// ============================================================
// report.js  –  Citizen Complaint Form JavaScript
// Sends a POST request to /api/complaints with form data
// ============================================================

// Pre-fill project ID from URL if passed as ?projectId=...
window.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(window.location.search);
  const pid = params.get('projectId');
  if (pid) {
    document.getElementById('projectId').value = pid;
  }
});

// Handle form submission
document.getElementById('complaint-form').addEventListener('submit', async function (e) {
  e.preventDefault(); // stop browser's default form submit (page refresh)

  // Hide any previous messages
  document.getElementById('success-msg').style.display = 'none';
  document.getElementById('error-msg').style.display   = 'none';

  // Collect form values
  const name        = document.getElementById('name').value.trim();
  const phone       = document.getElementById('phone').value.trim();
  const projectId   = document.getElementById('projectId').value.trim();
  const category    = document.getElementById('category').value;
  const description = document.getElementById('description').value.trim();

  // Basic validation
  if (!name || !category || !description) {
    showError('Please fill in all required fields (Name, Category, Description).');
    return;
  }

  // Build the data object to send
  const payload = { name, phone, projectId, category, description };

  try {
    // POST to our Express API
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

    // Show success with ticket ID
    showSuccess(
      `Complaint submitted successfully! <br>
       Your Ticket ID: <strong style="font-size:1.1rem;">${result.ticketId}</strong><br>
       <small>Save this ID to track your complaint at <a href="track.html">track.html</a></small>`
    );

    // Clear the form
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
