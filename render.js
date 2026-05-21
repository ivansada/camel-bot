const fs = require("fs");
// Hapus auth lama biar fresh pairing
const authDir = "./auth_render";
if (fs.existsSync(authDir)) { fs.rmSync(authDir, { recursive: true }); console.log("Auth lama dihapus"); }

const express = require('express');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PHONE = process.env.PHONE || '6287787943496';
const AUTH_DIR = './auth_render';

// Keep alive web server
app.get('/health', (req, res) => res.send('OK'));
app.get('/', (req, res) => res.redirect('/code'));
// Railway intercepts root, use /code instead
app.get('/code', (req, res) => {
  const qrPath = path.join(__dirname, 'public', 'qr_render.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h1>Camel Bot - Absensi</h1>
      <p>Bot menunggu pairing...</p>
      <p id="code">Kode: <strong>${global.pairingCode || 'menunggu...'}</strong></p>
      <script>setInterval(() => location.reload(), 5000)</script>
      </body></html>
    `);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Render server: port ${PORT}`);
});

// WhatsApp Bot
let pairGenerated = false;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'error' }),
    browser: ['Camel Bot', 'Chrome', '1.0.0'],
    connectTimeoutMs: 30000,
    keepAliveIntervalMs: 30000,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    // Pairing code hanya sekali
    if ((connection === 'connecting' || qr) && !pairGenerated) {
      pairGenerated = true;
      try {
        const code = await sock.requestPairingCode(PHONE);
        global.pairingCode = code;
        console.log('KODE PAIRING:', code);
      } catch (e) {
        console.error('Pairing fail:', e.message?.substring(0, 30));
      }
    }

    if (connection === 'open') {
      console.log('BOT ONLINE!');
      global.pairingCode = null;
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Disconnected. Reconnect:', shouldReconnect);
      if (shouldReconnect) {
        pairGenerated = false; // Reset untuk reconnect
        setTimeout(start, 5000);
      }
    }
  });
}

start().catch(console.error);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
