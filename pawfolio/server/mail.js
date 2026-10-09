import nodemailer from 'nodemailer';
export function resetMailConfigured() {
  return contactMailConfigured() && Boolean(process.env.CLIENT_ORIGIN);
}
export function contactMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM,
  );
}
function mailTransport() {
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}
export function logMailFailure(context, error) {
  const safeCode = (value) =>
    typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value)
      ? value
      : 'unknown';
  console.error('Email delivery failed', {
    context,
    code: safeCode(error?.code),
    command: safeCode(error?.command),
    responseCode: Number.isInteger(error?.responseCode)
      ? error.responseCode
      : null,
  });
}
export async function sendResetEmail(email, token) {
  const transporter = mailTransport();
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: 'Your Pawfolio password-reset code',
    text: `Your Pawfolio password-reset code is:\n\n${token}\n\nThis code expires in 10 minutes and can be used once. Enter it on the Pawfolio password reset screen. If you did not request it, you can ignore this email.`,
  });
}
export async function sendContactEmail({
  name,
  email,
  topic,
  subject,
  message,
}) {
  await mailTransport().sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.CONTACT_TO || 'pawfolio.2026@gmail.com',
    replyTo: email,
    subject: `Pawfolio contact: ${subject}`,
    text: `From: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`,
  });
}
