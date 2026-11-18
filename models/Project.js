// ============================================================
// models/Project.js  –  Mongoose Schema for MPLADS Projects
// ============================================================

const mongoose = require('mongoose');

// Define the shape of a project document in MongoDB
const projectSchema = new mongoose.Schema({
  workId:          { type: String, required: true, unique: true },   // Unique project ID
  title:           { type: String, required: true },                  // Work title
  category:        { type: String, default: 'Infrastructure' },       // Type of work
  state:           { type: String },
  district:        { type: String },
  constituency:    { type: String },
  mpName:          { type: String },                                  // Member of Parliament
  status:          {
    type: String,
    enum: ['Completed', 'Ongoing', 'Sanctioned', 'Recommended', 'Work partially Completed'],
    default: 'Recommended'
  },
  recommendedAmount: { type: Number, default: 0 },  // Amount recommended (₹)
  sanctionedAmount:  { type: Number, default: 0 },  // Amount sanctioned (₹)
  completedAmount:   { type: Number, default: 0 },  // Amount spent / completed (₹)
  recommendedDate:   { type: Date },
  sanctionDate:      { type: Date },
  completionDate:    { type: Date },
  createdAt:         { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', projectSchema);
