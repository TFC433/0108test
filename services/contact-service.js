// services/contact-service.js
// [Version: 2026-01-08-Refactor-Stage2]
// [Date: 2026-01-08]
// Description: 負責處理聯絡人業務邏輯，包含資料驗證、日誌記錄與 CRUD

class ContactService {
    /**
     * @param {object} services - 包含所有已初始化服務的容器
     */
    constructor(services) {
        this.contactReader = services.contactReader;
        this.contactWriter = services.contactWriter;
        this.companyReader = services.companyReader;
        this.interactionWriter = services.interactionWriter;
        this.dashboardService = services.dashboardService;
        this.configReader = services.configReader;
    }

    /**
     * 輔助函式：建立一筆聯絡人互動日誌
     */
    async _logContactInteraction(contactId, title, summary, modifier) {
        try {
            // 目前 Interaction 結構主要針對 Company/Opportunity，若要針對 Contact 可能需擴充
            // 暫時透過內容備註
            console.log(`[ContactLog] ${title}: ${summary} (by ${modifier})`);
            // 若未來 Interaction 支援 contactId 欄位可在此寫入
        } catch (logError) {
            console.warn(`[ContactService] 寫入日誌失敗: ${logError.message}`);
        }
    }

    /**
     * 取得聯絡人儀表板數據 (轉發至 DashboardService)
     */
    async getDashboardData() {
        return this.dashboardService.getContactsDashboardData();
    }

    /**
     * 搜尋潛在客戶 (原始名片)
     */
    async searchRawContacts(query, page = 1) {
        return this.contactReader.searchContacts(query);
    }

    /**
     * 搜尋已建檔聯絡人 (標準聯絡人)
     */
    async searchContactList(query, page = 1) {
        return this.contactReader.searchContactList(query, page);
    }

    /**
     * 更新已建檔聯絡人資料
     */
    async updateContact(contactId, updateData, modifier) {
        // 1. 驗證聯絡人存在
        const existingContact = await this.contactReader.findContactById(contactId);
        if (!existingContact) {
            throw new Error(`找不到聯絡人 ID: ${contactId}`);
        }

        // 2. 若有更新公司，驗證公司是否存在
        if (updateData.companyId && updateData.companyId !== existingContact.companyId) {
            const company = await this.companyReader.findCompanyById(updateData.companyId);
            if (!company) {
                throw new Error(`指定的公司 ID 不存在: ${updateData.companyId}`);
            }
        }

        // 3. 執行更新
        const result = await this.contactWriter.updateContact(contactId, updateData, modifier);
        
        // 4. 記錄日誌
        if (result.success) {
            const logs = [];
            if (updateData.name && updateData.name !== existingContact.name) logs.push(`姓名變更為 ${updateData.name}`);
            if (updateData.mobile && updateData.mobile !== existingContact.mobile) logs.push(`手機變更為 ${updateData.mobile}`);
            
            if (logs.length > 0) {
                await this._logContactInteraction(contactId, '聯絡人資料更新', logs.join(', '), modifier);
            }
        }

        return result;
    }

    /**
     * 更新原始名片資料 (LIFF 用)
     */
    async updateRawContact(rowIndex, updateData, modifier) {
        // 原始名片直接依賴 rowIndex
        return this.contactWriter.updateRawContact(rowIndex, updateData, modifier);
    }
}

module.exports = ContactService;