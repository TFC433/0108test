// services/company-service.js
// [Version: 2026-01-08-Refactor-Stage1]
// [Date: 2026-01-08]
// Description: 負責處理公司業務邏輯，修正依賴注入與 RowIndex 依賴

class CompanyService {
    /**
     * @param {object} services - 包含所有已初始化服務的容器
     */
    constructor(services) {
        // Data Access Layers
        this.companyReader = services.companyReader;
        this.contactReader = services.contactReader;
        this.opportunityReader = services.opportunityReader;
        this.interactionReader = services.interactionReader;
        this.eventLogReader = services.eventLogReader;
        
        this.companyWriter = services.companyWriter;
        this.interactionWriter = services.interactionWriter;
        this.opportunityWriter = services.opportunityWriter;
        this.contactWriter = services.contactWriter;

        // 【修正】使用 ConfigReader 取代 SystemReader
        this.configReader = services.configReader; 
    }

    /**
     * 輔助函式：建立一筆公司互動日誌
     * @private
     */
    async _logCompanyInteraction(companyId, title, summary, modifier) {
        try {
            await this.interactionWriter.createInteraction({
                companyId: companyId,
                eventType: '系統事件',
                eventTitle: title,
                contentSummary: summary,
                recorder: modifier,
            });
        } catch (logError) {
            console.warn(`[CompanyService] 寫入公司日誌失敗 (CompanyID: ${companyId}): ${logError.message}`);
        }
    }

    /**
     * 【快速新增】建立新公司 (含自動預設值)
     */
    async createCompany(companyName, modifier) {
        const normalizedName = companyName.trim();
        if (!normalizedName) throw new Error('公司名稱不能為空');

        // 使用 Reader 的專用查找方法
        const existing = await this.companyReader.findCompanyByName(normalizedName);
        
        if (existing) {
            return { 
                success: false, 
                reason: 'EXISTS', 
                message: '公司已存在', 
                data: existing 
            };
        }

        const defaultValues = {
            companyType: '未分類',
            customerStage: '01_初步接觸',
            engagementRating: 'C'
        };

        const newCompanyData = await this.companyWriter.getOrCreateCompany(
            normalizedName, 
            {}, // contactInfo (Optional)
            modifier, 
            defaultValues
        );
        
        await this._logCompanyInteraction(
            newCompanyData.id,
            '公司建立',
            `快速建立新公司 "${normalizedName}"`,
            modifier
        );

        return { 
            success: true, 
            data: {
                ...newCompanyData,
                companyName: newCompanyData.name,
                companyId: newCompanyData.id
            }
        };
    }

    /**
     * 更新公司資料 (含連動更新 Cascade Update)
     */
    async updateCompany(companyName, updateData, modifier) {
        // 1. 驗證公司是否存在
        const originalCompany = await this.companyReader.findCompanyByName(companyName);
        if (!originalCompany) {
            throw new Error(`找不到要更新的公司: ${companyName}`);
        }

        // 2. 獲取系統設定對照表
        // 【修正】確保 configReader 存在且方法正確
        const config = await this.configReader.getSystemConfig(); 
        const getNote = (configKey, value) => (config[configKey] || []).find(i => i.value === value)?.note || value || 'N/A';
        
        const logs = [];

        // 3. 檢查變更並記錄日誌
        const isRenaming = updateData.companyName && updateData.companyName.trim() !== originalCompany.companyName;
        
        if (isRenaming) {
            logs.push(`公司名稱從 [${originalCompany.companyName}] 變更為 [${updateData.companyName}]`);
        }
        if (updateData.customerStage && updateData.customerStage !== originalCompany.customerStage) {
            logs.push(`客戶階段從 [${getNote('客戶階段', originalCompany.customerStage)}] 更新為 [${getNote('客戶階段', updateData.customerStage)}]`);
        }
        if (updateData.engagementRating && updateData.engagementRating !== originalCompany.engagementRating) {
            logs.push(`互動評級從 [${getNote('互動評級', originalCompany.engagementRating)}] 更新為 [${getNote('互動評級', updateData.engagementRating)}]`);
        }

        // 4. 執行更新 (Writer 內部會處理 RowIndex)
        const updateResult = await this.companyWriter.updateCompany(companyName, updateData, modifier);
        
        // 5. 連動更新 (Cascade Update) - 如果改名
        if (updateResult.success && isRenaming) {
            console.log(`🔄 [CompanyService] 偵測到公司改名，開始連動更新...`);
            try {
                const allOpportunities = await this.opportunityReader.getOpportunities();
                const relatedOpportunities = allOpportunities.filter(opp => 
                    opp.customerCompany.toLowerCase().trim() === originalCompany.companyName.toLowerCase().trim()
                );

                if (relatedOpportunities.length > 0) {
                    // 注意：目前 Opportunity 仍依賴 rowIndex，這部分等到 Stage 3 (Opportunity) 重構時再改為 SQL-like update
                    const batchUpdates = relatedOpportunities.map(opp => ({
                        rowIndex: opp.rowIndex, 
                        data: { customerCompany: updateData.companyName },
                        modifier: `System (Cascade Update from ${modifier})`
                    }));

                    await this.opportunityWriter.batchUpdateOpportunities(batchUpdates);
                    logs.push(`已自動同步更新 ${relatedOpportunities.length} 筆關聯機會案件`);
                }
            } catch (cascadeError) {
                console.error(`❌ [CompanyService] 連動更新失敗:`, cascadeError);
                logs.push(`⚠️ 連動更新失敗: ${cascadeError.message}`);
            }
        }

        // 6. 寫入日誌
        if (updateResult.success && logs.length > 0) {
            await this._logCompanyInteraction(
                originalCompany.companyId,
                '公司資料變更',
                logs.join('； '),
                modifier
            );
        }

        return updateResult;
    }

    /**
     * 獲取公司列表 (含活動數據)
     */
    async getCompanyListWithActivity() {
        const [allCompanies, allInteractions, allOpportunities] = await Promise.all([
            this.companyReader.getCompanyList(),
            this.interactionReader.getInteractions(),
            this.opportunityReader.getOpportunities()
        ]);

        const companyActivityMap = new Map();
        const companyOpportunityCountMap = new Map();

        // 初始化 Map
        allCompanies.forEach(comp => {
            const initialTime = new Date(comp.lastUpdateTime || comp.createdTime).getTime();
            companyActivityMap.set(comp.companyId, isNaN(initialTime) ? 0 : initialTime);
            companyOpportunityCountMap.set(comp.companyId, 0);
        });

        // 建立名稱到 ID 的映射，方便反查
        const companyNameToIdMap = new Map(allCompanies.map(c => [c.companyName, c.companyId]));
        const oppToCompanyIdMap = new Map();
        
        // 統計機會案件
        allOpportunities.forEach(opp => {
            if (companyNameToIdMap.has(opp.customerCompany)) {
                const companyId = companyNameToIdMap.get(opp.customerCompany);
                oppToCompanyIdMap.set(opp.opportunityId, companyId);
                
                if (opp.currentStatus !== '已封存' && opp.currentStatus !== '已取消') {
                     const count = companyOpportunityCountMap.get(companyId) || 0;
                     companyOpportunityCountMap.set(companyId, count + 1);
                }
            }
        });

        // 統計互動時間
        allInteractions.forEach(inter => {
            let companyId = inter.companyId;
            // 如果互動沒綁公司但有綁機會，嘗試反查公司
            if (!companyId && inter.opportunityId && oppToCompanyIdMap.has(inter.opportunityId)) {
                companyId = oppToCompanyIdMap.get(inter.opportunityId);
            }

            if (companyId) {
                const existingTime = companyActivityMap.get(companyId) || 0;
                const interactTime = new Date(inter.interactionTime || inter.createdTime).getTime();
                if (interactTime > existingTime) {
                    companyActivityMap.set(companyId, interactTime);
                }
            }
        });

        // 組裝結果
        const companiesWithActivity = allCompanies.map(comp => ({
            ...comp,
            lastActivity: companyActivityMap.get(comp.companyId),
            opportunityCount: companyOpportunityCountMap.get(comp.companyId) || 0
        }));

        // 排序：最近有活動的排前面
        companiesWithActivity.sort((a, b) => b.lastActivity - a.lastActivity);

        return companiesWithActivity;
    }

    /**
     * 獲取公司詳情
     */
    async getCompanyDetails(companyName) {
        // 此處邏輯與之前保持一致，但受惠於 Reader 改良，取回的 company 物件格式更標準
        const [allCompanies, allContacts, allOpportunities, allEventLogs] = await Promise.all([
            this.companyReader.getCompanyList(),
            this.contactReader.getContactList(),
            this.opportunityReader.getOpportunities(),
            this.eventLogReader.getEventLogs()
        ]);

        const normalizedName = companyName.toLowerCase().trim();
        const company = allCompanies.find(c => c.companyName.toLowerCase().trim() === normalizedName);
        
        if (!company) {
            throw new Error(`找不到公司: ${companyName}`);
        }

        const relatedContacts = allContacts.filter(c => c.companyId === company.companyId);
        const relatedOpportunities = allOpportunities.filter(o => o.customerCompany.toLowerCase().trim() === normalizedName);
        
        const relatedEventLogs = allEventLogs
            .filter(log => log.companyId === company.companyId)
            .sort((a, b) => new Date(b.lastModifiedTime || b.createdTime) - new Date(a.lastModifiedTime || a.createdTime));
        
        return {
            companyInfo: company,
            contacts: relatedContacts,
            opportunities: relatedOpportunities,
            eventLogs: relatedEventLogs,
            potentialContacts: [], // 若無實作可留空
            interactions: []       // Interaction 可後續補上
        };
    }

    async deleteCompany(companyName, modifier) {
        // 先檢查關聯
        const allOpportunities = await this.opportunityReader.getOpportunities();
        const hasActiveOpp = allOpportunities.some(o => o.customerCompany.toLowerCase().trim() === companyName.toLowerCase().trim());
        
        if (hasActiveOpp) {
            throw new Error(`無法刪除：此公司仍有關聯的機會案件`);
        }

        // 執行刪除
        return this.companyWriter.deleteCompany(companyName);
    }
}

module.exports = CompanyService;