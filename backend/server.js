const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// โหลด config database เพื่อทดสอบการเชื่อมต่อตอน start server
require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// Serve uploaded files (employee photos, reports, contracts)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Routes
const siteRoutes = require('./routes/siteRoutes');
app.use('/api/sites', siteRoutes);

const manufacturerRoutes = require('./routes/manufacturerRoutes');
app.use('/api/manufacturers', manufacturerRoutes);

const deviceRoleRoutes = require('./routes/deviceRoleRoutes');
app.use('/api/device-roles', deviceRoleRoutes);

const deviceTypeRoutes = require('./routes/deviceTypeRoutes');
app.use('/api/device-types', deviceTypeRoutes);

const deviceRoutes = require('./routes/deviceRoutes');
app.use('/api/devices', deviceRoutes);

const employeeRoutes = require('./routes/employeeRoutes');
app.use('/api/employees', employeeRoutes);

const contractRoutes = require('./routes/contractRoutes');
app.use('/api/contracts', contractRoutes);

const taskRoutes = require('./routes/taskRoutes');
app.use('/api/tasks', taskRoutes);

const reportRoutes = require('./routes/reportRoutes');
app.use('/api/pm-reports', reportRoutes);
app.use('/api/ma-reports', reportRoutes);

const analyticsRoutes = require('./routes/analyticsRoutes');
app.use('/api/analytics', analyticsRoutes);

const holidayRoutes = require('./routes/holidayRoutes');
app.use('/api/holidays', holidayRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'MA/PM Plan API',
    version: '0.0.3'
  });
});

// 404 ใต้ /api ที่ไม่มี route — ตอบ JSON แทนข้อความ plain/HTML ของ Express
app.use((req, res) => {
  if (String(req.originalUrl || '').startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: 'API route not found',
      path: req.originalUrl,
    });
  }
  res.status(404).type('txt').send('Not found');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
