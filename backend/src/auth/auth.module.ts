import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthThrottleService } from "./auth-throttle.service";
import { User, UserSchema } from "../database/schemas/user.schema";
import {
  LoginAttempt,
  LoginAttemptSchema,
} from "./schemas/login-attempt.schema";
import { AnalyticsModule } from "../analytics/analytics.module";

/**
 * Authentication module.
 * Provides login endpoint with IP-based throttling, progressive
 * penalties, and cross-IP account-level brute force protection.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: LoginAttempt.name, schema: LoginAttemptSchema },
    ]),
    AnalyticsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthThrottleService],
})
export class AuthModule {}
