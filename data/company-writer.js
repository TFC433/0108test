// data/company-writer.js
// [Version: 2026-01-08-Refactor-Stage1]
// [Date: 2026-01-08]
// Description: 負責寫入公司總表，封裝 RowIndex 操作

const BaseWriter = require('./base-writer');

/**
 * 專門負責處理與「公司總表」相關的寫入/更新操作
 */
class CompanyWriter extends BaseWriter {
    /**
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets 
     * @param {import('./company-reader')} companyReader 
     */
    constructor(sheets, companyReader) {
        super(sheets);
        if (!companyReader) {
            throw new Error('CompanyWriter 需要 CompanyReader 的實例');
        }
        this.companyReader = companyReader;
    }

    /**
     * 取得或建立一間公司
     * @param {string} companyName - 公司名稱
     * @param {object} contactInfo - 聯絡人資訊 (用於填充)
     * @param {string} modifier - 操作者
     * @param {object} defaultValues - 預設值 (類型、階段等)
     * @returns {Promise<object>}
     */
    async getOrCreateCompany(companyName, contactInfo, modifier, defaultValues = {}) {
        const range = `${this.config.SHEETS.COMPANY_LIST}!A:M`;
        // 使用 Reader 的查找功能，而非自己寫
        const existingCompany = await this.companyReader.findRowByValue(range, 1, companyName);

        if (existingCompany) {
            console.log(`🏢 [CompanyWriter] 公司已存在: ${companyName}`);
            return {
                id: existingCompany.rowData[0],
                name: existingCompany.rowData[1],
                // 暫時回傳 rowIndex 以相容舊邏輯，但建議外部不要過度依賴
                rowIndex: existingCompany.rowIndex 
            };
        }

        const county = defaultValues.county || '';
        console.log(`🏢 [CompanyWriter] 建立新公司: ${companyName} by ${modifier}`);
        
        const now = new Date().toISOString();
        const newCompanyId = `COM${Date.now()}`; // 自動生成 ID
        
        // 建構新的一列資料 (必須與 Reader 的欄位順序一致)
        const newRow = [
            newCompanyId,                   // A: ID
            companyName,                    // B: Name
            contactInfo.phone || contactInfo.mobile || '', // C: Phone
            contactInfo.address || '',      // D: Address
            now,                            // E: CreatedTime
            now,                            // F: UpdatedTime
            county,                         // G: County
            modifier,                       // H: Creator
            modifier,                       // I: Modifier
            '',                             // J: Introduction
            defaultValues.companyType || '',// K: Type
            defaultValues.customerStage || '',// L: Stage
            defaultValues.engagementRating || '' // M: Rating
        ];

        const response = await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] }
        });
        
        // 寫入後立即讓快取失效
        this.companyReader.invalidateCache('companyList');

        // 解析回應以取得新寫入的 RowIndex (僅供內部回傳參考)
        const updatedRange = response.data.updates.updatedRange;
        const match = updatedRange.match(/!A(\d+)/);
        const newRowIndex = match ? parseInt(match[1]) : null;

        return { id: newCompanyId, name: companyName, rowIndex: newRowIndex };
    }

    /**
     * 更新公司資料 (封裝了 RowIndex 查找邏輯)
     * @param {string} companyName - (舊)公司名稱，作為查找 Key
     * @param {object} updateData - 要更新的資料物件
     * @param {string} modifier - 操作者
     * @returns {Promise<object>}
     */
    async updateCompany(companyName, updateData, modifier) {
        console.log(`🏢 [CompanyWriter] 更新公司資料: ${companyName} by ${modifier}`);
        
        const range = `${this.config.SHEETS.COMPANY_LIST}!A:M`;
        
        // 1. 在 Writer 內部自行查找 RowIndex
        const companyRow = await this.companyReader.findRowByValue(range, 1, companyName);
        if (!companyRow) {
            throw new Error(`找不到公司: ${companyName}`);
        }

        const { rowIndex, rowData: currentRow } = companyRow;
        const now = new Date().toISOString();

        // 2. 更新欄位 (Mapping 必須與 Sheet 對應)
        // 注意：這裡只更新傳入的欄位 (Partial Update)
        
        if (updateData.companyName !== undefined) currentRow[1] = updateData.companyName;
        if (updateData.phone !== undefined) currentRow[2] = updateData.phone;
        if (updateData.address !== undefined) currentRow[3] = updateData.address;
        
        // Time (Column 4, 5)
        currentRow[5] = now; // lastUpdateTime
        
        if (updateData.county !== undefined) currentRow[6] = updateData.county;
        
        // Creator/Modifier (Column 7, 8)
        currentRow[8] = modifier; // lastModifier
        
        if (updateData.introduction !== undefined) currentRow[9] = updateData.introduction;
        if (updateData.companyType !== undefined) currentRow[10] = updateData.companyType;
        if (updateData.customerStage !== undefined) currentRow[11] = updateData.customerStage;
        if (updateData.engagementRating !== undefined) currentRow[12] = updateData.engagementRating;

        // 3. 寫回 Google Sheets
        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.COMPANY_LIST}!A${rowIndex}:M${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [currentRow] }
        });

        this.companyReader.invalidateCache('companyList');
        console.log('✅ [CompanyWriter] 公司資料更新成功');
        
        return { success: true, id: currentRow[0] };
    }

    /**
     * 刪除一間公司
     * @param {string} companyName - 要刪除的公司名稱
     * @returns {Promise<object>}
     */
    async deleteCompany(companyName) {
        console.log(`🗑️ [CompanyWriter] 準備刪除公司: ${companyName}`);
        const range = `${this.config.SHEETS.COMPANY_LIST}!A:M`;
        
        const companyRow = await this.companyReader.findRowByValue(range, 1, companyName);
        if (!companyRow) {
            throw new Error(`找不到公司: ${companyName}`);
        }

        const { rowIndex } = companyRow;

        // 呼叫 BaseWriter 的通用刪除方法
        await this._deleteRow(
            this.config.SHEETS.COMPANY_LIST,
            rowIndex,
            this.companyReader 
        );

        console.log(`✅ [CompanyWriter] 公司 "${companyName}" (Row: ${rowIndex}) 已被刪除`);
        return { success: true, deletedCompanyId: companyRow.rowData[0] };
    }
}

module.exports = CompanyWriter;