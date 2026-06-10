const express = require('express');
const crypto = require('crypto');
const { User } = require('../models');
const { writeAuditLog } = require('../services/auditService');
const {
  normalizeMobile,
  isValidMobile,
  createOtp,
  hashOtp,
  sendOtpSms
} = require('../services/otpService');

const router = express.Router();

const hashPassword = (password, salt) =>
  crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  mobile_no: user.mobile_no || null
});

const requireUsernameAndPassword = (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    res.status(400).json({ message: 'Username and password are required.' });
    return null;
  }

  if (username.length < 3) {
    res.status(400).json({ message: 'Username must be at least 3 characters.' });
    return null;
  }

  if (password.length < 4) {
    res.status(400).json({ message: 'Password must be at least 4 characters.' });
    return null;
  }

  return { username, password };
};

const requireSignupInput = (req, res) => {
  const credentials = requireUsernameAndPassword(req, res);
  if (!credentials) return null;

  const mobile_no = normalizeMobile(req.body.mobile_no);
  if (!isValidMobile(mobile_no)) {
    res.status(400).json({ message: 'Enter a valid 10 digit mobile number.' });
    return null;
  }

  return { ...credentials, mobile_no };
};

router.post('/signup/request-otp', async (req, res) => {
  try {
    const data = requireSignupInput(req, res);
    if (!data) return;

    const existingUsername = await User.findOne({ where: { username: data.username } });
    if (existingUsername) {
      return res.status(409).json({ message: 'Username is already taken.' });
    }

    const existingMobile = await User.findOne({ where: { mobile_no: data.mobile_no } });
    if (existingMobile && existingMobile.otp_verified_at) {
      return res.status(409).json({ message: 'Mobile number is already registered.' });
    }

    const otp = createOtp();
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const [user, created] = await User.findOrCreate({
      where: { mobile_no: data.mobile_no },
      defaults: {
        username: data.username,
        mobile_no: data.mobile_no,
        password_salt: passwordSalt,
        password_hash: hashPassword(data.password, passwordSalt),
        otp_salt: salt,
        otp_hash: hashOtp(otp, salt),
        otp_expires_at: expiresAt
      }
    });

    if (!created) {
      if (user.otp_verified_at) {
        return res.status(409).json({ message: 'Mobile number is already registered.' });
      }

      await user.update({
        username: data.username,
        password_salt: passwordSalt,
        password_hash: hashPassword(data.password, passwordSalt),
        otp_salt: salt,
        otp_hash: hashOtp(otp, salt),
        otp_expires_at: expiresAt
      });
    }

    const delivery = await sendOtpSms({ mobile: data.mobile_no, otp });
    res.json({
      success: true,
      message: delivery.delivered ? 'OTP sent to mobile number.' : 'Test OTP generated. Use the code shown on screen.',
      mobile_no: data.mobile_no,
      devOtp: delivery.devOtp
    });
  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({ message: 'Unable to send OTP.' });
  }
});

router.post('/signup/verify-otp', async (req, res) => {
  try {
    const mobile_no = normalizeMobile(req.body.mobile_no);
    const otp = String(req.body.otp || '').trim();

    if (!isValidMobile(mobile_no) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: 'Valid mobile number and 6 digit OTP are required.' });
    }

    const user = await User.findOne({ where: { mobile_no } });
    if (!user || !user.otp_hash || !user.otp_salt) {
      return res.status(400).json({ message: 'Request OTP before verification.' });
    }

    if (user.otp_expires_at && new Date(user.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' });
    }

    const attemptedHash = hashOtp(otp, user.otp_salt);
    const attemptedBuffer = Buffer.from(attemptedHash, 'hex');
    const savedBuffer = Buffer.from(user.otp_hash, 'hex');
    const matches = attemptedBuffer.length === savedBuffer.length
      && crypto.timingSafeEqual(attemptedBuffer, savedBuffer);

    if (!matches) {
      return res.status(401).json({ message: 'Invalid OTP.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await user.update({
      session_token: token,
      otp_hash: null,
      otp_salt: null,
      otp_expires_at: null,
      otp_verified_at: new Date()
    });

    await writeAuditLog(req, {
      user: publicUser(user),
      action: 'OTP_SIGNUP',
      entity: 'auth',
      status: 'SUCCESS',
      status_code: 201,
      details: { username: user.username, mobile_no: user.mobile_no }
    });

    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Unable to verify OTP.' });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const credentials = requireSignupInput(req, res);
    if (!credentials) return;

    const existing = await User.findOne({ where: { username: credentials.username } });
    if (existing) {
      return res.status(409).json({ message: 'Username is already taken.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const token = crypto.randomBytes(32).toString('hex');
    const user = await User.create({
      username: credentials.username,
      mobile_no: credentials.mobile_no,
      otp_verified_at: new Date(),
      password_salt: salt,
      password_hash: hashPassword(credentials.password, salt),
      session_token: token
    });

    await writeAuditLog(req, {
      user: publicUser(user),
      action: 'SIGNUP',
      entity: 'auth',
      status: 'SUCCESS',
      status_code: 201,
      details: { username: user.username }
    });

    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Unable to create account.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const credentials = requireUsernameAndPassword(req, res);
    if (!credentials) return;

    const user = await User.findOne({ where: { username: credentials.username } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const attemptedHash = hashPassword(credentials.password, user.password_salt);
    const attemptedBuffer = Buffer.from(attemptedHash, 'hex');
    const savedBuffer = Buffer.from(user.password_hash, 'hex');
    const matches = attemptedBuffer.length === savedBuffer.length
      && crypto.timingSafeEqual(attemptedBuffer, savedBuffer);

    if (!matches) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await user.update({ session_token: token });

    await writeAuditLog(req, {
      user: publicUser(user),
      action: 'LOGIN',
      entity: 'auth',
      status: 'SUCCESS',
      status_code: 200,
      details: { username: user.username }
    });

    res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Unable to login.' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      return res.status(401).json({ message: 'Login required.' });
    }

    const user = await User.findOne({ where: { session_token: token } });
    if (!user) {
      return res.status(401).json({ message: 'Session expired.' });
    }

    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({ message: 'Unable to verify session.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token) {
      const user = await User.findOne({ where: { session_token: token } });
      await User.update({ session_token: null }, { where: { session_token: token } });
      if (user) {
        await writeAuditLog(req, {
          user: publicUser(user),
          action: 'LOGOUT',
          entity: 'auth',
          status: 'SUCCESS',
          status_code: 200,
          details: { username: user.username }
        });
      }
    }

    res.json({ message: 'Logged out.' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Unable to logout.' });
  }
});

module.exports = router;
