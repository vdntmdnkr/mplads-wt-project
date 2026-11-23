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
let memoryUsers = [];

function loadSeedData() {
  if (fs.existsSync(SEED_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      memoryProjects = (data.projects || []).map((p, idx) => ({ ...p, id: idx + 1, _id: idx + 1 }));
      memoryComplaints = (data.complaints || []).map((c, idx) => ({ ...c, id: idx + 1, _id: idx + 1 }));
      memoryUsers = (data.users || []).map((u, idx) => ({ ...u, id: idx + 1, _id: idx + 1 }));
      return data;
    } catch (e) {
      console.error('Error loading seed file:', e.message);
    }
  }
  return { projects: [], complaints: [], users: [] };
}

// Pre-load in-memory records
loadSeedData();

// Load Mongoose models
const MongoProject = require('./models/Project');
const MongoComplaint = require('./models/Complaint');
const MongoUser = require('./models/User');

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
              latitude REAL,
              longitude REAL,
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
              createdAt TEXT,
              citizenEmail TEXT
            )
          `, () => {
            // Add citizenEmail column if complaints table was previously created without it
            sqliteDb.run('ALTER TABLE complaints ADD COLUMN citizenEmail TEXT', () => {});
          });

          sqliteDb.run(`
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT,
              email TEXT UNIQUE,
              password TEXT,
              role TEXT DEFAULT 'citizen',
              district TEXT DEFAULT 'Pune',
              phone TEXT,
              createdAt TEXT
            )
          `);

          // Safe migrations for coordinates
          sqliteDb.run('ALTER TABLE projects ADD COLUMN latitude REAL', () => {});
          sqliteDb.run('ALTER TABLE projects ADD COLUMN longitude REAL', () => {});

          const seedData = loadSeedData();

          // Seed or update projects
          sqliteDb.get('SELECT COUNT(*) as count FROM projects', (countErr, row) => {
            const projStmt = sqliteDb.prepare(`
              INSERT OR IGNORE INTO projects
              (workId, title, category, state, district, constituency, mpName, status, recommendedAmount, sanctionedAmount, completedAmount, latitude, longitude, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const updateCoordStmt = sqliteDb.prepare(`
              UPDATE projects SET latitude = ?, longitude = ? WHERE workId = ?
            `);

            seedData.projects.forEach(p => {
              projStmt.run(
                p.workId, p.title, p.category, p.state, p.district,
                p.constituency, p.mpName, p.status,
                p.recommendedAmount || 0, p.sanctionedAmount || 0, p.completedAmount || 0,
                p.latitude || null, p.longitude || null,
                new Date().toISOString()
              );
              if (p.latitude && p.longitude) {
                updateCoordStmt.run(p.latitude, p.longitude, p.workId);
              }
            });
            projStmt.finalize();
            updateCoordStmt.finalize();

            // Seed complaints if empty
            sqliteDb.get('SELECT COUNT(*) as count FROM complaints', (cErr, cRow) => {
              if (!cErr && cRow && cRow.count === 0) {
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
              }
            });

            // Seed users if empty
            sqliteDb.get('SELECT COUNT(*) as count FROM users', (uErr, uRow) => {
              if (!uErr && (!uRow || uRow.count === 0)) {
                const userStmt = sqliteDb.prepare(`
                  INSERT OR IGNORE INTO users
                  (name, email, password, role, district, phone, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                (seedData.users || []).forEach(u => {
                  userStmt.run(
                    u.name,
                    (u.email || '').toLowerCase().trim(),
                    u.password,
                    u.role || 'citizen',
                    u.district || 'Pune',
                    u.phone || '',
                    new Date().toISOString()
                  );
                });
                userStmt.finalize();
                console.log(`[DB] SQLite users table initialized with sample users (Pune Authority & Citizen).`);
              }
            });

            console.log(`[DB] SQLite initialized and synchronized with ${seedData.projects.length} projects.`);
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
    const seedData = loadSeedData();
    if (count === 0) {
      await MongoProject.insertMany(seedData.projects);
      await MongoComplaint.insertMany(seedData.complaints);
      console.log(`[DB] MongoDB seeded with ${seedData.projects.length} sample projects.`);
    }

    const uCount = await MongoUser.countDocuments();
    if (uCount === 0 && seedData.users && seedData.users.length > 0) {
      await MongoUser.insertMany(seedData.users);
      console.log(`[DB] MongoDB seeded with ${seedData.users.length} sample users.`);
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

const JsonUser = {
  find: (filter = {}) => {
    let list = memoryUsers.map(u => ({ id: u.id, _id: u._id, name: u.name, email: u.email, role: u.role, district: u.district, phone: u.phone, createdAt: u.createdAt }));
    if (filter.role) list = list.filter(u => u.role === filter.role);
    if (filter.district) list = list.filter(u => u.district === filter.district);
    return Promise.resolve(list);
  },

  findOne: (query = {}) => {
    const user = memoryUsers.find(u => {
      if (query.email && (u.email || '').toLowerCase() === (query.email || '').toLowerCase()) return true;
      if ((query._id || query.id) && String(u.id) === String(query._id || query.id)) return true;
      return false;
    });
    return Promise.resolve(user ? { ...user } : null);
  },

  findById: (id) => {
    const user = memoryUsers.find(u => String(u.id) === String(id) || String(u._id) === String(id));
    if (!user) return Promise.resolve(null);
    const { password, ...safe } = user;
    return Promise.resolve(safe);
  },

  create: (data) => {
    const existing = memoryUsers.find(u => (u.email || '').toLowerCase() === (data.email || '').toLowerCase());
    if (existing) return Promise.reject(new Error('User with this email already exists'));
    const newId = memoryUsers.length + 1;
    const item = {
      id: newId,
      _id: newId,
      name: data.name,
      email: (data.email || '').toLowerCase().trim(),
      password: data.password,
      role: data.role || 'citizen',
      district: data.district || 'Pune',
      phone: data.phone || '',
      createdAt: new Date().toISOString()
    };
    memoryUsers.push(item);
    const { password, ...safe } = item;
    return Promise.resolve(safe);
  },

  countDocuments: () => Promise.resolve(memoryUsers.length)
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
      if (filter.category && filter.category.$regex) { sql += ' AND category LIKE ?'; params.push(`%${filter.category.$regex}%`); }
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
      INSERT INTO projects (workId, title, category, state, district, constituency, mpName, status, recommendedAmount, sanctionedAmount, completedAmount, latitude, longitude, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    sqliteDb.run(sql, [
      data.workId, data.title, data.category, data.state, data.district,
      data.constituency, data.mpName, data.status || 'Recommended',
      data.recommendedAmount || 0, data.sanctionedAmount || 0, data.completedAmount || 0,
      data.latitude || null, data.longitude || null,
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
    let matchObj = {};
    let groupStage = null;
    for (const stage of pipeline) {
      if (stage.$match) matchObj = { ...matchObj, ...stage.$match };
      if (stage.$group) groupStage = stage.$group;
    }

    if (groupStage && groupStage._id === null) {
      let sql = 'SELECT SUM(sanctionedAmount) as totalSanctioned, SUM(completedAmount) as totalCompleted, SUM(recommendedAmount) as totalRecommended FROM projects WHERE 1=1';
      const params = [];
      if (matchObj.state && matchObj.state.$regex) {
        sql += ' AND state LIKE ?';
        params.push(`%${matchObj.state.$regex}%`);
      }
      if (matchObj.district && matchObj.district.$regex) {
        sql += ' AND district LIKE ?';
        params.push(`%${matchObj.district.$regex}%`);
      }
      sqliteDb.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve([{
          _id: null,
          totalSanctioned: (row && row.totalSanctioned) || 0,
          totalCompleted: (row && row.totalCompleted) || 0,
          totalRecommended: (row && row.totalRecommended) || 0
        }]);
      });
    } else if (groupStage && groupStage._id === '$state') {
      let sql = `
        SELECT state as _id, COUNT(*) as totalProjects,
               SUM(CASE WHEN status LIKE '%Completed%' AND status NOT LIKE '%partially%' THEN 1 ELSE 0 END) as completed,
               SUM(sanctionedAmount) as totalSanctioned,
               SUM(completedAmount) as totalSpent
        FROM projects WHERE state IS NOT NULL AND state != ''
      `;
      const params = [];
      if (matchObj.state && matchObj.state.$regex) {
        sql += ' AND state LIKE ?';
        params.push(`%${matchObj.state.$regex}%`);
      }
      sql += ' GROUP BY state ORDER BY totalProjects DESC LIMIT 20';
      sqliteDb.all(sql, params, (err, rows) => {
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
        if (filter.status) {
          sql += ' AND status = ?';
          params.push(filter.status);
        }
        if (filter.citizenEmail) {
          sql += ' AND citizenEmail = ?';
          params.push(filter.citizenEmail);
        }
        if (filter.district) {
          sql += ' AND (district = ? OR projectId LIKE ?)';
          params.push(filter.district, `%${filter.district}%`);
        }
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

  countDocuments: (filter = {}) => new Promise((resolve, reject) => {
    let sql = 'SELECT COUNT(*) as cnt FROM complaints WHERE 1=1';
    const params = [];
    if (filter.citizenEmail) {
      sql += ' AND citizenEmail = ?';
      params.push(filter.citizenEmail);
    }
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.cnt : 0);
    });
  }),

  create: (data) => new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO complaints (ticketId, name, phone, projectId, category, description, status, createdAt, citizenEmail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const dateStr = new Date().toISOString();
    sqliteDb.run(sql, [
      data.ticketId, data.name || 'Anonymous Citizen', data.phone || '', data.projectId || '',
      data.category, data.description, data.status || 'Submitted', dateStr, data.citizenEmail || ''
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

const SqliteUser = {
  find: (filter = {}) => new Promise((resolve, reject) => {
    let sql = 'SELECT id, name, email, role, district, phone, createdAt FROM users WHERE 1=1';
    const params = [];
    if (filter.role) { sql += ' AND role = ?'; params.push(filter.role); }
    if (filter.district) { sql += ' AND district = ?'; params.push(filter.district); }
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(r => ({ ...r, _id: r.id })));
    });
  }),

  findOne: (query = {}) => new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    if (query.email) {
      sql += ' AND LOWER(email) = LOWER(?)';
      params.push(String(query.email).trim());
    }
    if (query._id || query.id) {
      sql += ' AND id = ?';
      params.push(query._id || query.id);
    }
    sqliteDb.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row ? { ...row, _id: row.id } : null);
    });
  }),

  findById: (id) => new Promise((resolve, reject) => {
    sqliteDb.get('SELECT id, name, email, role, district, phone, createdAt FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row ? { ...row, _id: row.id } : null);
    });
  }),

  create: (data) => new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO users (name, email, password, role, district, phone, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const dateStr = new Date().toISOString();
    sqliteDb.run(sql, [
      data.name,
      (data.email || '').toLowerCase().trim(),
      data.password,
      data.role || 'citizen',
      data.district || 'Pune',
      data.phone || '',
      dateStr
    ], function(err) {
      if (err) return reject(err);
      resolve({
        id: this.lastID,
        _id: this.lastID,
        name: data.name,
        email: data.email,
        role: data.role || 'citizen',
        district: data.district || 'Pune',
        phone: data.phone || '',
        createdAt: dateStr
      });
    });
  }),

  countDocuments: () => new Promise((resolve, reject) => {
    sqliteDb.get('SELECT COUNT(*) as cnt FROM users', (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.cnt : 0);
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

const UserProxy = new Proxy({}, {
  get: (target, prop) => {
    if (isUsingMongo) return MongoUser[prop];
    if (isUsingSqlite && sqliteDb) return SqliteUser[prop];
    return JsonUser[prop];
  }
});

module.exports = {
  connectDB,
  isUsingMongo: () => isUsingMongo,
  Project: ProjectProxy,
  Complaint: ComplaintProxy,
  User: UserProxy,
  MongoProject,
  MongoComplaint,
  MongoUser
};
