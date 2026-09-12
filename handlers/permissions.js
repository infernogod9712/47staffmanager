const { PermissionFlagsBits } = require('discord.js');
const { getSettings } = require('./settings');

function isAdmin(member) {
  return !!member?.permissions?.has(PermissionFlagsBits.Administrator);
}

// Admin always passes. Otherwise the member needs one of the roles in the given
// list setting. If that list is empty, fall back to the main staff role. If NOTHING
// has been configured yet, only Administrators can run commands.
function allowedBy(member, listKey) {
  if (!member) return false;
  if (isAdmin(member)) return true;
  const s = getSettings();
  const list = s[listKey] || [];
  if (list.length) return member.roles.cache.some(r => list.includes(r.id));
  if (s.mainStaffRoleId) return member.roles.cache.has(s.mainStaffRoleId);
  return false; // not set up yet - Administrators only
}

function canPromote(member) { return allowedBy(member, 'promoteRoleIds'); }
function canInfract(member) { return allowedBy(member, 'infractRoleIds'); }

// Who may click Approve / Deny on a promo or LOA request: admins, the main staff
// role, or anyone who can promote. Before setup, admins only.
function canReview(member) {
  if (!member) return false;
  if (isAdmin(member)) return true;
  const s = getSettings();
  if (s.mainStaffRoleId && member.roles.cache.has(s.mainStaffRoleId)) return true;
  return (s.promoteRoleIds || []).some(id => member.roles.cache.has(id));
}

module.exports = { isAdmin, canPromote, canInfract, canReview };
