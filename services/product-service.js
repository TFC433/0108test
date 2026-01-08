// services/product-service.js
// [Version: 2026-01-08-Refactor-BatchFix]
// [Date: 2026-01-08]

class ProductService {
    constructor(services) {
        this.productReader = services.productReader;
        this.productWriter = services.productWriter;
        this.configReader = services.configReader;
        this.configWriter = services.configWriter;
    }

    async getProducts(query = null) {
        let products = await this.productReader.getAllProducts();
        if (query) {
            const lowerQ = query.toLowerCase();
            products = products.filter(p => 
                (p.name && p.name.toLowerCase().includes(lowerQ)) ||
                (p.id && p.id.toLowerCase().includes(lowerQ)) ||
                (p.category && p.category.toLowerCase().includes(lowerQ))
            );
        }
        return products;
    }

    async getProductById(productId) {
        return this.productReader.findProductById(productId);
    }

    async refreshCache() {
        this.productReader.invalidateCache('marketProducts');
        await this.productReader.getAllProducts();
    }

    /**
     * 批次儲存
     * [Fix] 改用 Writer 的 saveBatch 進行原子化批次寫入，避免 N+1 API 呼叫
     */
    async saveAll(products, user) {
        if (!Array.isArray(products) || products.length === 0) {
            return { updated: 0, appended: 0 };
        }
        
        // 直接轉發給 Writer 處理
        try {
            return await this.productWriter.saveBatch(products, user);
        } catch (err) {
            console.error('[ProductService] 批次儲存失敗:', err);
            throw err;
        }
    }

    async getCategoryOrder() {
        const systemConfig = await this.configReader.getSystemConfig();
        let order = [];
        if (systemConfig['SystemPref']) {
            const pref = systemConfig['SystemPref'].find(p => p.value === 'PRODUCT_CATEGORY_ORDER');
            if (pref && pref.note) {
                try { order = JSON.parse(pref.note); } catch (e) {}
            }
        }
        return order;
    }

    async saveCategoryOrder(orderArray) {
        if (!Array.isArray(orderArray)) throw new Error('分類排序必須是陣列');
        const jsonString = JSON.stringify(orderArray);
        await this.configWriter.updateSystemPref('PRODUCT_CATEGORY_ORDER', jsonString);
        if (this.configReader.cache['systemConfig']) {
            delete this.configReader.cache['systemConfig'];
        }
        return { success: true };
    }
}

module.exports = ProductService;