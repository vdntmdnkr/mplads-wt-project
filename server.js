// ============================================================
// server.js  –  MPLADS Monitor  |  Node.js + Express Backend
// Web Technology Full Stack Project
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { connectDB, isUsingMongo } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 1. Application Middleware ────────────────────────────────
app.use(cors());                                 // Enable Cross-Origin Resource Sharing
app.use(express.json());                         // Parse incoming JSON payloads
app.use(express.urlencoded({ extended: true }));  // Parse URL-encoded form submissions

// ── 2. Serve Static Frontend Files ────────────────────────────
// Serves index.html, dashboard.html, projects.html, report.html, CSS, and JS
app.use(express.static(path.join(__dirname, 'public')));

// ── 3. Mount API Routers ──────────────────────────────────────
const projectRoutes   = require('./routes/projects');
const dashboardRoutes = require('./routes/dashboard');
const complaintRoutes = require('./routes/complaints');
const aiRoutes        = require('./routes/ai');
const authRoutes      = require('./routes/auth');

app.use('/api/projects',   projectRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/ai',         aiRoutes);
app.use('/api/auth',       authRoutes);

// ── 4. Health Check Route ─────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.2.1-fix-proxy',
    database: isUsingMongo() ? 'MongoDB' : 'Fallback DB',
    timestamp: new Date().toISOString()
  });
});

// ── 5. Catch-All Route ────────────────────────────────────────
// Any route not matching /api returns index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── 6. Start Server after Database Connection ─────────────────
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`[OK] MPLADS Full Stack Server is RUNNING!`);
    console.log(`[URL] Open your browser at: http://localhost:${PORT}`);
    console.log(`[DB]  Database Mode: ${isUsingMongo() ? 'MongoDB' : 'SQLite (Built-in Local DB)'}`);
    console.log(`==================================================\n`);
  });
}

startServer();
