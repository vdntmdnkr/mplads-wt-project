// ============================================================
// track.js  –  Track Complaint Page JavaScript
// Fetches complaint details by Ticket ID from Express API
// ============================================================

// Helper: return badge HTML for complaint status
function statusBadge(status) {
  const map = {
    'Submitted':     '<span class="badge badge-submitted">Submitted</span>',
    'Under Review':  '<span class="badge badge-review">Under Review</span>',
    'Resolved':      '<span class="badge badge-resolved">Resolved</span>',
    'Rejected':      '<span class="badge badge-rejected">Rejected</span>'
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

// Helper: format date nicely
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

// Main function: fetch complaint from API and display it
async function trackComplaint() {
  const ticketId = document.getElementById('ticket-input').value.trim();

  // Hide previous results/errors
  document.getElementById('error-msg').style.display   = 'none';
  document.getElementById('result-card').style.display = 'none';

  if (!ticketId) {
    document.getElementById('error-msg').textContent = 'Please enter a Ticket ID.';
    document.getElementById('error-msg').style.display = 'block';
    return;
  }

  try {
    // GET /api/complaints/:ticketId
    const response = await fetch('/api/complaints/' + encodeURIComponent(ticketId));

    if (response.status === 404) {
      document.getElementById('error-msg').textContent =
        'No complaint found with Ticket ID: ' + ticketId + '. Please check and try again.';
      document.getElementById('error-msg').style.display = 'block';
      return;
    }

    const complaint = await response.json();

    // Populate the result table using DOM manipulation
    document.getElementById('res-ticketId').textContent    = complaint.ticketId;
    document.getElementById('res-name').textContent        = complaint.name;
    document.getElementById('res-category').textContent    = complaint.category;
    document.getElementById('res-project').textContent     = complaint.projectId || 'Not specified';
    document.getElementById('res-description').textContent = complaint.description;
    document.getElementById('res-date').textContent        = formatDate(complaint.createdAt);
    document.getElementById('res-status').innerHTML        = statusBadge(complaint.status);

    // Show the result card
    document.getElementById('result-card').style.display = 'block';
    document.getElementById('result-card').scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    document.getElementById('error-msg').textContent =
      'Could not connect to server. Make sure Node.js server is running.';
    document.getElementById('error-msg').style.display = 'block';
  }
}

// Allow pressing Enter in the input to trigger search
document.getElementById('ticket-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') trackComplaint();
});
