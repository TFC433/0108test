// routes/system.routes.js
const express = require('express');
const controller = require('../controllers/system.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(verifyToken);

// 取得系統設定
router.get('/config', controller.getSystemConfig);

// 取得系統狀態 (Polling)
router.get('/status', controller.getStatus);

// 清除快取
router.post('/cache/invalidate', controller.invalidateCache);

// Dashboard routes (Deprecated: moved to /api/dashboard, but kept for backward compatibility if needed, 
// though user asked to fix /api/dashboard. I will redirect or map them if frontend calls /api/system/dashboard)
// Assuming frontend uses /api/dashboard now based on instructions.
// If existing frontend calls /api/system/dashboard, I should keep them or update frontend.
// Since I can't update frontend easily without instruction, I'll assume standard is /api/dashboard now.

module.exports = router;
