// ============================================================
// routes/projects.js  –  Express Router for /api/projects
// Web Technology Full Stack Project
// ============================================================

const express = require('express');
const router = express.Router();
const { Project } = require('../db');

// ── 1. GET /api/projects ──────────────────────────────────────
// Returns list of projects. Supports query parameters:
//   ?state=Maharashtra&status=Completed&search=road&limit=50
router.get('/', async (req, res) => {
  try {
    const { state, district, constituency, mp, status, category, search, limit = 50 } = req.query;

    // Build filter object (works on both Mongo and SQLite)
    const filter = {};

    if (state)         filter.state        = { $regex: state,        $options: 'i' };
    if (district)      filter.district     = { $regex: district,     $options: 'i' };
    if (constituency)  filter.constituency = { $regex: constituency, $options: 'i' };
    if (mp)            filter.mpName       = { $regex: mp,           $options: 'i' };
    if (status)        filter.status       = { $regex: status,       $options: 'i' };
    if (category)      filter.category     = { $regex: category,     $options: 'i' };
    if (search) {
      filter.$or = [
        { title:  { $regex: search, $options: 'i' } },
        { workId: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(filter).limit(Number(limit));
    res.json(projects);

  } catch (err) {
    console.error('Error in GET /api/projects:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 1b. GET /api/projects/map ─────────────────────────────────
// Returns projects formatted with coordinates for GIS Map
router.get('/map', async (req, res) => {
  try {
    const { status, district, state } = req.query;
    const filter = {};
    if (status)   filter.status   = { $regex: status,   $options: 'i' };
    if (district) filter.district = { $regex: district, $options: 'i' };
    if (state)    filter.state    = { $regex: state,    $options: 'i' };

    const projects = await Project.find(filter).limit(200);

    // Fallback coordinates dictionary if missing in DB
    const PUNE_BASE = { lat: 18.5204, lng: 73.8567 };

    const mapped = projects.map(p => {
      let lat = p.latitude;
      let lng = p.longitude;
      if (!lat || !lng) {
        if ((p.district || '').toLowerCase() === 'pune') {
          lat = PUNE_BASE.lat + (Math.random() - 0.5) * 0.08;
          lng = PUNE_BASE.lng + (Math.random() - 0.5) * 0.08;
        }
      }
      return {
        _id: p._id || p.id,
        id: p.id || p._id,
        workId: p.workId,
        title: p.title,
        category: p.category,
        state: p.state,
        district: p.district,
        constituency: p.constituency,
        mpName: p.mpName,
        status: p.status,
        recommendedAmount: p.recommendedAmount || 0,
        sanctionedAmount: p.sanctionedAmount || 0,
        completedAmount: p.completedAmount || 0,
        latitude: lat,
        longitude: lng
      };
    }).filter(p => p.latitude && p.longitude);

    res.json(mapped);
  } catch (err) {
    console.error('Error in GET /api/projects/map:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. GET /api/projects/:id ──────────────────────────────────
// Returns a single project by ID (Read operation)
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. POST /api/projects ─────────────────────────────────────
// Create a new project (Create operation)
router.post('/', async (req, res) => {
  try {
    const created = await Project.create(req.body);
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── 4. PUT /api/projects/:id ──────────────────────────────────
// Update an existing project (Update operation)
router.put('/:id', async (req, res) => {
  try {
    const updated = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Project not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── 5. DELETE /api/projects/:id ───────────────────────────────
// Delete a project (Delete operation)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
