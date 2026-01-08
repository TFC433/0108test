// controllers/contact.controller.js
const { handleApiError } = require('../middleware/error.middleware');

// 輔助函式：從 req.app 獲取服務
const getServices = (req) => req.app.get('services');

// GET /api/contacts/dashboard
exports.getDashboardData = async (req, res) => {
    try {
        const { dashboardService } = getServices(req);
        const data = await dashboardService.getContactsDashboardData();
        // 【修正】必須包裹成 { success: true, data }，因為前端 contacts.js 會檢查 .success
        res.json({ success: true, data });
    } catch (error) {
        handleApiError(res, error, 'Get Contacts Dashboard');
    }
};

// GET /api/contacts
exports.searchContacts = async (req, res) => {
    try {
        const { contactReader } = getServices(req);
        // ContactReader 已經回傳 { data: [...] } 結構，前端直接使用，因此這裡維持原樣不需包裹
        res.json(await contactReader.searchContacts(req.query.q, parseInt(req.query.page || 1)));
    } catch (error) { handleApiError(res, error, 'Search Contacts'); }
};

// GET /api/contact-list
exports.searchContactList = async (req, res) => {
    try {
        const { contactReader } = getServices(req);
        // 同上，Reader 已回傳正確結構
        res.json(await contactReader.searchContactList(req.query.q, parseInt(req.query.page || 1)));
    } catch (error) { handleApiError(res, error, 'Search Contact List'); }
};

// POST /api/contacts/:rowIndex/upgrade
exports.upgradeContact = async (req, res) => {
    try {
        const { workflowService } = getServices(req);
        // WorkflowService 的回傳值通常已包含 success: true/false
        res.json(await workflowService.upgradeContactToOpportunity(parseInt(req.params.rowIndex), req.body, req.user.name));
    } catch (error) { handleApiError(res, error, 'Upgrade Contact'); }
};

// PUT /api/contacts/:contactId
exports.updateContact = async (req, res) => {
    try {
        const { contactWriter } = getServices(req);
        res.json(await contactWriter.updateContact(req.params.contactId, req.body, req.user.name));
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