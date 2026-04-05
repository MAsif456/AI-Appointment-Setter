import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

/**
 * Authentication controller.
 * Exposes login endpoint with IP-based and account-level throttling.
 */
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticates a user with email and password.
   * Returns user data on success, or a generic error on failure.
   * Rate limited by both the global guard and the auth throttle service.
   *
   * @param dto - The login credentials.
   * @param req - The Express request (for IP extraction).
   * @returns An object with userId, email, and role.
   */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    this.logger.log(`Login attempt for ${dto.email} from IP ${ip}`);
    return this.authService.login(dto, ip);
  }
}
