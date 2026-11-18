// ============================================================
// routes/dashboard.js  –  Express Router for /api/dashboard
// Web Technology Full Stack Project
// ============================================================

const express = require('express');
const router = express.Router();
const { Project } = require('../db');

// ── GET /api/dashboard/summary ────────────────────────────────
// Aggregates total projects, status counts, money amounts, utilization %
router.get('/summary', async (req, res) => {
  try {
    const { state, district } = req.query;

    const filter = {};
    if (state)    filter.state    = { $regex: state,    $options: 'i' };
    if (district) filter.district = { $regex: district, $options: 'i' };

    // 1. Project counts
    const totalProjects = await Project.countDocuments(filter);
    const completed     = await Project.countDocuments({ ...filter, status: { $regex: 'Completed',   $options: 'i' } });
    const ongoing       = await Project.countDocuments({ ...filter, status: { $regex: 'Ongoing',     $options: 'i' } });
    const sanctioned    = await Project.countDocuments({ ...filter, status: { $regex: 'Sanction',    $options: 'i' } });
    const recommended   = await Project.countDocuments({ ...filter, status: { $regex: 'Recommended', $options: 'i' } });
    const partial       = await Project.countDocuments({ ...filter, status: { $regex: 'partially',   $options: 'i' } });

    // 2. Financial Aggregation
    const moneyStats = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSanctioned:  { $sum: '$sanctionedAmount' },
          totalCompleted:   { $sum: '$completedAmount' },
          totalRecommended: { $sum: '$recommendedAmount' }
        }
      }
    ]);

    const money = (moneyStats && moneyStats[0]) || { totalSanctioned: 0, totalCompleted: 0, totalRecommended: 0 };

    // 3. Distinct counts
    const states = await Project.distinct('state', filter);
    const mps    = await Project.distinct('mpName', filter);

    // 4. Calculate Utilization Percentage
    const utilizationRate = money.totalSanctioned > 0
      ? Math.round((money.totalCompleted / money.totalSanctioned) * 100)
      : 0;

    res.json({
      totalProjects,
      completed,
      ongoing,
      sanctioned,
      recommended,
      partial,
      totalSanctionedAmount:  money.totalSanctioned,
      totalCompletedAmount:   money.totalCompleted,
      totalRecommendedAmount: money.totalRecommended,
      utilizationRate,
      totalStates: (states && states.length) || 0,
      totalMPs:    (mps && mps.length) || 0
    });

  } catch (err) {
    console.error('Error in /api/dashboard/summary:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/by-state ───────────────────────────────
// Group projects by state for the breakdown table
router.get('/by-state', async (req, res) => {
  try {
    const stateStats = await Project.aggregate([
      {
        $group: {
          _id:             '$state',
          totalProjects:   { $sum: 1 },
          completed:       { $sum: { $cond: [{ $regexMatch: { input: '$status', regex: 'Completed', options: 'i' } }, 1, 0] } },
          totalSanctioned: { $sum: '$sanctionedAmount' },
          totalSpent:      { $sum: '$completedAmount' }
        }
      },
      { $sort: { totalProjects: -1 } },
      { $limit: 20 }
    ]);

    const result = stateStats.map(s => {
      const tot = s.totalProjects || 0;
      const comp = s.completed || 0;
      return {
        state:           s._id || s.state || 'Unknown',
        totalProjects:   tot,
        completed:       comp,
        totalSanctioned: s.totalSanctioned || 0,
        totalSpent:      s.totalSpent || 0,
        completionRate:  tot > 0 ? Math.round((comp / tot) * 100) : 0
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error in /api/dashboard/by-state:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
