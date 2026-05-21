module.exports = {
  phoneNumber: process.env.PHONE || '6287787943496',
  prefix: '/',
  authPath: './auth',
  dbPath: './data.db',
  absenStart: '07:00',
  absenEnd: '07:30',
  statusAbsen: ['Hadir', 'Sakit', 'Izin', 'Alpa'],
};
