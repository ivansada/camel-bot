const fs = require("fs");
const path = require('path');
const express = require('express');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const PHONE = process.env.PHONE || '6287787943496';

// Hapus auth lama biar fresh
const authDir = './auth_render';
if (fs.existsSync(authDir)) { fs.rmSync(authDir, { recursive: true }); }

let currentQR = null;
let qrLastUpdate = null;

// QR endpoint
app.get('/qr', (req, res) => {
  if (currentQR) {
    res.send(`<html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#f0f2f5">
      <h2 style="color:#075e54">Scan QR ini di WhatsApp</h2>
      <p style="color:#666;margin-bottom:20px">Buka WA > Setelan > Perangkat Tertaut > Tautkan</p>
      <img src="${currentQR}" style="max-width:400px;width:100%;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.15)">
      <p style="color:#999;margin-top:20px;font-size:13px">QR diperbarui otomatis setiap 20 detik</p>
      <script>setTimeout(() => location.reload(), 15000)</script>
    </body></html>`);
  } else {
    res.send('<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Menunggu QR...</h2><script>setTimeout(() => location.reload(), 3000)</script></body></html>');
  }
});

app.get('/health', (req, res) => res.send('OK'));
app.get('/', (req, res) => res.redirect('/qr'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server: port ${PORT}`);
  console.log(`QR: https://elegant-unity.railway.app/qr`);
});

// WhatsApp Bot
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'error' }),
    browser: ['Camel Bot', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 60000,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      try {
        const url = await qrcode.toDataURL(qr, { width: 400, margin: 2 });
        currentQR = url;
        console.log('QR baru digenerate');
      } catch (e) {
        console.error('QR error:', e.message);
      }
    }

    if (connection === 'open') {
      console.log('BOT ONLINE!');
      currentQR = null;
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Disconnected. Reconnect:', shouldReconnect);
      if (shouldReconnect) setTimeout(start, 5000);
    }
  });
}

start().catch(console.error);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
