const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// โหลด config database เพื่อทดสอบการเชื่อมต่อตอน start server
require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
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
