const nodemailer = require('nodemailer');

// Set up transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
});

const sendOTP = async (toEmail, otp) => {
  // If no email configured, just log to console (Dev mode)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`\n=================================================`);
    console.log(`[DEV MODE] 🚀 MOCK EMAIL SENT`);
    console.log(`To: ${toEmail}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`=================================================\n`);
    return true;
  }

  const mailOptions = {
    from: `"AuraWatch" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your AuraWatch Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #141414; color: white; border-radius: 8px;">
        <h1 style="color: #e50914;">AuraWatch</h1>
        <h2>Account Verification</h2>
        <p style="font-size: 16px;">Here is your One-Time Password (OTP) to complete your registration:</p>
        <div style="font-size: 32px; font-weight: bold; margin: 20px 0; padding: 10px; background-color: #333; display: inline-block; border-radius: 4px; letter-spacing: 4px;">
          ${otp}
        </div>
        <p style="font-size: 14px; color: #999;">This code will expire in 10 minutes.</p>
        <p style="font-size: 12px; color: #666; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send OTP:', error);
    throw new Error('Failed to send email. Please try again later.');
  }
};

module.exports = { sendOTP };
