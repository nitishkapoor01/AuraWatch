const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'aurawatch_fallback_secret_key_2026';
const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// Helper to normalize security answer
const normalizeAnswer = (answer) => answer.toLowerCase().trim();

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword, securityQuestion, securityAnswer } = req.body;

  if (!name || !email || !password || !confirmPassword || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  
  if (securityAnswer.length < 2) {
    return res.status(400).json({ message: 'Security answer must be at least 2 characters.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Check if email already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const answerHash = await bcrypt.hash(normalizeAnswer(securityAnswer), SALT_ROUNDS);

    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, security_question, security_answer_hash) VALUES (?, ?, ?, ?, ?)'
    ).run(name.trim(), cleanEmail, passwordHash, securityQuestion.trim(), answerHash);

    const token = jwt.sign(
      { id: result.lastInsertRowid, email: cleanEmail, name: name.trim() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: { id: result.lastInsertRowid, email: cleanEmail, name: name.trim(), role: 'user', avatar: 'red' }
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
       return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    res.status(500).json({ message: 'Failed to create account. Please try again.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // Check if account is locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const lockTimeLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return res.status(403).json({ message: `Account is temporarily locked due to too many failed attempts. Try again in ${lockTimeLeft} minutes.` });
  }

  try {
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      // Increment failed attempts
      const newAttempts = user.failed_login_attempts + 1;
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60000).toISOString();
        db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
          .run(newAttempts, lockedUntil, user.id);
        return res.status(403).json({ message: `Account locked due to too many failed attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.` });
      } else {
        db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(newAttempts, user.id);
        return res.status(401).json({ message: `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempts remaining.` });
      }
    }

    // Reset failed attempts on success
    if (user.failed_login_attempts > 0 || user.locked_until !== null) {
      db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role: user.role }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// Forgot Password - Step 1: Get Question
router.post('/forgot-password/question', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  const cleanEmail = email.toLowerCase().trim();
  const user = db.prepare('SELECT security_question FROM users WHERE email = ?').get(cleanEmail);

  if (!user) {
    // Return a generic success-looking response to prevent email enumeration attacks,
    // or just return the error. Since requirements say "System checks if user exists -> Show question", 
    // we'll return an error if not found.
    return res.status(404).json({ message: 'No account found with that email.' });
  }

  res.json({ question: user.security_question });
});

// Forgot Password - Step 2: Verify Answer
router.post('/forgot-password/verify', async (req, res) => {
  const { email, answer } = req.body;
  if (!email || !answer) return res.status(400).json({ message: 'Email and answer are required.' });

  const cleanEmail = email.toLowerCase().trim();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

  if (!user) return res.status(404).json({ message: 'User not found.' });

  // Rate limit check for forgot password (re-using login lock logic or custom logic)
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(403).json({ message: 'Account is locked. Try again later.' });
  }

  try {
    const match = await bcrypt.compare(normalizeAnswer(answer), user.security_answer_hash);
    if (!match) {
      const newAttempts = user.failed_login_attempts + 1;
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60000).toISOString();
        db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
          .run(newAttempts, lockedUntil, user.id);
        return res.status(403).json({ message: 'Account locked due to too many failed attempts.' });
      } else {
        db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(newAttempts, user.id);
        return res.status(401).json({ message: `Incorrect answer. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempts remaining.` });
      }
    }

    // Reset attempts on success
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    // Issue a temporary 15-minute token for password reset
    const resetToken = jwt.sign(
      { id: user.id, email: user.email, intent: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ message: 'Verification successful.', resetToken });
  } catch (error) {
    console.error('[Auth] Verify answer error:', error);
    res.status(500).json({ message: 'Verification failed.' });
  }
});

// Forgot Password - Step 3: Reset Password
router.post('/forgot-password/reset', async (req, res) => {
  const { resetToken, newPassword, confirmPassword } = req.body;

  if (!resetToken || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  try {
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    if (decoded.intent !== 'password_reset') {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, decoded.id);

    res.json({ message: 'Password has been successfully reset. You can now login.' });
  } catch (error) {
    console.error('[Auth] Password reset error:', error);
    res.status(401).json({ message: 'Invalid or expired reset token. Please start over.' });
  }
});


// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, avatar, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  res.json({ user });
});

// Update Avatar
router.put('/avatar', authMiddleware, (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ message: 'Avatar string is required.' });
  try {
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
    res.json({ message: 'Avatar updated successfully', avatar });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update avatar.' });
  }
});

// Get Logged-in User's Security Question
router.get('/my-security-question', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT security_question FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ question: user.security_question });
});

// Update Name (requires password OR security answer)
router.put('/update-name', authMiddleware, async (req, res) => {
  const { newName, password, securityAnswer } = req.body;

  if (!newName) {
    return res.status(400).json({ message: 'Name is required.' });
  }

  if (!password && !securityAnswer) {
    return res.status(400).json({ message: 'Either password or security answer is required.' });
  }

  if (newName.trim().length < 2) {
    return res.status(400).json({ message: 'Name must be at least 2 characters.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    let match = false;
    if (password) {
      match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ message: 'Incorrect password.' });
    } else if (securityAnswer) {
      const normalizedAnswer = securityAnswer.toLowerCase().trim();
      match = await bcrypt.compare(normalizedAnswer, user.security_answer_hash);
      if (!match) return res.status(401).json({ message: 'Incorrect security answer.' });
    }

    const trimmedName = newName.trim();
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(trimmedName, req.user.id);
    res.json({ message: 'Name updated successfully', name: trimmedName });
  } catch (error) {
    console.error('[Auth] Update name error:', error);
    res.status(500).json({ message: 'Failed to update name.' });
  }
});

// Change Password (logged-in user, requires current password OR security answer)
router.put('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, securityAnswer, newPassword, confirmPassword } = req.body;

  if ((!currentPassword && !securityAnswer) || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New passwords do not match.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    let match = false;
    if (currentPassword) {
      match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) return res.status(401).json({ message: 'Current password is incorrect.' });
    } else if (securityAnswer) {
      const normalizedAnswer = securityAnswer.toLowerCase().trim();
      match = await bcrypt.compare(normalizedAnswer, user.security_answer_hash);
      if (!match) return res.status(401).json({ message: 'Incorrect security answer.' });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
    res.json({ message: 'Password changed successfully!' });
  } catch (error) {
    console.error('[Auth] Change password error:', error);
    res.status(500).json({ message: 'Failed to change password.' });
  }
});

// Configure Multer for File Uploads
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/avatars'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// Upload Custom Avatar
router.post('/avatar-upload', authMiddleware, upload.single('avatarFile'), (req, res) => {
  console.log('[Auth] Avatar upload request received');
  if (!req.file) {
    console.log('[Auth] No file provided in upload request');
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  console.log('[Auth] File received:', req.file.filename);

  try {
    const avatarUrl = `http://localhost:5000/uploads/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.user.id);
    console.log('[Auth] Avatar updated in DB:', avatarUrl);
    res.json({ message: 'Avatar uploaded successfully', avatar: avatarUrl });
  } catch (error) {
    console.error('[Auth] Avatar upload error:', error);
    res.status(500).json({ message: 'Failed to save avatar.' });
  }
});

module.exports = router;
