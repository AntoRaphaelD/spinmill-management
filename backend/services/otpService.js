const axios = require('axios');
const crypto = require('crypto');

const normalizeMobile = (value) => String(value || '').replace(/[^\d]/g, '').slice(-10);

const isValidMobile = (value) => /^[6-9]\d{9}$/.test(normalizeMobile(value));

const createOtp = () => String(crypto.randomInt(100000, 1000000));

const hashOtp = (otp, salt) =>
  crypto.pbkdf2Sync(String(otp), salt, 80000, 32, 'sha256').toString('hex');

const formatIndianMobile = (mobile) => {
  const countryCode = process.env.SMS_COUNTRY_CODE || '91';
  return `${countryCode}${normalizeMobile(mobile)}`;
};

const sendViaFast2Sms = async ({ mobile, otp, message }) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) throw new Error('FAST2SMS_API_KEY is missing in backend/.env.');

  await axios.post('https://www.fast2sms.com/dev/bulkV2', {
    route: process.env.FAST2SMS_ROUTE || 'q',
    message,
    language: 'english',
    flash: 0,
    numbers: normalizeMobile(mobile)
  }, {
    headers: { authorization: apiKey },
    timeout: Number(process.env.SMS_TIMEOUT || 15000)
  });
};

const sendViaTwilio = async ({ mobile, message }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!accountSid || !authToken || !from) {
    throw new Error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM are required in backend/.env.');
  }

  const body = new URLSearchParams({
    From: from,
    To: `+${formatIndianMobile(mobile)}`,
    Body: message
  });

  await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, body, {
    auth: { username: accountSid, password: authToken },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: Number(process.env.SMS_TIMEOUT || 15000)
  });
};

const sendViaWebhook = async ({ mobile, otp, message }) => {
  const webhookUrl = process.env.SMS_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('SMS_WEBHOOK_URL is missing in backend/.env.');

  await axios.post(webhookUrl, {
    mobile: normalizeMobile(mobile),
    international_mobile: `+${formatIndianMobile(mobile)}`,
    otp,
    message
  }, {
    headers: process.env.SMS_WEBHOOK_TOKEN
      ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` }
      : undefined,
    timeout: Number(process.env.SMS_TIMEOUT || 15000)
  });
};

const sendOtpSms = async ({ mobile, otp }) => {
  const provider = String(process.env.SMS_PROVIDER || '').toLowerCase();
  const message = `Your Kayaar ERP verification OTP is ${otp}. It expires in 10 minutes.`;

  if (provider === 'fast2sms') {
    await sendViaFast2Sms({ mobile, otp, message });
    return { delivered: true };
  }

  if (provider === 'twilio') {
    await sendViaTwilio({ mobile, message });
    return { delivered: true };
  }

  if (provider === 'webhook' || process.env.SMS_WEBHOOK_URL) {
    await sendViaWebhook({ mobile, otp, message });
    return { delivered: true };
  }

  console.log(`Test OTP for ${mobile}: ${otp}`);
  return { delivered: false, devOtp: otp };
};

module.exports = {
  normalizeMobile,
  isValidMobile,
  createOtp,
  hashOtp,
  sendOtpSms
};
