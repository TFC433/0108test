// services/service-container.js
// [Version: 2026-01-08-Fix-ProductWriter]
// [Date: 2026-01-08]
// Description: 修正 ProductWriter 未被實例化導致 ProductService 崩潰的問題

const { google } = require('googleapis');
const AuthService = require('./auth-service');
const WorkflowService = require('./workflow-service');
const CalendarService = require('./calendar-service');

// 從 data/index.js 一次性引入所有資料層模組
const {
    OpportunityReader, ContactReader, CompanyReader, InteractionReader,
    EventLogReader, WeeklyBusinessReader, AnnouncementReader, ProductReader,
    AuthReader, ConfigReader,
    
    CompanyWriter, ContactWriter, OpportunityWriter, InteractionWriter,
    EventLogWriter, WeeklyBusinessWriter, AnnouncementWriter, ProductWriter, // ✅ [Fix 1] 加入 ProductWriter
    AuthWriter, ConfigWriter
} = require('../data');

const services = {};

async function initializeServices() {
    if (services.isInitialized) {
        return services;
    }

    console.log('🔧 [Service Container] 正在初始化所有服務...');

    // 1. 認證服務
    const authService = new AuthService();
    const authClient = await authService.getOAuthClient();

    // 2. Google API 實例
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const drive = google.drive({ version: 'v3', auth: authClient });

    // 3. Readers
    const opportunityReader = new OpportunityReader(sheets);
    const contactReader = new ContactReader(sheets);
    const companyReader = new CompanyReader(sheets);
    const interactionReader = new InteractionReader(sheets);
    const eventLogReader = new EventLogReader(sheets);
    const weeklyBusinessReader = new WeeklyBusinessReader(sheets);
    const announcementReader = new AnnouncementReader(sheets);
    const productReader = new ProductReader(sheets);
    const authReader = new AuthReader(sheets);
    const configReader = new ConfigReader(sheets);

    const readers = {
        opportunityReader, contactReader, companyReader, interactionReader,
        eventLogReader, weeklyBusinessReader, announcementReader, productReader,
        authReader, configReader
    };

    // 4. Writers
    const companyWriter = new CompanyWriter(sheets, companyReader);
    const contactWriter = new ContactWriter(sheets, contactReader);
    const opportunityWriter = new OpportunityWriter(sheets, opportunityReader, contactReader);
    const interactionWriter = new InteractionWriter(sheets, interactionReader, opportunityReader);
    const eventLogWriter = new EventLogWriter(sheets, eventLogReader, opportunityReader);
    const weeklyBusinessWriter = new WeeklyBusinessWriter(sheets, weeklyBusinessReader);
    const announcementWriter = new AnnouncementWriter(sheets, announcementReader);
    
    // ✅ [Fix 2] 實例化 ProductWriter (注意：ProductWriter 需要 productReader)
    const productWriter = new ProductWriter(sheets, productReader);
    
    const authWriter = new AuthWriter(sheets);
    const configWriter = new ConfigWriter(sheets);

    const writers = {
        companyWriter, contactWriter, opportunityWriter, interactionWriter,
        eventLogWriter, weeklyBusinessWriter, announcementWriter,
        productWriter, // ✅ [Fix 3] 加入 writers 容器
        authWriter, configWriter
    };

    // 5. Services
    const workflowService = new WorkflowService(writers, readers, sheets);
    const calendarService = new CalendarService(authClient);

    // 6. 儲存到容器
    Object.assign(services, {
        authService,
        sheets,
        calendar,
        drive,
        ...readers,
        ...writers, 
        workflowService,
        calendarService,
        isInitialized: true
    });

    // =========== 抓鬼偵測器 (Debug) ===========
    console.log('🔍 [Debug] Writers keys:', Object.keys(writers));
    console.log('🔍 [Debug] Service Container has productWriter:', !!services.productWriter);
    // =================================================

    console.log('✅ [Service Container] 所有服務初始化完成！');
    return services;
}

module.exports = initializeServices;