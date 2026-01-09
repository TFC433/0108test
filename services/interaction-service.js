// services/interaction-service.js
// [Version: 2026-01-08-New-Layer]
// [Date: 2026-01-08]
// Description: 互動紀錄業務邏輯層，負責資料聚合與日誌記錄

class InteractionService {
    constructor(services) {
        this.interactionReader = services.interactionReader;
        this.interactionWriter = services.interactionWriter;
        // 依賴注入 Opportunity 和 Company 服務/Reader 以進行資料聚合
        this.opportunityReader = services.opportunityReader; 
        this.companyReader = services.companyReader; 
    }

    /**
     * 搜尋所有互動紀錄，並聚合 Opportunity 與 Company 名稱
     * @param {string} query 搜尋關鍵字
     * @param {number} page 頁碼
     * @param {boolean} fetchAll 是否獲取全部
     */
    async searchAllInteractions(query, page = 1, fetchAll = false) {
        // 1. 平行獲取所有必要資料
        const [interactionsRaw, opportunities, companies] = await Promise.all([
            this.interactionReader.searchInteractionsRaw(query),
            this.opportunityReader.getOpportunities(),
            this.companyReader.getCompanyList()
        ]);

        // 2. 建立 Lookup Map
        const opportunityNameMap = new Map(opportunities.map(opp => [opp.opportunityId, opp.opportunityName]));
        const companyNameMap = new Map(companies.map(comp => [comp.companyId, comp.companyName]));

        // 3. 資料聚合 (Enrichment)
        let enrichedInteractions = interactionsRaw.map(interaction => {
            let contextName = '未指定';
            // 邏輯：優先顯示機會名稱，若無則顯示公司名稱
            if (interaction.opportunityId && opportunityNameMap.has(interaction.opportunityId)) {
                contextName = opportunityNameMap.get(interaction.opportunityId);
            } else if (interaction.companyId && companyNameMap.has(interaction.companyId)) {
                contextName = companyNameMap.get(interaction.companyId);
            }

            // 若有名稱匹配，則進行關鍵字過濾 (因為 Reader 只過濾了原始欄位)
            // 這裡進行二次過濾以支援 "搜尋機會名稱"
            return {
                ...interaction,
                opportunityName: contextName // 前端相容性欄位
            };
        });

        // 4. 二次過濾 (針對聚合後的名稱)
        if (query) {
            const lowerQuery = query.toLowerCase();
            enrichedInteractions = enrichedInteractions.filter(i => 
                i.opportunityName.toLowerCase().includes(lowerQuery) ||
                // 保留原始過濾條件 (因為 Reader 已經過濾過一次，這裡主要是補強名稱搜尋)
                (i.contentSummary && i.contentSummary.toLowerCase().includes(lowerQuery)) ||
                (i.eventTitle && i.eventTitle.toLowerCase().includes(lowerQuery)) ||
                (i.recorder && i.recorder.toLowerCase().includes(lowerQuery))
            );
        }

        // 5. 分頁處理
        if (fetchAll) {
            return {
                data: enrichedInteractions,
                pagination: { current: 1, total: 1, totalItems: enrichedInteractions.length }
            };
        }

        const pageSize = 10; // 或從 config 讀取
        const startIndex = (page - 1) * pageSize;
        const paginated = enrichedInteractions.slice(startIndex, startIndex + pageSize);

        return {
            data: paginated,
            pagination: {
                current: page,
                total: Math.ceil(enrichedInteractions.length / pageSize),
                totalItems: enrichedInteractions.length,
                hasNext: (startIndex + pageSize) < enrichedInteractions.length,
                hasPrev: page > 1
            }
        };
    }

    /**
     * 建立互動紀錄
     */
    async createInteraction(data) {
        return await this.interactionWriter.createInteraction(data);
    }

    /**
     * 更新互動紀錄
     */
    async updateInteraction(rowIndex, data, modifier) {
        return await this.interactionWriter.updateInteraction(rowIndex, data, modifier);
    }

    /**
     * 刪除互動紀錄
     */
    async deleteInteraction(rowIndex) {
        return await this.interactionWriter.deleteInteraction(rowIndex);
    }

    /**
     * 通用日誌記錄方法 (Quasi-SQL 風格)
     * @param {string} subjectId 關聯對象 ID (Opportunity 或 Company)
     * @param {string} type 事件類型
     * @param {string} content 內容摘要
     * @param {string} recorder 記錄人
     */
    async logInteraction(subjectId, type, content, recorder) {
        const payload = {
            eventType: type,
            contentSummary: content,
            recorder: recorder,
            interactionTime: new Date().toISOString()
        };

        // 自動判斷 ID 類型
        if (subjectId.startsWith('OPP')) {
            payload.opportunityId = subjectId;
        } else if (subjectId.startsWith('COMP')) {
            payload.companyId = subjectId;
        }

        return await this.createInteraction(payload);
    }
}

module.exports = InteractionService;