const { ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require('discord.js');
const { readAllTabs, credentialsExist, sheetConfigured } = require('./sheets');
const { getCursor, setCursor, saveRecord } = require('./appStore');
const { getSettings } = require('./settings');
const { applicationEmbed } = require('./embeds');

// Watches the staff application spreadsheet and posts any NEW response as a forum
// thread with Approve / Deny buttons on it.
//
// How "new" works: for each tab we remember how many response rows we have already
// posted. The first time a tab is seen we just record its current size and post
// nothing, so turning the feature on does not dump every old application at once.

const MAX_PER_TAB_PER_POLL = 10; // leftovers get picked up next cycle
const POST_DELAY_MS        = 1500;
const EMBED_FIELD_CAP      = 20;
const EMBED_CHAR_BUDGET    = 4500; // headroom under Discord's 6000 total

let polling = false;   // stops two polls overlapping
let warned  = false;   // only complain about missing setup once

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Reading a row ───────────────────────────────────────────────────────────
function findColumn(headers, pattern) {
  return headers.findIndex(h => pattern.test((h || '').trim()));
}

// Turns one response row into embed fields, skipping empty answers and staying
// inside Discord's limits. Returns what did not fit so the caller can attach the
// full application as a file.
function buildAnswerFields(headers, row) {
  const fields = [];
  let budget = EMBED_CHAR_BUDGET;
  let skipped = 0;
  let truncated = false;

  for (let i = 0; i < headers.length; i++) {
    const name  = (headers[i] || '').trim();
    const value = (row[i] || '').trim();
    if (!name || !value) continue;

    if (fields.length >= EMBED_FIELD_CAP) { skipped++; continue; }

    const n = name.slice(0, 256);
    let v = value;
    if (v.length > 1024) { v = v.slice(0, 1021) + '...'; truncated = true; }

    if (n.length + v.length > budget) { skipped++; continue; }
    budget -= n.length + v.length;
    fields.push({ name: n, value: v, inline: false });
  }

  return { fields, skipped, truncated };
}

// The plain-text copy of the whole application, attached when something did not
// fit in the embed so no answer is ever lost.
function buildTranscript(tab, headers, row) {
  const lines = [tab, '='.repeat(tab.length), ''];
  for (let i = 0; i < headers.length; i++) {
    const name  = (headers[i] || '').trim();
    const value = (row[i] || '').trim();
    if (!name || !value) continue;
    lines.push(name, value, '');
  }
  return new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'),
    { name: 'application.txt' });
}

// ── Matching the applicant to a Discord account ─────────────────────────────
// Whichever guild is not the Staff Hub is the main server. Preferred source is
// the results channel, since that is defined to live in the main server.
async function getMainGuild(client, settings) {
  if (settings.appResultsChannelId) {
    const ch = await client.channels.fetch(settings.appResultsChannelId).catch(() => null);
    if (ch?.guild) return ch.guild;
  }
  const config = require('../config');
  return client.guilds.cache.find(g => g.id !== config.staffHubGuildId) || null;
}

// Reads the "Discord" answer and tries to turn it into a real user, so we can DM
// them and ping them later. Returns { raw, user } - user is null if no match.
async function resolveApplicant(client, guild, headers, row) {
  const idx = findColumn(headers, /discord/i);
  const raw = idx === -1 ? '' : (row[idx] || '').trim();
  if (!raw) return { raw: '', user: null };

  // Someone pasted an id or a mention.
  const idMatch = raw.match(/(\d{17,20})/);
  if (idMatch) {
    const user = await client.users.fetch(idMatch[1]).catch(() => null);
    if (user) return { raw, user };
  }
  if (!guild) return { raw, user: null };

  // Otherwise treat it as a username: strip a leading @ and any old #1234 tag.
  const q = raw.replace(/^@/, '').split('#')[0].trim().toLowerCase();
  if (!q) return { raw, user: null };

  const matches = m =>
    m.user.username.toLowerCase() === q ||
    (m.user.globalName || '').toLowerCase() === q ||
    (m.nickname || '').toLowerCase() === q;

  let found = guild.members.cache.find(matches);
  if (!found) {
    const res = await guild.members.search({ query: q.slice(0, 32), limit: 10 }).catch(() => null);
    if (res?.size) found = res.find(matches) || (res.size === 1 ? res.first() : null);
  }
  return { raw, user: found?.user || null };
}

// The best name to show when we could not match a Discord account.
function pickResponder(headers, row, rawDiscord) {
  for (const pattern of [/roblox/i, /name/i, /email/i]) {
    const i = findColumn(headers, pattern);
    if (i !== -1 && (row[i] || '').trim()) return row[i].trim();
  }
  return rawDiscord || 'Unknown applicant';
}

// ── Posting one application ─────────────────────────────────────────────────
async function postApplication(client, forum, guild, tab, headers, row) {
  const { raw, user } = await resolveApplicant(client, guild, headers, row);
  const responder = user ? user.username : pickResponder(headers, row, raw);

  const tsIdx     = findColumn(headers, /^timestamp$/i);
  const submitted = tsIdx === -1 ? '' : (row[tsIdx] || '').trim();

  const { fields, skipped, truncated } = buildAnswerFields(headers, row);
  const embed = applicationEmbed({
    tab, responder, applicant: user, rawDiscord: raw, submitted, fields, skipped,
  });

  const awaiting = forum.availableTags.find(t => t.name === 'Awaiting Approval');
  const files    = (skipped || truncated) ? [buildTranscript(tab, headers, row)] : [];

  // Buttons go straight on the forum post - the thread IS the approval queue.
  // The custom id carries the applicant id ('0' when unmatched) and the thread id,
  // which we only learn after creating the thread, so they are added in an edit.
  const thread = await forum.threads.create({
    name: `${responder} | ${tab}`.slice(0, 100),
    message: { embeds: [embed], files },
    appliedTags: awaiting ? [awaiting.id] : [],
  });

  const starter = await thread.fetchStarterMessage().catch(() => null);
  if (starter) {
    await starter.edit({ components: [decisionButtons(user?.id || '0', thread.id)] }).catch(() => {});
  }

  saveRecord(thread.id, {
    tab,
    responder,
    discordId: user?.id || null,
    rawDiscord: raw,
    submitted,
    postedAt: Date.now(),
  });

  console.log(`[apps] Posted "${tab}" application from ${responder}`);
  return thread;
}

function decisionButtons(userId, threadId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`app_approve_${userId}_${threadId}`)
      .setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`app_deny_${userId}_${threadId}`)
      .setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
  );
}

// ── The poll ────────────────────────────────────────────────────────────────
// Returns a short summary string, so /appcheck can report what happened.
async function pollApplications(client, { quiet = true } = {}) {
  if (polling) return 'A check is already running.';

  const settings = getSettings();
  const problems = [];
  if (!sheetConfigured())    problems.push('`applicationsSheetId` is not set in config.js.');
  if (!credentialsExist())   problems.push('`credentials.json` is missing from the bot folder.');
  if (!settings.appForumId)  problems.push('No application forum set. Run `/staffhubpermission app_forum:`.');
  if (problems.length) {
    if (!quiet || !warned) { console.log('[apps] Not checking yet: ' + problems.join(' ')); warned = true; }
    return 'Not set up yet:\n' + problems.map(p => `- ${p}`).join('\n');
  }

  polling = true;
  try {
    const forum = await client.channels.fetch(settings.appForumId).catch(() => null);
    if (!forum || forum.type !== ChannelType.GuildForum) {
      return 'The application forum is missing or is not a forum channel.';
    }
    const guild = await getMainGuild(client, settings);
    const tabs  = await readAllTabs();
    const notes = [];

    for (const { tab, headers, rows } of tabs) {
      if (!headers.length) continue;

      const cursor = getCursor(tab);
      if (cursor === null) {
        setCursor(tab, rows.length);
        console.log(`[apps] Now watching "${tab}" (${rows.length} existing response(s) skipped)`);
        notes.push(`Now watching **${tab}** - skipped ${rows.length} existing response(s).`);
        continue;
      }
      // Someone deleted rows from the sheet; resync instead of getting stuck.
      if (rows.length < cursor) {
        setCursor(tab, rows.length);
        notes.push(`**${tab}**: rows were removed from the sheet, resynced.`);
        continue;
      }
      if (rows.length === cursor) continue;

      const end = Math.min(rows.length, cursor + MAX_PER_TAB_PER_POLL);
      for (let i = cursor; i < end; i++) {
        try {
          await postApplication(client, forum, guild, tab, headers, rows[i]);
        } catch (err) {
          console.error(`[apps] Failed to post row ${i + 2} of "${tab}":`, err.message);
        }
        // Saved after each post, so a crash mid-batch never double-posts.
        setCursor(tab, i + 1);
        if (i + 1 < end) await sleep(POST_DELAY_MS);
      }
      notes.push(`**${tab}**: posted ${end - cursor} new application(s)` +
        (rows.length > end ? `, ${rows.length - end} queued for the next check.` : '.'));
    }

    return notes.length ? notes.join('\n') : 'No new applications.';
  } catch (err) {
    console.error('[apps] Check failed:', err.message);
    return `Could not read the sheet: ${err.message}`;
  } finally {
    polling = false;
  }
}

module.exports = { pollApplications, decisionButtons, getMainGuild };
