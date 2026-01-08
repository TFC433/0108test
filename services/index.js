// services/index.js
const config = require('../config');
const DashboardService = require('./dashboard-service');
const OpportunityService = require('./opportunity-service');
const CompanyService = require('./company-service');
const EventLogService = require('./event-log-service');
const WeeklyBusinessService = require('./weekly-business-service');
const SalesAnalysisService = require('./sales-analysis-service');
const dateHelpers = require('../utils/date-helpers');

function initializeBusinessServices(coreServices) {
    // Debug: 檢查核心服務是否包含 configReader
    console.log('🔍 [BusinessServices] 接收核心服務, configReader:', !!coreServices.configReader);

    // 將 config 和 dateHelpers 加入核心服務
    const servicesWithUtils = { ...coreServices, config, dateHelpers };

    // 1. 實例化服務
    const opportunityService = new OpportunityService(servicesWithUtils);
    const companyService = new CompanyService(servicesWithUtils);
    const eventLogService = new EventLogService(servicesWithUtils);
    const weeklyBusinessService = new WeeklyBusinessService(servicesWithUtils);
    const salesAnalysisService = new SalesAnalysisService(servicesWithUtils);

    // 2. 準備包含所有服務的物件 (供 Dashboard 使用)
    const allInitializedServices = {
        ...servicesWithUtils, // 這會包含 configReader
        opportunityService,
        companyService,
        eventLogService,
        weeklyBusinessService,
        salesAnalysisService
    };

    // 3. 實例化 DashboardService
    const dashboardService = new DashboardService(allInitializedServices);

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
        configReader: coreServices.configReader, // 確保這裡也有匯出

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