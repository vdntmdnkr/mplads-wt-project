// ============================================================
// projects.js  –  Projects Page JavaScript
// Fetches projects list from Express API, renders in table,
// opens detail modal on click
// ============================================================

// Helper: format rupees
function formatINR(amount) {
  if (!amount || amount === 0) return '₹0';
  if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(2) + ' Cr';
  if (amount >= 100000)   return '₹' + (amount / 100000).toFixed(2) + ' L';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

// Helper: return badge HTML for a status string
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
  if (s.includes('recommended'))
    return `<span class="badge badge-recommended">Recommended</span>`;
  return `<span class="badge">${status}</span>`;
}

// Helper: calculate utilization % from project data
function utilRate(project) {
  if (!project.sanctionedAmount || project.sanctionedAmount === 0) return 0;
  return Math.min(Math.round((project.completedAmount / project.sanctionedAmount) * 100), 100);
}

// ── Load & Render Projects Table ──────────────────────────────
async function loadProjects() {
  const tbody = document.getElementById('projects-tbody');
  tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading projects…</td></tr>';

  // Collect filter values from the form safely
  const searchEl   = document.getElementById('search');
  const stateEl    = document.getElementById('filter-state');
  const statusEl   = document.getElementById('filter-status');
  const categoryEl = document.getElementById('filter-category');

  const search   = searchEl ? searchEl.value.trim() : '';
  const state    = stateEl ? stateEl.value : '';
  const status   = statusEl ? statusEl.value : '';
  const category = categoryEl ? categoryEl.value : '';

  // Build query string
  const params = new URLSearchParams();
  if (search)   params.append('search',   search);
  if (state)    params.append('state',    state);
  if (status)   params.append('status',   status);
  if (category) params.append('category', category);
  params.append('limit', '100');

  try {
    const response = await fetch('/api/projects?' + params.toString());
    const projects  = await response.json();

    // Show result count
    document.getElementById('result-count').textContent =
      `Showing ${projects.length} project${projects.length !== 1 ? 's' : ''}`;

    if (projects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-light);">No projects found matching your filters.</td></tr>';
      return;
    }

    // Build table rows — one <tr> per project
    tbody.innerHTML = projects.map(p => `
      <tr>
        <td style="font-family:monospace; font-size:0.78rem;">${p.workId}</td>
        <td style="max-width:260px;">
          <span title="${p.title}" style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:260px;">
            ${p.title}
          </span>
        </td>
        <td>${p.state || '—'}</td>
        <td>${p.district || '—'}</td>
        <td>${p.mpName || '—'}</td>
        <td>${p.category || '—'}</td>
        <td>${formatINR(p.sanctionedAmount)}</td>
        <td>${formatINR(p.completedAmount)}</td>
        <td>${statusBadge(p.status)}</td>
        <td>
          <button class="btn btn-sm btn-primary"
            onclick="openModal('${p._id}')">View</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:24px; color:var(--danger);">
      Failed to load projects. Make sure the server is running: <code>node server.js</code>
    </td></tr>`;
  }
}

// ── Populate State Dropdown ───────────────────────────────────
async function populateStateFilter() {
  try {
    const res  = await fetch('/api/dashboard/by-state');
    const rows = await res.json();
    const sel  = document.getElementById('filter-state');

    rows.forEach(row => {
      if (!row.state) return;
      const opt = document.createElement('option');
      opt.value = row.state;
      opt.textContent = row.state;
      sel.appendChild(opt);
    });
  } catch (e) { /* ignore */ }
}

// ── Clear all filters ─────────────────────────────────────────
function clearFilters() {
  if (document.getElementById('search'))          document.getElementById('search').value = '';
  if (document.getElementById('filter-state'))    document.getElementById('filter-state').value = '';
  if (document.getElementById('filter-status'))   document.getElementById('filter-status').value = '';
  if (document.getElementById('filter-category')) document.getElementById('filter-category').value = '';
  loadProjects();
}

// ── Modal: open project details ───────────────────────────────
async function openModal(projectId) {
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('modal-content').innerHTML = '<p class="loading">Loading…</p>';

  try {
    const res     = await fetch('/api/projects/' + projectId);
    const project = await res.json();

    const util = utilRate(project);

    document.getElementById('modal-content').innerHTML = `
      <h2 style="font-size:1.1rem; color:var(--primary); margin-bottom:6px; line-height:1.4;">
        ${project.title}
      </h2>
      <p style="font-family:monospace; font-size:0.8rem; color:var(--text-light); margin-bottom:20px;">
        ${project.workId}
      </p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; font-size:0.9rem; margin-bottom:20px;">
        <div><span style="color:var(--text-light);">State:</span> <strong>${project.state || '—'}</strong></div>
        <div><span style="color:var(--text-light);">District:</span> <strong>${project.district || '—'}</strong></div>
        <div><span style="color:var(--text-light);">Constituency:</span> <strong>${project.constituency || '—'}</strong></div>
        <div><span style="color:var(--text-light);">MP Name:</span> <strong>${project.mpName || '—'}</strong></div>
        <div><span style="color:var(--text-light);">Category:</span> <strong>${project.category}</strong></div>
        <div><span style="color:var(--text-light);">Status:</span> ${statusBadge(project.status)}</div>
      </div>

      <div style="background:var(--bg); border-radius:var(--radius); padding:16px; margin-bottom:20px;">
        <div style="font-size:0.85rem; color:var(--text-light); margin-bottom:4px;">Financial Progress</div>
        <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:8px;">
          <span>Sanctioned: <strong>${formatINR(project.sanctionedAmount)}</strong></span>
          <span>Spent: <strong>${formatINR(project.completedAmount)}</strong></span>
          <span style="color:var(--success);">Utilization: <strong>${util}%</strong></span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${util}%"></div>
        </div>
      </div>

      <a href="report.html?projectId=${encodeURIComponent(project.workId)}"
        class="btn btn-primary" style="width:100%; display:block; text-align:center;">
        Report Issue with this Project
      </a>
    `;
  } catch (err) {
    document.getElementById('modal-content').innerHTML =
      '<p style="color:var(--danger);">Failed to load project details.</p>';
  }
}

// ── Modal: close ──────────────────────────────────────────────
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// Close modal when clicking outside the box
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Allow pressing Enter in search box to trigger search
document.getElementById('search').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') loadProjects();
});

// ── Run on page load ──────────────────────────────────────────
populateStateFilter();
loadProjects();
