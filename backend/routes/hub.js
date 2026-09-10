const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, isAdmin, optionalAuth } = require('../middleware/auth');

let cachedLatestAdminPostAt = null;
let lastAdminCheckTime = 0;
const ADMIN_CHECK_TTL = 15 * 1000; // 15 seconds

// @route   GET /api/hub/unread-status
// @desc    Get timestamp of latest admin post for the red notification dot
// @access  Public
router.get('/unread-status', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedLatestAdminPostAt !== null && (now - lastAdminCheckTime < ADMIN_CHECK_TTL)) {
      return res.json({
        latest_admin_post_at: cachedLatestAdminPostAt
      });
    }

    const { rows } = await db.query(`
      SELECT created_at AS latest_admin_post_at
      FROM aura_hub_posts
      WHERE is_admin = true
      ORDER BY created_at DESC
      LIMIT 1;
    `);
    cachedLatestAdminPostAt = rows[0]?.latest_admin_post_at || null;
    lastAdminCheckTime = now;
    res.json({
      latest_admin_post_at: cachedLatestAdminPostAt
    });
  } catch (err) {
    console.error('Error getting hub unread status:', err);
    res.json({ latest_admin_post_at: cachedLatestAdminPostAt || null });
  }
});

// @route   GET /api/hub
// @desc    Get all community posts with like status, poll votes, and latest admin timestamp
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { visitorId } = req.query;
    const userId = req.user ? req.user.id : null;
    const cleanVisitorId = typeof visitorId === 'string' ? visitorId.trim() : null;

    const sql = `
      SELECT 
        p.id,
        p.content,
        p.author_name,
        p.user_id,
        p.is_admin,
        p.is_pinned,
        p.pinned_at,
        p.post_type,
        p.poll_options,
        p.likes,
        p.visitor_id,
        p.created_at,
        u.avatar AS user_avatar,
        u.role AS user_role,
        EXISTS (
          SELECT 1 FROM aura_hub_likes l 
          WHERE l.post_id = p.id 
          AND (
            ($1::integer IS NOT NULL AND l.user_id = $1::integer)
            OR 
            ($1::integer IS NULL AND $2::text IS NOT NULL AND l.visitor_id = $2::text AND l.user_id IS NULL)
          )
        ) AS has_liked,
        (
          SELECT pv.option_id FROM aura_hub_poll_votes pv
          WHERE pv.post_id = p.id
          AND (
            ($1::integer IS NOT NULL AND pv.user_id = $1::integer)
            OR 
            ($1::integer IS NULL AND $2::text IS NOT NULL AND pv.visitor_id = $2::text AND pv.user_id IS NULL)
          )
          LIMIT 1
        ) AS user_poll_vote
      FROM aura_hub_posts p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.is_pinned DESC, p.created_at DESC
      LIMIT 100;
    `;

    const now = Date.now();
    const shouldQueryAdmin = !cachedLatestAdminPostAt || (now - lastAdminCheckTime >= ADMIN_CHECK_TTL);

    const [postsRes, adminRes] = await Promise.all([
      db.query(sql, [userId, cleanVisitorId]),
      shouldQueryAdmin 
        ? db.query(`SELECT created_at FROM aura_hub_posts WHERE is_admin = true ORDER BY created_at DESC LIMIT 1;`)
        : Promise.resolve({ rows: [{ created_at: cachedLatestAdminPostAt }] })
    ]);

    if (shouldQueryAdmin) {
      cachedLatestAdminPostAt = adminRes.rows[0]?.created_at || null;
      lastAdminCheckTime = now;
    }

    res.json({
      posts: postsRes.rows,
      latest_admin_post_at: cachedLatestAdminPostAt
    });
  } catch (err) {
    console.error('Error fetching hub feed:', err);
    res.status(500).json({ error: 'Failed to load community feed' });
  }
});

// @route   POST /api/hub
// @desc    Create a simple text post (User or Guest)
// @access  Public
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { content, authorName, visitorId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty' });
    }

    const cleanContent = content.trim().slice(0, 2000);
    const userId = req.user ? req.user.id : null;
    let isAdminUser = false;
    if (req.user) {
      if (req.user.role === 'admin' || req.user.is_super_admin) {
        isAdminUser = true;
      } else {
        const uCheck = await db.query('SELECT role, is_super_admin FROM users WHERE id = $1', [req.user.id]);
        if (uCheck.rows.length > 0 && (uCheck.rows[0].role === 'admin' || uCheck.rows[0].is_super_admin)) {
          isAdminUser = true;
        }
      }
    }

    const cleanAuthor = isAdminUser 
      ? 'AuraWatch Official' 
      : (req.user ? req.user.name : (authorName && authorName.trim() ? authorName.trim().slice(0, 50) : 'Anonymous Member'));

    const insertSql = `
      INSERT INTO aura_hub_posts (
        content, author_name, user_id, is_admin, post_type, poll_options, likes, visitor_id
      )
      VALUES ($1, $2, $3, $4, 'text', '[]'::jsonb, 0, $5)
      RETURNING *;
    `;

    const { rows } = await db.query(insertSql, [
      cleanContent,
      cleanAuthor,
      userId,
      isAdminUser,
      cleanVisitorId
    ]);

    res.status(201).json({
      ...rows[0],
      has_liked: false,
      user_poll_vote: null
    });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ error: 'Failed to publish post' });
  }
});

// @route   POST /api/hub/admin
// @desc    Admin: Create an official post or interactive poll
// @access  Admin only
router.post('/admin', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { content, postType = 'text', pollOptions } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const cleanContent = content.trim().slice(0, 2000);
    let cleanPollOptions = [];

    if (postType === 'poll') {
      if (!Array.isArray(pollOptions) || pollOptions.length < 2) {
        return res.status(400).json({ error: 'A poll must have at least 2 options' });
      }
      cleanPollOptions = pollOptions
        .filter(opt => typeof opt === 'string' && opt.trim().length > 0)
        .slice(0, 6)
        .map((opt, idx) => ({
          id: idx + 1,
          text: opt.trim().slice(0, 100),
          votes: 0
        }));

      if (cleanPollOptions.length < 2) {
        return res.status(400).json({ error: 'Please provide at least 2 valid poll options' });
      }
    }

    const insertSql = `
      INSERT INTO aura_hub_posts (
        content, author_name, user_id, is_admin, post_type, poll_options, likes
      )
      VALUES ($1, $2, $3, true, $4, $5::jsonb, 0)
      RETURNING *;
    `;

    const { rows } = await db.query(insertSql, [
      cleanContent,
      'AuraWatch Official',
      req.user.id,
      postType === 'poll' ? 'poll' : 'text',
      JSON.stringify(cleanPollOptions)
    ]);

    cachedLatestAdminPostAt = rows[0].created_at;
    lastAdminCheckTime = Date.now();

    res.status(201).json({
      ...rows[0],
      has_liked: false,
      user_poll_vote: null
    });
  } catch (err) {
    console.error('Error creating admin post:', err);
    res.status(500).json({ error: 'Failed to create admin post' });
  }
});

// @route   POST /api/hub/:id/like
// @desc    Toggle like on a post (1 like per user/visitor, no duplicates)
// @access  Public
router.post('/:id/like', optionalAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const postId = parseInt(req.params.id, 10);
    const { visitorId } = req.body;
    const userId = req.user ? req.user.id : null;
    const cleanVisitorId = typeof visitorId === 'string' && visitorId.trim() ? visitorId.trim() : 'anon';

    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    await client.query('BEGIN');

    // Lock post row to completely prevent concurrent race conditions
    const postCheck = await client.query('SELECT id, likes FROM aura_hub_posts WHERE id = $1 FOR UPDATE', [postId]);
    if (postCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if like exists
    let checkLikeSql, checkLikeParams;
    if (userId) {
      checkLikeSql = 'SELECT id FROM aura_hub_likes WHERE post_id = $1 AND user_id = $2';
      checkLikeParams = [postId, userId];
    } else {
      checkLikeSql = 'SELECT id FROM aura_hub_likes WHERE post_id = $1 AND visitor_id = $2 AND user_id IS NULL';
      checkLikeParams = [postId, cleanVisitorId];
    }

    const existingLike = await client.query(checkLikeSql, checkLikeParams);
    let liked = false;
    let newLikes = postCheck.rows[0].likes;

    if (existingLike.rows.length > 0) {
      // Remove like
      await client.query('DELETE FROM aura_hub_likes WHERE id = $1', [existingLike.rows[0].id]);
      const updateRes = await client.query(`
        UPDATE aura_hub_posts 
        SET likes = (SELECT COUNT(*)::integer FROM aura_hub_likes WHERE post_id = $1)
        WHERE id = $1
        RETURNING likes;
      `, [postId]);
      newLikes = updateRes.rows[0].likes;
      liked = false;
    } else {
      // Add like
      await client.query(`
        INSERT INTO aura_hub_likes (post_id, user_id, visitor_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING;
      `, [postId, userId, cleanVisitorId]);

      const updateRes = await client.query(`
        UPDATE aura_hub_posts 
        SET likes = (SELECT COUNT(*)::integer FROM aura_hub_likes WHERE post_id = $1)
        WHERE id = $1
        RETURNING likes;
      `, [postId]);
      newLikes = updateRes.rows[0].likes;
      liked = true;
    }

    await client.query('COMMIT');
    res.json({ postId, likes: newLikes, liked });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error toggling like:', err);
    res.status(500).json({ error: 'Failed to process like' });
  } finally {
    client.release();
  }
});

// @route   POST /api/hub/:id/poll-vote
// @desc    Cast a vote on a poll option (1 vote per user/visitor, no duplicate voting)
// @access  Public
router.post('/:id/poll-vote', optionalAuth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const postId = parseInt(req.params.id, 10);
    const { optionId, visitorId } = req.body;
    const userId = req.user ? req.user.id : null;
    const cleanVisitorId = typeof visitorId === 'string' && visitorId.trim() ? visitorId.trim() : 'anon';
    const optId = parseInt(optionId, 10);

    if (isNaN(postId) || isNaN(optId)) {
      return res.status(400).json({ error: 'Invalid post or option ID' });
    }

    await client.query('BEGIN');

    // Lock post row to prevent race conditions
    const postRes = await client.query('SELECT id, post_type, poll_options FROM aura_hub_posts WHERE id = $1 FOR UPDATE', [postId]);
    if (postRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postRes.rows[0];
    if (post.post_type !== 'poll') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This post is not a poll' });
    }

    // Check if user already voted
    let checkVoteSql, checkVoteParams;
    if (userId) {
      checkVoteSql = 'SELECT id FROM aura_hub_poll_votes WHERE post_id = $1 AND user_id = $2';
      checkVoteParams = [postId, userId];
    } else {
      checkVoteSql = 'SELECT id FROM aura_hub_poll_votes WHERE post_id = $1 AND visitor_id = $2 AND user_id IS NULL';
      checkVoteParams = [postId, cleanVisitorId];
    }

    const voteCheck = await client.query(checkVoteSql, checkVoteParams);
    if (voteCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already voted on this poll' });
    }

    // Record vote
    await client.query(`
      INSERT INTO aura_hub_poll_votes (post_id, option_id, user_id, visitor_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING;
    `, [postId, String(optId), userId, cleanVisitorId]);

    // Recalculate each option's vote count from the source of truth table aura_hub_poll_votes
    const voteCounts = await client.query(`
      SELECT option_id, COUNT(*)::integer AS total_votes
      FROM aura_hub_poll_votes
      WHERE post_id = $1
      GROUP BY option_id;
    `, [postId]);

    const countMap = {};
    voteCounts.rows.forEach(r => {
      countMap[String(r.option_id)] = r.total_votes;
    });

    let pollOptions = Array.isArray(post.poll_options) ? post.poll_options : [];
    pollOptions = pollOptions.map(opt => ({
      ...opt,
      votes: countMap[String(opt.id)] || 0
    }));

    const updateRes = await client.query(`
      UPDATE aura_hub_posts 
      SET poll_options = $1::jsonb
      WHERE id = $2
      RETURNING poll_options;
    `, [JSON.stringify(pollOptions), postId]);

    await client.query('COMMIT');
    res.json({
      postId,
      poll_options: updateRes.rows[0].poll_options,
      user_poll_vote: optId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error voting on poll:', err);
    res.status(500).json({ error: 'Failed to cast vote on poll' });
  } finally {
    client.release();
  }
});

// @route   PATCH /api/hub/:id/pin
// @desc    Admin: Pin or unpin any post
// @access  Admin only
router.patch('/:id/pin', authMiddleware, isAdmin, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const check = await db.query('SELECT id, is_pinned FROM aura_hub_posts WHERE id = $1', [postId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const nextPinned = !check.rows[0].is_pinned;
    const updateSql = `
      UPDATE aura_hub_posts 
      SET is_pinned = $1, pinned_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = $2
      RETURNING id, is_pinned, pinned_at;
    `;
    const { rows } = await db.query(updateSql, [nextPinned, postId]);
    res.json({
      message: nextPinned ? 'Post pinned successfully' : 'Post unpinned',
      postId,
      is_pinned: rows[0].is_pinned,
      pinned_at: rows[0].pinned_at
    });
  } catch (err) {
    console.error('Error toggling pin on post:', err);
    res.status(500).json({ error: 'Failed to toggle pin on post' });
  }
});

// @route   DELETE /api/hub/:id
// @desc    Delete post (Admin can delete ANY post; users can ONLY delete THEIR OWN post; users CANNOT delete others' posts)
// @access  Public / Optional Auth (strictly verified server-side)
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const visitorId = req.body?.visitorId || req.query?.visitorId || req.headers['x-visitor-id'];
    let isUserAdmin = false;
    if (req.user) {
      if (req.user.role === 'admin' || req.user.is_super_admin) {
        isUserAdmin = true;
      } else {
        const uCheck = await db.query('SELECT role, is_super_admin FROM users WHERE id = $1', [req.user.id]);
        if (uCheck.rows.length > 0 && (uCheck.rows[0].role === 'admin' || uCheck.rows[0].is_super_admin)) {
          isUserAdmin = true;
        }
      }
    }

    const postRes = await db.query('SELECT id, user_id, visitor_id, is_admin FROM aura_hub_posts WHERE id = $1', [postId]);
    if (postRes.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postRes.rows[0];

    // 1. Admin can delete ANY post (admin post, user post, guest post)
    if (isUserAdmin) {
      await db.query('DELETE FROM aura_hub_posts WHERE id = $1', [postId]);
      if (post.is_admin) {
        cachedLatestAdminPostAt = null;
        lastAdminCheckTime = 0;
      }
      return res.json({ message: 'Post deleted by administrator', postId });
    }

    // 2. Logged-in user can ONLY delete THEIR OWN post (user_id matches)
    if (req.user) {
      if (post.user_id !== null && post.user_id === req.user.id) {
        await db.query('DELETE FROM aura_hub_posts WHERE id = $1', [postId]);
        return res.json({ message: 'Post deleted successfully', postId });
      }
      return res.status(403).json({ error: 'Forbidden: You can only delete your own posts.' });
    }

    // 3. Guest can ONLY delete anonymous post if visitor_id matches exactly and post has no user_id
    const cleanVisitorId = typeof visitorId === 'string' && visitorId.trim() ? visitorId.trim() : null;
    if (post.user_id === null && post.visitor_id && cleanVisitorId && post.visitor_id === cleanVisitorId) {
      await db.query('DELETE FROM aura_hub_posts WHERE id = $1', [postId]);
      return res.json({ message: 'Post deleted successfully', postId });
    }

    // 4. Any other deletion attempt is strictly forbidden!
    return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this post.' });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
