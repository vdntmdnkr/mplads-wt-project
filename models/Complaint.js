// ============================================================
// models/Complaint.js  –  Mongoose Schema for Citizen Complaints
// ============================================================

const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  ticketId:    { type: String, required: true, unique: true },
  name:        { type: String, required: true },      // Citizen name
  phone:       { type: String },
  projectId:   { type: String },                      // Related project workId
  category:    {
    type: String,
    enum: ['Corruption', 'Delay', 'Poor Quality', 'Missing Funds', 'Other'],
    default: 'Other'
  },
  description: { type: String, required: true },
  status:      {
    type: String,
    enum: ['Submitted', 'Under Review', 'Resolved', 'Rejected'],
    default: 'Submitted'
  },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
