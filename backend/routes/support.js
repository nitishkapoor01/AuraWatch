const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/SupportTicket');

// @route   POST /api/support
// @desc    Submit a support ticket (feedback, feature request, or issue)
// @access  Public (or could be Private if we want to attach to a user)
router.post('/', async (req, res) => {
  try {
    const { ticketType, name, message, title, description, issueType } = req.body;

    if (!ticketType) {
      return res.status(400).json({ msg: 'Ticket type is required' });
    }

    const newTicket = new SupportTicket({
      ticketType,
      name,
      message,
      title,
      description,
      issueType
    });

    const ticket = await newTicket.save();
    res.status(201).json(ticket);
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
    const tickets = await SupportTicket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    console.error('Error fetching support tickets:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
