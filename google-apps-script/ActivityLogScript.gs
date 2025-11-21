/**
 * WIF Finance - Activity Log Google Apps Script
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com and create a new project
 * 2. Copy this entire code into the script editor
 * 3. First, run the "setup" function manually (select it from dropdown and click Run)
 *    - This will prompt you to authorize the script
 *    - Grant all requested permissions
 * 4. After authorization, copy the SPREADSHEET_ID from the logs and paste it below
 * 5. Click "Deploy" > "New deployment"
 * 6. Select type: "Web app"
 * 7. Set "Execute as": "Me"
 * 8. Set "Who has access": "Anyone"
 * 9. Click "Deploy" and copy the Web app URL
 * 10. Add the URL to your .env file as VITE_ACTIVITY_LOG_URL
 */

// ============================================================================
// CONFIGURATION - UPDATE THIS AFTER RUNNING setup()
// ============================================================================
const SPREADSHEET_ID = ''; // <-- Paste your spreadsheet ID here after running setup()
const SHEET_NAME = 'Activity Logs';

// ============================================================================
// SETUP FUNCTION - RUN THIS FIRST!
// ============================================================================

/**
 * Run this function first to create the spreadsheet and get the ID
 * Select this function from the dropdown and click "Run"
 */
function setup() {
  // Create new spreadsheet
  const ss = SpreadsheetApp.create('WIF Finance Activity Logs');
  const sheet = ss.getActiveSheet();
  sheet.setName(SHEET_NAME);

  // Set up headers
  const headers = [
    'ID',
    'Timestamp',
    'Type',
    'User ID',
    'Username',
    'Description',
    'Resource Type',
    'Resource ID',
    'Metadata'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Set column widths
  sheet.setColumnWidth(1, 200);  // ID
  sheet.setColumnWidth(2, 180);  // Timestamp
  sheet.setColumnWidth(3, 150);  // Type
  sheet.setColumnWidth(4, 280);  // User ID
  sheet.setColumnWidth(5, 120);  // Username
  sheet.setColumnWidth(6, 400);  // Description
  sheet.setColumnWidth(7, 100);  // Resource Type
  sheet.setColumnWidth(8, 280);  // Resource ID
  sheet.setColumnWidth(9, 300);  // Metadata

  // Log the spreadsheet ID - COPY THIS!
  Logger.log('========================================');
  Logger.log('SETUP COMPLETE!');
  Logger.log('========================================');
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('');
  Logger.log('NEXT STEPS:');
  Logger.log('1. Copy the Spreadsheet ID above');
  Logger.log('2. Paste it into the SPREADSHEET_ID constant at the top of this script');
  Logger.log('3. Save the script');
  Logger.log('4. Deploy as Web App');
  Logger.log('========================================');

  return ss.getId();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the activity log sheet
 */
function getSheet() {
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID not configured. Please run setup() first and update the SPREADSHEET_ID constant.');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Set up headers if sheet was just created
    const headers = ['ID', 'Timestamp', 'Type', 'User ID', 'Username', 'Description', 'Resource Type', 'Resource ID', 'Metadata'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Generate unique ID
 */
function generateId() {
  return 'LOG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Try to parse JSON safely
 */
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

// ============================================================================
// WEB APP HANDLERS
// ============================================================================

/**
 * Handle HTTP POST requests (create log entry)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'log') {
      return createLogEntry(data.log);
    } else if (data.action === 'batch') {
      return createBatchLogEntries(data.logs);
    }

    return jsonResponse({ success: false, error: 'Unknown action' });

  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Handle HTTP GET requests (fetch logs)
 */
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || 'fetch';

    if (action === 'fetch') {
      return fetchLogs(params);
    } else if (action === 'stats') {
      return getStats(params);
    } else if (action === 'health') {
      return jsonResponse({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        configured: !!SPREADSHEET_ID
      });
    }

    return jsonResponse({ success: false, error: 'Unknown action' });

  } catch (error) {
    Logger.log('doGet error: ' + error.toString());
    return jsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * Create JSON response
 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// LOG OPERATIONS
// ============================================================================

/**
 * Create a single log entry
 */
function createLogEntry(log) {
  const sheet = getSheet();

  const row = [
    log.id || generateId(),
    log.timestamp || new Date().toISOString(),
    log.type || '',
    log.userId || '',
    log.username || '',
    log.description || '',
    log.resourceType || '',
    log.resourceId || '',
    log.metadata ? JSON.stringify(log.metadata) : ''
  ];

  sheet.appendRow(row);

  return jsonResponse({ success: true, id: row[0] });
}

/**
 * Create multiple log entries at once
 */
function createBatchLogEntries(logs) {
  if (!logs || logs.length === 0) {
    return jsonResponse({ success: true, count: 0 });
  }

  const sheet = getSheet();

  const rows = logs.map(function(log) {
    return [
      log.id || generateId(),
      log.timestamp || new Date().toISOString(),
      log.type || '',
      log.userId || '',
      log.username || '',
      log.description || '',
      log.resourceType || '',
      log.resourceId || '',
      log.metadata ? JSON.stringify(log.metadata) : ''
    ];
  });

  // Append all rows at once for efficiency
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);

  return jsonResponse({ success: true, count: rows.length });
}

/**
 * Fetch logs with optional filtering
 */
function fetchLogs(params) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return jsonResponse({ success: true, logs: [], total: 0 });
  }

  // Skip header row and convert to objects
  var logs = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    logs.push({
      id: row[0],
      timestamp: row[1],
      type: row[2],
      userId: row[3],
      username: row[4],
      description: row[5],
      resourceType: row[6],
      resourceId: row[7],
      metadata: row[8] ? tryParseJSON(row[8]) : null
    });
  }

  // Apply filters
  if (params.userId) {
    logs = logs.filter(function(log) { return log.userId === params.userId; });
  }

  if (params.type) {
    logs = logs.filter(function(log) { return log.type === params.type; });
  }

  if (params.resourceType) {
    logs = logs.filter(function(log) { return log.resourceType === params.resourceType; });
  }

  if (params.startDate) {
    var startDate = new Date(params.startDate);
    logs = logs.filter(function(log) { return new Date(log.timestamp) >= startDate; });
  }

  if (params.endDate) {
    var endDate = new Date(params.endDate);
    logs = logs.filter(function(log) { return new Date(log.timestamp) <= endDate; });
  }

  if (params.search) {
    var searchLower = params.search.toLowerCase();
    logs = logs.filter(function(log) {
      return log.description.toLowerCase().indexOf(searchLower) !== -1 ||
             log.username.toLowerCase().indexOf(searchLower) !== -1;
    });
  }

  // Sort by timestamp (newest first)
  logs.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  var total = logs.length;

  // Apply pagination
  var page = parseInt(params.page) || 1;
  var limit = parseInt(params.limit) || 100;
  var start = (page - 1) * limit;
  logs = logs.slice(start, start + limit);

  return jsonResponse({
    success: true,
    logs: logs,
    total: total,
    page: page,
    limit: limit,
    pages: Math.ceil(total / limit)
  });
}

/**
 * Get activity statistics
 */
function getStats(params) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return jsonResponse({
      success: true,
      stats: { total: 0, byType: {}, byUser: {}, byResourceType: {} }
    });
  }

  var logs = data.slice(1);

  // Apply date filters
  if (params.startDate) {
    var startDate = new Date(params.startDate);
    logs = logs.filter(function(row) { return new Date(row[1]) >= startDate; });
  }

  if (params.endDate) {
    var endDate = new Date(params.endDate);
    logs = logs.filter(function(row) { return new Date(row[1]) <= endDate; });
  }

  var byType = {};
  var byUser = {};
  var byResourceType = {};

  logs.forEach(function(row) {
    var type = row[2];
    var username = row[4];
    var resourceType = row[6];

    byType[type] = (byType[type] || 0) + 1;
    byUser[username] = (byUser[username] || 0) + 1;
    if (resourceType) {
      byResourceType[resourceType] = (byResourceType[resourceType] || 0) + 1;
    }
  });

  return jsonResponse({
    success: true,
    stats: {
      total: logs.length,
      byType: byType,
      byUser: byUser,
      byResourceType: byResourceType
    }
  });
}

/**
 * Test function to verify everything works
 */
function test() {
  var testLog = {
    id: 'TEST-' + Date.now(),
    timestamp: new Date().toISOString(),
    type: 'test',
    userId: 'test-user-id',
    username: 'testuser',
    description: 'Test log entry',
    resourceType: 'test',
    resourceId: 'test-123',
    metadata: { test: true }
  };

  var sheet = getSheet();
  var row = [
    testLog.id,
    testLog.timestamp,
    testLog.type,
    testLog.userId,
    testLog.username,
    testLog.description,
    testLog.resourceType,
    testLog.resourceId,
    JSON.stringify(testLog.metadata)
  ];

  sheet.appendRow(row);
  Logger.log('Test log entry created: ' + testLog.id);
  Logger.log('Check your spreadsheet!');
}
