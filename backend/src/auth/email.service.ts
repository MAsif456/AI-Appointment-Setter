import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Handles all transactional emails for the auth flow.
 * Uses token-based links instead of numeric codes for verification and password reset.
 *
 * Transport security is controlled by environment variables:
 *   EMAIL_PORT=465  → implicit TLS (secure: true)
 *   EMAIL_PORT=587  → STARTTLS enforced (requireTLS: true)
 *   EMAIL_SECURE=true  → override to implicit TLS regardless of port
 *   EMAIL_REQUIRE_TLS=true → override to force STARTTLS regardless of port
 * Local dev (e.g. Mailhog on port 1025) uses neither flag — plaintext is
 * acceptable inside a local network but must never reach production.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('EMAIL_HOST') || 'smtp.gmail.com';
    const port = parseInt(this.configService.get<string>('EMAIL_PORT') || '587', 10);
    const secureEnv = this.configService.get<string>('EMAIL_SECURE');
    const requireTlsEnv = this.configService.get<string>('EMAIL_REQUIRE_TLS');

    // Determine TLS mode — explicit env vars take precedence over port heuristics
    let secure = false;
    let requireTLS = false;

    if (secureEnv === 'true') {
      secure = true;
    } else if (requireTlsEnv === 'true') {
      requireTLS = true;
    } else if (port === 465) {
      // Port 465 is the implicit-TLS SMTPS port
      secure = true;
    } else if (port === 587) {
      // Port 587 is the submission port; STARTTLS must be required (not optional)
      // to prevent STARTTLS-stripping downgrade attacks
      requireTLS = true;
    }
    // Ports outside 25/465/587 (e.g. 1025 for local Mailhog) get neither flag,
    // which is intentional for local-dev-only use.

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  /**
   * Startup validation — logs an error if EMAIL_PORT=25 is used outside of
   * development/test environments, where plaintext SMTP is never acceptable.
   */
  onModuleInit(): void {
    const port = parseInt(this.configService.get<string>('EMAIL_PORT') || '587', 10);
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    if (port === 25 && nodeEnv !== 'development' && nodeEnv !== 'test') {
      this.logger.error(
        'EMAIL_PORT=25 transmits credentials and message content in plaintext. ' +
        'Use port 587 (STARTTLS) or port 465 (implicit TLS) in production.',
      );
    }
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