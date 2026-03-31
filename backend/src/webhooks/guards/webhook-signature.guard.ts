import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RawBodyRequest } from "@nestjs/common";
import { Request } from "express";
import {
  GHL_SIGNATURE_HEADER,
  HMAC_SIGNATURE_HEADER,
  GHL_WEBHOOK_SECRET_ENV,
} from "../constants/webhook.constants";
import { verifyEd25519Signature } from "./ed25519-verifier";
import { verifyHmacSignature } from "./hmac-verifier";

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);
  private readonly hmacSecret: string;

  /**
   * Creates a new instance of the WebhookSignatureGuard.
   * @param {ConfigService} configService - The ConfigService instance.
   */
  constructor(private readonly configService: ConfigService) {
    this.hmacSecret =
      this.configService.get<string>(GHL_WEBHOOK_SECRET_ENV) ?? "";
  }

  /**
   * Determines whether the incoming request can be processed based on
   * the presence of a valid webhook signature.
   *
   * If the request contains a valid Ed25519 signature, it is allowed.
   * If the request contains a valid HMAC signature and the webhook secret
   * is configured, it is allowed. If the webhook secret is not
   * configured, the request is allowed but a warning is logged.
   * If neither signature is present, an UnauthorizedException is thrown.
   *
   * @param {ExecutionContext} context - The ExecutionContext instance.
   * @returns {boolean} true if the request can be processed, false otherwise.
   */
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const ghlSignature = req.headers[GHL_SIGNATURE_HEADER] as
      | string
      | undefined;
    const hmacSignature = req.headers[HMAC_SIGNATURE_HEADER] as
      | string
      | undefined;

    if (ghlSignature) {
      return this.handleEd25519(req, ghlSignature);
    }

    if (hmacSignature) {
      return this.handleHmac(req, hmacSignature);
    }

    if (!this.hmacSecret) {
      this.logger.warn(
        "No signature header present and no webhook secret configured — " +
          "signature verification disabled. Set GHL_WEBHOOK_SECRET to enable HMAC verification.",
      );
      return true;
    }

    this.logger.warn(
      "Webhook rejected: no signature header present " +
        `(expected ${GHL_SIGNATURE_HEADER} or ${HMAC_SIGNATURE_HEADER})`,
    );
    throw new UnauthorizedException("Missing webhook signature");
  }

  /**
   * Ensures that the request body is available as a Buffer.
   * If the body is not available, an UnauthorizedException is thrown.
   * @param {RawBodyRequest<Request>} req - The request to check.
   * @returns {Buffer} The request body as a Buffer.
   * @throws {UnauthorizedException} If the request body is not available.
   */
  private requireRawBody(req: RawBodyRequest<Request>): Buffer {
    if (!req.rawBody) {
      this.logger.error(
        "rawBody not available — ensure rawBody: true in NestFactory.create()",
      );
      throw new UnauthorizedException("Cannot verify webhook signature");
    }
    return req.rawBody;
  }

  /**
   * Verifies the Ed25519 signature of the incoming request.
   * If the signature is invalid, an UnauthorizedException is thrown.
   * @returns {boolean} true if the signature is valid, false otherwise.
   */
  private handleEd25519(
    req: RawBodyRequest<Request>,
    signature: string,
  ): boolean {
    const rawBody = this.requireRawBody(req);
    if (!verifyEd25519Signature(rawBody, signature)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
    return true;
  }

  /**
   * Verifies the HMAC signature of the incoming request.
   * If the signature is invalid or the GHL_WEBHOOK_SECRET is not configured,
   * an UnauthorizedException is thrown.
   * @param {RawBodyRequest<Request>} req - The request to check.
   * @param {string} signature - The HMAC signature to verify.
   * @returns {boolean} true if the signature is valid, false otherwise.
   * @throws {UnauthorizedException} If the signature is invalid or the GHL_WEBHOOK_SECRET is not configured.
   */
  private handleHmac(req: RawBodyRequest<Request>, signature: string): boolean {
    const rawBody = this.requireRawBody(req);

    if (!this.hmacSecret) {
      this.logger.warn(
        `${HMAC_SIGNATURE_HEADER} header present but GHL_WEBHOOK_SECRET not configured`,
      );
      throw new UnauthorizedException(
        "Webhook signature verification not configured",
      );
    }

    const result = verifyHmacSignature(
      rawBody,
      signature,
      req.headers,
      this.hmacSecret,
    );

    if (!result.valid) {
      throw new UnauthorizedException(
        result.reason ?? "Invalid webhook signature",
      );
    }

    return true;
  }
}
