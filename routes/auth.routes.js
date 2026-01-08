// routes/auth.routes.js
const express = require('express');
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// 公開路由
router.post('/login', authController.login);

// 受保護路由
router.get('/session', verifyToken, authController.verifySession);
router.post('/verify-password', verifyToken, authController.verifyPassword);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;
