/**
 * NestJS interceptor for GDPR data-access audit logging.
 *
 * When applied to endpoints decorated with @AuditDataAccess(), creates an
 * immutable AuditLog entry recording who accessed patient data, when, and from where.
 *
 * Ref: OWASP Logging Cheat Sheet — "log access to sensitive data."
 *   https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Observable, tap } from 'rxjs';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { AUDIT_DATA_ACCESS_KEY } from './audit-data-access.decorator';

@Injectable()
export class GdprAuditInterceptor implements NestInterceptor {
/**
 * Constructor for GdprAuditInterceptor.
 * @param {Reflector} reflector - Utility for reflection-based operations.
 * @param {Model<AuditLogDocument>} auditLogModel - Mongoose model for AuditLog documents.
 */
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Intercepts incoming HTTP requests and applies GDPR data-access audit logging.
   *
   * If the handler is decorated with @AuditDataAccess(), creates an immutable
   * AuditLog entry recording who accessed patient data, when, and from where.
   * The generated audit log entry includes the accessed entity type, entity ID (if applicable),
   * the client IP address, and the client user agent.
   *
   * Ref: OWASP Logging cheat Sheet — "log access to sensitive data."
   *   https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const entityType = this.reflector.get<string>(
      AUDIT_DATA_ACCESS_KEY,
      context.getHandler(),
    );

    if (!entityType) return next.handle();

    const request = context.switchToHttp().getRequest();
    const entityId = request.params?.id ?? request.params?.leadId ?? undefined;
    const ipAddress = request.ip ?? request.headers?.['x-forwarded-for'];
    const userAgent = request.headers?.['user-agent'];

    return next.handle().pipe(
      tap(() => {
        // Fire-and-forget — audit logging should not block the response
        this.auditLogModel
          .create({
            action: 'data.accessed',
            entityType,
            entityId,
            ipAddress,
            userAgent,
            severity: 'info',
          })
          .catch(() => {
            // Silently fail — audit failures must not break the API
          });
      }),
    );
  }
}
