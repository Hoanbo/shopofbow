const nodemailer = require('nodemailer');
const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.startsWith('#')) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const SMTP_HOST = env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(env.SMTP_PORT || '465', 10);
const SMTP_USER = env.SMTP_USER || 'hoankb4@gmail.com';
const SMTP_PASS = env.SMTP_PASS;

console.log('Testing SMTP connection...');
console.log('SMTP_USER:', SMTP_USER);
console.log('SMTP_PASS exists:', !!SMTP_PASS);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

transporter.sendMail({
  from: `"BOW Shop" <${SMTP_USER}>`,
  to: 'hoankb4@gmail.com',
  subject: 'Test Email from BOW Shop',
  text: 'This is a test email.',
}).then((info) => {
  console.log('SUCCESS! MessageId:', info.messageId);
}).catch((err) => {
  console.error('ERROR sending email:', err);
});
