import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

type MailTransporter = ReturnType<typeof nodemailer.createTransport>;

let transporter: MailTransporter | null = null;

function getTransporter(): MailTransporter | null {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    try {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE, // true for 465, false for 587
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS
        }
      });
      console.log(`[EmailService] Transporter initialized for ${env.SMTP_HOST}:${env.SMTP_PORT}`);
    } catch (err: any) {
      console.error('[EmailService] Failed to initialize SMTP transporter:', err.message);
      transporter = null;
    }
  }
  return transporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Sends a generic email or logs to console if SMTP is unconfigured.
 */
export async function sendEmail(options: SendMailOptions): Promise<{ success: boolean; simulated?: boolean }> {
  const mailer = getTransporter();

  if (!mailer) {
    console.log('\n======================================================');
    console.log(' [EMAIL SIMULATION - SMTP NOT CONFIGURED]');
    console.log(` To:      ${options.to}`);
    console.log(` Subject: ${options.subject}`);
    console.log(` Content: ${options.text || '[HTML formatted message]'}`);
    console.log('======================================================\n');
    return { success: true, simulated: true };
  }

  try {
    await mailer.sendMail({
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    console.log(`[EmailService] Email successfully delivered to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[EmailService] Error dispatching mail to ${options.to}:`, error.message);
    // Fallback to console simulation on network error
    console.log('\n======================================================');
    console.log(' [EMAIL FALLBACK - DELIVERY FAILURE]');
    console.log(` To:      ${options.to}`);
    console.log(` Subject: ${options.subject}`);
    console.log(` Content: ${options.text || '[HTML formatted message]'}`);
    console.log('======================================================\n');
    return { success: false, simulated: true };
  }
}

/**
 * Sends an Archon Nell branded One-Time Password (OTP) verification email.
 */
export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: string,
  moduleName: string
): Promise<{ success: boolean; simulated?: boolean }> {
  const expiryMin = env.OTP_EXPIRATION_MINUTES;
  const readablePurpose = purpose.replace(/_/g, ' ').toUpperCase();
  const readableModule = moduleName.toUpperCase();

  const subject = `[${readableModule}] Your Archon Nell Verification Code: ${code}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Code</title>
      <style>
        body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
        .wrapper { width: 100%; max-width: 580px; margin: 30px auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; }
        .header { background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 32px 24px; text-align: center; border-bottom: 2px solid #3b82f6; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 1px; color: #ffffff; }
        .header p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; }
        .content { padding: 36px 32px; text-align: center; }
        .purpose-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background-color: #1e3a8a; color: #60a5fa; margin-bottom: 20px; }
        .code-container { background: #0f172a; border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px; margin: 24px 0; }
        .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #38bdf8; font-family: monospace; }
        .expiry-note { font-size: 13px; color: #94a3b8; margin-top: 10px; }
        .notice { font-size: 13px; color: #cbd5e1; line-height: 1.6; margin-top: 24px; border-top: 1px solid #334155; padding-top: 20px; text-align: left; }
        .footer { background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>ARCHON NELL</h1>
          <p>Industrial & Corporate Subsystem Gateway</p>
        </div>
        <div class="content">
          <div class="purpose-badge">${readableModule} • ${readablePurpose}</div>
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #ffffff;">Security Verification Code</h2>
          <p style="margin: 0; font-size: 14px; color: #94a3b8;">
            Please use the following single-use verification code to authenticate your request in the <strong>${readableModule}</strong> portal.
          </p>

          <div class="code-container">
            <div class="otp-code">${code}</div>
            <div class="expiry-note">⏱️ Code expires in <strong>${expiryMin} minutes</strong></div>
          </div>

          <div class="notice">
            <p style="margin: 0 0 8px;"><strong>Security Advisory:</strong></p>
            <ul style="margin: 0; padding-left: 20px; color: #94a3b8;">
              <li>Never disclose this verification code to anyone, including Archon Nell support staff.</li>
              <li>If you did not initiate this authentication request, please secure your credentials immediately.</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Archon Nell Incorporated. All rights reserved.<br>
          Sent automatically via Central Gateway. Do not reply to this email.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `[ARCHON NELL - ${readableModule}]\nYour verification code for ${readablePurpose} is: ${code}\nThis code is valid for ${expiryMin} minutes.\nNever share this code with anyone.`;

  return await sendEmail({
    to: email,
    subject,
    html,
    text
  });
}
