// services/index.js
// [Version: 2026-01-08-Refactor-Stage3]
// [Date: 2026-01-08]
// Description: 註冊 ProductService，完成 Stage 3 重構

const config = require('../config');
const DashboardService = require('./dashboard-service');
const OpportunityService = require('./opportunity-service');
const CompanyService = require('./company-service');
const ContactService = require('./contact-service');
const ProductService = require('./product-service'); // ✅ 新增引入
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
    const contactService = new ContactService(servicesWithUtils);
    const opportunityService = new OpportunityService(servicesWithUtils);
    const companyService = new CompanyService(servicesWithUtils);
    const productService = new ProductService(servicesWithUtils); // ✅ 實例化 ProductService
    const eventLogService = new EventLogService(servicesWithUtils);
    const weeklyBusinessService = new WeeklyBusinessService(servicesWithUtils);
    const salesAnalysisService = new SalesAnalysisService(servicesWithUtils);

    // 2. 準備包含所有服務的物件 (供 Dashboard 使用)
    const allInitializedServices = {
        ...servicesWithUtils,
        contactService,
        opportunityService,
        companyService,
        productService, // ✅ 加入列表供 Dashboard 使用
        eventLogService,
        weeklyBusinessService,
        salesAnalysisService
    };

    // 3. 實例化 DashboardService
    const dashboardService = new DashboardService(allInitializedServices);

    // 4. 解決循環依賴 (依賴注入修補)
    contactService.dashboardService = dashboardService;
    
    // 若 ProductService 未來需要呼叫 Dashboard，也可在此修補
    productService.dashboardService = dashboardService;

    console.log('✅ [Service Container] 所有業務服務 (含 ProductService) 初始化完成');

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
        contactService,
        opportunityService,
        companyService,
        productService, // ✅ 必須匯出，Controller 才能使用
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