const fs = require('fs');
const path = require('path');

// Tracks who has an LOA on file, keyed by Discord user id. A record is created
// when someone submits an LOA request, and is what /loaextend checks against.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE     = path.join(DATA_DIR, 'loas.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}

function save(all) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}

// Stored when an LOA request is submitted. status starts 'pending' and becomes
// 'active' only once a reviewer approves it.
function setLoa(userId, data, status = 'pending') {
  const all = load();
  all[userId] = { ...data, status, updatedAt: new Date().toISOString() };
  save(all);
}

function setStatus(userId, status) {
  const all = load();
  if (!all[userId]) return;
  all[userId].status = status;
  all[userId].updatedAt = new Date().toISOString();
  save(all);
}

// Merge new values into an existing record without touching its status.
function updateLoa(userId, patch) {
  const all = load();
  if (!all[userId]) return;
  all[userId] = { ...all[userId], ...patch, updatedAt: new Date().toISOString() };
  save(all);
}

function getLoa(userId) {
  return load()[userId] || null;
}

function getAllLoas() {
  return load();
}

// Only an APPROVED LOA counts as active (this is what /loaextend checks).
function hasActiveLoa(userId) {
  return load()[userId]?.status === 'active';
}

function clearLoa(userId) {
  const all = load();
  delete all[userId];
  save(all);
}

module.exports = { setLoa, setStatus, updateLoa, getLoa, getAllLoas, hasActiveLoa, clearLoa };
