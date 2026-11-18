// ============================================================
// routes/complaints.js  –  Express Router for /api/complaints
// Web Technology Full Stack Project
// ============================================================

const express = require('express');
const router = express.Router();
const { Complaint } = require('../db');

// ── GET /api/complaints ───────────────────────────────────────
// Get all citizen complaints (optionally filtered by status)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/complaints/:ticketId ─────────────────────────────
// Track complaint status by ticket ID
router.get('/:ticketId', async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ ticketId: req.params.ticketId });
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/complaints ──────────────────────────────────────
// Citizen submits a new complaint
router.post('/', async (req, res) => {
  try {
    // Generate unique Ticket ID e.g. "CMP-2024-000006"
    const count = await Complaint.countDocuments();
    const currentYear = new Date().getFullYear();
    const ticketId = `CMP-${currentYear}-${String(count + 1).padStart(6, '0')}`;

    const newComplaint = {
      ...req.body,
      ticketId,
      status: 'Submitted'
    };

    const saved = await Complaint.create(newComplaint);
    res.status(201).json({
      message: 'Complaint submitted successfully',
      ticketId: saved.ticketId
    });
  } catch (err) {
    console.error('Error in POST /api/complaints:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── PUT /api/complaints/:ticketId/status ──────────────────────
// Update complaint status (District Authority action)
router.put('/:ticketId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Complaint.findOneAndUpdate(
      { ticketId: req.params.ticketId },
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Complaint not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
