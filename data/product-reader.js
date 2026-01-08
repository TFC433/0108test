// data/product-reader.js
// [Version: 2026-01-08-Refactor-Stage3]
// [Date: 2026-01-08]
// Description: 負責讀取產品資料，實作標準化 DTO 與 Quasi-SQL 查詢介面

const BaseReader = require('./base-reader');
const config = require('../config');
const { parseString, parseDate, parseFloatSafe } = require('../utils/data-parsers');

class ProductReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
        this.cacheKey = 'marketProducts';
    }

    /**
     * 讀取所有商品資料 (回傳標準化 DTO)
     */
    async getAllProducts() {
        if (!config.MARKET_PRODUCT_SHEET_ID) {
            console.error('❌ [ProductReader] 未設定 MARKET_PRODUCT_SHEET_ID');
            return [];
        }

        const range = `${config.SHEETS.MARKET_PRODUCTS}!A:V`; 
        const cacheKey = this.cacheKey;
        
        // 定義解析器
        const rowParser = (row, index) => {
            const F = config.MARKET_PRODUCT_FIELDS;
            
            // 基本檢核：ID 或名稱至少要有一個
            if (!row[F.ID] && !row[F.NAME]) return null;

            return {
                id: parseString(row[F.ID]),
                name: parseString(row[F.NAME]),
                category: parseString(row[F.CATEGORY]),
                group: parseString(row[F.GROUP]),
                combination: parseString(row[F.COMBINATION]),
                unit: parseString(row[F.UNIT]),
                spec: parseString(row[F.SPEC]),
                
                // 數值型資料
                cost: parseFloatSafe(row[F.COST]),
                priceMtb: parseFloatSafe(row[F.PRICE_MTB]),
                priceSi: parseFloatSafe(row[F.PRICE_SI]),
                priceMtu: parseFloatSafe(row[F.PRICE_MTU]),
                
                supplier: parseString(row[F.SUPPLIER]),
                series: parseString(row[F.SERIES]),
                interface: parseString(row[F.INTERFACE]),
                property: parseString(row[F.PROPERTY]),
                aspect: parseString(row[F.ASPECT]),
                description: parseString(row[F.DESCRIPTION]),
                
                status: parseString(row[F.STATUS]) || '上架',
                creator: parseString(row[F.CREATOR]),
                createTime: parseDate(row[F.CREATE_TIME]),
                lastModifier: parseString(row[F.LAST_MODIFIER]),
                lastUpdateTime: parseDate(row[F.LAST_UPDATE_TIME]),

                // --- 內部中繼資料 (Quasi-SQL 必要) ---
                _meta: {
                    rowIndex: index + 2 // Sheet Row Index (1-based, +1 header)
                }
            };
        };

        // 由於目標 SpreadsheetID 不同，需覆寫 BaseReader 的 fetch 行為，這裡使用自定義邏輯
        // 為了保持架構一致，我們在這裡手動處理緩存與讀取，不直接呼叫 super._fetchAndCache
        // 因為 super 預設讀取 config.SPREADSHEET_ID
        
        const now = Date.now();
        if (this.cache[cacheKey] && (now - this.cache[cacheKey].timestamp < this.CACHE_DURATION)) {
            return this.cache[cacheKey].data;
        }

        try {
            console.log(`🔄 [ProductReader] 正在從外部 Sheet 讀取商品資料...`);
            const response = await this._executeWithRetry(() => 
                this.sheets.spreadsheets.values.get({
                    spreadsheetId: config.MARKET_PRODUCT_SHEET_ID,
                    range: range,
                })
            );

            const rows = response.data.values || [];
            let data = [];

            if (rows.length > 1) {
                data = rows.slice(1).map((row, index) => rowParser(row, index)).filter(item => item !== null);
            }

            this.cache[cacheKey] = { data, timestamp: Date.now() };
            return data;

        } catch (error) {
            console.error(`❌ [ProductReader] 讀取失敗:`, error.message);
            // 若失敗回傳空陣列或快取
            return this.cache[cacheKey] ? this.cache[cacheKey].data : [];
        }
    }

    /**
     * 透過 ID 查找單一商品
     * @param {string} productId 
     */
    async findProductById(productId) {
        if (!productId) return null;
        const allProducts = await this.getAllProducts();
        return allProducts.find(p => p.id === productId) || null;
    }
}

module.exports = ProductReader;