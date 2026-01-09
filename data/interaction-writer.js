// data/interaction-writer.js
// [Version: 2026-01-08-Refactor-BatchSave]
// [Date: 2026-01-08]
// Description: 互動紀錄寫入器，實作 saveBatch 以提升效能

const BaseWriter = require('./base-writer');

class InteractionWriter extends BaseWriter {
    /**
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets 
     * @param {import('./interaction-reader')} interactionReader 
     */
    constructor(sheets, interactionReader) {
        super(sheets);
        if (!interactionReader) {
            throw new Error('InteractionWriter 需要 InteractionReader 的實例');
        }
        this.interactionReader = interactionReader;
    }

    /**
     * 建立單筆互動紀錄
     */
    async createInteraction(interactionData) {
        console.log('📝 [InteractionWriter] 建立互動記錄...');
        const now = new Date().toISOString();
        const interactionId = interactionData.interactionId || `INT${Date.now()}`;
        
        const rowData = this._formatRow({
            ...interactionData,
            interactionId,
            createdTime: now,
            interactionTime: interactionData.interactionTime || now
        });
        
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.INTERACTIONS}!A:M`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [rowData] }
        });
        
        this.interactionReader.invalidateCache('interactions');
        console.log('✅ [InteractionWriter] 互動記錄建立成功:', interactionId);
        return { success: true, interactionId, data: rowData };
    }

    /**
     * 更新單筆互動紀錄
     */
    async updateInteraction(rowIndex, updateData, modifier) {
        if (isNaN(parseInt(rowIndex)) || rowIndex <= 1) throw new Error(`無效的 rowIndex: ${rowIndex}`);
        
        const range = `${this.config.SHEETS.INTERACTIONS}!A${rowIndex}:M${rowIndex}`;

        // 先讀取舊資料以保留未修改欄位 (單筆更新時的安全做法)
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.config.SPREADSHEET_ID, range: range,
        });

        const currentRow = response.data.values ? response.data.values[0] : [];
        if(currentRow.length === 0) throw new Error(`在 ${rowIndex} 列找不到互動紀錄`);

        // 轉換為物件以便合併 (簡單映射)
        const currentData = {
            interactionId: currentRow[0],
            opportunityId: currentRow[1],
            interactionTime: currentRow[2],
            eventType: currentRow[3],
            eventTitle: currentRow[4],
            contentSummary: currentRow[5],
            participants: currentRow[6],
            nextAction: currentRow[7],
            attachmentLink: currentRow[8],
            calendarEventId: currentRow[9],
            recorder: currentRow[10],
            createdTime: currentRow[11],
            companyId: currentRow[12]
        };

        // 合併資料
        const mergedData = { ...currentData, ...updateData };
        // 強制更新修改者 (若有的話，但 Interaction 表結構中 recorder 通常是建立者，這裡視業務邏輯而定)
        // 這裡維持原始邏輯，只更新 recorder 為修改者
        if (modifier) mergedData.recorder = modifier;

        const rowData = this._formatRow(mergedData);

        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.SPREADSHEET_ID, range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [rowData] }
        });

        this.interactionReader.invalidateCache('interactions');
        return { success: true };
    }

    /**
     * ★★★ 高效批次儲存 ★★★
     * @param {Array<object>} interactions 互動紀錄列表
     */
    async saveBatch(interactions) {
        if (!interactions || interactions.length === 0) return { updated: 0, appended: 0 };
        console.log(`📝 [InteractionWriter] 批次處理 ${interactions.length} 筆互動資料...`);

        // 1. 取得現有 ID 對照表
        const idResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.INTERACTIONS}!A:A`,
        });
        
        const existingIds = (idResponse.data.values || []).flat();
        const idRowMap = new Map();
        existingIds.forEach((id, index) => {
            if (index > 0 && id) idRowMap.set(String(id).trim(), index + 1);
        });

        const updates = [];
        const appends = [];
        const now = new Date().toISOString();

        for (const item of interactions) {
            // 確保有 ID
            const interactionId = item.interactionId || `INT${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            
            const rowData = this._formatRow({
                ...item,
                interactionId,
                createdTime: item.createdTime || (idRowMap.has(interactionId) ? undefined : now),
                interactionTime: item.interactionTime || now
            });

            if (idRowMap.has(String(interactionId).trim())) {
                const rowIndex = idRowMap.get(String(interactionId).trim());
                updates.push({
                    range: `${this.config.SHEETS.INTERACTIONS}!A${rowIndex}:M${rowIndex}`,
                    values: [rowData]
                });
            } else {
                appends.push(rowData);
            }
        }

        // 2. 執行批次操作
        if (updates.length > 0) {
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.config.SPREADSHEET_ID,
                resource: { valueInputOption: 'USER_ENTERED', data: updates }
            });
        }

        if (appends.length > 0) {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.config.SPREADSHEET_ID,
                range: `${this.config.SHEETS.INTERACTIONS}!A:M`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: appends }
            });
        }

        console.log(`✅ [InteractionWriter] 批次完成: 更新 ${updates.length}, 新增 ${appends.length}`);
        this.interactionReader.invalidateCache('interactions');
        
        return { updated: updates.length, appended: appends.length };
    }

    async deleteInteraction(rowIndex) {
        if (isNaN(parseInt(rowIndex)) || rowIndex <= 1) throw new Error(`無效的 rowIndex: ${rowIndex}`);
        await this._deleteRow(this.config.SHEETS.INTERACTIONS, rowIndex, this.interactionReader);
        this.interactionReader.invalidateCache('interactions');
        return { success: true };
    }

    _formatRow(data) {
        const v = (val) => (val === undefined || val === null) ? '' : val;
        return [
            v(data.interactionId),    // 0
            v(data.opportunityId),    // 1
            v(data.interactionTime),  // 2
            v(data.eventType),        // 3
            v(data.eventTitle),       // 4
            v(data.contentSummary),   // 5
            v(data.participants),     // 6
            v(data.nextAction),       // 7
            v(data.attachmentLink),   // 8
            v(data.calendarEventId),  // 9
            v(data.recorder),         // 10
            v(data.createdTime),      // 11
            v(data.companyId)         // 12
        ];
    }
}

module.exports = InteractionWriter;