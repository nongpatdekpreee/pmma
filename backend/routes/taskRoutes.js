const express = require('express');
const router = express.Router();
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  
} = require('../controllers/taskController');

// GET - list tasks
router.get('/', getTasks);

// GET - task by id
router.get('/:id', getTaskById);

// POST - create task
router.post('/', createTask);

// PUT - update task
router.put('/:id', updateTask);

module.exports = router;

