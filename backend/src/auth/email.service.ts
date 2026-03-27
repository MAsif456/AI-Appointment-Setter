import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Handles all transactional emails for the auth flow.
 * Uses token-based links instead of numeric codes for verification and password reset.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('EMAIL_HOST') || 'smtp.gmail.com',
      port: parseInt(this.configService.get('EMAIL_PORT') || '587'),
      secure: false,
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASS'),
      },
    });
  }

  /**
   * Sends a verification link to a newly created staff member.
   * The link points to the frontend /verify-email route with the token as a query param.
   * @param email - The staff member's email address
   * @param token - The secure random verification token
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const link = `${frontendUrl}/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get('EMAIL_FROM') || 'noreply@appointhealth.com',
      to: email,
      subject: 'Verify your AppointHealth AI account',
      html: `
        <h2>Welcome to AppointHealth AI!</h2>
        <p>An admin has created an account for you. Click the link below to verify your email and activate your account.</p>
        <p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">
          Verify Email
        </a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not expect this email, you can safely ignore it.</p>
      `,
    });

    this.logger.log(`Verification email sent to ${email}`);
  }

  /**
   * Sends a password reset link to a user who requested it.
   * The link points to the frontend /reset-password route with the token as a query param.
   * @param email - The user's email address
   * @param token - The secure random reset token
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const link = `${frontendUrl}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.configService.get('EMAIL_FROM') || 'noreply@appointhealth.com',
      to: email,
      subject: 'Reset your AppointHealth AI password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Click the link below to reset your password.</p>
        <p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;">
          Reset Password
        </a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
      `,
    });

    this.logger.log(`Password reset email sent to ${email}`);
  }
}