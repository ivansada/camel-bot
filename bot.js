const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const db = require('./db');
const config = require('./config');

let sock;

async function start() {
  await db.initDB();

  const { state, saveCreds } = await useMultiFileAuthState(config.authPath);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'error' }),
    browser: ['Camel Bot', 'Chrome', '1.0.0'],
    connectTimeoutMs: 30000,
    keepAliveIntervalMs: 30000,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    emitOwnEvents: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid.endsWith('@broadcast')) continue;
      await handleMessage(msg);
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (connection === 'connecting' || qr) {
      try {
        const code = await sock.requestPairingCode(config.phoneNumber);
        console.log(`\nKODE PAIRING: ${code}\n`);
        console.log(`HP nomor ${config.phoneNumber}`);
        console.log('Settings > Perangkat Tertaut > Masukin kode\n');
      } catch (error) {
        console.error('Gagal generate pairing code:', error.message?.substring(0, 30));
      }
    }

    if (connection === 'open') {
      console.log('Bot WA online!');
      const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
      console.log(`Terdaftar di ${Object.keys(groups).length} grup`);
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Koneksi putus. Reconnect:', shouldReconnect);
      if (shouldReconnect) setTimeout(start, 3000);
    }
  });
}

async function handleMessage(msg) {
  const jid = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
  const pushName = msg.pushName || '';

  if (!text) return;

  // Group message
  if (jid.endsWith('@g.us')) {
    await handleGroupMessage(jid, sender, text);
    return;
  }
}

async function handleGroupMessage(groupJid, sender, text) {
  // Student registration: daftar Nama - NoWA
  if (text.toLowerCase().replace(/^\//, '').startsWith('daftar')) {
    const result = handleGroupRegistration(text, sender);
    if (result) await sock.sendMessage(groupJid, { text: result });
    return;
  }

  if (!text.startsWith('/')) return;

  const cmd = text.slice(1).split(' ')[0].toLowerCase();

  // TODO: absensi, laporan, dll
}

function handleGroupRegistration(text, sender) {
  const cleaned = text.replace(/^\/?daftar\s+/i, '').trim();
  const parts = cleaned.split(/\s*[-–—]\s*/);
  if (parts.length < 2) {
    return `Format: daftar Nama - NoWA\nContoh: daftar Andi - 6281234567890`;
  }

  const name = parts[0].trim();
  const parent = parts[1].trim().replace(/[^0-9]/g, '');
  if (!name || name.length < 2 || parent.length < 10) {
    return 'Nama minimal 2 karakter, NoWA minimal 10 digit';
  }

  db.registerStudent(sender, name, parent);
  return `Daftar berhasil: ${name}`;
}

start().catch(console.error);

process.on('SIGINT', () => { db.save(); process.exit(0); });
process.on('SIGTERM', () => { db.save(); process.exit(0); });
