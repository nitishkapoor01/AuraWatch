const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketType: {
    type: String,
    required: true,
    enum: ['feedback', 'feature_request', 'report_issue']
  },
  name: {
    type: String,
    default: 'Anonymous'
  },
  message: {
    type: String,
  },
  title: {
    type: String,
  },
  description: {
    type: String,
  },
  issueType: {
    type: String,
  },
  status: {
    type: String,
    default: 'open',
    enum: ['open', 'in_progress', 'resolved', 'closed']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
