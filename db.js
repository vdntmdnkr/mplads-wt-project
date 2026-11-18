// ============================================================
// db.js  –  Resilient Unified Database Manager (MongoDB + SQLite + JSON)
// Web Technology Full Stack Project
//
// 1. If MongoDB is connected: Uses Mongoose.
// 2. If SQLite is available: Uses SQLite (mplads_local.db).
// 3. If Native SQLite is unavailable (e.g. GLIBC mismatch on cloud):
//    Gracefully falls back to local JSON store without crashing!
// ============================================================

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Attempt to load native sqlite3 safely
let sqlite3 = null;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (err) {
  console.warn('[DB] Native sqlite3 library unavailable, using local JSON store fallback:', err.message);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mplads';
const SQLITE_FILE = path.join(__dirname, 'data', 'mplads_local.db');
const SEED_FILE = path.join(__dirname, 'data', 'initialData.json');

// State tracking
let isUsingMongo = false;
let isUsingSqlite = false;
let sqliteDb = null;

// In-memory data store as universal fallback
let memoryProjects = [];
let memoryComplaints = [];

function loadSeedData() {
  if (fs.existsSync(SEED_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      memoryProjects = (data.projects || []).map((p, idx) => ({ ...p, id: idx + 1, _id: idx + 1 }));
      memoryComplaints = (data.complaints || []).map((c, idx) => ({ ...c, id: idx + 1, _id: idx + 1 }));
      return data;
    } catch (e) {
      console.error('Error loading seed file:', e.message);
    }
  }
  return { projects: [], complaints: [] };
}

// Pre-load in-memory records
loadSeedData();

// Load Mongoose models
const MongoProject = require('./models/Project');
const MongoComplaint = require('./models/Complaint');

// ── Initialize SQLite ─────────────────────────────────────────
function initSqlite() {
  if (!sqlite3) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      sqliteDb = new sqlite3.Database(SQLITE_FILE, (err) => {
        if (err) {
          console.warn('[DB] SQLite connection failed, continuing with JSON store:', err.message);
          return resolve(null);
        }

        sqliteDb.serialize(() => {
          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS projects (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              workId TEXT UNIQUE,
              title TEXT,
              category TEXT,
              state TEXT,
              district TEXT,
              constituency TEXT,
              mpName TEXT,
              status TEXT,
              recommendedAmount REAL DEFAULT 0,
              sanctionedAmount REAL DEFAULT 0,
              completedAmount REAL DEFAULT 0,
              createdAt TEXT
            )
          `);

          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS complaints (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              ticketId TEXT UNIQUE,
              name TEXT,
              phone TEXT,
              projectId TEXT,
              category TEXT,
              description TEXT,
              status TEXT DEFAULT 'Submitted',
              createdAt TEXT
            )
          `);

          sqliteDb.get('SELECT COUNT(*) as count FROM projects', (countErr, row) => {
            if (!countErr && row && row.count === 0) {
              const seedData = loadSeedData();
              const projStmt = sqliteDb.prepare(`
                INSERT OR IGNORE INTO projects
                (workId, title, category, state, district, constituency, mpName, status, recommendedAmount, sanctionedAmount, completedAmount, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);
              seedData.projects.forEach(p => {
                projStmt.run(
                  p.workId, p.title, p.category, p.state, p.district,
                  p.constituency, p.mpName, p.status,
                  p.recommendedAmount || 0, p.sanctionedAmount || 0, p.completedAmount || 0,
                  new Date().toISOString()
                );
              });
              projStmt.finalize();

              const compStmt = sqliteDb.prepare(`
                INSERT OR IGNORE INTO complaints
                (ticketId, name, phone, projectId, category, description, status, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `);
              seedData.complaints.forEach(c => {
                compStmt.run(
                  c.ticketId, c.name, c.phone, c.projectId,
                  c.category, c.description, c.status || 'Submitted',
                  new Date().toISOString()
                );
              });
              compStmt.finalize();
              console.log(`[DB] SQLite initialized and seeded with ${seedData.projects.length} projects.`);
            }
            isUsingSqlite = true;
            resolve(sqliteDb);
          });
        });
      });
    } catch (e) {
      console.warn('[DB] SQLite init exception, using JSON store:', e.message);
      resolve(null);
    }
  });
}

// ── Connect Database ──────────────────────────────────────────
async function connectDB() {
  await initSqlite();

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 2000
    });
    isUsingMongo = true;
    console.log('[DB] MongoDB connected successfully at', MONGO_URI);

    const count = await MongoProject.countDocuments();
    if (count === 0) {
      const seedData = loadSeedData();
      await MongoProject.insertMany(seedData.projects);
      await MongoComplaint.insertMany(seedData.complaints);
      console.log(`[DB] MongoDB seeded with ${seedData.projects.length} sample projects.`);
    }
  } catch (err) {
    isUsingMongo = false;
    if (isUsingSqlite) {
      console.log('[DB] MongoDB offline. Active Database: Local SQLite (data/mplads_local.db)');
    } else {
      console.log('[DB] MongoDB offline. Active Database: Built-in JSON Database Adapter');
    }
  }
}

// ── Fallback Memory / JSON Operations ─────────────────────────
const JsonProject = {
  find: (filter = {}) => ({
    limit: (limitNum = 50) => Promise.resolve(
      memoryProjects.filter(p => {
        if (filter.state && filter.state.$regex && !new RegExp(filter.state.$regex, 'i').test(p.state || '')) return false;
        if (filter.district && filter.district.$regex && !new RegExp(filter.district.$regex, 'i').test(p.district || '')) return false;
        if (filter.constituency && filter.constituency.$regex && !new RegExp(filter.constituency.$regex, 'i').test(p.constituency || '')) return false;
        if (filter.mpName && filter.mpName.$regex && !new RegExp(filter.mpName.$regex, 'i').test(p.mpName || '')) return false;
        if (filter.status && filter.status.$regex && !new RegExp(filter.status.$regex, 'i').test(p.status || '')) return false;
        if (filter.$or) {
          const q = filter.$or[0].title.$regex;
          const reg = new RegExp(q, 'i');
          if (!reg.test(p.title || '') && !reg.test(p.workId || '')) return false;
        }
        return true;
      }).slice(0, limitNum)
    )
  }),

  findById: (id) => Promise.resolve(
    memoryProjects.find(p => String(p._id) === String(id) || String(p.id) === String(id) || p.workId === id) || null
  ),

  create: (data) => {
    const newId = memoryProjects.length + 1;
    const item = { ...data, id: newId, _id: newId, createdAt: new Date().toISOString() };
    memoryProjects.push(item);
    return Promise.resolve(item);
  },

  findByIdAndUpdate: (id, update) => {
    const idx = memoryProjects.findIndex(p => String(p._id) === String(id) || String(p.id) === String(id));
    if (idx === -1) return Promise.resolve(null);
    memoryProjects[idx] = { ...memoryProjects[idx], ...update };
    return Promise.resolve(memoryProjects[idx]);
  },

  findByIdAndDelete: (id) => {
    const idx = memoryProjects.findIndex(p => String(p._id) === String(id) || String(p.id) === String(id));
    if (idx === -1) return Promise.resolve(null);
    memoryProjects.splice(idx, 1);
    return Promise.resolve({ id });
  },

  countDocuments: (filter = {}) => {
    let count = memoryProjects.filter(p => {
      if (filter.state && filter.state.$regex && !new RegExp(filter.state.$regex, 'i').test(p.state || '')) return false;
      if (filter.status && filter.status.$regex && !new RegExp(filter.status.$regex, 'i').test(p.status || '')) return false;
      return true;
    }).length;
    return Promise.resolve(count);
  },

  distinct: (field, filter = {}) => {
    const values = [...new Set(
      memoryProjects
        .filter(p => {
          if (filter.state && filter.state.$regex && !new RegExp(filter.state.$regex, 'i').test(p.state || '')) return false;
          return p[field] && p[field].trim() !== '';
        })
        .map(p => p[field])
    )];
    return Promise.resolve(values);
  },

  aggregate: (pipeline = []) => {
    if (pipeline[1] && pipeline[1].$group && pipeline[1].$group._id === null) {
      let sanc = 0, spent = 0, rec = 0;
      memoryProjects.forEach(p => {
        sanc += Number(p.sanctionedAmount || 0);
        spent += Number(p.completedAmount || 0);
        rec += Number(p.recommendedAmount || 0);
      });
      return Promise.resolve([{ _id: null, totalSanctioned: sanc, totalCompleted: spent, totalRecommended: rec }]);
    }
    if (pipeline[0] && pipeline[0].$group && pipeline[0].$group._id === '$state') {
      const stateMap = {};
      memoryProjects.forEach(p => {
        const s = p.state || 'Unknown';
        if (!stateMap[s]) {
          stateMap[s] = { state: s, _id: s, totalProjects: 0, completed: 0, totalSanctioned: 0, totalSpent: 0 };
        }
        stateMap[s].totalProjects += 1;
        if (/completed/i.test(p.status || '') && !/partially/i.test(p.status || '')) {
          stateMap[s].completed += 1;
        }
        stateMap[s].totalSanctioned += Number(p.sanctionedAmount || 0);
        stateMap[s].totalSpent += Number(p.completedAmount || 0);
      });
      const rows = Object.values(stateMap).sort((a, b) => b.totalProjects - a.totalProjects).slice(0, 20);
      return Promise.resolve(rows);
    }
    return Promise.resolve([]);
  }
};

const JsonComplaint = {
  find: (filter = {}) => ({
    sort: () => ({
      limit: (n = 100) => {
        let list = [...memoryComplaints];
        if (filter.status) list = list.filter(c => c.status === filter.status);
        return Promise.resolve(list.slice(0, n));
      }
    })
  }),

  findOne: (query = {}) => {
    const item = memoryComplaints.find(c => c.ticketId === query.ticketId);
    return Promise.resolve(item || null);
  },

  countDocuments: () => Promise.resolve(memoryComplaints.length),

  create: (data) => {
    const newId = memoryComplaints.length + 1;
    const item = { ...data, id: newId, _id: newId, createdAt: new Date().toISOString() };
    memoryComplaints.unshift(item);
    return Promise.resolve(item);
  },

  findOneAndUpdate: (filter, update) => {
    const item = memoryComplaints.find(c => c.ticketId === filter.ticketId);
    if (!item) return Promise.resolve(null);
    Object.assign(item, update);
    return Promise.resolve(item);
  }
};

// ── SQLite Operations (Used when sqlite3 is available) ───────
const SqliteProject = {
  find: (filter = {}) => ({
    limit: (limitNum = 50) => new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM projects WHERE 1=1';
      const params = [];
      if (filter.state && filter.state.$regex) { sql += ' AND state LIKE ?'; params.push(`%${filter.state.$regex}%`); }
      if (filter.district && filter.district.$regex) { sql += ' AND district LIKE ?'; params.push(`%${filter.district.$regex}%`); }
      if (filter.constituency && filter.constituency.$regex) { sql += ' AND constituency LIKE ?'; params.push(`%${filter.constituency.$regex}%`); }
      if (filter.mpName && filter.mpName.$regex) { sql += ' AND mpName LIKE ?'; params.push(`%${filter.mpName.$regex}%`); }
      if (filter.status && filter.status.$regex) { sql += ' AND status LIKE ?'; params.push(`%${filter.status.$regex}%`); }
      if (filter.$or) {
        const searchVal = filter.$or[0].title.$regex;
        sql += ' AND (title LIKE ? OR workId LIKE ?)';
        params.push(`%${searchVal}%`, `%${searchVal}%`);
      }
      sql += ' ORDER BY id ASC LIMIT ?';
      params.push(limitNum);
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(r => ({ ...r, _id: r.id })));
      });
    })
  }),

  findById: (id) => new Promise((resolve, reject) => {
    sqliteDb.get('SELECT * FROM projects WHERE id = ? OR workId = ?', [id, id], (err, row) => {
      if (err) return reject(err);
      resolve(row ? { ...row, _id: row.id } : null);
    });
  }),

  create: (data) => new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO projects (workId, title, category, state, district, constituency, mpName, status, recommendedAmount, sanctionedAmount, completedAmount, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    sqliteDb.run(sql, [
      data.workId, data.title, data.category, data.state, data.district,
      data.constituency, data.mpName, data.status || 'Recommended',
      data.recommendedAmount || 0, data.sanctionedAmount || 0, data.completedAmount || 0,
      new Date().toISOString()
    ], function(err) {
      if (err) return reject(err);
      resolve({ ...data, id: this.lastID, _id: this.lastID });
    });
  }),

  findByIdAndUpdate: (id, updateData) => new Promise((resolve, reject) => {
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updateData)) {
      if (key !== 'id' && key !== '_id') {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }
    values.push(id);
    sqliteDb.run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
      if (err) return reject(err);
      sqliteDb.get('SELECT * FROM projects WHERE id = ?', [id], (getErr, row) => {
        if (getErr) return reject(getErr);
        resolve(row ? { ...row, _id: row.id } : null);
      });
    });
  }),

  findByIdAndDelete: (id) => new Promise((resolve, reject) => {
    sqliteDb.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
      if (err) return reject(err);
      resolve(this.changes > 0 ? { id } : null);
    });
  }),

  countDocuments: (filter = {}) => new Promise((resolve, reject) => {
    let sql = 'SELECT COUNT(*) as cnt FROM projects WHERE 1=1';
    const params = [];
    if (filter.state && filter.state.$regex) { sql += ' AND state LIKE ?'; params.push(`%${filter.state.$regex}%`); }
    if (filter.status && filter.status.$regex) { sql += ' AND status LIKE ?'; params.push(`%${filter.status.$regex}%`); }
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.cnt : 0);
    });
  }),

  distinct: (field, filter = {}) => new Promise((resolve, reject) => {
    let sql = `SELECT DISTINCT ${field} FROM projects WHERE ${field} IS NOT NULL AND ${field} != ''`;
    const params = [];
    if (filter.state && filter.state.$regex) { sql += ' AND state LIKE ?'; params.push(`%${filter.state.$regex}%`); }
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => r[field]));
    });
  }),

  aggregate: (pipeline = []) => new Promise((resolve, reject) => {
    if (pipeline[1] && pipeline[1].$group && pipeline[1].$group._id === null) {
      let sql = 'SELECT SUM(sanctionedAmount) as totalSanctioned, SUM(completedAmount) as totalCompleted, SUM(recommendedAmount) as totalRecommended FROM projects';
      sqliteDb.get(sql, (err, row) => {
        if (err) return reject(err);
        resolve([{
          _id: null,
          totalSanctioned: (row && row.totalSanctioned) || 0,
          totalCompleted: (row && row.totalCompleted) || 0,
          totalRecommended: (row && row.totalRecommended) || 0
        }]);
      });
    } else if (pipeline[0] && pipeline[0].$group && pipeline[0].$group._id === '$state') {
      let sql = `
        SELECT state as _id, COUNT(*) as totalProjects,
               SUM(CASE WHEN status LIKE '%Completed%' AND status NOT LIKE '%partially%' THEN 1 ELSE 0 END) as completed,
               SUM(sanctionedAmount) as totalSanctioned,
               SUM(completedAmount) as totalSpent
        FROM projects WHERE state IS NOT NULL AND state != ''
        GROUP BY state ORDER BY totalProjects DESC LIMIT 20
      `;
      sqliteDb.all(sql, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    } else {
      resolve([]);
    }
  })
};

const SqliteComplaint = {
  find: (filter = {}) => ({
    sort: () => ({
      limit: (limitNum = 100) => new Promise((resolve, reject) => {
        let sql = 'SELECT * FROM complaints WHERE 1=1';
        const params = [];
        if (filter.status) { sql += ' AND status = ?'; params.push(filter.status); }
        sql += ' ORDER BY id DESC LIMIT ?';
        params.push(limitNum);
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(r => ({ ...r, _id: r.id })));
        });
      })
    })
  }),

  findOne: (query = {}) => new Promise((resolve, reject) => {
    sqliteDb.get('SELECT * FROM complaints WHERE ticketId = ?', [query.ticketId], (err, row) => {
      if (err) return reject(err);
      resolve(row ? { ...row, _id: row.id } : null);
    });
  }),

  countDocuments: () => new Promise((resolve, reject) => {
    sqliteDb.get('SELECT COUNT(*) as cnt FROM complaints', (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.cnt : 0);
    });
  }),

  create: (data) => new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO complaints (ticketId, name, phone, projectId, category, description, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const dateStr = new Date().toISOString();
    sqliteDb.run(sql, [
      data.ticketId, data.name, data.phone || '', data.projectId || '',
      data.category, data.description, data.status || 'Submitted', dateStr
    ], function(err) {
      if (err) return reject(err);
      resolve({ ...data, id: this.lastID, _id: this.lastID, createdAt: dateStr });
    });
  }),

  findOneAndUpdate: (filter, update) => new Promise((resolve, reject) => {
    sqliteDb.run('UPDATE complaints SET status = ? WHERE ticketId = ?', [update.status, filter.ticketId], function(err) {
      if (err) return reject(err);
      sqliteDb.get('SELECT * FROM complaints WHERE ticketId = ?', [filter.ticketId], (getErr, row) => {
        if (getErr) return reject(getErr);
        resolve(row ? { ...row, _id: row.id } : null);
      });
    });
  })
};

// ── Smart Dynamic Proxy (Mongo -> SQLite -> JSON) ─────────────
const ProjectProxy = new Proxy({}, {
  get: (target, prop) => {
    if (isUsingMongo) return MongoProject[prop];
    if (isUsingSqlite && sqliteDb) return SqliteProject[prop];
    return JsonProject[prop];
  }
});

const ComplaintProxy = new Proxy({}, {
  get: (target, prop) => {
    if (isUsingMongo) return MongoComplaint[prop];
    if (isUsingSqlite && sqliteDb) return SqliteComplaint[prop];
    return JsonComplaint[prop];
  }
});

module.exports = {
  connectDB,
  isUsingMongo: () => isUsingMongo,
  Project: ProjectProxy,
  Complaint: ComplaintProxy,
  MongoProject,
  MongoComplaint
};
