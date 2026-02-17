const express = require('express');
const router = express.Router();
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  checkEngineerConflict,
} = require('../controllers/taskController');

// GET - list tasks
router.get('/', getTasks);

// GET - check engineer conflict (ต้องอยู่ก่อน /:id เพื่อไม่ให้ match กับ :id)
router.get('/check-conflict', checkEngineerConflict);

// GET - task by id (ต้องอยู่หลัง specific routes)
router.get('/:id', getTaskById);

// POST - create task
router.post('/', createTask);

// PUT - update task
router.put('/:id', updateTask);

// DELETE - delete task
router.delete('/:id', deleteTask);

module.exports = router;

