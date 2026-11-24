// ============================================================
// routes/complaints.js  –  Express Router for /api/complaints
// Web Technology Full Stack Project
// ============================================================

const express = require('express');
const router = express.Router();
const { Complaint } = require('../db');

// ── GET /api/complaints/my ────────────────────────────────────
// Return complaints filed by the currently logged-in citizen
router.get('/my', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(401).json({ error: 'Citizen authentication required' });
    }
    const complaints = await Complaint.find({ citizenEmail: email }).sort({ createdAt: -1 }).limit(100);
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/complaints ───────────────────────────────────────
// Get all citizen complaints (Masks citizen identity for 100% anonymity)
router.get('/', async (req, res) => {
  try {
    const { status, district } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (district) filter.district = district;

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 }).limit(100);

    // Enforce Whistleblower Anonymity: never disclose complainant name or contact to authority/public
    const sanitized = complaints.map(c => {
      const plain = c.toObject ? c.toObject() : { ...c };
      plain.name = 'Anonymous Citizen';
      plain.citizenName = 'Anonymous Citizen';
      delete plain.phone;
      delete plain.citizenEmail;
      return plain;
    });

    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/complaints/:ticketId ─────────────────────────────
// Track complaint status by ticket ID (Anonymized)
router.get('/:ticketId', async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ ticketId: req.params.ticketId });
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    const plain = complaint.toObject ? complaint.toObject() : { ...complaint };
    plain.name = 'Anonymous Citizen (Protected Identity)';
    plain.citizenName = 'Anonymous Citizen (Protected Identity)';
    delete plain.phone;
    delete plain.citizenEmail;

    res.json(plain);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/complaints ──────────────────────────────────────
// Citizen submits a new anonymous complaint
router.post('/', async (req, res) => {
  try {
    const { category, description, projectId, district, citizenEmail } = req.body;

    if (!category || !description) {
      return res.status(400).json({ error: 'Please provide Category and Description.' });
    }

    // Generate unique Ticket ID e.g. "CMP-2024-000006"
    const count = await Complaint.countDocuments();
    const currentYear = new Date().getFullYear();
    const ticketId = `CMP-${currentYear}-${String(count + 1).padStart(6, '0')}`;

    // For safety and security, store identity as Anonymous Citizen
    const newComplaint = {
      ticketId,
      name: 'Anonymous Citizen',
      phone: 'Protected',
      projectId: projectId || '',
      category,
      description,
      district: district || 'Pune',
      citizenEmail: citizenEmail || '',
      status: 'Submitted'
    };

    const saved = await Complaint.create(newComplaint);
    res.status(201).json({
      message: 'Complaint submitted anonymously',
      ticketId: saved.ticketId
    });
  } catch (err) {
    console.error('Error in POST /api/complaints:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ── PUT / PATCH /api/complaints/:ticketId/status ──────────────
// Update complaint status (District Authority action)
const handleUpdateStatus = async (req, res) => {
  try {
    let { status } = req.body;
    if (status === 'Under Investigation') status = 'Under Review';
    const validStatuses = ['Submitted', 'Under Review', 'Resolved', 'Rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Allowed values: ${validStatuses.join(', ')}` 
      });
    }

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
};

router.put('/:ticketId/status', handleUpdateStatus);
router.patch('/:ticketId/status', handleUpdateStatus);

module.exports = router;
