#  MPLADS Public Monitor & Accountability System
### Web Technology Full Stack Academic Project

A complete, full-stack web application designed according to the university Web Technology syllabus:
- **Frontend**: Semantic HTML5, Custom CSS3 (Flexbox & CSS Grid, no external UI frameworks), and Vanilla JavaScript (Fetch API + DOM Manipulation).
- **Backend**: Node.js runtime with Express.js REST API framework.
- **AI & Fraud Detection Layer**: Lightweight Python engine (`ai_analyzer.py`) for duplicate detection, stalled project detection, and risk scoring.
- **Database**: MongoDB (via Mongoose ODM) with an automatic offline SQLite fallback for fail-proof viva evaluation.

---

##  Project Structure

```
mplads/
├── server.js                  ← Main Express application & middleware setup
├── db.js                      ← Database connection (MongoDB + SQLite fallback)
├── seed.js                    ← Database seed script for MongoDB
├── package.json               ← Dependencies and start scripts
│
├── models/                    ← Mongoose Schemas (Database Models)
│   ├── Project.js             ← Project schema (workId, title, amounts, status)
│   └── Complaint.js           ← Citizen complaint schema (ticketId, category, description)
│
├── routes/                    ← Express REST API Routers
│   ├── projects.js            ← Full CRUD operations on projects
│   ├── dashboard.js           ← Financial aggregations & state breakdowns
│   └── complaints.js          ← Citizen grievance filing & status tracking
│
├── public/                    ← Client-Side Frontend
│   ├── index.html             ← Home page with National KPIs
│   ├── dashboard.html         ← Financial analytics & state comparison table
│   ├── projects.html          ← Searchable project directory with modal popup
│   ├── report.html            ← Citizen complaint submission form
│   ├── track.html             ← Complaint status tracker by Ticket ID
│   ├── css/
│   │   └── style.css          ← Custom CSS (CSS variables, Flexbox nav, CSS Grid)
│   └── js/
│       ├── dashboard.js       ← Metric calculation & dynamic DOM updates
│       ├── projects.js        ← Project search, filters, and modal logic
│       ├── report.js          ← Asynchronous form submission
│       └── track.js           ← Ticket status search and badge rendering
│
├── data/                      ← Sample data and local fallback database
│   ├── initialData.json       ← 50 realistic MPLADS project records
│   └── mplads_local.db        ← Local SQLite database
│
└── VIVA_GUIDE.md              ← Comprehensive Viva Defense & Quick Modification Guide
```

---

##  Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
*(Or run `node server.js` directly)*

### 3. Open in Browser
Visit **`http://localhost:3000`** in your browser.

---

##  Database Operation

- **MongoDB (Default if available)**: If MongoDB is running locally or a MongoDB Atlas connection string is provided in `.env`, the application connects via Mongoose.
- **SQLite (Offline Fallback)**: If MongoDB is not running, the application automatically switches to the built-in local SQLite database (`data/mplads_local.db`). All searches, filters, and complaint submissions work immediately with zero configuration needed.

---

##  Viva & Defense Preparation

For a complete walkthrough of potential viva questions, architecture explanations, and live code modification cheatsheets, see **[VIVA_GUIDE.md](VIVA_GUIDE.md)**.
