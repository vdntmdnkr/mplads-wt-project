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
    const { state, district, constituency, mp, status, search, limit = 50 } = req.query;

    // Build filter object (works on both Mongo and SQLite)
    const filter = {};

    if (state)         filter.state        = { $regex: state,        $options: 'i' };
    if (district)      filter.district     = { $regex: district,     $options: 'i' };
    if (constituency)  filter.constituency = { $regex: constituency, $options: 'i' };
    if (mp)            filter.mpName       = { $regex: mp,           $options: 'i' };
    if (status)        filter.status       = { $regex: status,       $options: 'i' };
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
