// routes/dashboard.routes.js
const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// 所有儀表板路由都需要認證
router.use(verifyToken);

// 主儀表板
router.get('/', dashboardController.getDashboardData);

// 各模組儀表板
router.get('/contacts', dashboardController.getContactsDashboardData);
router.get('/events', dashboardController.getEventsDashboardData);
router.get('/companies', dashboardController.getCompaniesDashboardData);
router.get('/opportunities', dashboardController.getOpportunitiesDashboardData);

module.exports = router;
