// utils/data-parsers.js
// [Version: 2026-01-08-Refactor-Stage1]
// [Date: 2026-01-08]
// Description: 定義資料轉換與標準化工具，確保 Reader 回傳符合 SQL 規範的資料型態

/**
 * 將輸入值轉為乾淨的字串
 * @param {any} value - 輸入值
 * @returns {string} - 去除前後空白的字串，若為 null/undefined 則回傳空字串
 */
const parseString = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

/**
 * 將輸入值轉為標準 ISO 日期字串 (YYYY-MM-DDTHH:mm:ss.sssZ)
 * 用於模擬 SQL 的 TIMESTAMPTZ 格式
 * @param {any} value - 輸入值 (日期字串或 Excel 序號)
 * @returns {string|null} - ISO 字串或 null
 */
const parseDate = (value) => {
    if (!value) return null;
    
    // 處理 Excel 可能回傳的奇怪字串
    const strVal = String(value).trim();
    if (!strVal) return null;

    const date = new Date(strVal);
    // 檢查是否為有效日期
    if (isNaN(date.getTime())) {
        console.warn(`[DataParser] 無法解析的日期格式: ${value}`);
        return null; 
    }
    
    return date.toISOString();
};

/**
 * 將輸入值轉為整數
 * @param {any} value 
 * @param {number} defaultValue 
 * @returns {number}
 */
const parseIntSafe = (value, defaultValue = 0) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * 將輸入值轉為浮點數 (處理金額用)
 * @param {any} value 
 * @param {number} defaultValue 
 * @returns {number}
 */
const parseFloatSafe = (value, defaultValue = 0.0) => {
    if (typeof value === 'string') {
        // 移除貨幣符號與逗號 (例如 "$1,000.00" -> "1000.00")
        value = value.replace(/[$,]/g, '');
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

module.exports = {
    parseString,
    parseDate,
    parseIntSafe,
    parseFloatSafe
};