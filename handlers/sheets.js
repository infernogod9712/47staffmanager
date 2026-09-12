const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const config = require('../config');

// Reads the staff application spreadsheet. Each Google Form writes its responses
// into its own tab, so one tab = one kind of application. Read-only: this bot
// never writes to the sheet.
const CREDENTIALS = path.join(__dirname, '..', 'credentials.json');

let sheetsApi;

function credentialsExist() {
  return fs.existsSync(CREDENTIALS);
}

function sheetConfigured() {
  const id = config.applicationsSheetId;
  return !!id && !id.startsWith('YOUR') && !id.includes('SHEET_ID');
}

async function getSheets() {
  if (sheetsApi) return sheetsApi;
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  sheetsApi = google.sheets({ version: 'v4', auth: await auth.getClient() });
  return sheetsApi;
}

// A1 notation needs the tab name in single quotes, and any single quote inside
// the name doubled: Bob's Form -> 'Bob''s Form'
function quoteTab(title) {
  return `'${title.replace(/'/g, "''")}'`;
}

// Every tab title in the spreadsheet, in sheet order.
async function listTabs() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: config.applicationsSheetId,
    fields: 'sheets.properties.title',
  });
  return (res.data.sheets || []).map(s => s.properties.title);
}

// Reads every tab in a single batch request. Returns
//   [{ tab, headers, rows }]
// where headers is row 1 and rows are the response rows under it. Google omits
// trailing empty cells, so every row is padded out to the header length.
async function readAllTabs() {
  const tabs = await listTabs();
  if (!tabs.length) return [];

  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: config.applicationsSheetId,
    ranges: tabs.map(t => `${quoteTab(t)}!A:BZ`),
    majorDimension: 'ROWS',
  });

  const ranges = res.data.valueRanges || [];
  return tabs.map((tab, i) => {
    const values  = ranges[i]?.values || [];
    const headers = (values[0] || []).map(h => (h ?? '').toString());
    const rows    = values.slice(1)
      .map(r => headers.map((_, c) => (r[c] ?? '').toString()))
      .filter(r => r.some(cell => cell.trim() !== '')); // drop fully blank rows
    return { tab, headers, rows };
  });
}

module.exports = { credentialsExist, sheetConfigured, listTabs, readAllTabs, CREDENTIALS };
