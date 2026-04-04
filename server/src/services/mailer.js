import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS
  }
})

export async function sendEmail({ to, subject, html }) {
  return transporter.sendMail({
    from: '"cofin ☕" <noreply@cofin.app>',
    to,
    subject,
    html
  })
}

export function settlementEmail({ partnerName, amount, settledBy }) {
  return {
    subject: `cofin — ${settledBy} settled $${amount.toFixed(2)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0e0e10;color:#f0ede8;border-radius:12px;">
        <h2 style="font-family:serif;color:#c8b89a;margin:0 0 16px;">☕ cofin</h2>
        <p style="margin:0 0 12px;">Hey ${partnerName},</p>
        <p style="margin:0 0 24px;"><strong>${settledBy}</strong> just marked <strong>$${amount.toFixed(2)}</strong> as settled.</p>
        <p style="color:#888784;font-size:13px;">Your joint balance has been updated.</p>
      </div>
    `
  }
}
