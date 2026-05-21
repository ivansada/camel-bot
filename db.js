const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = './data.db';

let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      jid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_number TEXT NOT NULL,
      registered_at TEXT DEFAULT (datetime('now', '+7 hours'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Hadir','Sakit','Izin','Alpa')),
      date TEXT NOT NULL DEFAULT (date('now', '+7 hours')),
      time TEXT NOT NULL DEFAULT (time('now', '+7 hours')),
      noted_by TEXT,
      UNIQUE(jid, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      jid TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('class', 'parent')),
      name TEXT
    )
  `);

  save();
  return db;
}

function save() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// === Student CRUD ===

function getStudent(jid) {
  return db.exec(`SELECT * FROM students WHERE jid = '${jid.replace(/'/g, "''")}'`);
}

function getAllStudents() {
  return db.exec('SELECT * FROM students ORDER BY name ASC');
}

function getUnregisteredStudents(knownJids) {
  if (knownJids.length === 0) return [];
  const escaped = knownJids.map(j => `'${j.replace(/'/g, "''")}'`).join(',');
  return db.exec(`SELECT jid FROM students WHERE jid NOT IN (${escaped})`);
}

function registerStudent(jid, name, parentNumber) {
  db.run(
    `INSERT OR REPLACE INTO students (jid, name, parent_number) VALUES (?, ?, ?)`,
    [jid, name, parentNumber]
  );
  save();
}

function isRegistered(jid) {
  const r = db.exec(`SELECT 1 FROM students WHERE jid = '${jid.replace(/'/g, "''")}'`);
  return r.length > 0 && r[0].values.length > 0;
}

function getStudentCount() {
  const r = db.exec('SELECT COUNT(*) as c FROM students');
  return r[0]?.values[0]?.[0] || 0;
}

// === Attendance CRUD ===

function recordAttendance(jid, name, status, notedBy = null) {
  const safeJid = jid.replace(/'/g, "''");
  const safeName = name.replace(/'/g, "''");
  const noted = notedBy ? `'${notedBy.replace(/'/g, "''")}'` : 'NULL';

  db.run(`
    INSERT OR REPLACE INTO attendance (jid, name, status, date, time, noted_by)
    VALUES (
      '${safeJid}',
      '${safeName}',
      '${status}',
      (SELECT date('now', '+7 hours')),
      (SELECT time('now', '+7 hours')),
      ${noted}
    )
  `);
  save();
}

function getTodayAttendance() {
  return db.exec(`
    SELECT a.*, s.parent_number
    FROM attendance a
    LEFT JOIN students s ON s.jid = a.jid
    WHERE a.date = date('now', '+7 hours')
    ORDER BY a.name ASC
  `);
}

function getAttendanceSummary(date = null) {
  const d = date || `date('now', '+7 hours')`;
  return db.exec(`
    SELECT status, COUNT(*) as count
    FROM attendance
    WHERE date = ${d}
    GROUP BY status
  `);
}

function getMissingStudents() {
  return db.exec(`
    SELECT s.name
    FROM students s
    LEFT JOIN attendance a ON a.jid = s.jid AND a.date = date('now', '+7 hours')
    WHERE a.jid IS NULL
    ORDER BY s.name ASC
  `);
}

function hasAttended(jid) {
  const r = db.exec(`
    SELECT 1 FROM attendance
    WHERE jid = '${jid.replace(/'/g, "''")}'
    AND date = date('now', '+7 hours')
  `);
  return r.length > 0 && r[0].values.length > 0;
}

// === Groups ===

function saveGroup(jid, type, name) {
  db.run(
    `INSERT OR REPLACE INTO groups (jid, type, name) VALUES (?, ?, ?)`,
    [jid, type, name]
  );
  save();
}

function getGroupByType(type) {
  const r = db.exec(`SELECT * FROM groups WHERE type = '${type}' LIMIT 1`);
  return r.length > 0 ? {
    jid: r[0].values[0][0],
    type: r[0].values[0][1],
    name: r[0].values[0][2]
  } : null;
}

// === Utility ===

function getParentNumbers() {
  const r = db.exec('SELECT parent_number FROM students WHERE parent_number IS NOT NULL AND parent_number != \'\'');
  return r.map(row => row.values[0]);
}

function formatAsTable(data) {
  if (!data || data.length === 0) return 'Tidak ada data.';
  const cols = data[0].columns;
  const rows = data[0].values;
  let result = '';
  for (const row of rows) {
    result += row.join('\t') + '\n';
  }
  return result;
}

module.exports = {
  initDB,
  save,
  getStudent,
  getAllStudents,
  registerStudent,
  isRegistered,
  getStudentCount,
  recordAttendance,
  getTodayAttendance,
  getAttendanceSummary,
  getMissingStudents,
  hasAttended,
  saveGroup,
  getGroupByType,
  getParentNumbers,
  formatAsTable,
};
