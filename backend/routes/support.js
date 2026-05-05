const express = require('express');
const router = express.Router();
const db = require('../db');

// @route   POST /api/support
// @desc    Submit a support ticket (feedback, feature request, or issue)
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { ticketType, name, message, title, description, issueType } = req.body;

    if (!ticketType) {
      return res.status(400).json({ msg: 'Ticket type is required' });
    }

    const query = `
      INSERT INTO support_tickets (ticket_type, name, message, title, description, issue_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      ticketType, 
      name || 'Anonymous', 
      message || null, 
      title || null, 
      description || null, 
      issueType || null
    ];

    const result = await db.query(query, values);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating support ticket:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/support
// @desc    Get all support tickets (admin only in reality, but public for now to test)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM support_tickets ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching support tickets:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
