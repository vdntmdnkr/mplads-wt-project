// ============================================================
// js/authority.js  –  District Authority Management Script (Pune)
// Main Focus: AI Anomaly & Fraud Risk Monitor (MoSPI SIH PS 26102)
// Web Technology Full Stack Project
// ============================================================

let puneProjects = [];
let allComplaints = [];
let allAnomalies = [];

document.addEventListener('DOMContentLoaded', () => {
  checkAuthorityAccess();
  loadAuthorityData();
});

// ── 1. Check Authority Authentication Guard ───────────────────
function checkAuthorityAccess() {
  const user = getCurrentUser();
  const alertBox = document.getElementById('auth-guard-alert');

  if (!user || user.role !== 'authority') {
    alertBox.style.display = 'block';
    alertBox.className = 'alert alert-info';
    alertBox.innerHTML = `
      <strong>Authority Session Notice:</strong> You are currently viewing in public preview mode. 
      To test official administrative actions (updating complaint status, running AI scans, or adding works), 
      <a href="login.html" style="font-weight:700; text-decoration:underline;">Click here to Sign In as Pune District Authority</a> 
      or use the 1-click demo login.
    `;
  } else {
    alertBox.style.display = 'block';
    alertBox.className = 'alert alert-success';
    alertBox.innerHTML = `
      Logged in as: <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) — 
      Administrative Role: <strong>District Authority (${escapeHtml(user.district || 'Pune')})</strong>.
    `;
  }
}

// ── 2. Load Pune Projects, Complaints & AI Anomalies ──────────
async function loadAuthorityData() {
  await Promise.all([
    loadAiAnomalies(),
    loadPuneProjects(),
    loadComplaints()
  ]);
  updatePuneKpis();
}

// ── 3. AI Anomaly & Fraud Detection Engine (SIH PS 26102) ─────
async function loadAiAnomalies() {
  try {
    const res = await fetch('/api/ai/anomalies');
    if (!res.ok) throw new Error('Failed to fetch AI anomalies');
    const data = await res.json();
    allAnomalies = data.anomalies || [];

    // Update AI KPI cards
    const summary = data.summary || {};
    const highCount = summary.highRiskCount || allAnomalies.filter(a => a.riskLevel === 'HIGH').length;
    const medCount = summary.mediumRiskCount || allAnomalies.filter(a => a.riskLevel === 'MEDIUM').length;

    document.getElementById('stat-ai-high').textContent = highCount;
    document.getElementById('stat-ai-medium').textContent = medCount;
    document.getElementById('stat-ai-total').textContent = allAnomalies.length;
    document.getElementById('ai-count-pill').textContent = `${allAnomalies.length} Flagged Works`;

    renderAiAnomaliesTable(allAnomalies);
  } catch (err) {
    console.error('Error loading AI anomalies:', err);
    document.getElementById('ai-anomalies-table-body').innerHTML = `
      <tr><td colspan="6" style="text-align:center; color:#ef4444; padding:20px;">
        Error loading AI anomalies: ${escapeHtml(err.message)}
      </td></tr>
    `;
  }
}

function renderAiAnomaliesTable(list) {
  const tbody = document.getElementById('ai-anomalies-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">
        No anomalies matching filter criteria.
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(a => {
    let riskBadgeClass = 'risk-pill-low';
    if (a.riskLevel === 'HIGH') riskBadgeClass = 'risk-pill-high';
    else if (a.riskLevel === 'MEDIUM') riskBadgeClass = 'risk-pill-med';

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:12px 14px; font-weight:700; color:#1e293b; white-space:nowrap;">
          <code>${escapeHtml(a.workId || 'N/A')}</code>
        </td>
        <td style="padding:12px 14px;">
          <div style="font-weight:600; color:#0f172a;">${escapeHtml(a.title || 'Untitled Work')}</div>
          <div style="font-size:0.8rem; color:#64748b;">
            District: ${escapeHtml(a.district || 'Pune')} | Cat: ${escapeHtml(a.category || 'General')}
          </div>
        </td>
        <td style="padding:12px 14px; font-size:0.84rem; font-weight:600; color:#334155;">
          ${escapeHtml(a.anomalyType || 'Deviation')}
        </td>
        <td style="padding:12px 14px;">
          <span class="${riskBadgeClass}">
            ${escapeHtml(a.riskLevel || 'LOW')}
          </span>
          <div style="font-size:0.72rem; color:#64748b; margin-top:2px;">
            Score: ${(Number(a.anomalyScore || 0) * 100).toFixed(0)}%
          </div>
        </td>
        <td style="padding:12px 14px; font-size:0.82rem; color:#475569; max-width:320px; line-height:1.4;">
          ${escapeHtml(a.details || a.description || 'Deviations detected in project timeline or expenditure.')}
        </td>
        <td style="padding:12px 14px; text-align:center; white-space:nowrap;">
          <a href="map.html" class="status-action-btn btn-map" style="text-decoration:none;" title="Inspect on GIS Map">
            GIS Map
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAiAnomalies() {
  const query = (document.getElementById('ai-filter-search').value || '').trim().toLowerCase();
  const risk = (document.getElementById('ai-filter-risk').value || '').toUpperCase();
  const type = (document.getElementById('ai-filter-type').value || '').toLowerCase();

  let filtered = allAnomalies.filter(a => {
    const matchesQuery = !query ||
      (a.title && a.title.toLowerCase().includes(query)) ||
      (a.workId && a.workId.toLowerCase().includes(query)) ||
      (a.district && a.district.toLowerCase().includes(query));

    const matchesRisk = !risk || (a.riskLevel && a.riskLevel.toUpperCase() === risk);
    const matchesType = !type || (a.anomalyType && a.anomalyType.toLowerCase().includes(type));

    return matchesQuery && matchesRisk && matchesType;
  });

  renderAiAnomaliesTable(filtered);
}

function resetAiFilters() {
  document.getElementById('ai-filter-search').value = '';
  document.getElementById('ai-filter-risk').value = '';
  document.getElementById('ai-filter-type').value = '';
  renderAiAnomaliesTable(allAnomalies);
}

async function runAiInspection() {
  const btn = document.getElementById('btn-trigger-ai');
  const banner = document.getElementById('ai-scan-banner');

  btn.disabled = true;
  btn.textContent = 'Running AI Scan...';
  banner.style.display = 'block';
  banner.className = 'alert alert-info';
  banner.innerHTML = '<strong>Running AI Inspection Engine:</strong> Executing statistical, duplicate text similarity, and stalled expenditure analysis on MPLADS records...';

  try {
    const res = await fetch('/api/ai/run-analysis', { method: 'POST' });
    const data = await res.json();

    banner.className = 'alert alert-success';
    banner.innerHTML = `<strong>Scan Complete:</strong> AI analysis executed successfully. Flagged ${data.totalAnomaliesDetected || allAnomalies.length} irregularities (${data.highRiskCount || 0} high risk).`;

    await loadAiAnomalies();
  } catch (err) {
    banner.className = 'alert alert-danger';
    banner.innerHTML = `<strong>Scan Error:</strong> ${escapeHtml(err.message)}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run AI Risk Scan';
  }
}

// ── 4. Pune Projects ──────────────────────────────────────────
async function loadPuneProjects() {
  try {
    const res = await fetch('/api/projects?district=Pune&limit=100');
    if (!res.ok) throw new Error('Failed to fetch Pune projects');
    puneProjects = await res.json();
    renderPuneProjectsTable(puneProjects);
  } catch (err) {
    console.error(err);
    document.getElementById('pune-projects-table-body').innerHTML = `
      <tr><td colspan="7" style="text-align:center; color:#ef4444; padding:20px;">
        Error loading Pune projects: ${escapeHtml(err.message)}
      </td></tr>
    `;
  }
}

function renderPuneProjectsTable(list) {
  const tbody = document.getElementById('pune-projects-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7" style="text-align:center; padding:30px; color:#64748b;">
        No projects recorded in Pune district database.
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(p => {
    let badgeColor = '#e0f2fe';
    let badgeText = '#0369a1';
    const s = (p.status || '').toLowerCase();
    if (s.includes('completed')) {
      badgeColor = '#dcfce7'; badgeText = '#15803d';
    } else if (s.includes('ongoing')) {
      badgeColor = '#e0f2fe'; badgeText = '#0369a1';
    } else if (s.includes('sanction')) {
      badgeColor = '#fef3c7'; badgeText = '#b45309';
    }

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:12px 14px; font-weight:700; color:#1e293b; white-space:nowrap;">
          <code>${escapeHtml(p.workId || 'N/A')}</code>
        </td>
        <td style="padding:12px 14px;">
          <div style="font-weight:600; color:#0f172a;">${escapeHtml(p.title || 'Untitled Work')}</div>
        </td>
        <td style="padding:12px 14px;">
          <span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:600;">
            ${escapeHtml(p.category || 'General')}
          </span>
        </td>
        <td style="padding:12px 14px; font-size:0.83rem;">
          <div><strong>${escapeHtml(p.constituency || 'Pune')}</strong></div>
          <div style="color:#64748b;">MP: ${escapeHtml(p.mpName || '—')}</div>
        </td>
        <td style="padding:12px 14px; font-weight:700; color:#0f172a;">
          Rs ${(Number(p.sanctionedAmount || 0) / 100000).toFixed(1)}L
        </td>
        <td style="padding:12px 14px;">
          <span style="background:${badgeColor}; color:${badgeText}; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">
            ${escapeHtml(p.status || 'Ongoing')}
          </span>
        </td>
        <td style="padding:12px 14px; text-align:center; white-space:nowrap;">
          <a href="map.html" class="status-action-btn btn-map" style="text-decoration:none;" title="View on GIS Map">
            GIS Map
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

// ── 5. Complaints Management ──────────────────────────────────
async function loadComplaints() {
  try {
    const res = await fetch('/api/complaints');
    if (!res.ok) throw new Error('Failed to fetch complaints');
    allComplaints = await res.json();
    renderComplaintsTable(allComplaints);
  } catch (err) {
    console.error(err);
    document.getElementById('complaints-table-body').innerHTML = `
      <tr><td colspan="6" style="text-align:center; color:#ef4444; padding:20px;">
        Error loading complaints: ${escapeHtml(err.message)}
      </td></tr>
    `;
  }
}

function renderComplaintsTable(list) {
  const tbody = document.getElementById('complaints-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">
        No citizen complaints registered for Pune yet.
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(c => {
    let statusClass = 'badge-partial';
    let statusBg = '#fef3c7';
    let statusColor = '#b45309';

    if (c.status === 'Resolved') {
      statusBg = '#dcfce7'; statusColor = '#15803d';
    } else if (c.status === 'Rejected') {
      statusBg = '#fee2e2'; statusColor = '#b91c1c';
    } else if (c.status === 'Under Investigation') {
      statusBg = '#e0f2fe'; statusColor = '#0369a1';
    }

    const ticketId = c.ticketId || c._id || (c.id ? 'TKT-' + c.id : 'N/A');

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:12px 14px; font-weight:700; color:#1e293b; white-space:nowrap;">
          <code>${escapeHtml(ticketId)}</code>
        </td>
        <td style="padding:12px 14px;">
          <span style="background:#f1f5f9; color:#334155; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">Anonymous Citizen</span>
          <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">Identity Protected</div>
        </td>
        <td style="padding:12px 14px;">
          <span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:600;">
            ${escapeHtml(c.category || 'General')}
          </span>
        </td>
        <td style="padding:12px 14px; max-width:280px; font-size:0.84rem; color:#334155; line-height:1.4;">
          ${escapeHtml(c.description || 'No description provided.')}
        </td>
        <td style="padding:12px 14px;">
          <span style="background:${statusBg}; color:${statusColor}; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">
            ${escapeHtml(c.status || 'Pending Review')}
          </span>
        </td>
        <td style="padding:12px 14px; text-align:right; white-space:nowrap;">
          <div style="display:inline-flex; gap:6px; align-items:center;">
            <button onclick="updateComplaintStatus('${escapeHtml(ticketId)}', 'Under Review')" class="status-action-btn btn-review" title="Investigate complaint">
              Investigate
            </button>
            <button onclick="updateComplaintStatus('${escapeHtml(ticketId)}', 'Resolved')" class="status-action-btn btn-resolve" title="Mark as resolved">
              Resolve
            </button>
            <button onclick="updateComplaintStatus('${escapeHtml(ticketId)}', 'Rejected')" class="status-action-btn btn-reject" title="Reject invalid report">
              Reject
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateComplaintStatus(ticketId, newStatus) {
  const user = getCurrentUser();
  if (!user || user.role !== 'authority') {
    alert('Administrative action restricted. Please sign in as District Authority.');
    return;
  }

  try {
    const res = await fetch(`/api/complaints/${encodeURIComponent(ticketId)}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token || ''}`
      },
      body: JSON.stringify({
        status: newStatus,
        authorityName: user.name,
        remarks: `Updated by District Authority (${user.district || 'Pune'})`
      })
    });

    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Server returned status ${res.status}: ${text.slice(0, 100)}`);
    }

    if (!res.ok) throw new Error(data.error || 'Failed to update ticket status');

    await loadComplaints();
    updatePuneKpis();
  } catch (err) {
    alert('Error updating status: ' + err.message);
  }
}

// ── 6. Update KPI Counters ────────────────────────────────────
function updatePuneKpis() {
  const total = puneProjects.length;
  document.getElementById('pune-stat-total').textContent = total;
  document.getElementById('pune-stat-complaints').textContent = allComplaints.length;
  document.getElementById('complaints-count-badge').textContent = `${allComplaints.length} Citizen Tickets`;
}

// ── 7. Modal Handlers: Add New Project ────────────────────────
function openNewProjectModal() {
  document.getElementById('new-project-modal').style.display = 'flex';
}

function closeNewProjectModal() {
  document.getElementById('new-project-modal').style.display = 'none';
}

function closeModalOnBg(e) {
  if (e.target.id === 'new-project-modal') closeNewProjectModal();
}

function autoFillMp(constituency) {
  const mpInput = document.getElementById('proj-mp');
  if (constituency === 'Pune') mpInput.value = 'Murlidhar Mohol';
  else if (constituency === 'Baramati') mpInput.value = 'Supriya Sule';
  else if (constituency === 'Maval') mpInput.value = 'Shrirang Barne';
  else if (constituency === 'Shirur') mpInput.value = 'Dr. Amol Kolhe';
}

async function submitNewProject(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('btn-save-project');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const payload = {
    workId: document.getElementById('proj-workId').value.trim(),
    title: document.getElementById('proj-title').value.trim(),
    category: document.getElementById('proj-category').value,
    status: document.getElementById('proj-status').value,
    state: 'Maharashtra',
    district: 'Pune',
    constituency: document.getElementById('proj-constituency').value,
    mpName: document.getElementById('proj-mp').value.trim(),
    sanctionedAmount: Number(document.getElementById('proj-sanctioned').value) || 0,
    completedAmount: Number(document.getElementById('proj-completed').value) || 0,
    latitude: Number(document.getElementById('proj-lat').value) || 18.5204,
    longitude: Number(document.getElementById('proj-lng').value) || 73.8567
  };

  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create work');

    alert('Project created successfully in Pune District database!');
    closeNewProjectModal();
    document.getElementById('add-project-form').reset();
    await loadPuneProjects();
    updatePuneKpis();
  } catch (err) {
    alert('Error creating project: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Work';
  }
}
