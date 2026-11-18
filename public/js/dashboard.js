// ============================================================
// dashboard.js  –  Dashboard Page JavaScript
// Fetches KPI summary and state-wise breakdown from Express API
// ============================================================

// Helper: format a number as Indian Rupee string (e.g. ₹2.50 Cr)
function formatINR(amount) {
  if (amount >= 10000000) {
    return '₹' + (amount / 10000000).toFixed(2) + ' Cr';
  } else if (amount >= 100000) {
    return '₹' + (amount / 100000).toFixed(2) + ' L';
  }
  return '₹' + amount.toLocaleString('en-IN');
}

// Helper: return a colored badge HTML string based on status
function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('completed') && !s.includes('partially'))
    return `<span class="badge badge-completed">Completed</span>`;
  if (s.includes('ongoing'))
    return `<span class="badge badge-ongoing">Ongoing</span>`;
  if (s.includes('sanction'))
    return `<span class="badge badge-sanctioned">Sanctioned</span>`;
  if (s.includes('partial'))
    return `<span class="badge badge-partial">Partial</span>`;
  return `<span class="badge badge-recommended">${status}</span>`;
}

// ── Load main KPI summary ─────────────────────────────────────
async function loadDashboard() {
  const state = document.getElementById('filter-state').value;

  // Build URL with optional state filter
  let url = '/api/dashboard/summary';
  if (state) url += '?state=' + encodeURIComponent(state);

  try {
    const response = await fetch(url);
    const data     = await response.json();

    // Update all KPI cards by setting their text content
    document.getElementById('d-total').textContent     = data.totalProjects.toLocaleString();
    document.getElementById('d-completed').textContent = data.completed.toLocaleString();
    document.getElementById('d-ongoing').textContent   = data.ongoing.toLocaleString();
    document.getElementById('d-sanctioned').textContent = data.sanctioned.toLocaleString();
    document.getElementById('d-partial').textContent   = data.partial.toLocaleString();
    document.getElementById('d-states').textContent    = data.totalStates.toLocaleString();
    document.getElementById('d-mps').textContent       = data.totalMPs.toLocaleString();
    document.getElementById('d-util').textContent      = data.utilizationRate + '%';

    // Money stats
    document.getElementById('d-sanc-amt').textContent  = formatINR(data.totalSanctionedAmount);
    document.getElementById('d-spent-amt').textContent = formatINR(data.totalCompletedAmount);
    document.getElementById('d-util-pct').textContent  = data.utilizationRate + '%';

    // Update progress bar width
    document.getElementById('d-progress').style.width = Math.min(data.utilizationRate, 100) + '%';

  } catch (err) {
    console.error('Dashboard summary error:', err);
    document.getElementById('d-total').textContent = 'Error';
  }
}

// ── Load state-wise breakdown table ──────────────────────────
async function loadStateTable() {
  const tbody = document.getElementById('state-table-body');

  try {
    const response = await fetch('/api/dashboard/by-state');
    const rows     = await response.json();

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-light);">No data available</td></tr>';
      return;
    }

    // Build table rows using DOM manipulation
    tbody.innerHTML = rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${row.state}</strong></td>
        <td>${row.totalProjects.toLocaleString()}</td>
        <td>${row.completed.toLocaleString()}</td>
        <td>${formatINR(row.totalSanctioned)}</td>
        <td>${formatINR(row.totalSpent)}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="progress-bar" style="width:80px;">
              <div class="progress-fill" style="width:${row.completionRate}%"></div>
            </div>
            <span style="font-size:0.8rem; font-weight:600;">${row.completionRate}%</span>
          </div>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--danger);">Failed to load data. Is the server running?</td></tr>';
  }
}

// ── Populate state dropdown ───────────────────────────────────
async function populateStateFilter() {
  try {
    const response = await fetch('/api/dashboard/by-state');
    const rows     = await response.json();
    const select   = document.getElementById('filter-state');

    rows.forEach(row => {
      const opt = document.createElement('option');
      opt.value = row.state;
      opt.textContent = row.state;
      select.appendChild(opt);
    });
  } catch (err) {
    // ignore — filter just won't be populated
  }
}

function clearFilter() {
  document.getElementById('filter-state').value = '';
  loadDashboard();
}

// ── Run on page load ──────────────────────────────────────────
loadDashboard();
loadStateTable();
populateStateFilter();
