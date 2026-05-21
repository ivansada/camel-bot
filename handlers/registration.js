const db = require('../db');

let registrationEnabled = true;

function setRegistrationEnabled(val) {
  registrationEnabled = val;
}

function isRegistrationEnabled() {
  return registrationEnabled;
}

function parseRegistration(text, sender) {
  // Format: daftar Nama Lengkap - 08123456789
  // atau: /daftar Nama Lengkap - 08123456789
  const cleaned = text.replace(/^\/?daftar\s+/i, '').trim();
  const parts = cleaned.split(/\s*[-–—]\s*/);

  if (parts.length < 2) return null;

  const name = parts[0].trim();
  const parentNumber = parts[1].trim().replace(/[^0-9]/g, '');

  if (!name || name.length < 2) return null;
  if (parentNumber.length < 10) return null;

  return { name, parentNumber };
}

function handleGroupRegistration(text, sender) {
  if (!registrationEnabled) return null;

  const data = parseRegistration(text, sender);
  if (!data) return null;

  // Cek udah terdaftar
  if (db.isRegistered(sender)) {
    const existing = db.getStudent(sender);
    const oldName = existing[0]?.values[0]?.[1] || '';
    // Update data
    db.registerStudent(sender, data.name, data.parentNumber);
    return `Data *${data.name}* diperbarui. Ortu: ${data.parentNumber}`;
  }

  db.registerStudent(sender, data.name, data.parentNumber);
  return `✅ *${data.name}* berhasil daftar!\nNo Ortu: ${data.parentNumber}`;
}

module.exports = {
  setRegistrationEnabled,
  isRegistrationEnabled,
  handleGroupRegistration,
  parseRegistration,
};
