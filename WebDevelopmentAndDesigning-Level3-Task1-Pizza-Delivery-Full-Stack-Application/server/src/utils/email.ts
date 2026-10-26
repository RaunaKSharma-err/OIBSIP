import nodemailer, { type Transporter } from 'nodemailer';
import { env, smtpConfigured } from '../config/env';
import { logger } from './logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
export interface MailResult {
  /** true ONLY when an SMTP server accepted the message. */
  delivered: boolean;
  mode: 'smtp' | 'preview';
  messageId?: string;
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Sends an email via SMTP. Without SMTP credentials this runs in PREVIEW mode: nothing is sent,
 * `delivered` is false, and (development only) the message body is logged so links can be tested.
 * Throws when SMTP is configured but delivery fails.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  if (!smtpConfigured) {
    logger.warn('SMTP not configured: email NOT sent (preview mode)', { to: msg.to, subject: msg.subject });
    if (env.NODE_ENV === 'development') logger.info('Email preview', { body: msg.text });
    return { delivered: false, mode: 'preview' };
  }
  const info = await getTransporter().sendMail({ from: env.EMAIL_FROM, ...msg });
  logger.info('Email sent', { to: msg.to, subject: msg.subject, messageId: info.messageId });
  return { delivered: true, mode: 'smtp', messageId: info.messageId };
}
