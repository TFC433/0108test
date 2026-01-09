// data/opportunity-writer.js

const BaseWriter = require('./base-writer');

/**
 * 專門負責處理與「機會案件」及「關聯」相關的寫入/更新操作
 * 【重構】支援動態標題對映
 * 【更新】支援更新建立日期 (Created Time)
 */
class OpportunityWriter extends BaseWriter {
    /**
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets 
     * @param {import('./opportunity-reader')} opportunityReader 
     * @param {import('./contact-reader')} contactReader 
     */
    constructor(sheets, opportunityReader, contactReader) {
        super(sheets);
        if (!opportunityReader || !contactReader) {
            throw new Error('OpportunityWriter 需要 OpportunityReader 和 ContactReader 的實例');
        }
        this.opportunityReader = opportunityReader;
        this.contactReader = contactReader;
    }

    async _getHeaderMapAndRow(rowIndex) {
        const headerRange = `${this.config.SHEETS.OPPORTUNITIES}!A1:ZZ1`;
        const dataRange = `${this.config.SHEETS.OPPORTUNITIES}!A${rowIndex}:ZZ${rowIndex}`;
        
        const response = await this.sheets.spreadsheets.values.batchGet({
            spreadsheetId: this.config.SPREADSHEET_ID,
            ranges: [headerRange, dataRange]
        });

        const headerValues = response.data.valueRanges[0].values ? response.data.valueRanges[0].values[0] : [];
        const rowValues = response.data.valueRanges[1].values ? response.data.valueRanges[1].values[0] : [];

        if (headerValues.length === 0) throw new Error('找不到標題列');
        
        const map = {};
        headerValues.forEach((title, index) => {
            if(title) map[title.trim()] = index;
        });

        return { map, currentRow: rowValues, headerLength: headerValues.length };
    }

    async updateOpportunity(rowIndex, updateData, modifier) {
        if (isNaN(parseInt(rowIndex)) || rowIndex <= 1) throw new Error(`無效的 rowIndex: ${rowIndex}`);
        console.log(`📝 [OpportunityWriter] 更新機會案件 (動態欄位) - Row: ${rowIndex} by ${modifier}`);
        
        const now = new Date().toISOString();
        const FIELD_NAMES = this.config.OPPORTUNITY_FIELD_NAMES;

        const { map, currentRow, headerLength } = await this._getHeaderMapAndRow(rowIndex);
        if (currentRow.length === 0) throw new Error(`在 ${rowIndex} 列找不到資料`);

        while (currentRow.length < headerLength) {
            currentRow.push('');
        }

        const setValue = (fieldName, value) => {
            const index = map[fieldName];
            if (index !== undefined && index >= 0) {
                currentRow[index] = value;
            } else {
                console.warn(`⚠️ [OpportunityWriter] 警告: 找不到欄位標題 "${fieldName}"，更新略過。`);
            }
        };

        if(updateData.opportunityName !== undefined) setValue(FIELD_NAMES.NAME, updateData.opportunityName);
        if(updateData.customerCompany !== undefined) setValue(FIELD_NAMES.CUSTOMER, updateData.customerCompany);
        if(updateData.mainContact !== undefined) setValue(FIELD_NAMES.CONTACT, updateData.mainContact);
        
        if(updateData.assignee !== undefined) setValue(FIELD_NAMES.ASSIGNEE, updateData.assignee);
        if(updateData.opportunityType !== undefined) setValue(FIELD_NAMES.TYPE, updateData.opportunityType);
        if(updateData.opportunitySource !== undefined) setValue(FIELD_NAMES.SOURCE, updateData.opportunitySource);
        if(updateData.currentStage !== undefined) setValue(FIELD_NAMES.STAGE, updateData.currentStage);
        if(updateData.expectedCloseDate !== undefined) setValue(FIELD_NAMES.CLOSE_DATE, updateData.expectedCloseDate);
        if(updateData.opportunityValue !== undefined) setValue(FIELD_NAMES.VALUE, updateData.opportunityValue);
        if(updateData.currentStatus !== undefined) setValue(FIELD_NAMES.STATUS, updateData.currentStatus);
        if(updateData.notes !== undefined) setValue(FIELD_NAMES.NOTES, updateData.notes);
        
        if(updateData.stageHistory !== undefined) setValue(FIELD_NAMES.HISTORY, updateData.stageHistory);
        if(updateData.parentOpportunityId !== undefined) setValue(FIELD_NAMES.PARENT_ID, updateData.parentOpportunityId);
        
        if(updateData.orderProbability !== undefined) setValue(FIELD_NAMES.PROBABILITY, updateData.orderProbability);
        if(updateData.potentialSpecification !== undefined) setValue(FIELD_NAMES.PRODUCT_SPEC, updateData.potentialSpecification); 
        
        if(updateData.salesChannel !== undefined) setValue(FIELD_NAMES.CHANNEL, updateData.salesChannel);
        
        if(updateData.deviceScale !== undefined) setValue(FIELD_NAMES.DEVICE_SCALE, updateData.deviceScale);
        if(updateData.opportunityValueType !== undefined) setValue(FIELD_NAMES.VALUE_TYPE, updateData.opportunityValueType);

        if(updateData.salesModel !== undefined) setValue(FIELD_NAMES.SALES_MODEL, updateData.salesModel);
        if(updateData.channelDetails !== undefined) setValue(FIELD_NAMES.CHANNEL, updateData.channelDetails);
        if(updateData.channelContact !== undefined) setValue(FIELD_NAMES.CHANNEL_CONTACT, updateData.channelContact);

        if(updateData.createdTime !== undefined) setValue(FIELD_NAMES.CREATED_TIME, updateData.createdTime);

        setValue(FIELD_NAMES.LAST_UPDATE_TIME, now);
        setValue(FIELD_NAMES.LAST_MODIFIER, modifier);
        
        const range = `${this.config.SHEETS.OPPORTUNITIES}!A${rowIndex}:ZZ${rowIndex}`;
        
        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [currentRow] }
        });

        this.opportunityReader.invalidateCache('opportunities');
        console.log('✅ [OpportunityWriter] 機會案件更新成功');

        return { success: true, data: { rowIndex, ...updateData } };
    }

    /**
     * 高效批量儲存 (支援更新)
     * 遵循 Stage 3-4 Canon: saveBatch(items, user)
     */
    async saveBatch(items, user) {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return { updated: 0, appended: 0 };
        }

        // 為了相容前端可能傳來的結構 (updates 陣列包含 rowIndex)，我們做一次正規化
        // 假設 items 是 [{ rowIndex, data: {...}, modifier }] 或是 [{ rowIndex, ...fields }]
        // 這裡主要針對「更新」情境優化 (Based on ChipWall/Kanban logic)

        console.log(`📝 [OpportunityWriter] 執行高效批量儲存 (Items: ${items.length})...`);
        const FIELD_NAMES = this.config.OPPORTUNITY_FIELD_NAMES;
        
        // 1. 取得標題對照表 (Header Map)
        const headerRange = `${this.config.SHEETS.OPPORTUNITIES}!A1:ZZ1`;
        const headerResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.config.SPREADSHEET_ID, range: headerRange
        });
        const headerValues = headerResponse.data.values ? headerResponse.data.values[0] : [];
        const map = {};
        headerValues.forEach((title, index) => { if(title) map[title.trim()] = index; });

        const now = new Date().toISOString();
        const modifierName = user ? (user.name || user) : 'System';

        // 2. 準備更新資料 (Batch Prepare)
        // [N+1 Optimization] 一次性讀取所有資料，避免迴圈內讀取

        console.log('[OpportunityWriter] 預先讀取 Sheet 資料以避免 N+1...');
        const allDataResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.OPPORTUNITIES}!A:ZZ`, // 讀取整張表
        });
        const allRows = allDataResponse.data.values || [];

        const preparedData = items.map((item) => {
            // 相容前端傳來的結構: { rowIndex, data: {...} } 或直接 { rowIndex, ... }
            const rowIndex = item.rowIndex || (item.data && item.data.rowIndex);
            const updateData = item.data || item;
            
            if (!rowIndex) {
                console.warn('[OpportunityWriter] 批量更新略過無 rowIndex 的項目');
                return null;
            }

            // 直接從記憶體中獲取 Row (rowIndex 是 1-based, array 是 0-based)
            const arrayIndex = rowIndex - 1;
            let currentRow = allRows[arrayIndex] ? [...allRows[arrayIndex]] : [];
            
            // 如果該行不存在或為空，視為錯誤 (因為是更新操作)
            if (currentRow.length === 0) {
                 console.warn(`[OpportunityWriter] 找不到 Row ${rowIndex} 的資料，略過更新`);
                 return null;
            }

            // 補齊長度
            while (currentRow.length < headerValues.length) currentRow.push('');

            const setVal = (key, val) => {
                const idx = map[key];
                if (idx !== undefined && idx >= 0) currentRow[idx] = val;
            };

            // 根據傳入欄位進行更新 (支援常用的批量更新欄位)
            if (updateData.currentStage !== undefined) setVal(FIELD_NAMES.STAGE, updateData.currentStage);
            if (updateData.stageHistory !== undefined) setVal(FIELD_NAMES.HISTORY, updateData.stageHistory);
            if (updateData.customerCompany !== undefined) setVal(FIELD_NAMES.CUSTOMER, updateData.customerCompany);
            if (updateData.opportunityName !== undefined) setVal(FIELD_NAMES.NAME, updateData.opportunityName);
            if (updateData.opportunityType !== undefined) setVal(FIELD_NAMES.TYPE, updateData.opportunityType);
            if (updateData.assignee !== undefined) setVal(FIELD_NAMES.ASSIGNEE, updateData.assignee);

            setVal(FIELD_NAMES.LAST_UPDATE_TIME, now);
            setVal(FIELD_NAMES.LAST_MODIFIER, modifierName);
            
            return {
                range: `${this.config.SHEETS.OPPORTUNITIES}!A${rowIndex}:ZZ${rowIndex}`,
                values: [currentRow]
            };
        });

        const validUpdates = preparedData.filter(d => d !== null);

        if (validUpdates.length > 0) {
            await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.config.SPREADSHEET_ID,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: validUpdates
                }
            });
        }

        this.opportunityReader.invalidateCache('opportunities');
        console.log(`✅ [OpportunityWriter] 批量儲存完成: 更新 ${validUpdates.length} 筆`);

        // 回傳格式符合 Canon (ProductWriter)
        return { updated: validUpdates.length, appended: 0 };
    }
    
    async deleteOpportunity(rowIndex, modifier) {
        if (isNaN(parseInt(rowIndex)) || rowIndex <= 1) throw new Error(`無效的 rowIndex: ${rowIndex}`);
        console.log(`🗑️ [OpportunityWriter] 刪除機會案件 - Row: ${rowIndex} by ${modifier}`);
        
        await this._deleteRow(this.config.SHEETS.OPPORTUNITIES, rowIndex, this.opportunityReader);
        
        console.log('✅ [OpportunityWriter] 機會案件刪除成功');
        return { success: true };
    }

    async linkContactToOpportunity(opportunityId, contactId, modifier) {
        console.log(`🔗 [OpportunityWriter] 建立關聯: 機會 ${opportunityId} <-> 聯絡人 ${contactId}`);
        const now = new Date().toISOString();
        const linkId = `LNK${Date.now()}`;
        
        const rowData = [linkId, opportunityId, contactId, now, 'active', modifier];
        
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.OPPORTUNITY_CONTACT_LINK}!A:F`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [rowData] }
        });
        
        this.contactReader.invalidateCache('oppContactLinks');
        return { success: true, linkId: linkId };
    }

    async deleteContactLink(opportunityId, contactId) {
        console.log(`🗑️ [OpportunityWriter] 永久刪除關聯: 機會 ${opportunityId} <-> 聯絡人 ${contactId}`);
        const range = `${this.config.SHEETS.OPPORTUNITY_CONTACT_LINK}!A:F`;
        
        const allLinks = await this.contactReader.getAllOppContactLinks();
        const linkRowsResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: range,
        });

        const rows = linkRowsResponse.data.values || [];
        for (let i = 1; i < rows.length; i++) { 
            const rowOppId = rows[i][this.config.OPP_CONTACT_LINK_FIELDS.OPPORTUNITY_ID];
            const rowContactId = rows[i][this.config.OPP_CONTACT_LINK_FIELDS.CONTACT_ID];
            
            if (rowOppId === opportunityId && rowContactId === contactId) {
                const rowIndexToDelete = i + 1;
                await this._deleteRow(this.config.SHEETS.OPPORTUNITY_CONTACT_LINK, rowIndexToDelete, this.contactReader);
                return { success: true, rowIndex: rowIndexToDelete };
            }
        }
        throw new Error('找不到對應的關聯紀錄');
    }
}

module.exports = OpportunityWriter;