import {
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import { User, UserDocument } from "../database/schemas/user.schema";
import { AuthThrottleService } from "./auth-throttle.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly authThrottleService: AuthThrottleService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Validates user credentials and returns a safe user object on success.
   * Uses generic error messages ("Invalid credentials") to prevent account
   * enumeration — the same message is returned whether the email does not
   * exist, the password is wrong, or the account is inactive/locked.
   *
   * @param dto - The login DTO containing email and password.
   * @param ip - The client IP address for throttle tracking.
   * @returns An object with userId, email, and role on success.
   * @throws UnauthorizedException with "Invalid credentials" on any failure.
   * @throws HttpException(429) if the IP or account is throttled.
   */
  async login(
    dto: LoginDto,
    ip: string,
  ): Promise<{ userId: string; email: string; role: string }> {
    // Check throttle state before doing any credential work
    await this.authThrottleService.checkThrottle(ip, dto.email);

    const user = await this.userModel.findOne({ email: dto.email });

    // User not found — record failure, return generic error
    if (!user) {
      await this.authThrottleService.recordFailure(ip, dto.email);
      this.logger.warn(`Login failed: unknown email from IP ${ip}`);
      throw new UnauthorizedException("Invalid credentials");
    }

    // Inactive account — same generic error
    if (!user.isActive) {
      await this.authThrottleService.recordFailure(ip, dto.email);
      this.logger.warn(`Login failed: inactive account ${dto.email}`);
      throw new UnauthorizedException("Invalid credentials");
    }

    // Password mismatch — same generic error
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.authThrottleService.recordFailure(ip, dto.email);
      this.logger.warn(
        `Login failed: wrong password for ${dto.email} from IP ${ip}`,
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    // Success — clear failure counters, update lastLoginAt
    await this.authThrottleService.recordSuccess(ip, dto.email);
    await this.userModel.updateOne(
      { _id: user._id },
      { lastLoginAt: new Date() },
    );

    this.logger.log(`Login successful for ${dto.email}`);

    this.analyticsService.logSecurityEvent({
      eventType: "login_success",
      ip,
      email: dto.email,
      userId: (user._id as any).toString(),
      endpoint: "/auth/login",
      tier: "auth",
    });

    return {
      userId: (user._id as any).toString(),
      email: user.email,
      role: user.role,
    };
  }
}
