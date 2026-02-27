const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// JWT Middleware
const { authenticateToken } = require('./middleware/authMiddleware');

// Routes ที่ไม่ต้องใช้ Token (Login, Register)
const loginRoutes = require('./routes/loginRoutes');
app.use('/api/auth', loginRoutes);

// Routes ที่ต้องใช้ Token (ทุก API ยกเว้น auth)
const siteRoutes = require('./routes/siteRoutes');
app.use('/api/sites', authenticateToken, siteRoutes);

const manufacturerRoutes = require('./routes/manufacturerRoutes');
app.use('/api/manufacturers', authenticateToken, manufacturerRoutes);

const deviceRoleRoutes = require('./routes/deviceRoleRoutes');
app.use('/api/device-roles', authenticateToken, deviceRoleRoutes);

const deviceTypeRoutes = require('./routes/deviceTypeRoutes');
app.use('/api/device-types', authenticateToken, deviceTypeRoutes);

const deviceRoutes = require('./routes/deviceRoutes');
app.use('/api/devices', authenticateToken, deviceRoutes);

const netboxRoutes = require('./routes/netboxRoutes');
app.use('/api/netbox', authenticateToken, netboxRoutes);

const statRoutes = require('./routes/statRoutes');
app.use('/api/stats', authenticateToken, statRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'TCC Stock Management API',
    version: '1.0.0'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server กำลังทำงานที่ port ${PORT}`);
  console.log(`📡 http://localhost:${PORT}`);
});
