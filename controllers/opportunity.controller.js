// controllers/opportunity.controller.js
const { handleApiError } = require('../middleware/error.middleware');

// 輔助函式：從 req.app 獲取服務
const getServices = (req) => req.app.get('services');

exports.getDashboardData = async (req, res) => {
    try {
        const { dashboardService } = getServices(req);
        res.json({ success: true, data: await dashboardService.getOpportunitiesDashboardData() });
    } catch (error) { handleApiError(res, error, 'Opp Dashboard'); }
};

exports.getOpportunitiesByCounty = async (req, res) => {
    try {
        const { opportunityService } = getServices(req);
        res.json(await opportunityService.getOpportunitiesByCounty(req.query.opportunityType));
    } catch (error) { handleApiError(res, error, 'Opp By County'); }
};

exports.searchOpportunities = async (req, res) => {
    try {
        const { opportunityService } = getServices(req);
        const { q, page = 0, assignee, type, stage } = req.query;
        const filters = { assignee, type, stage };
        Object.keys(filters).forEach(key => (filters[key] === undefined || filters[key] === '') && delete filters[key]);
        res.json(await opportunityService.searchOpportunities(q, parseInt(page), filters));
    } catch (error) { handleApiError(res, error, 'Search Opps'); }
};

exports.getOpportunityDetails = async (req, res) => {
    try {
        const { opportunityService } = getServices(req);
        res.json({ success: true, data: await opportunityService.getOpportunityDetails(req.params.opportunityId) });
    } catch (error) { handleApiError(res, error, 'Get Opp Details'); }
};

exports.createOpportunity = async (req, res) => {
    try {
        const { workflowService } = getServices(req);
        // 【修正】將 req.user.name 作為第二個參數傳入，確保 Service 層知道是誰操作的
        res.json(await workflowService.createOpportunity(req.body, req.user.name));
    } catch (error) { handleApiError(res, error, 'Create Opp'); }
};

exports.updateOpportunity = async (req, res) => {
    try {
        const { opportunityService } = getServices(req);
        res.json(await opportunityService.updateOpportunity(parseInt(req.params.rowIndex), req.body, req.user.name));
    } catch (error) { handleApiError(res, error, 'Update Opp'); }
};

exports.batchUpdateOpportunities = async (req, res) => {
    try {
        const { opportunityService } = getServices(req);

        // Frontend sends: { updates: [{ rowIndex, data, modifier }] }
        const updates = req.body.updates || [];

        // Call Service.saveBatch(items, user)
        // returns { updated: N, appended: M }
        const result = await opportunityService.saveBatch(updates, req.user);

        // Transform response to match frontend expectation (Legacy format)
        // Expected: { success: true, successCount: N, failCount: M }
        res.json({
            success: true,
            successCount: result.updated + result.appended,
            failCount: updates.length - (result.updated + result.appended),
            details: result
        });
    } catch (error) { handleApiError(res, error, 'Batch Update Opps'); }
};

exports.deleteOpportunity = async (req, res) => {
    try {
        // --- 修改點：改為呼叫 opportunityService ---
        const { opportunityService } = getServices(req);
        res.json(await opportunityService.deleteOpportunity(parseInt(req.params.rowIndex), req.user.name));
    } catch (error) { handleApiError(res, error, 'Delete Opp'); }
};

exports.addContactToOpportunity = async (req, res) => {
    try {
        const { opportunityService } = getServices(req);
        res.json(await opportunityService.addContactToOpportunity(req.params.opportunityId, req.body, req.user.name));
    } catch (error) { handleApiError(res, error, 'Add Contact to Opp'); }
};

exports.deleteContactLink = async (req, res) => {
    try {
        // --- 修改點：改為呼叫 opportunityService ---
        const { opportunityService } = getServices(req);
        res.json(await opportunityService.deleteContactLink(req.params.opportunityId, req.params.contactId, req.user.name));
    } catch (error) { handleApiError(res, error, 'Delete Contact Link'); }
};