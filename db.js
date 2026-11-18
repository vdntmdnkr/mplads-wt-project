// ============================================================
// db.js  –  Unified Database Manager (MongoDB + SQLite Fallback)
// Web Technology Full Stack Project
//
// Why this design?
// 1. If MongoDB is installed and running, it uses MongoDB via Mongoose.
// 2. If MongoDB is NOT running (e.g. college lab, offline exam hall),
//    it automatically falls back to SQLite so the app ALWAYS works!
// ============================================================

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mplads';
const SQLITE_FILE = path.join(__dirname, 'data', 'mplads_local.db');

// State tracking
let isUsingMongo = false;
let sqliteDb = null;

// Load Mongoose models
const MongoProject = require('./models/Project');
const MongoComplaint = require('./models/Complaint');

// ── Initialize SQLite ─────────────────────────────────────────
function initSqlite() {
  return new Promise((resolve, reject) => {
    sqliteDb = new sqlite3.Database(SQLITE_FILE, (err) => {
      if (err) return reject(err);

      sqliteDb.serialize(() => {
        // 1. Projects table
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

        // 2. Complaints table
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

        // 3. Check if empty; if so, seed from initialData.json
        sqliteDb.get('SELECT COUNT(*) as count FROM projects', (countErr, row) => {
          if (!countErr && row && row.count === 0) {
            try {
              const seedPath = path.join(__dirname, 'data', 'initialData.json');
              if (fs.existsSync(seedPath)) {
                const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

                // Seed projects
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

                // Seed complaints
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

                console.log(`[DB] SQLite initialized and seeded with ${seedData.projects.length} projects & ${seedData.complaints.length} complaints.`);
              }
            } catch (seedError) {
              console.error('Failed to seed SQLite:', seedError.message);
            }
          }
          resolve(sqliteDb);
        });
      });
    });
  });
}

// ── Connect Database (tries Mongo, falls back to SQLite) ─────
async function connectDB() {
  // Always prepare SQLite so fallback is instantaneous
  await initSqlite();

  try {
    // Attempt Mongoose connection with 2 second timeout
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 2000
    });
    isUsingMongo = true;
    console.log('[DB] MongoDB connected successfully at', MONGO_URI);

    // Auto-seed Mongo if empty
    const count = await MongoProject.countDocuments();
    if (count === 0) {
      const seedPath = path.join(__dirname, 'data', 'initialData.json');
      if (fs.existsSync(seedPath)) {
        const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        await MongoProject.insertMany(seedData.projects);
        await MongoComplaint.insertMany(seedData.complaints);
        console.log(`[DB] MongoDB seeded with ${seedData.projects.length} sample projects.`);
      }
    }
  } catch (err) {
    isUsingMongo = false;
    console.log('[DB] MongoDB not running locally (or connection failed).');
    console.log('[DB] Active Database: Local SQLite (data/mplads_local.db)');
    console.log('     All projects, filters, and complaint submissions are fully functional!');
  }
}

// ── SQLite Project Operations (Unified interface) ────────────
const SqliteProject = {
  find: (filter = {}) => {
    return {
      limit: (limitNum = 50) => {
        return new Promise((resolve, reject) => {
          let sql = 'SELECT * FROM projects WHERE 1=1';
          const params = [];

          if (filter.state && filter.state.$regex) {
            sql += ' AND state LIKE ?';
            params.push(`%${filter.state.$regex}%`);
          }
          if (filter.district && filter.district.$regex) {
            sql += ' AND district LIKE ?';
            params.push(`%${filter.district.$regex}%`);
          }
          if (filter.constituency && filter.constituency.$regex) {
            sql += ' AND constituency LIKE ?';
            params.push(`%${filter.constituency.$regex}%`);
          }
          if (filter.mpName && filter.mpName.$regex) {
            sql += ' AND mpName LIKE ?';
            params.push(`%${filter.mpName.$regex}%`);
          }
          if (filter.status && filter.status.$regex) {
            sql += ' AND status LIKE ?';
            params.push(`%${filter.status.$regex}%`);
          }
          if (filter.$or) {
            const searchVal = filter.$or[0].title.$regex;
            sql += ' AND (title LIKE ? OR workId LIKE ?)';
            params.push(`%${searchVal}%`, `%${searchVal}%`);
          }

          sql += ' ORDER BY id ASC LIMIT ?';
          params.push(limitNum);

          sqliteDb.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            // Map id to _id for frontend compatibility
            const mapped = rows.map(r => ({ ...r, _id: r.id }));
            resolve(mapped);
          });
        });
      }
    };
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      sqliteDb.get('SELECT * FROM projects WHERE id = ? OR workId = ?', [id, id], (err, row) => {
        if (err) return reject(err);
        resolve(row ? { ...row, _id: row.id } : null);
      });
    });
  },

  create: (data) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO projects
        (workId, title, category, state, district, constituency, mpName, status, recommendedAmount, sanctionedAmount, completedAmount, createdAt)
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
    });
  },

  findByIdAndUpdate: (id, updateData) => {
    return new Promise((resolve, reject) => {
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
    });
  },

  findByIdAndDelete: (id) => {
    return new Promise((resolve, reject) => {
      sqliteDb.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0 ? { id } : null);
      });
    });
  },

  countDocuments: (filter = {}) => {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT COUNT(*) as cnt FROM projects WHERE 1=1';
      const params = [];
      if (filter.state && filter.state.$regex) {
        sql += ' AND state LIKE ?';
        params.push(`%${filter.state.$regex}%`);
      }
      if (filter.status && filter.status.$regex) {
        sql += ' AND status LIKE ?';
        params.push(`%${filter.status.$regex}%`);
      }
      sqliteDb.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.cnt : 0);
      });
    });
  },

  distinct: (field, filter = {}) => {
    return new Promise((resolve, reject) => {
      let sql = `SELECT DISTINCT ${field} FROM projects WHERE ${field} IS NOT NULL AND ${field} != ''`;
      const params = [];
      if (filter.state && filter.state.$regex) {
        sql += ' AND state LIKE ?';
        params.push(`%${filter.state.$regex}%`);
      }
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(r => r[field]));
      });
    });
  },

  aggregate: (pipeline = []) => {
    return new Promise((resolve, reject) => {
      // Pipeline 1: Group by null for totals
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
      }
      // Pipeline 2: Group by state
      else if (pipeline[0] && pipeline[0].$group && pipeline[0].$group._id === '$state') {
        let sql = `
          SELECT
            state as _id,
            COUNT(*) as totalProjects,
            SUM(CASE WHEN status LIKE '%Completed%' AND status NOT LIKE '%partially%' THEN 1 ELSE 0 END) as completed,
            SUM(sanctionedAmount) as totalSanctioned,
            SUM(completedAmount) as totalSpent
          FROM projects
          WHERE state IS NOT NULL AND state != ''
          GROUP BY state
          ORDER BY totalProjects DESC
          LIMIT 20
        `;
        sqliteDb.all(sql, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else {
        resolve([]);
      }
    });
  }
};

// ── SQLite Complaint Operations (Unified interface) ──────────
const SqliteComplaint = {
  find: (filter = {}) => {
    return {
      sort: () => ({
        limit: (limitNum = 100) => {
          return new Promise((resolve, reject) => {
            let sql = 'SELECT * FROM complaints WHERE 1=1';
            const params = [];
            if (filter.status) {
              sql += ' AND status = ?';
              params.push(filter.status);
            }
            sql += ' ORDER BY id DESC LIMIT ?';
            params.push(limitNum);
            sqliteDb.all(sql, params, (err, rows) => {
              if (err) return reject(err);
              resolve(rows.map(r => ({ ...r, _id: r.id })));
            });
          });
        }
      })
    };
  },

  findOne: (query = {}) => {
    return new Promise((resolve, reject) => {
      sqliteDb.get('SELECT * FROM complaints WHERE ticketId = ?', [query.ticketId], (err, row) => {
        if (err) return reject(err);
        resolve(row ? { ...row, _id: row.id } : null);
      });
    });
  },

  countDocuments: () => {
    return new Promise((resolve, reject) => {
      sqliteDb.get('SELECT COUNT(*) as cnt FROM complaints', (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.cnt : 0);
      });
    });
  },

  create: (data) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO complaints
        (ticketId, name, phone, projectId, category, description, status, createdAt)
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
    });
  },

  findOneAndUpdate: (filter, update) => {
    return new Promise((resolve, reject) => {
      sqliteDb.run('UPDATE complaints SET status = ? WHERE ticketId = ?', [update.status, filter.ticketId], function(err) {
        if (err) return reject(err);
        sqliteDb.get('SELECT * FROM complaints WHERE ticketId = ?', [filter.ticketId], (getErr, row) => {
          if (getErr) return reject(getErr);
          resolve(row ? { ...row, _id: row.id } : null);
        });
      });
    });
  }
};

// ── Smart Dynamic Proxy (Uses Mongo if connected, else SQLite) ──
const ProjectProxy = new Proxy({}, {
  get: (target, prop) => {
    if (isUsingMongo) {
      return MongoProject[prop];
    }
    return SqliteProject[prop];
  }
});

const ComplaintProxy = new Proxy({}, {
  get: (target, prop) => {
    if (isUsingMongo) {
      return MongoComplaint[prop];
    }
    return SqliteComplaint[prop];
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
