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

// Seamlessly sync any guest Ad-Pass quest & active VIP status to registered user account
async function syncGuestVipQuest(userId, visitorId) {
  if (!userId || !visitorId) return;
  try {
    const cleanVid = String(visitorId).trim().slice(0, 100);
    if (!cleanVid) return;

    // Find any guest quest record for this visitor
    const questRes = await db.query(
      'SELECT * FROM ad_pass_quests WHERE visitor_id = $1 AND user_id IS NULL ORDER BY updated_at DESC LIMIT 1',
      [cleanVid]
    );

    if (questRes.rows.length > 0) {
      const guestQuest = questRes.rows[0];

      // Check if user already has an existing quest row
      const userQuestRes = await db.query(
        'SELECT * FROM ad_pass_quests WHERE user_id = $1',
        [userId]
      );

      if (userQuestRes.rows.length === 0) {
        // Link the guest quest directly to the user
        await db.query('UPDATE ad_pass_quests SET user_id = $1 WHERE id = $2', [userId, guestQuest.id]);
      } else {
        // Merge progress: take whichever has higher watch count or longer expiry
        const userQuest = userQuestRes.rows[0];
        const higherCount = Math.max(userQuest.current_count || 0, guestQuest.current_count || 0);
        let bestExpiry = userQuest.unlocked_until;
        if (guestQuest.unlocked_until) {
          if (!bestExpiry || new Date(guestQuest.unlocked_until) > new Date(bestExpiry)) {
            bestExpiry = guestQuest.unlocked_until;
          }
        }
        await db.query(
          'UPDATE ad_pass_quests SET current_count = $1, unlocked_until = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [higherCount, bestExpiry, userQuest.id]
        );
      }

      // If quest unlocked pass is currently active, activate user VIP membership
      if (guestQuest.unlocked_until && new Date(guestQuest.unlocked_until) > new Date()) {
        const userRow = await db.query('SELECT is_premium, premium_expires_at FROM users WHERE id = $1', [userId]);
        const user = userRow.rows[0];
        let targetExpiry = new Date(guestQuest.unlocked_until);
        if (user?.is_premium && user?.premium_expires_at && new Date(user.premium_expires_at) > targetExpiry) {
          targetExpiry = new Date(user.premium_expires_at);
        }
        await db.query(
          `UPDATE users
           SET is_premium = TRUE,
               premium_expires_at = $1,
               premium_plan = 'VIP Ad-Pass',
               premium_activated_by = 'ad_quest'
           WHERE id = $2`,
          [targetExpiry, userId]
        );
      }
    }
  } catch (err) {
    console.error('[Sync Guest VIP Quest] Non-fatal error:', err);
  }
}

const DEFAULT_UI_PREFERENCES = {
  theme: 'classic',
  layout: 'cinematic',
  density: 'comfortable',
  cardSize: 'large',
  fontSize: 16,
  heroSize: 'full',
  navStyle: 'glass',
  rowStyle: 'scroll',
  cardStyle: 'poster',
  animations: true,
  fontFamily: "'Inter', sans-serif",
  fontWeight: 'normal',
  lineHeight: 1.6,
  accentColor: '#e50914',
  buttonStyle: 'pill',
  glowEffects: false,
  headingFont: "'Inter', sans-serif",
  borderRadius: 12,
  contentWidth: 'full',
  transparency: 0.8,
  blurIntensity: 10,
  letterSpacing: 0,
  scrollbarStyle: 'thin',
  cardHoverEffect: 'scale',
  shadowIntensity: 0.5,
  sidebarPosition: 'left',
  backgroundEffect: 'none',
  presets: {
    preset1: {
      theme: 'classic',
      layout: 'cinematic',
      density: 'comfortable',
      cardSize: 'large',
      fontSize: 16,
      heroSize: 'full',
      navStyle: 'glass',
      rowStyle: 'scroll',
      cardStyle: 'poster',
      animations: true,
      fontFamily: "'Inter', sans-serif",
      fontWeight: 'normal',
      lineHeight: 1.6,
      accentColor: '#e50914',
      buttonStyle: 'pill',
      glowEffects: false,
      headingFont: "'Inter', sans-serif",
      borderRadius: 12,
      contentWidth: 'full',
      transparency: 0.8,
      blurIntensity: 10,
      letterSpacing: 0,
      scrollbarStyle: 'thin',
      cardHoverEffect: 'scale',
      shadowIntensity: 0.5,
      sidebarPosition: 'left',
      backgroundEffect: 'none'
    },
    preset2: null,
    preset3: null
  }
};

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword, securityQuestion, securityAnswer } = req.body;
  const visitorId = req.headers['x-visitor-id'] || req.body.visitor_id || null;

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
  const existingResult = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
  if (existingResult.rows.length > 0) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const answerHash = await bcrypt.hash(normalizeAnswer(securityAnswer), SALT_ROUNDS);

    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, security_question, security_answer_hash, ui_preferences) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name.trim(), cleanEmail, passwordHash, securityQuestion.trim(), answerHash, JSON.stringify(DEFAULT_UI_PREFERENCES)]
    );
    const newUserId = result.rows[0].id;

    // Seamlessly sync any guest quest / VIP pass they earned before signing up
    if (visitorId) {
      await syncGuestVipQuest(newUserId, visitorId);
    }

    // Fetch refreshed user status
    const freshUserRes = await db.query('SELECT is_premium, premium_expires_at, premium_plan FROM users WHERE id = $1', [newUserId]);
    const freshUser = freshUserRes.rows[0];

    const token = jwt.sign(
      { id: newUserId, email: cleanEmail, name: name.trim() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: {
        id: newUserId,
        email: cleanEmail,
        name: name.trim(),
        role: 'user',
        avatar: 'red',
        is_super_admin: false,
        admin_permissions: { all: false },
        ui_preferences: DEFAULT_UI_PREFERENCES,
        is_premium: freshUser?.is_premium || false,
        premium_expires_at: freshUser?.premium_expires_at || null,
        premium_plan: freshUser?.premium_plan || 'free'
      }
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    if (error.code === '23505') { // PostgreSQL unique constraint violation
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
  const userResult = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
  const user = userResult.rows[0];
  
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // Check if account is locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const lockTimeLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return res.status(403).json({ message: `Account is temporarily locked due to too many failed attempts. Try again in ${lockTimeLeft} minutes.` });
  }

  // Check if account is banned
  if (user.is_banned) {
    return res.status(403).json({ message: 'Your account has been permanently banned by an administrator.' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      // Increment failed attempts
      const newAttempts = user.failed_login_attempts + 1;
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60000).toISOString();
        await db.query('UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3', [newAttempts, lockedUntil, user.id]);
        await db.query('INSERT INTO login_logs (user_id, ip_address, success) VALUES ($1, $2, false)', [user.id, ip]);
        return res.status(403).json({ message: `Account locked due to too many failed attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes.` });
      } else {
        await db.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [newAttempts, user.id]);
        await db.query('INSERT INTO login_logs (user_id, ip_address, success) VALUES ($1, $2, false)', [user.id, ip]);
        return res.status(401).json({ message: `Invalid email or password. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempts remaining.` });
      }
    }

    await db.query('INSERT INTO login_logs (user_id, ip_address, success) VALUES ($1, $2, true)', [user.id, ip]);

    // Reset failed attempts on success
    if (user.failed_login_attempts > 0 || user.locked_until !== null) {
      await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const visitorId = req.headers['x-visitor-id'] || req.body.visitor_id || null;
    if (visitorId) {
      await syncGuestVipQuest(user.id, visitorId);
    }

    // Refresh user VIP status after possible guest sync
    const freshUserRes = await db.query('SELECT is_premium, premium_expires_at, premium_plan FROM users WHERE id = $1', [user.id]);
    const freshUser = freshUserRes.rows[0] || user;

    let isPremium = freshUser.is_premium || false;
    let expiresAt = freshUser.premium_expires_at;
    if (isPremium && expiresAt && new Date(expiresAt) < new Date()) {
      isPremium = false;
      await db.query('UPDATE users SET is_premium = FALSE WHERE id = $1', [user.id]).catch(() => {});
    }

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        is_super_admin: user.is_super_admin,
        admin_permissions: user.admin_permissions,
        ui_preferences: (user.ui_preferences && Object.keys(user.ui_preferences).length > 0) ? user.ui_preferences : DEFAULT_UI_PREFERENCES,
        is_premium: isPremium,
        premium_expires_at: expiresAt,
        premium_plan: freshUser.premium_plan || 'free'
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// Forgot Password - Step 1: Get Question
router.post('/forgot-password/question', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required.' });

  const cleanEmail = email.toLowerCase().trim();
  const userResult = await db.query('SELECT security_question FROM users WHERE email = $1', [cleanEmail]);
  const user = userResult.rows[0];

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
  const userResult = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
  const user = userResult.rows[0];

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
        await db.query('UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3', [newAttempts, lockedUntil, user.id]);
        return res.status(403).json({ message: 'Account locked due to too many failed attempts.' });
      } else {
        await db.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [newAttempts, user.id]);
        return res.status(401).json({ message: `Incorrect answer. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempts remaining.` });
      }
    }

    // Reset attempts on success
    await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);

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
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, decoded.id]);

    res.json({ message: 'Password has been successfully reset. You can now login.' });
  } catch (error) {
    console.error('[Auth] Password reset error:', error);
    res.status(401).json({ message: 'Invalid or expired reset token. Please start over.' });
  }
});


// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  const result = await db.query(
    'SELECT id, name, email, avatar, role, is_super_admin, admin_permissions, ui_preferences, is_premium, premium_expires_at, premium_plan FROM users WHERE id = $1',
    [req.user.id]
  );
    
  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'User not found' });
  }

  const user = result.rows[0];
  let isPremium = user.is_premium || false;
  const expiresAt = user.premium_expires_at;
  if (isPremium && expiresAt && new Date(expiresAt) < new Date()) {
    isPremium = false;
    await db.query('UPDATE users SET is_premium = FALSE WHERE id = $1', [user.id]).catch(() => {});
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      is_super_admin: user.is_super_admin,
      admin_permissions: user.admin_permissions,
      ui_preferences: (user.ui_preferences && Object.keys(user.ui_preferences).length > 0) ? user.ui_preferences : DEFAULT_UI_PREFERENCES,
      is_premium: isPremium,
      premium_expires_at: expiresAt,
      premium_plan: user.premium_plan || 'free'
    }
  });
});

// Update Avatar
router.put('/avatar', authMiddleware, async (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ message: 'Avatar string is required.' });
  try {
    await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, req.user.id]);
    res.json({ message: 'Avatar updated successfully', avatar });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update avatar.' });
  }
});

// Get Logged-in User's Security Question
router.get('/my-security-question', authMiddleware, async (req, res) => {
  const result = await db.query('SELECT security_question FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
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
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
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
    await db.query('UPDATE users SET name = $1 WHERE id = $2', [trimmedName, req.user.id]);
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
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
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
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
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
router.post('/avatar-upload', authMiddleware, upload.single('avatarFile'), async (req, res) => {
  console.log('[Auth] Avatar upload request received');
  if (!req.file) {
    console.log('[Auth] No file provided in upload request');
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  console.log('[Auth] File received:', req.file.filename);

  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
    await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatarUrl, req.user.id]);
    console.log('[Auth] Avatar updated in DB:', avatarUrl);
    res.json({ message: 'Avatar uploaded successfully', avatar: avatarUrl });
  } catch (error) {
    console.error('[Auth] Avatar upload error:', error);
    res.status(500).json({ message: 'Failed to save avatar.' });
  }
});

// Update User UI Preferences
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const preferences = req.body;
    await db.query('UPDATE users SET ui_preferences = $1 WHERE id = $2', [JSON.stringify(preferences), req.user.id]);
    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Watch Streak
router.get('/streak', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT date FROM user_activity WHERE user_id = $1 ORDER BY date DESC`,
      [req.user.id]
    );

    const dates = result.rows.map(r => r.date.toISOString().split('T')[0]);
    
    if (dates.length === 0) {
      return res.json({ currentStreak: 0, longestStreak: 0, totalDays: 0, lastActive: null });
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = dates[0] === today || dates[0] === yesterday ? dates[0] : null;
    
    if (checkDate) {
      for (let i = 0; i < dates.length; i++) {
        const expected = new Date(Date.now() - (i * 86400000));
        if (checkDate === today) {
          // Start from today
          const exp = new Date(Date.now() - (i * 86400000)).toISOString().split('T')[0];
          if (dates[i] === exp) {
            currentStreak++;
          } else break;
        } else {
          // Start from yesterday
          const exp = new Date(Date.now() - ((i + 1) * 86400000)).toISOString().split('T')[0];
          if (dates[i] === exp) {
            currentStreak++;
          } else break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (prev - curr) / 86400000;
      if (Math.round(diff) === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentStreak, 1);

    const totalWatchedResult = await db.query(
      `SELECT COUNT(DISTINCT movie_id) as total FROM watch_history WHERE user_id = $1 AND progress >= (duration * 0.9) AND duration > 0`,
      [req.user.id]
    );
    const totalWatched = parseInt(totalWatchedResult.rows[0].total || 0);

    res.json({
      currentStreak,
      longestStreak,
      totalDays: dates.length,
      totalWatched,
      lastActive: dates[0]
    });
  } catch (error) {
    console.error('[Streak] Error:', error);
    res.status(500).json({ message: 'Failed to get streak.' });
  }
});

module.exports = router;

