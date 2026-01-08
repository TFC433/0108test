// data/contact-reader.js
// [Version: 2026-01-08-Refactor-Stage2]
// [Date: 2026-01-08]
// Description: 負責讀取聯絡人資料 (含原始名片與正式聯絡人)，並將資料轉換為標準化 DTO

const BaseReader = require('./base-reader');
const { parseString, parseDate } = require('../utils/data-parsers');

/**
 * 專門負責讀取所有與「聯絡人」相關資料的類別
 */
class ContactReader extends BaseReader {
    constructor(sheets) {
        super(sheets);
    }

    /**
     * 【新增】內部輔助函式，用於建立標準化的 JOIN Key
     */
    _normalizeKey(str = '') {
        return String(str).toLowerCase().trim();
    }

    /**
     * 取得原始名片資料 (潛在客戶)
     * @param {number} [limit=2000] - 讀取上限
     * @returns {Promise<Array<object>>}
     */
    async getContacts(limit = 2000) {
        const cacheKey = 'contacts';
        const range = `${this.config.SHEETS.CONTACTS}!A:Y`;

        const rowParser = (row, index) => ({
            createdTime: parseDate(row[this.config.CONTACT_FIELDS.TIME]),
            name: parseString(row[this.config.CONTACT_FIELDS.NAME]),
            company: parseString(row[this.config.CONTACT_FIELDS.COMPANY]),
            position: parseString(row[this.config.CONTACT_FIELDS.POSITION]),
            department: parseString(row[this.config.CONTACT_FIELDS.DEPARTMENT]),
            phone: parseString(row[this.config.CONTACT_FIELDS.PHONE]),
            mobile: parseString(row[this.config.CONTACT_FIELDS.MOBILE]),
            email: parseString(row[this.config.CONTACT_FIELDS.EMAIL]),
            website: parseString(row[this.config.CONTACT_FIELDS.WEBSITE]),
            address: parseString(row[this.config.CONTACT_FIELDS.ADDRESS]),
            confidence: parseString(row[this.config.CONTACT_FIELDS.CONFIDENCE]),
            driveLink: parseString(row[this.config.CONTACT_FIELDS.DRIVE_LINK]),
            status: parseString(row[this.config.CONTACT_FIELDS.STATUS]),
            
            // 用於前端篩選 "我的名片"
            lineUserId: parseString(row[this.config.CONTACT_FIELDS.LINE_USER_ID]),
            
            // 用於前端顯示 "👤 Kevin"
            userNickname: parseString(row[this.config.CONTACT_FIELDS.USER_NICKNAME]),

            // --- 內部中繼資料 ---
            _meta: {
                rowIndex: index + 2
            }
        });
        
        const sorter = (a, b) => {
            const dateA = new Date(a.createdTime);
            const dateB = new Date(b.createdTime);
            if (isNaN(dateB)) return -1;
            if (isNaN(dateA)) return 1;
            return dateB - dateA;
        };

        const allData = await this._fetchAndCache(cacheKey, range, rowParser, sorter);
        
        // 直接回傳完整資料 (不在此處過濾空名片，讓前端決定顯示方式)
        return allData.slice(0, limit);
    }

    /**
     * 取得聯絡人總表 (已建檔聯絡人)
     * @returns {Promise<Array<object>>}
     */
    async getContactList() {
        const cacheKey = 'contactList';
        const range = `${this.config.SHEETS.CONTACT_LIST}!A:M`;

        const rowParser = (row, rowIndex) => ({
            contactId: parseString(row[0]),
            sourceId: parseString(row[1]),
            name: parseString(row[2]),
            companyId: parseString(row[3]),
            department: parseString(row[4]),
            position: parseString(row[5]),
            mobile: parseString(row[6]),
            phone: parseString(row[7]),
            email: parseString(row[8]),
            
            createdTime: parseDate(row[9]),
            lastUpdateTime: parseDate(row[10]),
            creator: parseString(row[11]),
            lastModifier: parseString(row[12]),

            // --- 內部中繼資料 ---
            _meta: {
                rowIndex: rowIndex + 1 
            }
        });

        return this._fetchAndCache(cacheKey, range, rowParser);
    }

    /**
     * 透過 ID 查找已建檔聯絡人 (模擬 SQL: SELECT * FROM contacts WHERE id = ?)
     * @param {string} contactId 
     */
    async findContactById(contactId) {
        if (!contactId) return null;
        const list = await this.getContactList();
        return list.find(c => c.contactId === contactId) || null;
    }
    
    /**
     * 讀取並快取所有的「機會-聯絡人」關聯
     */
    async getAllOppContactLinks() {
        const cacheKey = 'oppContactLinks';
        const range = `${this.config.SHEETS.OPPORTUNITY_CONTACT_LINK}!A:F`;

        const rowParser = (row) => ({
            linkId: parseString(row[this.config.OPP_CONTACT_LINK_FIELDS.LINK_ID]),
            opportunityId: parseString(row[this.config.OPP_CONTACT_LINK_FIELDS.OPPORTUNITY_ID]),
            contactId: parseString(row[this.config.OPP_CONTACT_LINK_FIELDS.CONTACT_ID]),
            createTime: parseDate(row[this.config.OPP_CONTACT_LINK_FIELDS.CREATE_TIME]),
            status: parseString(row[this.config.OPP_CONTACT_LINK_FIELDS.STATUS]),
            creator: parseString(row[this.config.OPP_CONTACT_LINK_FIELDS.CREATOR]),
        });

        return this._fetchAndCache(cacheKey, range, rowParser);
    }

    /**
     * 根據機會 ID 取得關聯的聯絡人詳細資料
     */
    async getLinkedContacts(opportunityId) {
        // 注意：此處依賴 getCompanyList (需確保有注入或 require)
        // 為了避免循環依賴，這裡動態 require 或假設外部已處理，但 BaseReader 架構下通常建議外部傳入資料或透過 Service 組合
        // 為保持相容性，這裡暫時保留 require CompanyReader 的方式，但在 Service 層組合會更好
        const CompanyReader = require('./company-reader');
        const companyReader = new CompanyReader(this.sheets);

        const [allLinks, allContacts, allCompanies, allPotentialContacts] = await Promise.all([
            this.getAllOppContactLinks(),
            this.getContactList(),
            companyReader.getCompanyList(), 
            this.getContacts(9999)    
        ]);

        const linkedContactIds = new Set();
        for (const link of allLinks) {
            if (link.opportunityId === opportunityId && link.status === 'active') {
                linkedContactIds.add(link.contactId);
            }
        }
        
        if (linkedContactIds.size === 0) return [];
        
        const companyNameMap = new Map(allCompanies.map(c => [c.companyId, c.companyName]));
        
        const potentialCardMap = new Map();
        allPotentialContacts.forEach(pc => {
            if (pc.name && pc.company && pc.driveLink) {
                const key = this._normalizeKey(pc.name) + '|' + this._normalizeKey(pc.company);
                if (!potentialCardMap.has(key)) {
                    potentialCardMap.set(key, pc.driveLink);
                }
            }
        });

        const linkedContacts = allContacts
            .filter(contact => linkedContactIds.has(contact.contactId))
            .map(contact => {
                let driveLink = ''; 
                const companyName = companyNameMap.get(contact.companyId) || '';

                if (contact.name && companyName) {
                    const key = this._normalizeKey(contact.name) + '|' + this._normalizeKey(companyName);
                    driveLink = potentialCardMap.get(key) || ''; 
                }

                return {
                    contactId: contact.contactId,
                    sourceId: contact.sourceId, 
                    name: contact.name,
                    companyId: contact.companyId,
                    department: contact.department,
                    position: contact.position,
                    mobile: contact.mobile,
                    phone: contact.phone,
                    email: contact.email,
                    companyName: companyName,
                    driveLink: driveLink 
                };
            });
        
        return linkedContacts;
    }

    /**
     * 搜尋潛在客戶
     */
    async searchContacts(query) {
        let contacts = await this.getContacts();
        
        contacts = contacts.filter(contact => 
            (contact.name || contact.company)
        );

        if (query) {
            const searchTerm = query.toLowerCase();
            contacts = contacts.filter(c =>
                (c.name && c.name.toLowerCase().includes(searchTerm)) ||
                (c.company && c.company.toLowerCase().includes(searchTerm))
            );
        }
        return { data: contacts };
    }

    /**
     * 搜尋已建檔聯絡人並分頁
     */
    async searchContactList(query, page = 1) {
        // 動態引入 CompanyReader 避免循環依賴問題
        const CompanyReader = require('./company-reader'); 
        const companyReader = new CompanyReader(this.sheets);
        
        const [allContacts, allCompanies] = await Promise.all([
            this.getContactList(),
            companyReader.getCompanyList() 
        ]);
    
        const companyNameMap = new Map(allCompanies.map(c => [c.companyId, c.companyName]));
    
        let contacts = allContacts.map(contact => ({
            ...contact,
            companyName: companyNameMap.get(contact.companyId) || contact.companyId 
        }));
    
        if (query) {
            const searchTerm = query.toLowerCase();
            contacts = contacts.filter(c =>
                (c.name && c.name.toLowerCase().includes(searchTerm)) ||
                (c.companyName && c.companyName.toLowerCase().includes(searchTerm))
            );
        }
        
        const pageSize = this.config.PAGINATION.CONTACTS_PER_PAGE;
        const startIndex = (page - 1) * pageSize;
        const paginated = contacts.slice(startIndex, startIndex + pageSize);
        return {
            data: paginated,
            pagination: { current: page, total: Math.ceil(contacts.length / pageSize), totalItems: contacts.length, hasNext: (startIndex + pageSize) < contacts.length, hasPrev: page > 1 }
        };
    }
}

module.exports = ContactReader;