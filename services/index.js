// services/index.js
// [Version: 2026-01-08-Refactor-Stage4]
// [Date: 2026-01-08]
// Description: 加入 InteractionService 並完成依賴注入

const config = require('../config');
const DashboardService = require('./dashboard-service');
const OpportunityService = require('./opportunity-service');
const CompanyService = require('./company-service');
const ContactService = require('./contact-service');
const ProductService = require('./product-service');
const InteractionService = require('./interaction-service'); // ✅ 新增
const EventLogService = require('./event-log-service');
const WeeklyBusinessService = require('./weekly-business-service');
const SalesAnalysisService = require('./sales-analysis-service');
const dateHelpers = require('../utils/date-helpers');

function initializeBusinessServices(coreServices) {
    console.log('🔍 [BusinessServices] 初始化業務服務層...');

    const servicesWithUtils = { ...coreServices, config, dateHelpers };

    // 1. 實例化服務
    const contactService = new ContactService(servicesWithUtils);
    const opportunityService = new OpportunityService(servicesWithUtils);
    const companyService = new CompanyService(servicesWithUtils);
    const productService = new ProductService(servicesWithUtils);
    const interactionService = new InteractionService(servicesWithUtils); // ✅ 實例化
    const eventLogService = new EventLogService(servicesWithUtils);
    const weeklyBusinessService = new WeeklyBusinessService(servicesWithUtils);
    const salesAnalysisService = new SalesAnalysisService(servicesWithUtils);

    // 2. 準備服務容器
    const allInitializedServices = {
        ...servicesWithUtils,
        contactService,
        opportunityService,
        companyService,
        productService,
        interactionService, // ✅ 加入容器
        eventLogService,
        weeklyBusinessService,
        salesAnalysisService
    };

    // 3. 實例化 DashboardService
    const dashboardService = new DashboardService(allInitializedServices);

    // 4. 解決循環依賴與反向注入
    contactService.dashboardService = dashboardService;
    productService.dashboardService = dashboardService;
    // InteractionService 不需要反向注入 Dashboard，但如果有其他依賴可在此處理

    console.log('✅ [Service Container] Stage 4 - Interaction Module Ready');

    return {
        // ...coreServices contents (passed through)
        sheets: coreServices.sheets,
        calendar: coreServices.calendar,
        drive: coreServices.drive,
        dateHelpers,

        // Services
        dashboardService,
        contactService,
        opportunityService,
        companyService,
        productService,
        interactionService, // ✅ 匯出
        eventLogService,
        weeklyBusinessService,
        salesAnalysisService,
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