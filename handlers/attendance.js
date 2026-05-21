const db = require('../db');
const config = require('../config');
const { proto } = require('@whiskeysockets/baileys');

// Generate interactive button message for attendance
function buildAttendanceButtons(students) {
  if (!students || students.length === 0) {
    return { text: 'Belum ada siswa terdaftar.' };
  }

  const sections = config.statusAbsen.map(status => ({
    title: status,
    rows: students
      .filter(s => !db.hasAttended(s.jid))
      .map(s => ({
        title: s.name,
        id: `absen_${status}_${s.jid}`,
      }))
  }));

  return {
    text: '📋 *ABSENSI HARI INI*\nTap nama kamu, lalu pilih status:',
    sections,
    buttonText: 'Pilih Nama',
  };
}

// Generate summary message for parent group
function buildParentSummary() {
  const summary = db.getAttendanceSummary();
  const total = db.getStudentCount();
  const today = db.getTodayAttendance();
  const missing = db.getMissingStudents();

  let msg = `📋 *LAPORAN ABSENSI*\n${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

  let hadir = 0, sakit = 0, izin = 0, alpa = 0;
  for (const row of (summary[0]?.values || [])) {
    const s = row[0];
    const c = row[1];
    if (s === 'Hadir') hadir = c;
    else if (s === 'Sakit') sakit = c;
    else if (s === 'Izin') izin = c;
    else if (s === 'Alpa') alpa = c;
  }

  msg += `✅ Hadir: ${hadir}\n`;
  msg += `🤒 Sakit: ${sakit}\n`;
  msg += `📝 Izin: ${izin}\n`;
  msg += `❌ Alpa: ${alpa}\n\n`;

  if (missing.length > 0) {
    msg += `⏳ *Belum Absen:*\n`;
    for (const row of missing) {
      msg += `  - ${row[0]}\n`;
    }
    msg += `\n`;
  }

  const hadirList = (today[0]?.values || []).filter(r => r[2] === 'Hadir');
  if (hadirList.length > 0) {
    msg += `✅ *Hadir:*\n`;
    for (const r of hadirList) {
      msg += `  ${r[1]} (${r[3]})\n`;
    }
  }

  return msg.trim();
}

// Process attendance button interaction
function handleAttendanceTap(jid, data) {
  // data format: absen_{status}_{studentJid}
  const parts = data.split('_');
  if (parts.length !== 3 || parts[0] !== 'absen') return null;

  const status = parts[1];
  const studentJid = parts[2];

  if (!config.statusAbsen.includes(status)) return null;

  // Get student name
  const student = db.getStudent(studentJid);
  if (!student || student.length === 0) return null;

  const name = student[0].values[0][1];

  db.recordAttendance(studentJid, name, status, jid);
  return `✅ ${name}: ${status}`;
}

module.exports = {
  buildAttendanceButtons,
  buildParentSummary,
  handleAttendanceTap,
};
