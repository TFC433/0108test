// controllers/product.controller.js
// [Version: 2026-01-08-Refactor-Stage3]
// [Date: 2026-01-08]
// Description: Product Controller - 僅負責路由轉發與權限驗證，邏輯移至 ProductService

const config = require('../config');

// Helper: 取得 Service 容器
const getServices = (req) => req.app.get('services');

class ProductController {
    
    async getProducts(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, error: config.ERROR_MESSAGES.ADMIN_ONLY });
            }
            
            const { productService } = getServices(req);
            const { q } = req.query;
            
            const data = await productService.getProducts(q);
            res.json({ success: true, data: data, count: data.length });
        } catch (error) {
            console.error('[ProductController] 獲取失敗:', error);
            res.status(500).json({ success: false, error: config.ERROR_MESSAGES.NETWORK_ERROR });
        }
    }

    async refresh(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
            
            const { productService } = getServices(req);
            await productService.refreshCache();
            
            res.json({ success: true, message: '商品資料已重新同步' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async batchUpdate(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, error: '權限不足，無法執行寫入操作' });
            }
            
            const products = req.body.products;
            if (!Array.isArray(products)) return res.status(400).json({ success: false, error: '資料格式錯誤' });

            const { productService } = getServices(req);
            const result = await productService.saveAll(products, req.user);
            
            res.json({ success: true, message: `儲存成功 (更新: ${result.updated}, 新增: ${result.appended})`, result });
        } catch (error) {
            console.error('[ProductController] 批次更新失敗:', error);
            res.status(500).json({ success: false, error: '儲存失敗: ' + error.message });
        }
    }

    // 獲取分類排序
    async getCategoryOrder(req, res) {
        try {
            const { productService } = getServices(req);
            const order = await productService.getCategoryOrder();
            res.json({ success: true, order });
        } catch (error) {
            console.error('[ProductController] 獲取分類排序失敗:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // 儲存分類排序
    async saveCategoryOrder(req, res) {
        try {
            if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: '權限不足' });
            
            const { order } = req.body;
            const { productService } = getServices(req);
            
            await productService.saveCategoryOrder(order);
            res.json({ success: true, message: '分類排序已更新' });
        } catch (error) {
            console.error('[ProductController] 儲存分類排序失敗:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new ProductController();