// public/scripts/interactions.js
// [Version: 2026-01-08-Refactor-SafeDOM]
// [Date: 2026-01-08]
// Description: 前端互動紀錄頁面，加入 DOM 安全檢查

/**
 * 載入並渲染所有互動紀錄頁面的主函式
 */
async function loadAllInteractionsPage(page = 1, query = '') {
    const container = document.getElementById('page-interactions');
    if (!container) return; // ✅ Safety Check

    // 步驟 1: 渲染頁面基本骨架
    container.innerHTML = `
        <div class="dashboard-widget">
            <div class="widget-header">
                <h2 class="widget-title">所有互動紀錄</h2>
            </div>
            <div class="search-pagination" style="padding: 0 1.5rem 1rem;">
                <input type="text" class="search-box" id="all-interactions-search" placeholder="搜尋內容、機會名稱、記錄人..." value="${query}">
                <div class="pagination" id="all-interactions-pagination"></div>
            </div>
            <div id="all-interactions-content" class="widget-content">
                <div class="loading show"><div class="spinner"></div><p>載入互動總覽中...</p></div>
            </div>
        </div>
    `;

    // 綁定搜尋事件 (加入安全檢查)
    const searchInput = document.getElementById('all-interactions-search');
    if (searchInput) {
        searchInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                const newQuery = event.target.value;
                loadAllInteractionsPage(1, newQuery);
            }
        });
    }

    // 步驟 2: 獲取數據並渲染
    try {
        const result = await authedFetch(`/api/interactions/all?page=${page}&q=${encodeURIComponent(query)}`);
        
        const contentDiv = document.getElementById('all-interactions-content');
        if (contentDiv) { // ✅ Safety Check
            contentDiv.innerHTML = renderAllInteractionsTable(result.data || []);
        }
        
        renderPagination('all-interactions-pagination', result.pagination, 'loadAllInteractionsPage');

    } catch (error) {
        if (error.message !== 'Unauthorized') {
            console.error('載入所有互動紀錄失敗:', error);
            const contentDiv = document.getElementById('all-interactions-content');
            if (contentDiv) {
                contentDiv.innerHTML = `<div class="alert alert-error">載入紀錄失敗: ${error.message}</div>`;
            }
        }
    }
}

/**
 * 渲染所有互動紀錄的表格
 */
function renderAllInteractionsTable(interactions) {
    if (!interactions || interactions.length === 0) {
        return '<div class="alert alert-info" style="text-align:center;">找不到符合條件的互動紀錄</div>';
    }

    let tableHTML = `<table class="data-table">
                        <thead>
                            <tr>
                                <th>互動時間</th>
                                <th>關聯對象</th>
                                <th>事件類型</th>
                                <th>內容摘要</th>
                                <th>記錄人</th>
                            </tr>
                        </thead>
                        <tbody>`;

    interactions.forEach(item => {
        let summaryHTML = item.contentSummary || '';
        const linkRegex = /\[(.*?)\]\(event_log_id=([a-zA-Z0-9]+)\)/g;
        summaryHTML = summaryHTML.replace(linkRegex, (fullMatch, text, eventId) => {
            const safeEventId = eventId.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return `<a href="#" class="text-link" onclick="event.preventDefault(); showEventLogReport('${safeEventId}')">${text}</a>`;
        });

        // 機會/公司連結邏輯 (相容後端 Service 聚合後的資料)
        let opportunityLink = item.opportunityName || '未指定';
        
        // 此處邏輯與後端 Service 一致：若有 opportunityId 則連到機會，否則若有公司 ID 則連到公司
        if (item.opportunityId) {
            opportunityLink = `<a href="#" class="text-link" onclick="event.preventDefault(); CRM_APP.navigateTo('opportunity-details', { opportunityId: '${item.opportunityId}' })">
                                   ${item.opportunityName}
                               </a>`;
        } else if (item.companyId && item.opportunityName !== '未指定') {
            const encodedCompanyName = encodeURIComponent(item.opportunityName);
            opportunityLink = `<a href="#" class="text-link" onclick="event.preventDefault(); CRM_APP.navigateTo('company-details', { companyName: '${encodedCompanyName}' })">
                                   ${item.opportunityName} (公司)
                               </a>`;
        }

        tableHTML += `
            <tr>
                <td data-label="互動時間">${formatDateTime(item.interactionTime)}</td>
                <td data-label="關聯對象">${opportunityLink}</td>
                <td data-label="事件類型">${item.eventTitle || item.eventType}</td>
                <td data-label="內容摘要" style="white-space: pre-wrap; word-break: break-word;">${summaryHTML}</td>
                <td data-label="記錄人">${item.recorder || '-'}</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    return tableHTML;
}

if (window.CRM_APP) {
    window.CRM_APP.pageModules.interactions = loadAllInteractionsPage;
}