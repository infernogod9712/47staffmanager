const { getAllLoas, clearLoa } = require('./loaStore');
const { setThreadStatus } = require('./forumTags');
const { getSettings } = require('./settings');
const { loaCompletedEmbed } = require('./embeds');

// Sends an embed to the LOA's forum thread if it has one, otherwise to the LOA
// approval channel as a fallback. Returns the thread it posted to, or null.
async function postToRecord(client, loa, embed) {
  if (loa.forumThreadId && loa.forumThreadId !== '0') {
    const thread = await client.channels.fetch(loa.forumThreadId).catch(() => null);
    if (thread) { await thread.send({ embeds: [embed] }).catch(() => {}); return thread; }
  }
  const s = getSettings();
  if (s.loaApprovalId) {
    const ch = await client.channels.fetch(s.loaApprovalId).catch(() => null);
    if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
  }
  return null;
}

// Marks an LOA complete: flips the forum tag to "Completed", posts the given embed
// to the record, and clears the stored LOA. Used by auto-complete and early-complete.
async function completeLoa(client, userId, loa, embed) {
  if (loa.forumThreadId && loa.forumThreadId !== '0') {
    const thread = await client.channels.fetch(loa.forumThreadId).catch(() => null);
    if (thread) {
      await setThreadStatus(thread, 'Completed').catch(err => console.error('[loa] tag update failed:', err.message));
    }
  }
  await postToRecord(client, loa, embed);
  clearLoa(userId);
}

// Auto-completes any active LOA whose end date has passed. Meant to run on a timer.
async function checkExpiredLoas(client) {
  const all = getAllLoas();
  const now = Date.now();
  for (const [userId, loa] of Object.entries(all)) {
    if (loa.status !== 'active' || !loa.endTs || loa.endTs > now) continue;
    const user  = await client.users.fetch(userId).catch(() => null);
    const embed = loaCompletedEmbed(user, userId, loa);
    await completeLoa(client, userId, loa, embed);
    console.log(`[loa] Auto-completed LOA for ${userId}`);
  }
}

module.exports = { postToRecord, completeLoa, checkExpiredLoas };
