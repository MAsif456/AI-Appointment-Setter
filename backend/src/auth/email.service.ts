import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendVerificationEmail(email: string, code: string) {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@appointhealth.com',
      to: email,
      subject: 'Verify your AppointHealth AI account',
      html: `
        <h2>Welcome to AppointHealth AI!</h2>
        <p>Your verification code is: <strong>${code}</strong></p>
        <p>This code will expire in 15 minutes.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, code: string) {
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@appointhealth.com',
      to: email,
      subject: 'Reset your password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Your password reset code is: <strong>${code}</strong></p>
        <p>This code will expire in 15 minutes.</p>
      `,
    });
  }
}