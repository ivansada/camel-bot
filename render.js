const fs = require("fs");
const path = require('path');
const express = require('express');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const PHONE = process.env.PHONE || '6287877943496';

// Hapus auth lama biar fresh
const authDir = './auth_render';
if (fs.existsSync(authDir)) { fs.rmSync(authDir, { recursive: true }); }

let currentQR = null;
let currentPairCode = null;
let pairGenerated = false;

// Endpoint utama: QR + kode pairing
app.get('/qr', (req, res) => {
  res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:20px;background:#f0f2f5">
    <h2 style="color:#075e54">Camel Bot - Pairing</h2>
    ${currentPairCode ? `<div style="background:#fff;border-radius:12px;padding:20px;margin:16px auto;max-width:400px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
      <p style="font-size:14px;color:#666">KODE PAIRING:</p>
      <p style="font-size:36px;font-weight:bold;letter-spacing:6px;color:#075e54;margin:8px 0">${currentPairCode}</p>
      <p style="font-size:13px;color:#999">WA > Setelan > Perangkat Tertaut > Tautkan</p>
    </div>` : ''}
    ${currentQR ? `<div style="background:#fff;border-radius:12px;padding:20px;margin:16px auto;max-width:400px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
      <p style="font-size:14px;color:#666;margin-bottom:12px">Atau scan QR:</p>
      <img src="${currentQR}" style="max-width:350px;width:100%;border-radius:8px">
    </div>` : ''}
    ${!currentQR && !currentPairCode ? '<div style="padding:40px"><p>Menunggu QR...</p><script>setTimeout(()=>location.reload(),3000)</script></div>' : ''}
    <p style="color:#999;font-size:11px;margin-top:20px">Halaman diperbarui otomatis</p>
    <script>setTimeout(()=>location.reload(),10000)</script>
  </body></html>`);
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
      
      // Generate pairing code juga
      if (!pairGenerated) {
        pairGenerated = true;
        try {
          const code = await sock.requestPairingCode(PHONE);
          currentPairCode = code;
          console.log('KODE PAIRING:', code);
        } catch (e) {
          console.error('Pairing code fail:', e.message?.substring(0, 30));
        }
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
