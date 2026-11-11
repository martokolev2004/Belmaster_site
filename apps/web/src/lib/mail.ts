import 'server-only';
import nodemailer from 'nodemailer';
import { prisma } from './db';

/** Адрес на сайта за линковете в имейлите. */
export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

const FROM = process.env.MAIL_FROM ?? 'БЕЛ Мастър <noreply@belmaster.eu>';

function transport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
  });
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * Праща имейл с бутон-линк. Без настроена поща (SMTP_HOST) нищо не се праща,
 * но се записва в дневника — админът вижда линка в „Админ → Имейли“.
 */
export async function sendMail(to: string, subject: string, lines: string[], button?: { text: string; url: string }) {
  const text = [...lines, ...(button ? ['', `${button.text}: ${button.url}`] : []), '', '— БЕЛ Мастър'].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1f1f1f;max-width:520px">
<p style="font-size:22px;font-weight:bold;color:#1cb0f6">БЕЛ Мастър</p>
${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
${button ? `<p><a href="${esc(button.url)}" style="display:inline-block;background:#58cc02;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px">${esc(button.text)}</a></p><p style="font-size:13px;color:#777">Ако бутонът не работи, отвори: ${esc(button.url)}</p>` : ''}
<p style="font-size:13px;color:#777">Ако не си очаквал този имейл, просто го игнорирай.</p></div>`;
  const t = transport();
  if (!t) {
    await prisma.mailLog.create({ data: { to, subject, link: button?.url, status: 'skipped' } });
    console.log(`[mail] (не е настроена поща) ${to} · ${subject} · ${button?.url ?? ''}`);
    return;
  }
  try {
    await t.sendMail({ from: FROM, to, subject, text, html });
    await prisma.mailLog.create({ data: { to, subject, link: button?.url, status: 'sent' } });
  } catch (e) {
    await prisma.mailLog.create({ data: { to, subject, link: button?.url, status: 'error', error: String(e).slice(0, 500) } });
  }
}
