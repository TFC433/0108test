// controllers/system.controller.js
const { handleApiError } = require('../middleware/error.middleware');

// 輔助函式：從 req.app 獲取服務
const getServices = (req) => req.app.get('services');

class SystemController {
    constructor() {
        this.getSystemConfig = this.getSystemConfig.bind(this);
        this.invalidateCache = this.invalidateCache.bind(this);
        this.getDashboardData = this.getDashboardData.bind(this);
        this.getContactsDashboardData = this.getContactsDashboardData.bind(this);
        this.getEventsDashboardData = this.getEventsDashboardData.bind(this);
        this.getCompaniesDashboardData = this.getCompaniesDashboardData.bind(this);
        this.getSystemStatus = this.getSystemStatus.bind(this);
        this.getStatus = this.getSystemStatus.bind(this); // Alias
    }

    // 處理 GET /api/config
    async getSystemConfig(req, res) {
        try {
            const { configReader } = getServices(req);
            res.json(await configReader.getSystemConfig());
        } catch (error) { handleApiError(res, error, 'Get Config'); }
    }

    // 處理 POST /api/cache/invalidate
    async invalidateCache(req, res) {
        try {
            const { configReader } = getServices(req);
            configReader.invalidateCache(null); // 'null' 會清除所有快取
            res.json({ success: true, message: '後端所有快取已清除' });
        } catch (error) { handleApiError(res, error, 'Invalidate Cache'); }
    }

    // 處理 GET /api/dashboard
    // Note: This logic is usually in DashboardController, but existing code had it here.
    // I will keep it here to avoid breaking existing routes immediately, or deprecate it if moving to DashboardController.
    // However, the instructions said "Implement DashboardController and DashboardRoutes (to fix /api/dashboard)".
    // So this method might be better placed in DashboardController, but SystemController had it.
    // I will leave it here as a proxy or implementation if routes point here.
    async getDashboardData(req, res) {
        try {
            const { dashboardService } = getServices(req);
            res.json({ success: true, data: await dashboardService.getDashboardData() });
        } catch (error) { handleApiError(res, error, 'Get Dashboard'); }
    }

    async getContactsDashboardData(req, res) {
        try {
            const { dashboardService } = getServices(req);
            res.json({ success: true, data: await dashboardService.getContactsDashboardData() });
        } catch (error) { handleApiError(res, error, 'Get Contacts Dashboard'); }
    }

    async getEventsDashboardData(req, res) {
        try {
            const { dashboardService } = getServices(req);
            res.json({ success: true, data: await dashboardService.getEventsDashboardData() });
        } catch (error) { handleApiError(res, error, 'Get Events Dashboard'); }
    }

    async getCompaniesDashboardData(req, res) {
        try {
            const { dashboardService } = getServices(req);
            res.json({ success: true, data: await dashboardService.getCompaniesDashboardData() });
        } catch (error) { handleApiError(res, error, 'Get Companies Dashboard'); }
    }

    // --- 【*** 新增：系統狀態輪詢API ***】 ---
    // 處理 GET /api/system/status
    async getSystemStatus(req, res) {
        try {
            const { configReader } = getServices(req);
            // 從 base-reader.js 的共享 cache 中讀取我們儲存的時間戳
            const lastWrite = configReader.cache._globalLastWrite ? configReader.cache._globalLastWrite.data : 0;
            res.json({ success: true, lastWriteTimestamp: lastWrite });
        } catch (error) {
            // 這個請求理論上不應該失敗
            handleApiError(res, error, 'Get System Status');
        }
    }
}

module.exports = new SystemController();
