const express = require('express');
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
} = require('../controllers/taskController');

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

// GET - task by id (ต้องอยู่หลัง specific routes)
router.get('/:id', getTaskById);

// POST - create task
router.post('/', createTask);

// PUT - update task
router.put('/:id', updateTask);

// DELETE - delete task
router.delete('/:id', deleteTask);

module.exports = router;

