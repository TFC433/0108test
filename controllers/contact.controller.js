// controllers/contact.controller.js
// [Version: 2026-01-08-Refactor-Stage2]
// [Date: 2026-01-08]
// Description: Contact Controller，已重構為使用 ContactService

const { handleApiError } = require('../middleware/error.middleware');

// 輔助函式：從 req.app 獲取服務
const getServices = (req) => req.app.get('services');

// GET /api/contacts/dashboard
exports.getDashboardData = async (req, res) => {
    try {
        const { contactService } = getServices(req);
        // 透過 Service 獲取數據，並確保回傳 { success: true, data }
        const data = await contactService.getDashboardData();
        res.json({ success: true, data });
    } catch (error) {
        handleApiError(res, error, 'Get Contacts Dashboard');
    }
};

// GET /api/contacts (搜尋原始名片)
exports.searchContacts = async (req, res) => {
    try {
        const { contactService } = getServices(req);
        // Service 回傳 { data: [...] }
        res.json(await contactService.searchRawContacts(req.query.q, parseInt(req.query.page || 1)));
    } catch (error) { handleApiError(res, error, 'Search Contacts'); }
};

// GET /api/contact-list (搜尋標準聯絡人)
exports.searchContactList = async (req, res) => {
    try {
        const { contactService } = getServices(req);
        res.json(await contactService.searchContactList(req.query.q, parseInt(req.query.page || 1)));
    } catch (error) { handleApiError(res, error, 'Search Contact List'); }
};

// POST /api/contacts/:rowIndex/upgrade
exports.upgradeContact = async (req, res) => {
    try {
        const { workflowService } = getServices(req);
        // 升級流程屬於複雜 Workflow，仍由 WorkflowService 處理
        res.json(await workflowService.upgradeContactToOpportunity(parseInt(req.params.rowIndex), req.body, req.user.name));
    } catch (error) { handleApiError(res, error, 'Upgrade Contact'); }
};

// PUT /api/contacts/:contactId
exports.updateContact = async (req, res) => {
    try {
        const { contactService } = getServices(req);
        // 使用 ContactService 進行更新 (含驗證)
        res.json(await contactService.updateContact(req.params.contactId, req.body, req.user.name));
    } catch (error) { handleApiError(res, error, 'Update Contact'); }
};

// POST /api/contacts/:contactId/link-card
exports.linkCardToContact = async (req, res) => {
    try {
        const { workflowService } = getServices(req);
        const { contactId } = req.params;
        const { businessCardRowIndex } = req.body;
        if (!businessCardRowIndex) {
            return res.status(400).json({ success: false, error: '缺少 businessCardRowIndex' });
        }
        res.json(await workflowService.linkBusinessCardToContact(contactId, parseInt(businessCardRowIndex), req.user.name));
    } catch (error) {
        handleApiError(res, error, 'Link Card to Contact');
    }
};

// POST /api/contacts/:rowIndex/file
exports.fileContact = async (req, res) => {
    try {
        const { workflowService } = getServices(req);
        res.json(await workflowService.fileContact(parseInt(req.params.rowIndex), req.user.name));
    } catch (error) {
        handleApiError(res, error, 'File Contact');
    }
};