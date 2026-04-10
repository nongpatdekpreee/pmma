const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  checkEngineerConflict,
  getOverdueTasks,
  getCompletedTasks,
  getInprocessTasks,
  getPendingTasks,
  uploadTaskFile,
  getTaskMaNotice,
} = require('../controllers/taskController');

const tasksUploadDir = path.join(__dirname, '..', 'uploads', 'tasks');
if (!fs.existsSync(path.join(__dirname, '..', 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });
}
if (!fs.existsSync(tasksUploadDir)) {
  fs.mkdirSync(tasksUploadDir, { recursive: true });
}

const taskFileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tasksUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});
const taskFileUpload = multer({
  storage: taskFileStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// GET - list tasks
router.get('/', getTasks);

// GET - check engineer conflict (ต้องอยู่ก่อน /:id เพื่อไม่ให้ match กับ :id)
router.get('/check-conflict', checkEngineerConflict);

// GET - overdue tasks แยก MA/PM: status='not-started', end_date < CURRENT_DATE
router.get('/overdue', getOverdueTasks);

// GET - completed tasks แยก MA/PM: status='done'
router.get('/completed', getCompletedTasks);

// GET - inprocess tasks แยก MA/PM
router.get('/inprocess', getInprocessTasks);

// GET - pending tasks แยก MA/PM
router.get('/pending', getPendingTasks);

// POST - อัปโหลดไฟล์แนบงาน MA (ต้องอยู่ก่อน POST / และก่อน GET /:id ไม่ชน path)
router.post('/upload', taskFileUpload.single('file'), uploadTaskFile);

// GET - เปิดดูไฟล์ repair notice (?b=basename บน disk) — ต้องอยู่ก่อน GET /:id
router.get('/:id/ma-notice', getTaskMaNotice);

// GET - task by id (ต้องอยู่หลัง specific routes)
router.get('/:id', getTaskById);

// POST - create task
router.post('/', createTask);

// PUT - update task
router.put('/:id', updateTask);

// DELETE - delete task
router.delete('/:id', deleteTask);

module.exports = router;

