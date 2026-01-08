// services/index.js
// [Version: 2026-01-08-Fix-Dependency]
// [Date: 2026-01-08]
// Description: 修正 ContactService 缺失與解決循環依賴問題

const config = require('../config');
const DashboardService = require('./dashboard-service');
const OpportunityService = require('./opportunity-service');
const CompanyService = require('./company-service');
const ContactService = require('./contact-service'); // ✅ 新增引入
const EventLogService = require('./event-log-service');
const WeeklyBusinessService = require('./weekly-business-service');
const SalesAnalysisService = require('./sales-analysis-service');
const dateHelpers = require('../utils/date-helpers');

function initializeBusinessServices(coreServices) {
    // Debug: 檢查核心服務
    console.log('🔍 [BusinessServices] 接收核心服務, configReader:', !!coreServices.configReader);

    // 將 config 和 dateHelpers 加入核心服務
    const servicesWithUtils = { ...coreServices, config, dateHelpers };

    // 1. 實例化服務 (注意順序)
    // ✅ 建立 ContactService (此時它的 this.dashboardService 會是 undefined，稍後修補)
    const contactService = new ContactService(servicesWithUtils);
    
    const opportunityService = new OpportunityService(servicesWithUtils);
    const companyService = new CompanyService(servicesWithUtils);
    const eventLogService = new EventLogService(servicesWithUtils);
    const weeklyBusinessService = new WeeklyBusinessService(servicesWithUtils);
    const salesAnalysisService = new SalesAnalysisService(servicesWithUtils);

    // 2. 準備包含所有服務的物件 (供 Dashboard 使用)
    const allInitializedServices = {
        ...servicesWithUtils,
        contactService, // ✅ 加入 ContactService 供 Dashboard 使用
        opportunityService,
        companyService,
        eventLogService,
        weeklyBusinessService,
        salesAnalysisService
    };

    // 3. 實例化 DashboardService (此時它能拿到 contactService)
    const dashboardService = new DashboardService(allInitializedServices);

    // 4. ✅ [關鍵修正] 解決循環依賴：手動將 dashboardService 注入回 contactService
    contactService.dashboardService = dashboardService;

    console.log('✅ [Service Container] ContactService 已註冊並完成依賴注入');

    // 回傳完整的服務容器
    return {
        // Google API 客戶端
        sheets: coreServices.sheets,
        calendar: coreServices.calendar,
        drive: coreServices.drive,

        // 工具函式
        dateHelpers, 

        // 業務邏輯服務
        dashboardService,
        contactService, // ✅ 必須匯出，Controller 才能使用
        opportunityService,
        companyService,
        eventLogService,
        weeklyBusinessService,
        salesAnalysisService,

        // 核心工作流服務
        workflowService: coreServices.workflowService,
        calendarService: coreServices.calendarService,

        // 資料層 Readers
        contactReader: coreServices.contactReader,
        opportunityReader: coreServices.opportunityReader,
        companyReader: coreServices.companyReader,
        interactionReader: coreServices.interactionReader,
        weeklyBusinessReader: coreServices.weeklyBusinessReader,
        eventLogReader: coreServices.eventLogReader,
        announcementReader: coreServices.announcementReader,
        productReader: coreServices.productReader,
        authReader: coreServices.authReader,
        configReader: coreServices.configReader,

        // 資料層 Writers
        companyWriter: coreServices.companyWriter,
        contactWriter: coreServices.contactWriter,
        opportunityWriter: coreServices.opportunityWriter,
        interactionWriter: coreServices.interactionWriter,
        eventLogWriter: coreServices.eventLogWriter,
        weeklyBusinessWriter: coreServices.weeklyBusinessWriter,
        announcementWriter: coreServices.announcementWriter,
        authWriter: coreServices.authWriter,
        configWriter: coreServices.configWriter
    };
}

module.exports = initializeBusinessServices;