// ============================================================
// js/map.js  –  Leaflet.js GIS Interactive Map Tracker
// Web Technology Full Stack Project
// Visualizes MPLADS works with special emphasis on Pune District
// ============================================================

let map;
let allProjects = [];
let currentMarkers = [];
let activeStatusFilter = 'all';
let searchQuery = '';

const PUNE_COORDINATES = [18.5204, 73.8567];
const INDIA_COORDINATES = [21.5937, 78.9629];

// ── 1. Initialize Map ─────────────────────────────────────────
function initMap() {
  map = L.map('map', {
    zoomControl: false // Move zoom control for cleaner layout
  }).setView(INDIA_COORDINATES, 5);

  // Position zoom controls at top-left below our buttons
  L.control.zoom({ position: 'topleft' }).addTo(map);

  // Standard OpenStreetMap Tile Layer (Free, reliable, no API key needed)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | MPLADS'
  }).addTo(map);

  loadMapData();
}

// ── 2. Fetch Projects with Coordinates ────────────────────────
async function loadMapData() {
  try {
    const res = await fetch('/api/projects/map');
    if (!res.ok) throw new Error('Failed to load project coordinates');
    allProjects = await res.json();
    renderMapElements();
  } catch (err) {
    console.error('Error fetching map projects:', err);
    document.getElementById('sidebar-projects-list').innerHTML = `
      <div style="padding:20px; text-align:center; color:#ef4444;">
        Failed to load map points. Ensure server is running.
      </div>
    `;
  }
}

// ── 3. Render Markers & Sidebar ───────────────────────────────
function renderMapElements() {
  // Clear existing markers
  currentMarkers.forEach(m => map.removeLayer(m));
  currentMarkers = [];

  // Filter projects by status & search
  const filtered = allProjects.filter(p => {
    // Status check
    if (activeStatusFilter !== 'all') {
      const pStatus = (p.status || '').toLowerCase();
      if (!pStatus.includes(activeStatusFilter.toLowerCase())) {
        return false;
      }
    }

    // Search query check
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchDistrict = (p.district || '').toLowerCase().includes(q);
      const matchMp = (p.mpName || '').toLowerCase().includes(q);
      const matchId = (p.workId || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDistrict && !matchMp && !matchId) return false;
    }

    return true;
  });

  // Calculate stats
  let completedCount = 0;
  let ongoingCount = 0;
  let puneCount = 0;

  filtered.forEach(p => {
    const s = (p.status || '').toLowerCase();
    if (s.includes('completed') && !s.includes('partially')) completedCount++;
    else if (s.includes('ongoing')) ongoingCount++;

    if ((p.district || '').toLowerCase() === 'pune') puneCount++;

    // Create marker pin
    const marker = createProjectMarker(p);
    marker.addTo(map);
    currentMarkers.push(marker);
  });

  // Update floating stats
  document.getElementById('stat-pinned').textContent = filtered.length;
  document.getElementById('stat-comp-count').textContent = completedCount;
  document.getElementById('stat-ong-count').textContent = ongoingCount;
  document.getElementById('stat-pune-count').textContent = puneCount;
  document.getElementById('sidebar-count').textContent = `${filtered.length} Works`;

  renderSidebarList(filtered);
}

// ── 4. Create Custom Marker with Status Pin ───────────────────
function createProjectMarker(project) {
  const status = (project.status || '').toLowerCase();
  let pinClass = 'pin-sanctioned';
  let badgeClass = 'badge-sanc';

  if (status.includes('completed') && !status.includes('partially')) {
    pinClass = 'pin-completed';
    badgeClass = 'badge-comp';
  } else if (status.includes('ongoing')) {
    pinClass = 'pin-ongoing';
    badgeClass = 'badge-ong';
  } else if (status.includes('recommended')) {
    pinClass = 'pin-recommended';
    badgeClass = 'badge-sanc';
  }

  // Custom pulsing div icon
  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="pulse-pin ${pinClass}" title="${escapeHtml(project.title)}"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });

  const marker = L.marker([project.latitude, project.longitude], { icon });

  // Progress percentage
  const sanctioned = Number(project.sanctionedAmount || 0);
  const spent = Number(project.completedAmount || 0);
  const pct = sanctioned > 0 ? Math.min(100, Math.round((spent / sanctioned) * 100)) : 0;

  // Popup Content
  const popupHtml = `
    <div class="popup-content" style="min-width:240px; font-family:'Segoe UI',sans-serif;">
      <span class="popup-badge ${badgeClass}">${escapeHtml(project.status || 'Recommended')}</span>
      <span style="font-size:0.75rem; color:#64748b; font-weight:600; float:right;">${escapeHtml(project.workId)}</span>
      <h4>${escapeHtml(project.title)}</h4>
      
      <table class="popup-table">
        <tr>
          <td style="color:#64748b; width:40%;">Location:</td>
          <td><strong>${escapeHtml(project.district || 'Pune')}, ${escapeHtml(project.state || 'Maharashtra')}</strong></td>
        </tr>
        <tr>
          <td style="color:#64748b;">MP:</td>
          <td>${escapeHtml(project.mpName || '—')} (${escapeHtml(project.constituency || '—')})</td>
        </tr>
        <tr>
          <td style="color:#64748b;">Sanctioned:</td>
          <td><strong>₹${(sanctioned / 100000).toFixed(1)} Lakhs</strong></td>
        </tr>
        <tr>
          <td style="color:#64748b;">Expenditure:</td>
          <td>₹${(spent / 100000).toFixed(1)} Lakhs (${pct}%)</td>
        </tr>
      </table>

      <div class="popup-progress">
        <div class="popup-progress-fill" style="width:${pct}%;"></div>
      </div>

      <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
        <a href="report.html?projectId=${encodeURIComponent(project.workId)}" 
           style="font-size:0.75rem; color:var(--primary, #1a4b8c); font-weight:700; text-decoration:underline;">
          Report Issue →
        </a>
        <span style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase;">${escapeHtml(project.category || 'General')}</span>
      </div>
    </div>
  `;

  marker.bindPopup(popupHtml);
  marker.projectId = project.workId;

  marker.on('click', () => {
    highlightSidebarItem(project.workId);
  });

  return marker;
}

// ── 5. Render Sidebar Project List ────────────────────────────
function renderSidebarList(projects) {
  const container = document.getElementById('sidebar-projects-list');
  if (projects.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px; color:#64748b; font-size:0.9rem;">
        No projects match your current filters.
      </div>
    `;
    return;
  }

  container.innerHTML = projects.map(p => {
    const isPune = (p.district || '').toLowerCase() === 'pune';
    const isComp = (p.status || '').toLowerCase().includes('completed');
    const badgeColor = isComp ? '#16a34a' : '#ea580c';

    return `
      <div class="project-item" id="sidebar-proj-${p.workId.replace(/[^a-zA-Z0-9]/g, '_')}" onclick="focusProjectMarker('${p.workId}', ${p.latitude}, ${p.longitude})">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <span style="font-size:0.72rem; font-weight:700; color:${badgeColor}; text-transform:uppercase;">
            ● ${escapeHtml(p.status || 'Active')}
          </span>
          ${isPune ? '<span style="font-size:0.7rem; font-weight:800; background:#fef3c7; color:#b45309; padding:1px 6px; border-radius:4px;">PUNE</span>' : ''}
        </div>
        <div style="font-weight:700; font-size:0.88rem; color:#1e293b; line-height:1.3; margin-bottom:6px;">
          ${escapeHtml(p.title)}
        </div>
        <div style="font-size:0.78rem; color:#64748b; display:flex; justify-content:space-between;">
          <span>${escapeHtml(p.district || '')}, ${escapeHtml(p.state || '')}</span>
          <span style="font-weight:600; color:#0f172a;">₹${(Number(p.sanctionedAmount || 0)/100000).toFixed(1)}L</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── 6. Map Interactivity & Focus Functions ────────────────────
function focusPune() {
  map.flyTo(PUNE_COORDINATES, 11.5, {
    animate: true,
    duration: 1.5
  });

  // Highlight button
  resetFilterButtons();
  document.querySelector('.pune-highlight').classList.add('active');

  // Set search or filter to Pune
  searchQuery = 'Pune';
  document.getElementById('map-search').value = 'Pune';
  renderMapElements();
}

function focusIndia() {
  map.flyTo(INDIA_COORDINATES, 5, {
    animate: true,
    duration: 1.5
  });

  resetFilterButtons();
  document.getElementById('filter-all').classList.add('active');
  searchQuery = '';
  document.getElementById('map-search').value = '';
  activeStatusFilter = 'all';
  renderMapElements();
}

function filterByStatus(status) {
  activeStatusFilter = status;
  resetFilterButtons();

  if (status === 'all') {
    document.getElementById('filter-all').classList.add('active');
  } else if (status === 'Completed') {
    document.getElementById('filter-completed').classList.add('active');
  } else if (status === 'Ongoing') {
    document.getElementById('filter-ongoing').classList.add('active');
  } else if (status === 'Sanctioned') {
    document.getElementById('filter-sanctioned').classList.add('active');
  }

  renderMapElements();
}

function resetFilterButtons() {
  document.querySelectorAll('.map-btn').forEach(btn => btn.classList.remove('active'));
}

function handleSearch(val) {
  searchQuery = val.trim();
  renderMapElements();
}

function focusProjectMarker(workId, lat, lng) {
  map.flyTo([lat, lng], 14, { duration: 1.2 });

  // Open corresponding marker popup
  const target = currentMarkers.find(m => m.projectId === workId);
  if (target) {
    target.openPopup();
  }

  highlightSidebarItem(workId);
}

function highlightSidebarItem(workId) {
  document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
  const safeId = 'sidebar-proj-' + workId.replace(/[^a-zA-Z0-9]/g, '_');
  const targetEl = document.getElementById(safeId);
  if (targetEl) {
    targetEl.classList.add('active');
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Start on DOM ready
document.addEventListener('DOMContentLoaded', initMap);
