// ============================================================
// ai-analytics.js  –  Client-Side JavaScript for AI Anomaly Monitor
// Web Technology Full Stack Project
// ============================================================

// Helper: return colored badge for risk level
function riskBadge(level) {
  const l = (level || '').toUpperCase();
  if (l === 'HIGH') return `<span class="badge" style="background:#fadbd8; color:#922b21; font-weight:700;">HIGH</span>`;
  if (l === 'MEDIUM') return `<span class="badge" style="background:#fef9e7; color:#9a7d0a; font-weight:700;">MEDIUM</span>`;
  return `<span class="badge" style="background:#d5f5e3; color:#1e8449; font-weight:700;">LOW</span>`;
}

// Helper: return badge for anomaly type
function anomalyTypeBadge(type) {
  if (type.includes('Duplicate')) return `<span class="badge badge-partial">Duplicate Work</span>`;
  if (type.includes('Stalled')) return `<span class="badge badge-rejected">Zero Progress</span>`;
  if (type.includes('Partial')) return `<span class="badge badge-review">Partial Delay</span>`;
  return `<span class="badge badge-recommended">${type}</span>`;
}

// Helper: render visual risk score bar
function renderScoreBar(score) {
  let color = '#27ae60';
  if (score >= 75) color = '#e74c3c';
  else if (score >= 50) color = '#f39c12';

  return `
    <div style="display:flex; align-items:center; gap:8px;">
      <div class="progress-bar" style="width:70px; background:#e0e0e0;">
        <div class="progress-fill" style="width:${score}%; background:${color};"></div>
      </div>
      <span style="font-weight:700; font-size:0.85rem; color:${color};">${score}/100</span>
    </div>
  `;
}

// Global anomalies cache for modal lookup
let currentAnomalies = [];

// ── Load and Render Anomalies ─────────────────────────────────
async function loadAnomalies() {
  const tbody = document.getElementById('anomalies-tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading AI inspection data…</td></tr>';

  const riskLevel = document.getElementById('filter-risk').value;
  const anomalyType = document.getElementById('filter-type').value;
  const search = document.getElementById('ai-search').value.trim();

  const params = new URLSearchParams();
  if (riskLevel) params.append('riskLevel', riskLevel);
  if (anomalyType) params.append('anomalyType', anomalyType);
  if (search) params.append('search', search);

  try {
    const res = await fetch('/api/ai/anomalies?' + params.toString());
    const data = await res.json();

    const summary = data.summary || {};
    currentAnomalies = data.anomalies || [];

    // Update KPI numbers
    document.getElementById('stat-high-risk').textContent = summary.highRiskCount || 0;
    document.getElementById('stat-medium-risk').textContent = summary.mediumRiskCount || 0;
    document.getElementById('stat-total-anomalies').textContent = summary.totalAnomaliesDetected || 0;
    document.getElementById('stat-avg-score').textContent = (summary.averageRiskScore || 0) + ' / 100';

    document.getElementById('ai-result-count').textContent =
      `Displaying ${currentAnomalies.length} anomaly flag${currentAnomalies.length !== 1 ? 's' : ''}`;

    if (currentAnomalies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-light);">No anomaly flags match the selected criteria.</td></tr>';
      return;
    }

    // Render table rows
    tbody.innerHTML = currentAnomalies.map((item, index) => `
      <tr>
        <td style="font-family:monospace; font-size:0.8rem; font-weight:700;">${item.workId}</td>
        <td style="max-width:240px;">
          <span title="${item.title}" style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px;">
            ${item.title}
          </span>
        </td>
        <td>${item.state || '—'} / ${item.district || '—'}</td>
        <td>${anomalyTypeBadge(item.anomalyType)}</td>
        <td>${riskBadge(item.riskLevel)}</td>
        <td>${renderScoreBar(item.riskScore)}</td>
        <td style="font-weight:600; font-size:0.85rem;">${item.confidence || '—'}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="openAiModal(${index})">
            Details
          </button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Failed to load AI anomalies:', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--danger);">
      Failed to load AI data. Verify server is running: <code>npm start</code>
    </td></tr>`;
  }
}

// ── Trigger Python AI Analysis On-Demand ──────────────────────
async function triggerAiAnalysis() {
  const btn = document.getElementById('btn-run-ai');
  const msg = document.getElementById('ai-status-msg');

  btn.disabled = true;
  btn.textContent = 'Executing Python AI Engine...';
  msg.style.display = 'block';
  msg.className = 'alert alert-info';
  msg.innerHTML = 'Running <code>python3 ai_analyzer.py</code> on all MPLADS project records. Please wait...';

  const startTime = Date.now();

  try {
    const res = await fetch('/api/ai/run-analysis', { method: 'POST' });
    const data = await res.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    msg.className = 'alert alert-success';
    msg.innerHTML = `<strong>Python AI Analysis Completed</strong> in ${duration}s! Evaluated ${data.results?.totalProjectsAnalyzed || 50} projects and refreshed anomaly flags.`;

    await loadAnomalies();

    setTimeout(() => {
      msg.style.display = 'none';
    }, 6000);

  } catch (err) {
    msg.className = 'alert alert-error';
    msg.textContent = 'Failed to trigger Python analyzer: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Python AI Inspection';
  }
}

// ── Clear filters ─────────────────────────────────────────────
function clearAiFilters() {
  document.getElementById('ai-search').value = '';
  document.getElementById('filter-risk').value = '';
  document.getElementById('filter-type').value = '';
  loadAnomalies();
}

// ── Modal popup logic ─────────────────────────────────────────
function openAiModal(index) {
  const item = currentAnomalies[index];
  if (!item) return;

  const overlay = document.getElementById('ai-modal-overlay');
  const content = document.getElementById('ai-modal-content');

  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <h2 style="font-size:1.2rem; color:var(--primary);">${item.anomalyType}</h2>
      ${riskBadge(item.riskLevel)}
    </div>

    <div style="background:var(--bg); padding:16px; border-radius:var(--radius); margin-bottom:16px;">
      <div style="font-size:0.8rem; color:var(--text-light); text-transform:uppercase; font-weight:700;">Project Reference</div>
      <div style="font-weight:700; font-size:1rem; margin-top:4px;">${item.title}</div>
      <div style="font-family:monospace; font-size:0.8rem; color:var(--text-light); margin-top:2px;">ID: ${item.workId}</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.9rem; margin-bottom:18px;">
      <div><span style="color:var(--text-light);">State:</span> <strong>${item.state || '—'}</strong></div>
      <div><span style="color:var(--text-light);">District:</span> <strong>${item.district || '—'}</strong></div>
      <div><span style="color:var(--text-light);">MP Name:</span> <strong>${item.mpName || '—'}</strong></div>
      <div><span style="color:var(--text-light);">Category:</span> <strong>${item.category || '—'}</strong></div>
      <div><span style="color:var(--text-light);">Detection Confidence:</span> <strong>${item.confidence || '—'}</strong></div>
      <div><span style="color:var(--text-light);">Risk Score:</span> <strong>${item.riskScore} / 100</strong></div>
    </div>

    <div style="border-left:4px solid var(--accent); padding-left:14px; margin-bottom:20px;">
      <div style="font-weight:700; color:var(--primary); font-size:0.95rem; margin-bottom:4px;">AI Analysis & Explanation:</div>
      <p style="font-size:0.92rem; color:var(--text); line-height:1.5;">${item.explanation}</p>
    </div>

    <div style="display:flex; gap:10px;">
      <a href="report.html?projectId=${encodeURIComponent(item.workId)}" class="btn btn-primary" style="flex:1; text-align:center;">
        Report to District Authority
      </a>
      <button class="btn btn-outline" style="color:var(--text); border-color:var(--border);" onclick="closeAiModal()">
        Close
      </button>
    </div>
  `;

  overlay.style.display = 'block';
}

function closeAiModal() {
  document.getElementById('ai-modal-overlay').style.display = 'none';
}

// Close when clicking outside
document.getElementById('ai-modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeAiModal();
});

// Search on enter key
document.getElementById('ai-search').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') loadAnomalies();
});

// Initial load
loadAnomalies();
