// data/interaction-reader.js
// [Version: 2026-01-08-Refactor-Stage4]
// [Date: 2026-01-08]
// Description: 互動紀錄讀取器，移除內部依賴，專注於原始資料讀取

const BaseReader = require('./base-reader');
// 依指示引入，供未來擴充標準化解析使用
const dataParsers = require('../utils/data-parsers'); 

class InteractionReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 取得所有互動紀錄 (原始資料)
     * @returns {Promise<Array<object>>}
     */
    async getInteractions() {
        const cacheKey = 'interactions';
        const range = `${this.config.SHEETS.INTERACTIONS}!A:M`;

        const rowParser = (row, index) => ({
            rowIndex: index + 2,
            interactionId: row[0] || '',
            opportunityId: row[1] || '',
            interactionTime: row[2] || '',
            eventType: row[3] || '',
            eventTitle: row[4] || '',
            contentSummary: row[5] || '',
            participants: row[6] || '',
            nextAction: row[7] || '',
            attachmentLink: row[8] || '',
            calendarEventId: row[9] || '',
            recorder: row[10] || '',
            createdTime: row[11] || '',
            companyId: row[12] || ''
        });

        const sorter = (a, b) => {
            const dateA = new Date(a.interactionTime);
            const dateB = new Date(b.interactionTime);
            if (isNaN(dateB)) return -1;
            if (isNaN(dateA)) return 1;
            return dateB - dateA;
        };

        return this._fetchAndCache(cacheKey, range, rowParser, sorter);
    }

    /**
     * 搜尋互動紀錄 (僅針對原始資料進行過濾)
     * @param {string} query 
     * @returns {Promise<Array<object>>}
     */
    async searchInteractionsRaw(query) {
        let interactions = await this.getInteractions();
        
        if (query) {
            const searchTerm = query.toLowerCase();
            interactions = interactions.filter(i =>
                (i.contentSummary && i.contentSummary.toLowerCase().includes(searchTerm)) ||
                (i.eventTitle && i.eventTitle.toLowerCase().includes(searchTerm)) ||
                (i.recorder && i.recorder.toLowerCase().includes(searchTerm))
            );
        }
        return interactions;
    }
}

module.exports = InteractionReader;