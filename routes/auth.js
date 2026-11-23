// ============================================================
// routes/auth.js  –  Express Router for Authentication & Roles
// Web Technology Full Stack Project
// Roles: 'authority' (District Authority - Pune) & 'citizen'
// ============================================================

const express = require('express');
const router = express.Router();
const { User } = require('../db');

// Sample demo credentials for viva & presentations
const SAMPLE_LOGINS = [
  {
    role: 'authority',
    roleLabel: 'District Authority',
    district: 'Pune',
    email: 'pune.authority@mplads.gov.in',
    password: 'pune123',
    name: 'District Authority Pune',
    description: 'Manages Pune district works, reviews and resolves citizen complaints.'
  },
  {
    role: 'citizen',
    roleLabel: 'Citizen',
    district: 'Pune',
    email: 'citizen@example.com',
    password: 'citizen123',
    name: 'Rahul Sharma',
    description: 'Files grievances, tracks complaint progress, inspects local projects.'
  }
];

// ── GET /api/auth/sample-users ────────────────────────────────
// Returns sample credentials for quick 1-click login on frontend
router.get('/sample-users', (req, res) => {
  res.json({
    success: true,
    samples: SAMPLE_LOGINS
  });
});

// ── POST /api/auth/login ──────────────────────────────────────
// Authenticates user and returns profile and role
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Query user in DB
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'No account found with this email address.'
      });
    }

    // Verify password
    if (user.password !== String(password).trim()) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password entered.'
      });
    }

    // If a specific role was requested in login form, verify role
    if (role && user.role !== role) {
      return res.status(403).json({
        success: false,
        error: `This account is registered as '${user.role}', not '${role}'.`
      });
    }

    // Return safe user object (omit password)
    const safeUser = {
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      district: user.district || 'Pune',
      phone: user.phone || ''
    };

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      user: safeUser
    });

  } catch (err) {
    console.error('Error in /api/auth/login:', err.message);
    res.status(500).json({ success: false, error: 'Login failed: ' + err.message });
  }
});

// ── POST /api/auth/register ───────────────────────────────────
// Citizen or Authority registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, district, phone } = req.body;

    // Server-side validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Full name is required (min 2 characters).' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ success: false, error: 'Password must be at least 4 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
    }

    // Create user in database
    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: password.trim(),
      role: role === 'authority' ? 'authority' : 'citizen',
      district: district ? district.trim() : 'Pune',
      phone: phone ? phone.trim() : ''
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! You can now log in.',
      user: {
        id: newUser._id || newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        district: newUser.district,
        phone: newUser.phone
      }
    });

  } catch (err) {
    console.error('Error in /api/auth/register:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── GET /api/auth/users ───────────────────────────────────────
// List all users in system (for verification)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json({
      success: true,
      count: users.length,
      users: users.map(u => ({
        id: u._id || u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        district: u.district,
        phone: u.phone,
        createdAt: u.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
