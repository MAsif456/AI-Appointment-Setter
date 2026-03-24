import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { createHash } from 'crypto';
import { IdempotencyKey, IdempotencyKeyDocument } from './idempotency-key.schema';

/**
 * NestJS interceptor implementing the Idempotency-Key HTTP header pattern
 * (IETF draft-ietf-httpapi-idempotency-key-header-07).
 *
 * When a request includes an `Idempotency-Key` header:
 *  1. If the key has been seen before AND the payload hash matches,
 *     the cached response is returned without re-executing the handler.
 *  2. If the key has been seen but the payload differs, a 409 Conflict is thrown
 *     (prevents key reuse with different data).
 *  3. If the key is new, the handler executes and the result is cached.
 *
 * Requests without the header pass through unmodified.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

/**
 * Constructor for IdempotencyInterceptor.
 * @param {Model<IdempotencyKeyDocument>} idempotencyModel - Mongoose model for idempotency keys.
 */
  constructor(
    @InjectModel(IdempotencyKey.name)
    private readonly idempotencyModel: Model<IdempotencyKeyDocument>,
  ) {}

  /**
   * Intercepts incoming HTTP requests and applies the Idempotency-Key pattern.
   * If the request includes an `Idempotency-Key` header, checks if the key has been seen before.
   * If the key has been seen and the payload hash matches, returns the cached response.
   * If the key has been seen but the payload hash differs, throws a 409 Conflict.
   * If the key is new, executes the handler and caches the result.
   *
   * Requests without the `Idempotency-Key` header pass through unmodified.
   * @param {ExecutionContext} context - The execution context of the request.
   * @param {CallHandler} next - The next handler in the interceptor chain.
   * @returns {Observable<any>} - The result of the request, potentially cached or re-executed.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    const payloadHash = this.hashPayload(request.body);

    return from(this.idempotencyModel.findOne({ key: idempotencyKey })).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            this.logger.warn(
              `Idempotency key ${idempotencyKey} reused with different payload`,
            );
            throw new ConflictException(
              'Idempotency key has already been used with a different request body',
            );
          }
          this.logger.log(
            `Returning cached response for idempotency key ${idempotencyKey}`,
          );
          return of(existing.response);
        }

        return next.handle().pipe(
          tap(async (response) => {
            try {
              await this.idempotencyModel.create({
                key: idempotencyKey,
                payloadHash,
                response,
              });
            } catch (err) {
              // Duplicate key race condition - safe to ignore
              if (err?.code !== 11000) {
                this.logger.error(`Failed to store idempotency key: ${err.message}`);
              }
            }
          }),
        );
      }),
    );
  }

  /**
   * Hashes a given request body into a SHA256 hexadecimal string.
   * Used to store and compare idempotency keys.
   * @param {any} body - The request body to hash (or null/undefined).
   * @returns {string} - The hashed request body as a SHA256 hexadecimal string.
   */
  private hashPayload(body: any): string {
    return createHash('sha256')
      .update(JSON.stringify(body ?? {}))
      .digest('hex');
  }
}
