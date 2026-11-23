// ============================================================
// report.js  –  Citizen Anonymous Complaint Form JavaScript
// Sends a POST request to /api/complaints with form data
// ============================================================

// Pre-fill project ID from URL if passed as ?projectId=...
window.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(window.location.search);
  const pid = params.get('projectId');
  if (pid) {
    const el = document.getElementById('projectId');
    if (el) el.value = pid;
  }
});

// Handle form submission
document.getElementById('complaint-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  document.getElementById('success-msg').style.display = 'none';
  document.getElementById('error-msg').style.display   = 'none';

  const projectId   = document.getElementById('projectId').value.trim();
  const category    = document.getElementById('category').value;
  const description = document.getElementById('description').value.trim();

  // Basic validation
  if (!category || !description) {
    showError('Please fill in all required fields (Category, Description).');
    return;
  }

  // Complainant identity is strictly masked as Anonymous Citizen
  const payload = {
    name: 'Anonymous Citizen',
    phone: 'Protected',
    projectId,
    category,
    description,
    district: 'Pune'
  };

  try {
    const raw = localStorage.getItem('mplads_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user.email) payload.citizenEmail = user.email;
    }
  } catch (e) {}

  try {
    const response = await fetch('/api/complaints', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      showError(result.error || 'Something went wrong. Please try again.');
      return;
    }

    // Show success with ticket ID and direct links to My Complaints and Track Ticket
    showSuccess(
      `Grievance registered anonymously!<br>
       Your Ticket ID: <strong style="font-size:1.15rem; font-family:monospace;">${result.ticketId}</strong><br>
       <div style="margin-top:10px;">
         <a href="my-complaints.html" class="btn btn-sm btn-primary" style="margin-right:8px; display:inline-block; font-weight:700;">View in My Complaints</a>
         <a href="track.html" class="btn btn-sm btn-outline" style="display:inline-block; font-weight:700;">Track Live Status</a>
       </div>`
    );

    document.getElementById('complaint-form').reset();

  } catch (err) {
    showError('Could not connect to the server. Make sure Node.js server is running.');
  }
});

function showSuccess(msg) {
  const el = document.getElementById('success-msg');
  el.innerHTML = msg;
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth' });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
}
