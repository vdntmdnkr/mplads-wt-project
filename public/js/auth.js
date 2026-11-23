// ============================================================
// js/auth.js  –  Central Authentication & Role-Based Access Control (RBAC)
// Aligned with SIH 26102 (MoSPI MPLADS AI Anomaly System)
//
// ROLES & PERMISSIONS:
// 1. Citizen / General User:
//    - CAN: File complaints (Report Issue), track complaint status, view public dashboard.
//    - CANNOT: Access AI Anomaly Engine, GIS Map, or Resolve Complaints.
// 2. District Authority (Pune):
//    - Primary Focus: AI Anomaly & Fraud Detection Engine (SIH PS 26102),
//      GIS Spatial Map, Pune Works Inventory, and Citizen Complaint Resolution.
//    - CANNOT: File citizen complaints (Report Issue is hidden from Authority).
// ============================================================

const AUTH_STORAGE_KEY = 'mplads_user';

// Get currently logged-in user
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Save user session
function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

// Log out user
function logoutUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.location.href = 'index.html';
}

// ── 1. Role-Based Navigation Builder ──────────────────────────
function updateNavigationAuth() {
  const user = getCurrentUser();
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const isAuthority = user && user.role === 'authority';

  let html = `
    <li><a href="index.html" class="${currentPath === 'index.html' ? 'active' : ''}">Home</a></li>
    <li><a href="dashboard.html" class="${currentPath === 'dashboard.html' ? 'active' : ''}">Dashboard</a></li>
  `;

  if (isAuthority) {
    // DISTRICT AUTHORITY NAVIGATION (Main Focus: AI Risk Monitor & Scheme Oversight)
    html += `
      <li><a href="authority.html" class="${currentPath === 'authority.html' ? 'active' : ''}">Authority Portal</a></li>
      <li><a href="map.html" class="${currentPath === 'map.html' ? 'active' : ''}">GIS Map</a></li>
      <li><a href="projects.html" class="${currentPath === 'projects.html' ? 'active' : ''}">Projects</a></li>
      <li><a href="ai-analytics.html" class="${currentPath === 'ai-analytics.html' ? 'active' : ''}">AI Anomaly Engine</a></li>
      <li><a href="track.html" class="${currentPath === 'track.html' ? 'active' : ''}">Track Ticket</a></li>
    `;
  } else {
    // CITIZEN / PUBLIC GUEST NAVIGATION
    html += `
      <li><a href="projects.html" class="${currentPath === 'projects.html' ? 'active' : ''}">Projects</a></li>
    `;
    if (user) {
      html += `
        <li><a href="my-complaints.html" class="${currentPath === 'my-complaints.html' ? 'active' : ''}">My Complaints</a></li>
      `;
    }
    html += `
      <li><a href="track.html" class="${currentPath === 'track.html' ? 'active' : ''}">Track Complaint</a></li>
    `;
    if (user) {
      html += `<li><a href="report.html" class="btn-report ${currentPath === 'report.html' ? 'active' : ''}">Report Issue</a></li>`;
    } else {
      // Without login: redirects to login first
      html += `<li><a href="login.html?redirect=report.html" class="btn-report ${currentPath === 'report.html' ? 'active' : ''}">Report Issue</a></li>`;
    }
  }

  // Profile / Login Status:
  if (user) {
    const roleBadgeColor = isAuthority ? '#f59e0b' : '#27ae60';

    html += `
      <li id="nav-auth-item" style="display:flex; align-items:center; gap:8px; margin-left:6px;">
        <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.25); padding:4px 10px; border-radius:20px; font-size:0.82rem;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${roleBadgeColor};"></span>
          <span style="font-weight:600; color:#fff;">${escapeHtml(user.name)}</span>
          <span style="background:${roleBadgeColor}; color:${isAuthority ? '#78350f' : '#fff'}; font-size:0.65rem; padding:1px 6px; border-radius:10px; font-weight:700; text-transform:uppercase;">
            ${escapeHtml(user.role)}
          </span>
        </div>
        <button onclick="logoutUser()" style="background:transparent; border:1px solid rgba(255,255,255,0.4); color:#fff; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='transparent'">
          Logout
        </button>
      </li>
    `;
  } else {
    html += `
      <li id="nav-auth-item" style="margin-left:6px;">
        <a href="login.html" style="background:var(--accent, #e67e22); color:#fff; font-weight:600; padding:7px 14px; border-radius:6px;">
          Login
        </a>
      </li>
    `;
  }

  navLinks.innerHTML = html;
}

// ── 2. Page-Level Access Guard ─────────────────────────────────
function enforcePageGuard() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const user = getCurrentUser();
  const isAuthority = user && user.role === 'authority';

  // Rule 1: Without login, user cannot access report.html or my-complaints.html
  if ((currentPath === 'report.html' || currentPath === 'my-complaints.html') && !user) {
    window.location.replace(`login.html?redirect=${currentPath}`);
    return;
  }

  // Rule 2: Authorities should not access citizen "Report Issue" form
  if (currentPath === 'report.html' && isAuthority) {
    renderAuthorityReportGuard(user);
    return;
  }

  // Rule 3: Citizens / Guests cannot access internal administrative modules
  const authorityOnlyPages = ['map.html', 'ai-analytics.html', 'authority.html'];

  if (authorityOnlyPages.includes(currentPath) && !isAuthority) {
    renderAccessDeniedScreen(currentPath, user);
  }
}

// Shown when District Authority accidentally navigates to Report Issue
function renderAuthorityReportGuard(user) {
  document.body.innerHTML = `
    <nav style="background-color:#1a4b8c; color:white; padding:0 24px; display:flex; align-items:center; justify-content:space-between; height:64px;">
      <div style="font-size:1.25rem; font-weight:700;">MPLADS Monitor <span style="background:#e67e22; color:white; font-size:0.65rem; padding:2px 7px; border-radius:4px;">GOV</span></div>
      <ul style="display:flex; list-style:none; gap:12px; align-items:center;">
        <li><a href="authority.html" style="color:white; text-decoration:none; font-weight:700;">Authority Portal</a></li>
        <li><a href="index.html" style="color:white; text-decoration:none; font-weight:600;">Home</a></li>
      </ul>
    </nav>

    <div style="max-width:620px; margin:70px auto; padding:0 20px; text-align:center;">
      <div style="background:#ffffff; border-radius:10px; border:1px solid #dce1e7; padding:36px 30px; box-shadow:0 8px 30px rgba(0,0,0,0.08);">
        <span style="background:#fef3c7; color:#b45309; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:12px; text-transform:uppercase;">
          Administrative Role Active
        </span>
        <h2 style="color:#0f3060; font-size:1.5rem; margin:14px 0 8px;">
          Grievance Resolution Panel
        </h2>
        <p style="font-size:0.95rem; color:#475569; line-height:1.6; margin-bottom:20px;">
          You are logged in as <strong>District Authority (${escapeHtml(user.district || 'Pune')})</strong>. 
          District Authorities review, investigate, and resolve complaints submitted by citizens rather than filing them.
        </p>
        <div style="display:flex; justify-content:center; gap:12px;">
          <a href="authority.html" style="background:#1a4b8c; color:white; padding:10px 22px; border-radius:6px; font-weight:700; text-decoration:none;">
            View and Resolve Citizen Complaints
          </a>
          <a href="index.html" style="background:#f1f5f9; color:#334155; padding:10px 18px; border-radius:6px; font-weight:600; text-decoration:none;">
            Home
          </a>
        </div>
      </div>
    </div>
  `;
}

// Shown when Citizens / Guests try to access Authority modules
function renderAccessDeniedScreen(page, user) {
  let pageTitle = 'Administrative Module';
  if (page === 'map.html') pageTitle = 'GIS Interactive Spatial Map';
  else if (page === 'ai-analytics.html') pageTitle = 'AI Anomaly & Fraud Detection Engine (SIH PS 26102)';
  else if (page === 'authority.html') pageTitle = 'Pune District Administration Portal';
  else if (page === 'projects.html') pageTitle = 'Full Projects Database';

  const userStatus = user 
    ? `You are currently logged in as a <strong>Citizen (${escapeHtml(user.name)})</strong>.`
    : `You are currently browsing as a <strong>Guest / Public User</strong>.`;

  document.body.innerHTML = `
    <nav style="background-color:#1a4b8c; color:white; padding:0 24px; display:flex; align-items:center; justify-content:space-between; height:64px;">
      <div style="font-size:1.25rem; font-weight:700;">MPLADS Monitor <span style="background:#e67e22; color:white; font-size:0.65rem; padding:2px 7px; border-radius:4px;">GOV</span></div>
      <ul style="display:flex; list-style:none; gap:12px; align-items:center;">
        <li><a href="index.html" style="color:white; text-decoration:none; font-weight:600;">Back to Home</a></li>
        <li><a href="report.html" style="color:white; text-decoration:none; font-weight:600;">Report Issue</a></li>
        <li><a href="track.html" style="color:white; text-decoration:none; font-weight:600;">Track Complaint</a></li>
      </ul>
    </nav>

    <div style="max-width:680px; margin:60px auto; padding:0 20px;">
      <div style="background:#ffffff; border-radius:10px; border:1px solid #dce1e7; padding:36px 30px; box-shadow:0 8px 30px rgba(0,0,0,0.08); text-align:center;">
        
        <span style="background:#fee2e2; color:#b91c1c; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:12px; text-transform:uppercase;">
          Restricted Authority Access
        </span>

        <h2 style="color:#0f3060; font-size:1.6rem; margin:14px 0 8px;">
          ${pageTitle}
        </h2>

        <p style="font-size:0.95rem; color:#475569; line-height:1.6; margin-bottom:16px;">
          As per <strong>Ministry of Statistics and Programme Implementation (MoSPI)</strong> and 
          <strong>SIH Problem Statement 26102</strong> specifications, access to internal AI fraud analysis, 
          expenditure anomaly detection, and spatial GIS mapping is reserved for 
          <strong>District Authorities</strong> and administrative nodal officers.
        </p>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:24px; font-size:0.88rem; color:#334155;">
          ${userStatus} Citizens are authorized to access the public dashboard, file project grievances, and track complaint resolution.
        </div>

        <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
          <a href="login.html" style="background:#1a4b8c; color:white; padding:10px 22px; border-radius:6px; font-weight:600; text-decoration:none; font-size:0.92rem;">
            Sign In as District Authority (Pune)
          </a>
          <a href="report.html" style="background:#e67e22; color:white; padding:10px 20px; border-radius:6px; font-weight:600; text-decoration:none; font-size:0.92rem;">
            File Citizen Grievance
          </a>
          <a href="index.html" style="background:#f1f5f9; color:#334155; padding:10px 18px; border-radius:6px; font-weight:600; text-decoration:none; font-size:0.92rem;">
            Public Overview
          </a>
        </div>

      </div>
    </div>
  `;
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Execute checks on load
document.addEventListener('DOMContentLoaded', () => {
  updateNavigationAuth();
  enforcePageGuard();
});
