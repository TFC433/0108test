// data/index.js
// [Version: 2026-01-08-Fix-Export]
// [Date: 2026-01-08]
// Description: 資料層入口檔案，負責匯出所有 Readers 與 Writers。修正 ProductWriter 未匯出導致的啟動錯誤。

// 讀取器 (Readers)
const OpportunityReader = require('./opportunity-reader');
const ContactReader = require('./contact-reader');
const CompanyReader = require('./company-reader');
const InteractionReader = require('./interaction-reader');
const EventLogReader = require('./event-log-reader');
const WeeklyBusinessReader = require('./weekly-business-reader');
const AnnouncementReader = require('./announcement-reader');
const ProductReader = require('./product-reader');
const AuthReader = require('./auth-reader');
const ConfigReader = require('./config-reader');

// 寫入器 (Writers)
const CompanyWriter = require('./company-writer');
const ContactWriter = require('./contact-writer');
const OpportunityWriter = require('./opportunity-writer');
const InteractionWriter = require('./interaction-writer');
const EventLogWriter = require('./event-log-writer');
const WeeklyBusinessWriter = require('./weekly-business-writer');
const AnnouncementWriter = require('./announcement-writer');
const ProductWriter = require('./product-writer'); // ✅ [新增] 引入 ProductWriter
const AuthWriter = require('./auth-writer');
const ConfigWriter = require('./config-writer');

module.exports = {
    // Readers
    OpportunityReader,
    ContactReader,
    CompanyReader,
    InteractionReader,
    EventLogReader,
    WeeklyBusinessReader,
    AnnouncementReader,
    ProductReader,
    AuthReader,
    ConfigReader,
    
    // Writers
    CompanyWriter,
    ContactWriter,
    OpportunityWriter,
    InteractionWriter,
    EventLogWriter,
    WeeklyBusinessWriter,
    AnnouncementWriter,
    ProductWriter, // ✅ [新增] 匯出 ProductWriter，讓 ServiceContainer 讀得到
    AuthWriter,
    ConfigWriter
};