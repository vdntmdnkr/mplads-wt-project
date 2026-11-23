#  Web Technology Full Stack Viva & Defense Guide
## Project: MPLADS Public Monitor & Accountability System

---

##  1. Project Elevator Pitch (Say this in the first 30 seconds)
> *"Good morning Sir/Madam. Our project is **MPLADS Monitor**, a Full-Stack Web Application for tracking development projects recommended by Members of Parliament under the MPLADS scheme.
> We built this using the complete Web Technology stack:
> - **Frontend**: Semantic HTML5, responsive CSS3 (Flexbox & CSS Grid without frameworks), and Vanilla JavaScript (Fetch API + DOM Manipulation).
> - **Backend**: Node.js runtime with Express.js REST API framework.
> - **AI & Analytics**: Lightweight Python inspection engine (`ai_analyzer.py`) detecting duplicate works, execution delays, and cost anomalies.
> - **Database**: MongoDB (via Mongoose ODM) with an automatic offline SQLite fallback for fail-proof reliability.
> - **Core Features**: Real-time project tracking, state/district financial analytics, AI anomaly alerts, and a citizen complaint reporting & tracking module."*

---

##  2. Complete Architecture (How Data Flows)

```
[Browser / User]
       │
       │ (1) User actions (clicks, form submits, filters)
       ▼
[Vanilla JavaScript (ES6+)]
       │
       │ (2) fetch('/api/projects')  [HTTP GET / POST / PUT / DELETE]
       ▼
[Node.js + Express Server (server.js)]
       │
       │ (3) Middleware: CORS, express.json(), express.static()
       ▼
[Express Routers (routes/*.js)]
       │
       │ (4) Controller logic & validation
       ▼
[Database Layer (db.js / models/*.js)]
       │
       ├──► MongoDB (Mongoose Schema)
       └──► Local SQLite Database (Offline Fallback)
```

---

##  3. File-by-File Walkthrough (Where is everything?)

| File / Folder | Role in Syllabus | What it does |
|---|---|---|
| `server.js` | **Node.js & Express** | App entry point, configures middleware, mounts routes, starts HTTP server on port 3000. |
| `db.js` | **Database Management** | Manages database connection (MongoDB with SQLite fallback) and data queries. |
| `models/Project.js` | **Database Schema (NoSQL)** | Mongoose Schema defining project properties (workId, title, amounts, status). |
| `models/Complaint.js` | **Database Schema (NoSQL)** | Mongoose Schema for citizen complaints (ticketId, category, description, status). |
| `routes/projects.js` | **Express Routing & CRUD** | REST endpoints for listing, searching, creating, updating, and deleting projects. |
| `routes/dashboard.js` | **Data Aggregation** | Calculates KPI totals, utilization rates, and state-wise breakdown. |
| `routes/complaints.js` | **Citizen Grievance API** | Handles complaint submission, ticket ID generation, and ticket status tracking. |
| `ai_analyzer.py` | **Python Analytics Layer** | Analyzes works for duplicate titles, stalled progress, and calculates Risk Scores. |
| `routes/ai.js` | **AI REST Endpoint** | Express router connecting the web app with `ai_analyzer.py` via `child_process`. |
| `public/ai-analytics.html` | **HTML5 AI Dashboard** | Interface for inspecting flagged anomalies, filtering by risk, and triggering analysis. |
| `public/js/ai-analytics.js` | **JavaScript Fetch & DOM** | Asynchronously triggers analysis and populates risk cards and anomaly table rows. |
| `public/index.html` | **HTML5** | Landing page with hero banner, national KPIs, and scheme explanation. |
| `public/dashboard.html` | **HTML5 & Analytics** | Financial stats, progress bars, and state-by-state comparison table. |
| `public/projects.html` | **HTML5 & Tables** | Interactive project search table with modal popup details. |
| `public/report.html` | **HTML5 Forms** | Citizen complaint submission form with input validation. |
| `public/track.html` | **HTML5 Search** | Ticket ID search interface for tracking complaint resolution. |
| `public/css/style.css` | **CSS3** | CSS variables, Flexbox navbar, CSS Grid cards, responsive media queries. |
| `public/js/*.js` | **Client-side JavaScript** | Async/await Fetch API calls, event listeners, dynamic DOM rendering. |

---

##  4. Top 15 Viva Questions & Exact Answers

### Q1: What is semantic HTML and why did you use it?
**Answer:**
> *"Semantic HTML uses tags that convey the meaning of the content rather than just presentation. In our project:
> - `<nav>` for main navigation links
> - `<section>` for logical content blocks (Hero, KPIs, Features)
> - `<form>` for user input collection
> - `<table>`, `<thead>`, `<tbody>` for tabular data
> - `<footer>` for footer information
> This improves accessibility, SEO, and code maintainability compared to using only generic `<div>` tags."*

---

### Q2: Explain the CSS Box Model used in your project.
**Answer:**
> *"Every element in our CSS is a box consisting of 4 layers from inside out:
> 1. **Content**: Text/images (`width`, `height`).
> 2. **Padding**: Transparent area around content inside the border (e.g., `padding: 24px;` in `.card`).
> 3. **Border**: Surrounding outline (e.g., `border: 1px solid var(--border);`).
> 4. **Margin**: Space outside the border separating elements (e.g., `margin-bottom: 20px;`).
> We set `box-sizing: border-box;` in the `*` universal selector so that padding and border are included in the element's total width."*

---

### Q3: Where did you use Flexbox and CSS Grid?
**Answer:**
> - **Flexbox (`display: flex;`)**: Used for 1-dimensional layouts such as the navigation bar (`nav`), hero button group, and filter bars (`.filter-bar`).
> - **CSS Grid (`display: grid;`)**: Used for 2-dimensional layouts such as `.kpi-grid` (`grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));`) and `.features-grid` which automatically adapt to screen widths."*

---

### Q4: What is DOM Manipulation and how does JavaScript update the UI?
**Answer:**
> *"The Document Object Model (DOM) is an object-oriented tree representation of the webpage.
> In `public/js/projects.js` and `public/js/dashboard.js`:
> 1. We use `fetch('/api/projects')` to get JSON data asynchronously.
> 2. We locate DOM nodes with `document.getElementById('projects-tbody')`.
> 3. We construct HTML elements and update them using `.innerHTML = rows.map(...).join('')` or `.textContent`.
> 4. We listen to user events using `.addEventListener('click', ...)` and `.addEventListener('submit', ...)`."*

---

### Q5: What is the difference between `let`, `const`, and `var` in your JavaScript?
**Answer:**
> - `const`: Block-scoped, cannot be reassigned (used for DOM references and API responses).
> - `let`: Block-scoped, can be reassigned (used for loop variables and dynamic filter objects).
> - `var`: Function-scoped, hoisted (we avoid `var` in favor of modern ES6 standards).*

---

### Q6: What is Node.js and why is it used for backend?
**Answer:**
> *"Node.js is an open-source, cross-platform JavaScript runtime built on Chrome's V8 engine. It allows running JavaScript on the server side using an event-driven, non-blocking I/O model, making it lightweight and efficient for handling concurrent REST API requests."*

---

### Q7: What is Express.js and what is Middleware?
**Answer:**
> *"Express is a minimal and flexible Node.js web application framework providing routing and HTTP utilities.
> **Middleware** are functions that have access to `req` (request), `res` (response), and `next`. They execute during the lifecycle of a request before reaching the route handler. Examples in `server.js`:
> - `cors()`: Enables cross-origin requests.
> - `express.json()`: Parses incoming JSON request bodies into `req.body`.
> - `express.static('public')`: Serves static assets (HTML, CSS, JS) directly."*

---

### Q8: What are RESTful APIs and what HTTP methods did you use?
**Answer:**
> *"REST (Representational State Transfer) is an architectural style using standard HTTP methods for CRUD operations:
> - `GET /api/projects` → Read list of projects.
> - `GET /api/projects/:id` → Read a single project by ID.
> - `POST /api/complaints` → Create a new citizen complaint.
> - `PUT /api/complaints/:ticketId/status` → Update status of a complaint.
> - `DELETE /api/projects/:id` → Delete a project."*

---

### Q9: What is MongoDB and how does Mongoose work?
**Answer:**
> *"MongoDB is a NoSQL document database storing data in flexible, JSON-like BSON documents.
> **Mongoose** is an Object Data Modeling (ODM) library for MongoDB and Node.js. It manages data relationships, provides schema validation (as seen in `models/Project.js` and `models/Complaint.js`), and translates between code objects and MongoDB documents."*

---

### Q10: Why do you have SQLite alongside MongoDB?
**Answer:**
> *"In production, MongoDB is used. However, for defense and evaluation reliability, we implemented a smart database manager in `db.js`: if MongoDB is running locally or connected to Atlas, it uses Mongoose. If MongoDB is not running, it automatically switches to local SQLite (`mplads_local.db`), ensuring zero downtime and offline evaluation capability without manual configuration."*

---

### Q11: How does the Citizen Complaint Tracking system work?
**Answer:**
> *"1. Citizen fills out `report.html`.
> 2. JavaScript sends a `POST /api/complaints` request with citizen name, category, and description.
> 3. The backend generates a unique sequential Ticket ID (e.g. `CMP-2024-000006`) and saves the record with status `'Submitted'`.
> 4. The citizen enters the Ticket ID in `track.html`, which triggers `GET /api/complaints/:ticketId` to view real-time status and progress."*

---

### Q12: How does the Python AI Anomaly Detection layer work and how is it integrated?
**Answer:**
> *"Our project directly addresses the problem statement using a Python analytics layer (`ai_analyzer.py`):
> 1. **Duplicate Work Detection**: It tokenizes project titles, removes stop words, and computes Jaccard text similarity across works in the same district/constituency. Overlaps ≥ 45% are flagged as potential duplicate billings.
> 2. **Stalled Execution & Inefficiencies**: It flags projects sanctioned above ₹15 Lakhs that report ₹0 expenditure, as well as prolonged partially-completed projects with < 50% fund utilization.
> 3. **Risk Scoring (0 - 100)**: Each anomaly is categorized into HIGH, MEDIUM, or LOW risk levels with an actionable explanation.
> 4. **Integration**: Express (`routes/ai.js`) executes `python3 ai_analyzer.py` via Node's `child_process.execFile` on demand, and returns the structured JSON report to `public/ai-analytics.html` via the Fetch API."*

---

##  5. "Change This On The Spot" Cheatsheet

During viva, examiners love asking you to make quick live changes to test if you wrote the code:

### 1. "Change the primary color of the website to Green / Purple"
- Open `public/css/style.css` (Line 10).
- Change:
  ```css
  --primary: #1a4b8c; /* Change to #1b5e20 for Green or #4a148c for Purple */
  ```
- Refresh browser: All navbars, buttons, headers, and borders update instantly!

### 2. "Sort projects table by sanctioned amount (highest first)"
- Open `routes/projects.js` or `db.js`.
- In `SqliteProject.find`: Change `ORDER BY id ASC` to `ORDER BY sanctionedAmount DESC`.
- In Mongoose: Add `.sort({ sanctionedAmount: -1 })`.

### 3. "Add a new route that returns your name and college info"
- Open `server.js`.
- Add before `app.listen`:
  ```javascript
  app.get('/api/student', (req, res) => {
    res.json({
      name: "Vedant",
      subject: "Web Technology Full Stack",
      project: "MPLADS Public Monitor",
      rollNo: "Your Roll Number Here"
    });
  });
  ```
- Test in browser: `http://localhost:3000/api/student`.

### 4. "Add a new issue category in the complaint dropdown"
- Open `public/report.html`.
- Find `<select id="category">` and add:
  ```html
  <option value="Environmental"> Environmental Impact</option>
  ```

---

##  6. How to Run for Demo

```bash
# 1. Open Terminal in the project directory:
cd "wt-server"

# 2. Start the Node.js Express server:
node server.js

# 3. Open browser:
http://localhost:3000
```
