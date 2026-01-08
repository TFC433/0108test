// data/index.js

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
const AuthWriter = require('./auth-writer');
const ConfigWriter = require('./config-writer');

module.exports = {
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
    
    CompanyWriter,
    ContactWriter,
    OpportunityWriter,
    InteractionWriter,
    EventLogWriter,
    WeeklyBusinessWriter,
    AnnouncementWriter,
    AuthWriter,
    ConfigWriter
};
