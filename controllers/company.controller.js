// controllers/company.controller.js
// [Version: 2026-01-08-Refactor-Stage1]
// [Date: 2026-01-08]
// Description: Company Controller，標準介面層

const { handleApiError } = require('../middleware/error.middleware');
const getServices = (req) => req.app.get('services');

exports.getDashboardData = async (req, res) => {
    try {
        const { dashboardService } = getServices(req);
        // Controller 不做運算，直接轉發
        res.json(await dashboardService.getCompaniesDashboardData());
    } catch (error) {
        handleApiError(res, error, 'Get Companies Dashboard');
    }
};

exports.getCompanies = async (req, res) => {
    try {
        const { companyService } = getServices(req);
        const data = await companyService.getCompanyListWithActivity();
        res.json({ success: true, data });
    } catch (error) {
        handleApiError(res, error, 'Get Companies');
    }
};

exports.createCompany = async (req, res) => {
    try {
        const { companyService } = getServices(req);
        const { companyName } = req.body;
        
        if (!companyName) {
            return res.status(400).json({ success: false, error: 'Company name is required' });
        }
        
        // 傳入 user.name 供紀錄
        const result = await companyService.createCompany(companyName, req.user.name);
        res.json(result);
    } catch (error) {
        handleApiError(res, error, 'Create Company');
    }
};

exports.getCompanyDetails = async (req, res) => {
    try {
        const { companyService } = getServices(req);
        // decodeURIComponent 處理 URL 中文編碼
        const companyName = decodeURIComponent(req.params.companyName);
        const data = await companyService.getCompanyDetails(companyName);
        res.json({ success: true, data });
    } catch (error) {
        handleApiError(res, error, 'Get Company Details');
    }
};

exports.updateCompany = async (req, res) => {
    try {
        const { companyService } = getServices(req);
        const companyName = decodeURIComponent(req.params.companyName);
        // 直接將 body 傳給 service，不做額外處理
        const result = await companyService.updateCompany(companyName, req.body, req.user.name);
        res.json(result);
    } catch (error) {
        handleApiError(res, error, 'Update Company');
    }
};

exports.deleteCompany = async (req, res) => {
    try {
        const { companyService } = getServices(req);
        const companyName = decodeURIComponent(req.params.companyName);
        const result = await companyService.deleteCompany(companyName, req.user.name);
        res.json(result);
    } catch (error) {
        handleApiError(res, error, 'Delete Company');
    }
};