const fs = require('fs');
const path = require('path');

// Remembers two things between restarts:
//   cursors - how many response rows of each tab we have already posted, so a
//             restart never re-posts old applications
//   records - details of each posted application, keyed by its forum thread id,
//             so the Approve/Deny buttons know who applied and for what
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE     = path.join(DATA_DIR, 'applications.json');

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { cursors: raw.cursors || {}, records: raw.records || {} };
  } catch {
    return { cursors: {}, records: {} };
  }
}

function save(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

// null means "this tab has never been seen" - the caller baselines it instead of
// posting every application that already exists in the sheet.
function getCursor(tab) {
  const c = load().cursors[tab];
  return typeof c === 'number' ? c : null;
}

function setCursor(tab, count) {
  const store = load();
  store.cursors[tab] = count;
  save(store);
}

function getCursors() {
  return load().cursors;
}

function saveRecord(threadId, record) {
  const store = load();
  store.records[threadId] = record;
  save(store);
}

function getRecord(threadId) {
  return load().records[threadId] || null;
}

function deleteRecord(threadId) {
  const store = load();
  delete store.records[threadId];
  save(store);
}

module.exports = { getCursor, setCursor, getCursors, saveRecord, getRecord, deleteRecord };
