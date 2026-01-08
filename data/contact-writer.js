// data/contact-writer.js
// [Version: 2026-01-08-Refactor-Stage2]
// [Date: 2026-01-08]
// Description: 負責寫入聯絡人資料，封裝標準聯絡人的 RowIndex 操作

const BaseWriter = require('./base-writer');

/**
 * 專門負責處理與「聯絡人」相關的寫入/更新操作
 */
class ContactWriter extends BaseWriter {
    /**
     * @param {import('googleapis').google.sheets_v4.Sheets} sheets 
     * @param {import('./contact-reader')} contactReader 
     */
    constructor(sheets, contactReader) {
        super(sheets);
        if (!contactReader) {
            throw new Error('ContactWriter 需要 ContactReader 的實例');
        }
        this.contactReader = contactReader;
    }

    /**
     * 取得或建立一位聯絡人 (標準聯絡人)
     */
    async getOrCreateContact(contactInfo, companyData, modifier) {
        const allContacts = await this.contactReader.getContactList();
        // 這裡的邏輯假設同公司同名為同一人
        const existingContact = allContacts.find(c => c.name === contactInfo.name && c.companyId === companyData.id);
        
        if (existingContact) {
             console.log(`👤 [ContactWriter] 聯絡人已存在: ${contactInfo.name}`);
             return { id: existingContact.contactId, name: existingContact.name };
        }

        console.log(`👤 [ContactWriter] 建立新聯絡人: ${contactInfo.name} by ${modifier}`);
        const now = new Date().toISOString();
        const newContactId = `CON${Date.now()}`;
        
        // 使用傳入的 rowIndex (來自原始名片) 或 'MANUAL'
        // 注意：contactInfo 可能是 DTO，rowIndex 在 _meta 中，或者來自其他來源
        const sourceRef = contactInfo._meta && contactInfo._meta.rowIndex 
            ? `BC-${contactInfo._meta.rowIndex}` 
            : (contactInfo.rowIndex ? `BC-${contactInfo.rowIndex}` : 'MANUAL');

        const newRow = [
            newContactId,                   // A: ID
            sourceRef,                      // B: Source
            contactInfo.name || '',         // C: Name
            companyData.id,                 // D: CompanyID
            contactInfo.department || '',   // E: Dept
            contactInfo.position || '',     // F: Position
            contactInfo.mobile || '',       // G: Mobile
            contactInfo.phone || '',        // H: Phone
            contactInfo.email || '',        // I: Email
            now,                            // J: Created
            now,                            // K: Updated
            modifier,                       // L: Creator
            modifier                        // M: Modifier
        ];
        
        await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.CONTACT_LIST}!A:M`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] }
        });

        this.contactReader.invalidateCache('contactList');
        return { id: newContactId, name: contactInfo.name };
    }

    /**
     * 更新已建檔聯絡人資料 (封裝 RowIndex)
     * @param {string} contactId - 聯絡人 ID
     * @param {object} updateData - 要更新的欄位
     * @param {string} modifier - 修改者
     */
    async updateContact(contactId, updateData, modifier) {
        console.log(`👤 [ContactWriter] 更新聯絡人資料: ${contactId} by ${modifier}`);
        const range = `${this.config.SHEETS.CONTACT_LIST}!A:M`;
        
        // 1. 使用 Reader 查找 Row (使用 ID 欄位，Index 0)
        const contactRow = await this.contactReader.findRowByValue(range, 0, contactId);
        if (!contactRow) throw new Error(`找不到聯絡人ID: ${contactId}`);

        const { rowIndex, rowData: currentRow } = contactRow;
        const now = new Date().toISOString();
        
        // 2. 更新欄位 (Partial Update)
        if(updateData.sourceId !== undefined) currentRow[1] = updateData.sourceId;
        if(updateData.name !== undefined) currentRow[2] = updateData.name;
        if(updateData.companyId !== undefined) currentRow[3] = updateData.companyId;
        if(updateData.department !== undefined) currentRow[4] = updateData.department;
        if(updateData.position !== undefined) currentRow[5] = updateData.position;
        if(updateData.mobile !== undefined) currentRow[6] = updateData.mobile;
        if(updateData.phone !== undefined) currentRow[7] = updateData.phone;
        if(updateData.email !== undefined) currentRow[8] = updateData.email;
        
        currentRow[10] = now; // LastUpdate
        currentRow[12] = modifier; // Modifier
        
        // 3. 寫回 Sheets
        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: `${this.config.SHEETS.CONTACT_LIST}!A${rowIndex}:M${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [currentRow] }
        });

        this.contactReader.invalidateCache('contactList');
        console.log('✅ [ContactWriter] 聯絡人資料更新成功');
        return { success: true };
    }

    /**
     * 更新潛在客戶的狀態欄位 (依賴 rowIndex)
     */
    async updateContactStatus(rowIndex, status) {
        if (isNaN(parseInt(rowIndex)) || rowIndex <= 1) throw new Error(`無效的 rowIndex: ${rowIndex}`);
        
        const range = `${this.config.SHEETS.CONTACTS}!Y${rowIndex}`;
        console.log(`📝 [ContactWriter] 更新潛在客戶狀態 - Row: ${rowIndex} -> ${status}`);
        
        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[status]] }
        });
        
        this.contactReader.invalidateCache('contacts');
        return { success: true };
    }

    /**
     * 更新原始名片資料 (用於 LIFF 簡易編輯)
     * @param {number} rowIndex - 原始名片資料的列索引 (1-based)
     * @param {object} updateData - 要更新的欄位
     * @param {string} modifier - 修改者
     */
    async updateRawContact(rowIndex, updateData, modifier) {
        if (isNaN(parseInt(rowIndex)) || rowIndex <= 1) throw new Error(`無效的 rowIndex: ${rowIndex}`);
        
        console.log(`📝 [ContactWriter] LIFF 更新原始名片 - Row: ${rowIndex} by ${modifier}`);
        
        const range = `${this.config.SHEETS.CONTACTS}!A${rowIndex}:Y${rowIndex}`;
        
        // 先讀取以保留未修改欄位
        const response = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: range,
        });

        const currentRow = response.data.values ? response.data.values[0] : [];
        if (currentRow.length === 0) throw new Error(`在 "原始名片資料" Row ${rowIndex} 找不到資料`);

        const F = this.config.CONTACT_FIELDS;

        // 更新對應欄位
        if (updateData.name !== undefined) currentRow[F.NAME] = updateData.name;
        if (updateData.company !== undefined) currentRow[F.COMPANY] = updateData.company;
        if (updateData.position !== undefined) currentRow[F.POSITION] = updateData.position;
        if (updateData.mobile !== undefined) currentRow[F.MOBILE] = updateData.mobile;
        if (updateData.email !== undefined) currentRow[F.EMAIL] = updateData.email;
        
        // 寫回
        await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.config.SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [currentRow] }
        });

        this.contactReader.invalidateCache('contacts');
        
        console.log('✅ [ContactWriter] 原始名片資料更新成功');
        return { success: true };
    }
}

module.exports = ContactWriter;