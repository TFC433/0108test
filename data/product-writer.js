// data/product-writer.js
// [Version: 2026-01-08-Refactor-BatchFix]
// [Date: 2026-01-08]
// Description: 強化 saveBatch 效能，解決 N+1 API 呼叫問題

const BaseWriter = require('./base-writer');
const config = require('../config');

class ProductWriter extends BaseWriter {
    /**
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets 
     * @param {import('./product-reader')} productReader 
     */
    constructor(sheets, productReader) {
        super(sheets);
        if (!productReader) throw new Error('ProductWriter 需要 ProductReader 實例');
        this.productReader = productReader;
        this.targetSpreadsheetId = config.MARKET_PRODUCT_SHEET_ID;
        this.sheetName = config.SHEETS.MARKET_PRODUCTS;
    }

    /**
     * 建立新產品 (單筆)
     */
    async createProduct(productData, modifier) {
        // 維持原樣，供單筆操作使用
        console.log(`📦 [ProductWriter] 建立新產品: ${productData.name} by ${modifier}`);
        const now = new Date().toISOString();
        const newId = productData.id || `PROD${Date.now()}`;
        
        const row = this._formatRow({
            ...productData,
            id: newId,
            status: productData.status || '上架',
            creator: modifier,
            createTime: now,
            lastModifier: modifier,
            lastUpdateTime: now
        });

        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.targetSpreadsheetId,
            range: `${this.sheetName}!A:V`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });

        this.productReader.invalidateCache('marketProducts');
        return { id: newId };
    }

    /**
     * 更新產品 (單筆)
     */
    async updateProduct(productId, updateData, modifier) {
        // 維持原樣，供單筆操作使用
        console.log(`📦 [ProductWriter] 更新產品: ${productId} by ${modifier}`);
        const existingProduct = await this.productReader.findProductById(productId);
        if (!existingProduct) throw new Error(`找不到產品 ID: ${productId}`);

        const rowIndex = existingProduct._meta.rowIndex;
        const now = new Date().toISOString();
        const mergedData = { ...existingProduct, ...updateData, lastModifier: modifier, lastUpdateTime: now };
        delete mergedData._meta;

        const rowData = this._formatRow(mergedData);

        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.targetSpreadsheetId,
            range: `${this.sheetName}!A${rowIndex}:V${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [rowData] }
        });

        this.productReader.invalidateCache('marketProducts');
        return { success: true };
    }

    /**
     * ★★★ 高效批次儲存 (關鍵修正) ★★★
     * 一次 API 呼叫處理所有新增與更新
     */
    async saveBatch(products, user) {
        if (!products || products.length === 0) return { updated: 0, appended: 0 };
        
        const modifier = user.name || 'System';
        console.log(`📦 [ProductWriter] 批次處理 ${products.length} 筆資料...`);

        // 1. 取得所有現有 ID 與 RowIndex 的對照表
        // 為了效能，我們直接讀取 ID 欄位 (Column A)，不讀取整張表
        const idResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.targetSpreadsheetId,
            range: `${this.sheetName}!A:A`,
        });
        
        const existingIds = (idResponse.data.values || []).flat();
        const idRowMap = new Map();
        // RowIndex 從 1 開始，且第一列是標題，所以資料從 index 1 (Row 2) 開始
        existingIds.forEach((id, index) => {
            if (index > 0 && id) idRowMap.set(String(id).trim(), index + 1);
        });

        const updates = [];
        const appends = [];
        const now = new Date().toISOString();

        // 2. 分類：哪些是更新？哪些是新增？
        for (const p of products) {
            // 這裡無法輕易取得 "舊資料" 做完整 Merge，
            // 為了批次效能，我們假設傳入的 p 已經是完整資料 (Frontend 負責)
            // 或是只更新必要的欄位 (這需要更複雜的逻辑，目前先假設傳入完整 DTO)
            
            // 稍微補全必要欄位
            const rowData = this._formatRow({
                ...p,
                lastModifier: modifier,
                lastUpdateTime: now,
                // 如果是新增，補上 Creator
                creator: p.creator || (idRowMap.has(p.id) ? undefined : modifier),
                createTime: p.createTime || (idRowMap.has(p.id) ? undefined : now),
                status: p.status || '上架'
            });

            if (p.id && idRowMap.has(String(p.id).trim())) {
                const rowIndex = idRowMap.get(String(p.id).trim());
                updates.push({
                    range: `${this.sheetName}!A${rowIndex}:V${rowIndex}`,
                    values: [rowData]
                });
            } else {
                // ID 不存在或是新的，視為新增
                appends.push(rowData);
            }
        }

        // 3. 執行批次更新 (Batch Update) - 只需一次 Request
        if (updates.length > 0) {
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.targetSpreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates
                }
            });
        }

        // 4. 執行批次新增 (Append) - 只需一次 Request
        if (appends.length > 0) {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.targetSpreadsheetId,
                range: `${this.sheetName}!A:V`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: appends }
            });
        }

        console.log(`✅ [ProductWriter] 批次完成: 更新 ${updates.length}, 新增 ${appends.length}`);

        // 5. ★★★ 關鍵：最後只清除一次快取 ★★★
        this.productReader.invalidateCache('marketProducts');

        return { updated: updates.length, appended: appends.length };
    }

    _formatRow(p) {
        // 確保欄位順序正確 (Undefined 轉為空字串)
        // 注意：對於更新操作，若某些欄位不想覆蓋，需保持原值。
        // 但由於 saveBatch 無法逐筆讀取舊值，前端必須送來完整資料。
        const v = (val) => (val === undefined || val === null) ? '' : val;
        
        return [
            v(p.id),               // 0: ID
            v(p.name),             // 1: Name
            v(p.category),         // 2: Category
            v(p.group),            // 3: Group
            v(p.combination),      // 4: Combination
            v(p.unit),             // 5: Unit
            v(p.spec),             // 6: Spec
            v(p.cost),             // 7: Cost
            v(p.priceMtb),         // 8: Price MTB
            v(p.priceSi),          // 9: Price SI
            v(p.priceMtu),         // 10: Price MTU
            v(p.supplier),         // 11: Supplier
            v(p.series),           // 12: Series
            v(p.interface),        // 13: Interface
            v(p.property),         // 14: Property
            v(p.aspect),           // 15: Aspect
            v(p.description),      // 16: Description
            v(p.status),           // 17: Status
            v(p.creator),          // 18: Creator
            v(p.createTime),       // 19: Create Time
            v(p.lastModifier),     // 20: Last Modifier
            v(p.lastUpdateTime)    // 21: Last Update Time
        ];
    }
}

module.exports = ProductWriter;