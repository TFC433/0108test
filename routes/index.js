// routes/index.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');

// --- 引入 Controllers ---
const externalController = require('../controllers/external.controller');
const contactController = require('../controllers/contact.controller'); 

// --- 引入其他路由模組 ---
const authRoutes = require('./auth.routes');
const opportunityRoutes = require('./opportunity.routes');
const systemRoutes = require('./system.routes');
const announcementRoutes = require('./announcement.routes');
const contactRoutes = require('./contact.routes');
const companyRoutes = require('./company.routes');
const interactionRoutes = require('./interaction.routes');
const weeklyRoutes = require('./weekly.routes');
const salesRoutes = require('./sales.routes');
const eventRoutes = require('./event.routes');         
const calendarRoutes = require('./calendar.routes');   
const lineLeadsRoutes = require('./line-leads.routes'); 
const dashboardRoutes = require('./dashboard.routes'); // ★★★ 【新增】Dashboard Routes

// ★★★ 【新增】商品路由 ★★★
const productRoutes = require('./product.routes');

// ==========================================
// 1. 【公開區域】
// ==========================================
router.use('/auth', authRoutes);
router.use('/line', lineLeadsRoutes); 
router.get('/drive/thumbnail', externalController.getDriveThumbnail);

// ==========================================
// 2. 【保護區域】
// ==========================================
router.use(authMiddleware.verifyToken); 

router.post('/companies/:companyName/generate-profile', externalController.generateCompanyProfile);

// 掛載其他業務模組
router.use('/dashboard', dashboardRoutes); // ★★★ 掛載 Dashboard 路由
router.use('/opportunities', opportunityRoutes);

// System Routes & Legacy Aliases
// Mount at /system for new standard paths (e.g., /api/system/status)
router.use('/system', systemRoutes);

// Legacy Alias: /config -> /api/system/config
router.get('/config', (req, res, next) => {
    const controller = require('../controllers/system.controller');
    controller.getSystemConfig(req, res, next);
});
// Legacy Alias: /cache/invalidate -> /api/system/cache/invalidate
router.post('/cache/invalidate', (req, res, next) => {
    const controller = require('../controllers/system.controller');
    controller.invalidateCache(req, res, next);
});

router.use('/announcements', announcementRoutes);
router.use('/contacts', contactRoutes);
router.use('/companies', companyRoutes);
router.use('/interactions', interactionRoutes);
router.use('/business/weekly', weeklyRoutes);
router.use('/sales-analysis', salesRoutes);
router.use('/events', eventRoutes);         
router.use('/calendar', calendarRoutes);   

// ★★★ 【掛載 Phase 2 路由】 ★★★
// 路徑：/api/products
router.use('/products', productRoutes);

// 特例處理
router.get('/contact-list', contactController.searchContactList);

// 404 處理
router.use('*', (req, res) => {
    res.status(404).json({ success: false, error: 'API 端點不存在' });
});

module.exports = router;
