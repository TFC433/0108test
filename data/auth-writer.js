// data/auth-writer.js
const BaseWriter = require('./base-writer');
const config = require('../config');

/**
 * 專門負責寫入使用者權限資料的類別
 */
class AuthWriter extends BaseWriter {
    constructor(sheets) {
        super(sheets);
    }

    async updatePassword(rowIndex, newHash) {
        const targetSheetId = config.AUTH_SPREADSHEET_ID;
        const range = `使用者名冊!B${rowIndex}`;
        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: targetSheetId, range, valueInputOption: 'RAW',
                resource: { values: [[newHash]] }
            });
            return true;
        } catch (error) {
            console.error('❌ [AuthWriter] 更新密碼失敗:', error.message);
            throw error;
        }
    }
}

module.exports = AuthWriter;
