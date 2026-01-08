// routes/event.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/event.controller');
// 【新增】引入 dashboard controller 以處理統計數據請求
const dashboardController = require('../controllers/dashboard.controller');

// ==========================================
// Event Log Routes ( /api/events/* )
// ==========================================

// 1. 特殊路徑 (必須放在 /:eventId 之前！)
// ------------------------------------------------
// 這是修復 "讀取資料失敗" 的關鍵。
// 前端 events.js 呼叫 /api/events/dashboard，我們將其導向正確的統計控制器
router.get('/dashboard', dashboardController.getEventsDashboardData);


// 2. 集合路徑
// ------------------------------------------------
// 取得所有列表 (修復列表不顯示的問題)
router.get('/', controller.getEventLogs);
// 建立新事件
router.post('/', controller.createEventLog);


// 3. 參數化路徑 (必須放在最後！)
// ------------------------------------------------
// 如果把 /dashboard 放在這行下面，它就會被當成 id 攔截，導致錯誤
router.get('/:eventId', controller.getEventLogById);
router.put('/:eventId', controller.updateEventLog);
router.delete('/:eventId', controller.deleteEventLog);

module.exports = router;