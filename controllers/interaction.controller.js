// controllers/interaction.controller.js
// [Version: 2026-01-08-Refactor-ServiceCall]
// [Date: 2026-01-08]
// Description: 改用 InteractionService 處理請求

const { handleApiError } = require('../middleware/error.middleware');

// 輔助函式：從 req.app 獲取服務
const getServices = (req) => req.app.get('services');

// GET /api/interactions/all
exports.searchAllInteractions = async (req, res) => {
    try {
        const { interactionService } = getServices(req); // ✅ 改用 Service
        res.json(await interactionService.searchAllInteractions(
            req.query.q, 
            parseInt(req.query.page || 1), 
            req.query.fetchAll === 'true'
        ));
    } catch (error) { handleApiError(res, error, 'Search All Interactions'); }
};

// POST /api/interactions
exports.createInteraction = async (req, res) => {
    try {
        const { interactionService } = getServices(req);
        // 【安全】確保 recorder 是登入的使用者
        const interactionData = { ...req.body, recorder: req.user.name };
        res.json(await interactionService.createInteraction(interactionData));
    } catch (error) { handleApiError(res, error, 'Create Interaction'); }
};

// PUT /api/interactions/:rowIndex
exports.updateInteraction = async (req, res) => {
    try {
        const { interactionService } = getServices(req);
        res.json(await interactionService.updateInteraction(
            parseInt(req.params.rowIndex), 
            req.body, 
            req.user.name
        ));
    } catch (error) { handleApiError(res, error, 'Update Interaction'); }
};

// DELETE /api/interactions/:rowIndex
exports.deleteInteraction = async (req, res) => {
    try {
        const { interactionService } = getServices(req);
        res.json(await interactionService.deleteInteraction(parseInt(req.params.rowIndex)));
    } catch (error) {
        handleApiError(res, error, 'Delete Interaction');
    }
};