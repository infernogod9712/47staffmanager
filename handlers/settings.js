const fs = require('fs');
const path = require('path');

// Settings that admins change in Discord with /staffhubpermission.
// Stored as one JSON file so they survive restarts.
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE     = path.join(DATA_DIR, 'settings.json');

const DEFAULTS = {
  promoteRoleIds:  [],   // roles allowed to use /promote
  infractRoleIds:  [],   // roles allowed to use /infract
  promoApprovalId: null, // text channel where promo requests get Approve/Deny buttons
  promoForumId:    null, // forum where the promo record is posted (optional)
  loaApprovalId:   null, // text channel where LOA requests get Approve/Deny buttons
  loaForumId:      null, // forum where the LOA record is posted (inactivity-notice)
  mainStaffRoleId: null, // the main staff role (fallback for who counts as staff)

  // Staff applications (read out of the Google Sheet)
  appForumId:          null, // Staff Hub forum where new applications are posted
  appResultsChannelId: null, // results channel in the MAIN server (set by id)
  staffHubInvite:      null, // invite link DM'd to accepted applicants
};

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2));
}

function getSettings() {
  return load();
}

// Set a single-value setting (a channel or role id).
function setValue(key, value) {
  const s = load();
  s[key] = value;
  save(s);
  return s;
}

// Toggle a role in a list setting: add if missing, remove if present.
// Returns { settings, added }.
function toggleRoleInList(key, roleId) {
  const s = load();
  if (!Array.isArray(s[key])) s[key] = [];
  const i = s[key].indexOf(roleId);
  let added;
  if (i === -1) { s[key].push(roleId); added = true; }
  else          { s[key].splice(i, 1); added = false; }
  save(s);
  return { settings: s, added };
}

module.exports = { getSettings, setValue, toggleRoleInList };
