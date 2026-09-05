const nodemailer = require('nodemailer');

// Reads SMTP settings from .env — see the setup steps for what to put there.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT === '465', // true only for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendPasswordResetEmail(toEmail, resetLink) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Reset your Student Records System password',
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetLink}">Click here to set a new password</a></p>
      <p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
