// data/auth-reader.js

const BaseReader = require('./base-reader');

/**
 * 專門負責讀取使用者權限資料的類別
 */
class AuthReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 取得使用者名冊
     * @returns {Promise<Array<object>>}
     */
    async getUsers() {
        const cacheKey = 'users';
        // 讀取範圍 A:D (增加第4欄 Role)
        const range = '使用者名冊!A:D';
        
        const targetSheetId = this.config.AUTH_SPREADSHEET_ID;

        const now = Date.now();
        if (this.cache[cacheKey] && this.cache[cacheKey].data && (now - this.cache[cacheKey].timestamp < this.CACHE_DURATION)) {
            return this.cache[cacheKey].data;
        }

        console.log(`🔐 [AuthReader] 讀取使用者名冊 (Sheet ID: ...${targetSheetId.slice(-6)})...`);

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: targetSheetId,
                range: range,
            });

            const rows = response.data.values || [];
            
            const allUsers = rows.map((row, index) => {
                // 防呆：處理可能為 undefined 的欄位
                const username = row[0] ? row[0].trim() : '';
                const passwordHash = row[1] ? row[1].trim() : '';
                const displayName = row[2] ? row[2].trim() : '';
                // 解析 Role，預設為 'sales'
                const role = row[3] ? row[3].trim().toLowerCase() : 'sales';

                return {
                    rowIndex: index + 1,
                    username,
                    passwordHash,
                    displayName,
                    role 
                };
            }).filter(user => user.username && user.passwordHash);

            this.cache[cacheKey] = { data: allUsers, timestamp: now };
            return allUsers;

        } catch (error) {
            console.error('❌ [AuthReader] 讀取使用者名冊失敗:', error.message);
            return [];
        }
    }
}

module.exports = AuthReader;
