// controllers/dashboard.controller.js
const { handleApiError } = require('../middleware/error.middleware');

// 輔助函式：從 req.app 獲取服務
const getServices = (req) => req.app.get('services');

class DashboardController {
    constructor() {
        this.getDashboardData = this.getDashboardData.bind(this);
        this.getContactsDashboardData = this.getContactsDashboardData.bind(this);
        this.getEventsDashboardData = this.getEventsDashboardData.bind(this);
        this.getCompaniesDashboardData = this.getCompaniesDashboardData.bind(this);
        this.getOpportunitiesDashboardData = this.getOpportunitiesDashboardData.bind(this);
    }

    // 處理 GET /api/dashboard
    async getDashboardData(req, res) {
        try {
            const { dashboardService } = getServices(req);
            const data = await dashboardService.getDashboardData();
            res.json({ success: true, data });
        } catch (error) { handleApiError(res, error, 'Get Dashboard Data'); }
    }

    // 處理 GET /api/dashboard/contacts
    async getContactsDashboardData(req, res) {
        try {
            const { dashboardService } = getServices(req);
            const data = await dashboardService.getContactsDashboardData();
            res.json({ success: true, data });
        } catch (error) { handleApiError(res, error, 'Get Contacts Dashboard Data'); }
    }

    // 處理 GET /api/dashboard/events
    async getEventsDashboardData(req, res) {
        try {
            const { dashboardService } = getServices(req);
            const data = await dashboardService.getEventsDashboardData();
            res.json({ success: true, data });
        } catch (error) { handleApiError(res, error, 'Get Events Dashboard Data'); }
    }

    // 處理 GET /api/dashboard/companies
    async getCompaniesDashboardData(req, res) {
        try {
            const { dashboardService } = getServices(req);
            const data = await dashboardService.getCompaniesDashboardData();
            res.json({ success: true, data });
        } catch (error) { handleApiError(res, error, 'Get Companies Dashboard Data'); }
    }

    // 處理 GET /api/dashboard/opportunities
    async getOpportunitiesDashboardData(req, res) {
        try {
            const { dashboardService } = getServices(req);
            const data = await dashboardService.getOpportunitiesDashboardData();
            res.json({ success: true, data });
        } catch (error) { handleApiError(res, error, 'Get Opportunities Dashboard Data'); }
    }
}

module.exports = new DashboardController();
