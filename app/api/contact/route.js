import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { isValidEmail } from '@/utils/check-email';

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Best-effort Telegram notification; never throws.
async function sendTelegramMessage(token, chat_id, message) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, chat_id }),
    });
    if (!res.ok) {
      console.error('Telegram notification failed with status', res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
    return false;
  }
}

// HTML email template (all values are escaped before interpolation)
const generateEmailTemplate = (name, email, userMessage) => `
  <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; background-color: #f4f4f4;">
    <div style="max-width: 600px; margin: auto; background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);">
      <h2 style="color: #007BFF;">New Message Received</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Message:</strong></p>
      <blockquote style="border-left: 4px solid #007BFF; padding-left: 10px; margin-left: 0;">
        ${escapeHtml(userMessage).replace(/\r?\n/g, '<br>')}
      </blockquote>
      <p style="font-size: 12px; color: #888;">Click reply to respond to the sender.</p>
    </div>
  </div>
`;

const bad = (message) =>
  NextResponse.json({ success: false, message }, { status: 400 });

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return bad('Invalid request body.');
  }

  if (!payload || typeof payload !== 'object') {
    return bad('Invalid request body.');
  }

  // Honeypot: bots fill hidden fields. Pretend success, send nothing.
  if (typeof payload.company === 'string' && payload.company.trim() !== '') {
    return NextResponse.json({ success: true, message: 'Message sent successfully!' }, { status: 200 });
  }

  const { name, email, message } = payload;
  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return bad('Name, email and message must be text.');
  }
  const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanMessage = message.trim();

  if (!cleanName || !cleanEmail || !cleanMessage) {
    return bad('Name, email and message are required.');
  }
  if (cleanName.length > 100) return bad('Name must be 100 characters or fewer.');
  if (cleanEmail.length > 100) return bad('Email must be 100 characters or fewer.');
  if (!isValidEmail(cleanEmail)) return bad('Please provide a valid email.');
  if (cleanMessage.length > 2000) return bad('Message must be 2000 characters or fewer.');

  const emailAddress = process.env.EMAIL_ADDRESS;
  const gmailPass = process.env.GMAIL_PASSKEY;
  if (!emailAddress || !gmailPass) {
    console.error('Contact API: EMAIL_ADDRESS or GMAIL_PASSKEY is not set.');
    return NextResponse.json(
      { success: false, message: 'Email service is not configured.' },
      { status: 500 }
    );
  }

  const plainText = `New message from ${cleanName}\n\nEmail: ${cleanEmail}\n\nMessage:\n\n${cleanMessage}\n`;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: emailAddress, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"Portfolio Contact" <${emailAddress}>`,
      to: emailAddress,
      subject: `New Message From ${cleanName.replace(/[\r\n]+/g, ' ')}`,
      text: plainText,
      html: generateEmailTemplate(cleanName, cleanEmail, cleanMessage),
      replyTo: cleanEmail,
    });
  } catch (error) {
    console.error('Error while sending email:', error.message);
    return NextResponse.json(
      { success: false, message: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }

  // Optional, best-effort Telegram notification; failure never fails the request.
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat_id = process.env.TELEGRAM_CHAT_ID;
  if (token && chat_id) {
    await sendTelegramMessage(token, chat_id, plainText);
  }

  return NextResponse.json(
    { success: true, message: 'Message sent successfully!' },
    { status: 200 }
  );
}
