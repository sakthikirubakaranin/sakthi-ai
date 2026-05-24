import nodemailer from './node_modules/nodemailer/lib/nodemailer.js';

const t = nodemailer.createTransport({
  host: 'smtppro.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: 'sakthi.kirubakaran@sakthikirubakaran.in',
    pass: 'jA0ts66DEsX7'
  }
});

t.verify((err, success) => {
  if (err) console.log('FAILED:', err.message);
  else console.log('SUCCESS: SMTP connection works!');
});
