// data/company-reader.js
// [Version: 2026-01-08-Refactor-Stage1]
// [Date: 2026-01-08]
// Description: 負責讀取公司總表，並將資料轉換為標準化 DTO

const BaseReader = require('./base-reader');
const { parseString, parseDate } = require('../utils/data-parsers');

/**
 * 專門負責讀取所有與「公司總表」相關資料的類別
 */
class CompanyReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 取得公司總表列表 (標準化 DTO)
     * @returns {Promise<Array<object>>}
     */
    async getCompanyList() {
        const cacheKey = 'companyList';
        // 讀取範圍涵蓋到 M 欄 (對應 Config 定義的欄位)
        const range = `${this.config.SHEETS.COMPANY_LIST}!A:M`;

        // 定義資料轉換邏輯 (Mapping)
        // 這裡將 Google Sheet 的 Array 轉為具名物件
        const rowParser = (row, rowIndex) => ({
            // --- 核心識別資料 ---
            companyId: parseString(row[0]),       // ID
            companyName: parseString(row[1]),     // 名稱

            // --- 基本聯絡資料 ---
            phone: parseString(row[2]),           // 電話
            address: parseString(row[3]),         // 地址
            county: parseString(row[6]),          // 縣市

            // --- 業務分類資料 ---
            introduction: parseString(row[9]),    // 簡介
            companyType: parseString(row[10]),    // 公司類型
            customerStage: parseString(row[11]),  // 客戶階段
            engagementRating: parseString(row[12]), // 互動評級

            // --- 系統審計資料 ---
            createdTime: parseDate(row[4]),       // 建立時間
            lastUpdateTime: parseDate(row[5]),    // 最後更新時間
            creator: parseString(row[7]),         // 建立者
            lastModifier: parseString(row[8]),    // 最後修改者

            // --- 內部中繼資料 (未來 SQL 遷移時將移除) ---
            _meta: {
                rowIndex: rowIndex + 1 // 實際行號 (因為 rowParser 的 index 是從 0 開始且已扣除 header)
            }
        });

        return this._fetchAndCache(cacheKey, range, rowParser);
    }

    /**
     * 透過 ID 查找公司 (模擬 SQL 的 SELECT * FROM companies WHERE id = ?)
     * @param {string} companyId 
     */
    async findCompanyById(companyId) {
        const list = await this.getCompanyList();
        return list.find(c => c.companyId === companyId) || null;
    }

    /**
     * 透過名稱查找公司 (模擬 SQL 的 SELECT * FROM companies WHERE name = ?)
     * @param {string} name 
     */
    async findCompanyByName(name) {
        if (!name) return null;
        const normalizedName = parseString(name).toLowerCase();
        const list = await this.getCompanyList();
        return list.find(c => c.companyName.toLowerCase() === normalizedName) || null;
    }
}

module.exports = CompanyReader;