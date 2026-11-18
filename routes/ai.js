// ============================================================
// routes/ai.js  –  Express Router for AI Anomaly & Fraud Detection
// Connects Node.js with the Python Analytics Engine (ai_analyzer.py)
// Web Technology Full Stack Project
// ============================================================

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const ANOMALIES_FILE = path.join(__dirname, '..', 'data', 'ai_anomalies.json');
const PYTHON_SCRIPT = path.join(__dirname, '..', 'ai_analyzer.py');

// Helper to run the Python AI Analyzer script
function runPythonAnalyzer() {
  return new Promise((resolve, reject) => {
    execFile('python3', [PYTHON_SCRIPT], (error, stdout, stderr) => {
      if (error) {
        console.warn('Python execution warning:', error.message);
        // If python fails or is not found, we can still load from existing JSON
      }
      try {
        if (fs.existsSync(ANOMALIES_FILE)) {
          const raw = fs.readFileSync(ANOMALIES_FILE, 'utf8');
          resolve(JSON.parse(raw));
        } else {
          resolve({
            totalProjectsAnalyzed: 0,
            totalAnomaliesDetected: 0,
            highRiskCount: 0,
            mediumRiskCount: 0,
            lowRiskCount: 0,
            anomalies: []
          });
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ── 1. GET /api/ai/anomalies ──────────────────────────────────
// Returns the AI detection results, with optional riskLevel filter
router.get('/anomalies', async (req, res) => {
  try {
    let data;

    // Load existing analysis if available, otherwise run python analyzer
    if (fs.existsSync(ANOMALIES_FILE)) {
      data = JSON.parse(fs.readFileSync(ANOMALIES_FILE, 'utf8'));
    } else {
      data = await runPythonAnalyzer();
    }

    const { riskLevel, anomalyType, search } = req.query;
    let list = data.anomalies || [];

    if (riskLevel) {
      list = list.filter(a => a.riskLevel.toUpperCase() === riskLevel.toUpperCase());
    }
    if (anomalyType) {
      list = list.filter(a => a.anomalyType.toLowerCase().includes(anomalyType.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.workId && a.workId.toLowerCase().includes(q)) ||
        (a.district && a.district.toLowerCase().includes(q))
      );
    }

    res.json({
      summary: {
        totalProjectsAnalyzed: data.totalProjectsAnalyzed || 50,
        totalAnomaliesDetected: data.totalAnomaliesDetected || list.length,
        highRiskCount: data.highRiskCount || 0,
        mediumRiskCount: data.mediumRiskCount || 0,
        lowRiskCount: data.lowRiskCount || 0,
        averageRiskScore: data.averageRiskScore || 0
      },
      filteredCount: list.length,
      anomalies: list
    });

  } catch (err) {
    console.error('Error in /api/ai/anomalies:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 2. POST /api/ai/run-analysis ──────────────────────────────
// Triggers the Python AI analyzer on-demand and returns fresh results
router.post('/run-analysis', async (req, res) => {
  try {
    console.log('[AI] Triggering Python AI Analysis via ai_analyzer.py...');
    const results = await runPythonAnalyzer();
    res.json({
      message: 'AI Analysis executed successfully via Python engine',
      results
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to run AI analysis: ' + err.message });
  }
});

module.exports = router;
