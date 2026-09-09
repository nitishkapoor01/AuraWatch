const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, isAdmin, optionalAuth } = require('../middleware/auth');

// @route   POST /api/support
// @desc    Submit a support ticket (feedback, feature request, or issue)
// @access  Public (Guest or Authenticated)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { ticketType, name, message, title, description, issueType, visitorId } = req.body;

    if (!ticketType) {
      return res.status(400).json({ msg: 'Ticket type is required' });
    }

    const validTypes = ['feedback', 'feature_request', 'report_issue'];
    if (!validTypes.includes(ticketType)) {
      return res.status(400).json({ msg: 'Invalid ticket type' });
    }

    // Determine user_id from verified JWT session if available
    const userId = req.user?.id || (req.body.userId && Number.isInteger(Number(req.body.userId)) ? Number(req.body.userId) : null);
    const sanitizedVisitorId = typeof visitorId === 'string' ? visitorId.trim().slice(0, 100) : null;
    const sanitizedName = typeof name === 'string' ? name.trim().slice(0, 100) : (req.user?.name || 'Anonymous');
    const sanitizedTitle = typeof title === 'string' ? title.trim().slice(0, 200) : null;
    const sanitizedMessage = typeof message === 'string' ? message.trim().slice(0, 3000) : null;
    const sanitizedDescription = typeof description === 'string' ? description.trim().slice(0, 3000) : null;
    const sanitizedIssueType = typeof issueType === 'string' ? issueType.trim().slice(0, 100) : null;

    const query = `
      INSERT INTO support_tickets (
        ticket_type, name, message, title, description, issue_type, user_id, visitor_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
      RETURNING *
    `;
    const values = [
      ticketType,
      sanitizedName,
      sanitizedMessage,
      sanitizedTitle,
      sanitizedDescription,
      sanitizedIssueType,
      userId,
      sanitizedVisitorId
    ];

    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Support] Error creating support ticket:', err.message);
    res.status(500).json({ msg: 'Server Error creating support ticket' });
  }
});

// @route   GET /api/support/my-tickets
// @desc    Get user's ticket threads & permanent replies
// @access  Public (matches user_id or visitorId)
router.get('/my-tickets', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || (req.query.userId && Number.isInteger(Number(req.query.userId)) ? Number(req.query.userId) : null);
    const visitorId = typeof req.query.visitorId === 'string' ? req.query.visitorId.trim() : null;

    if (!userId && !visitorId) {
      return res.json([]);
    }

    let query = '';
    let values = [];

    if (userId && visitorId) {
      query = `
        SELECT id, ticket_type, name, message, title, description, issue_type,
               status, created_at, admin_reply, replied_at, is_read,
               'AuraWatch Official Support' AS official_sender
        FROM support_tickets
        WHERE user_id = $1 OR visitor_id = $2
        ORDER BY created_at DESC
        LIMIT 50
      `;
      values = [userId, visitorId];
    } else if (userId) {
      query = `
        SELECT id, ticket_type, name, message, title, description, issue_type,
               status, created_at, admin_reply, replied_at, is_read,
               'AuraWatch Official Support' AS official_sender
        FROM support_tickets
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `;
      values = [userId];
    } else {
      query = `
        SELECT id, ticket_type, name, message, title, description, issue_type,
               status, created_at, admin_reply, replied_at, is_read,
               'AuraWatch Official Support' AS official_sender
        FROM support_tickets
        WHERE visitor_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `;
      values = [visitorId];
    }

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('[Support] Error fetching my tickets:', err.message);
    res.status(500).json({ msg: 'Server Error fetching my tickets' });
  }
});

// @route   GET /api/support/unread-count
// @desc    Get count of unread official replies for badge display
// @access  Public (matches user_id or visitorId)
router.get('/unread-count', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || (req.query.userId && Number.isInteger(Number(req.query.userId)) ? Number(req.query.userId) : null);
    const visitorId = typeof req.query.visitorId === 'string' ? req.query.visitorId.trim() : null;

    if (!userId && !visitorId) {
      return res.json({ unreadCount: 0 });
    }

    let query = '';
    let values = [];

    if (userId && visitorId) {
      query = `
        SELECT COUNT(*) AS count
        FROM support_tickets
        WHERE (user_id = $1 OR visitor_id = $2)
          AND admin_reply IS NOT NULL
          AND is_read = FALSE
      `;
      values = [userId, visitorId];
    } else if (userId) {
      query = `
        SELECT COUNT(*) AS count
        FROM support_tickets
        WHERE user_id = $1
          AND admin_reply IS NOT NULL
          AND is_read = FALSE
      `;
      values = [userId];
    } else {
      query = `
        SELECT COUNT(*) AS count
        FROM support_tickets
        WHERE visitor_id = $1
          AND admin_reply IS NOT NULL
          AND is_read = FALSE
      `;
      values = [visitorId];
    }

    const result = await db.query(query, values);
    const count = parseInt(result.rows[0]?.count || '0', 10);
    res.json({ unreadCount: count });
  } catch (err) {
    console.error('[Support] Error fetching unread count:', err.message);
    res.status(500).json({ unreadCount: 0 });
  }
});

// @route   POST /api/support/:id/mark-read
// @desc    Mark a ticket's reply as read
// @access  Public (with user_id or visitor_id ownership check)
router.post('/:id/mark-read', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || (req.body.userId && Number.isInteger(Number(req.body.userId)) ? Number(req.body.userId) : null);
    const visitorId = typeof req.body.visitorId === 'string' ? req.body.visitorId.trim() : null;

    let query = `
      UPDATE support_tickets
      SET is_read = TRUE
      WHERE id = $1
    `;
    const values = [id];

    if (userId && visitorId) {
      query += ` AND (user_id = $2 OR visitor_id = $3)`;
      values.push(userId, visitorId);
    } else if (userId) {
      query += ` AND user_id = $2`;
      values.push(userId);
    } else if (visitorId) {
      query += ` AND visitor_id = $2`;
      values.push(visitorId);
    }

    query += ` RETURNING id, is_read`;

    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Ticket not found or unauthorized' });
    }

    res.json({ success: true, ticket: result.rows[0] });
  } catch (err) {
    console.error('[Support] Error marking ticket as read:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// @route   POST /api/support/:id/reply
// @desc    Send official reply from AuraWatch Support (Admin only)
// @access  Admin
router.post('/:id/reply', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_reply, replyText } = req.body;
    const reply = (admin_reply || replyText || '').trim();

    if (!reply) {
      return res.status(400).json({ msg: 'Reply text cannot be empty' });
    }

    if (reply.length > 4000) {
      return res.status(400).json({ msg: 'Reply text exceeds 4000 characters limit' });
    }

    const query = `
      UPDATE support_tickets
      SET admin_reply = $1,
          replied_at = CURRENT_TIMESTAMP,
          replied_by = $2,
          status = 'resolved',
          is_read = FALSE
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(query, [reply, req.user.id, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Ticket not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Support] Error sending reply:', err.message);
    res.status(500).json({ msg: 'Server Error sending reply' });
  }
});

// @route   GET /api/support
// @desc    Get all support tickets for admin dashboard
// @access  Admin
router.get('/', authMiddleware, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 200');
    res.json(result.rows);
  } catch (err) {
    console.error('[Support] Error fetching all support tickets:', err.message);
    res.status(500).json({ msg: 'Server Error fetching tickets' });
  }
});

// @route   PUT /api/support/:id/status
// @desc    Update support ticket status
// @access  Admin
router.put('/:id/status', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ['open', 'resolved', 'in_progress', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const query = `
      UPDATE support_tickets 
      SET status = $1 
      WHERE id = $2 
      RETURNING *
    `;
    const result = await db.query(query, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Ticket not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Support] Error updating ticket status:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
