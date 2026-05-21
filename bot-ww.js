const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = 3002;
const app = express();

let client;

async function start() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './wwjs_auth' }),
    puppeteer: {
      executablePath: '/usr/bin/chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
    webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wikipedia99/whatsapp-web.js/main/src/versions/2.2413.51.json' },
  });

  client.on('qr', async (qr) => {
    console.log('QR received, generating image...');
    const url = await qrcode.toDataURL(qr, { width: 600, margin: 2 });
    fs.writeFileSync('/home/ivan/wabot/web/public/qr_ww.png', Buffer.from(url.split(',')[1], 'base64'));
    console.log('QR saved: http://192.168.100.12:' + PORT + '/qr_ww.png');
  });

  client.on('ready', () => {
    console.log('\n*** BOT WHATSAPP TERHUBUNG! ***\n');
    // Hapus QR
    try { fs.unlinkSync('/home/ivan/wabot/web/public/qr_ww.png'); } catch(e) {}
  });

  client.on('disconnected', (reason) => {
    console.log('Disconnected:', reason);
    setTimeout(() => client.initialize(), 5000);
  });

  // Handle message
  client.on('message', async (msg) => {
    // Akan diimplementasikan
    console.log('Pesan:', msg.from, msg.body?.substring(0, 30));
  });

  // Web server untuk serve QR
  app.get('/qr_ww.png', (req, res) => {
    const file = '/home/ivan/wabot/web/public/qr_ww.png';
    if (fs.existsSync(file)) res.sendFile(file);
    else res.status(404).send('QR not ready yet');
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log('QR tersedia di: http://192.168.100.12:' + PORT + '/qr_ww.png');
  });

  await client.initialize();
}

start().catch(e => {
  console.error('Fatal:', e.message);
  setTimeout(start, 5000);
});
