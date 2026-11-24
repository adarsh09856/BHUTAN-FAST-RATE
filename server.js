const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database
db.getDb();

// Mount API Routes
app.use('/api', require('./routes/public'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/guide', require('./routes/guide'));
app.use('/api/client', require('./routes/client'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'Bhutan Fast Rate Tours API',
    license: 'TR/2018/9882',
    timestamp: new Date().toISOString()
  });
});

// Serve static frontend files
app.use(express.static(__dirname));

// Fallback to index.html for root requests
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`⚡ BHUTAN FAST RATE TOURS - PRODUCTION SERVER ONLINE`);
    console.log(`📍 Web & API URL: http://localhost:${PORT}`);
    console.log(`🛡️  Admin Panel:  http://localhost:${PORT}/admin/login.html`);
    console.log(`🧳 Client Portal: http://localhost:${PORT}/client/login.html`);
    console.log(`🏔️  Guide Portal:  http://localhost:${PORT}/guide/login.html`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
