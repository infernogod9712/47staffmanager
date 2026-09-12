const { EmbedBuilder } = require('discord.js');

// One shared palette + a few builders, so every embed in the bot reads as one
// system: colored bar, a friendly description line, the subject's avatar as a
// thumbnail, and a footer with a small icon and timestamp.
const COLORS = {
  promote: 0x2ECC71, // green  - promotions, approvals, completions
  infract: 0xE74C3C, // red    - infractions, denials
  loa:     0xF1C40F, // gold   - LOA requests
  extend:  0x3498DB, // blue   - extensions
  info:    0x5865F2, // blurple- requests, panels, settings
};

function withFooter(embed, text, iconURL) {
  return embed.setFooter(iconURL ? { text, iconURL } : { text }).setTimestamp();
}

// ── Direct actions (posted to the log channels) ─────────────────────────────
function promotionEmbed(target, rank, reason, issuer) {
  return withFooter(new EmbedBuilder()
    .setColor(COLORS.promote)
    .setTitle('📈 Staff Promotion')
    .setDescription('The high-ranking team have decided to grant you a promotion. Congratulations!')
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: 'Staff Member', value: `<@${target.id}>`, inline: true },
      { name: 'New Rank',     value: `<@&${rank.id}>`,  inline: true },
      { name: 'Reason',       value: reason,            inline: false },
    ),
    `Promotion issued by ${issuer.username}`, issuer.displayAvatarURL());
}

function infractionEmbed(target, punishment, reason, issuer) {
  return withFooter(new EmbedBuilder()
    .setColor(COLORS.infract)
    .setTitle('⚠️ Staff Infraction')
    .setDescription('The staff team has issued you an infraction. Please review the details below.')
    .setThumbnail(target.displayAvatarURL())
    .addFields(
      { name: 'Staff Member', value: `<@${target.id}>`, inline: true },
      { name: 'Punishment',   value: punishment,        inline: true },
      { name: 'Reason',       value: reason,            inline: false },
    ),
    `Infraction issued by ${issuer.username}`, issuer.displayAvatarURL());
}

// ── Requests (posted to approval channel + forum record) ────────────────────
function promoRequestEmbed(user, f) {
  return withFooter(new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle('📈 Promotion Request')
    .setDescription(`<@${user.id}> is requesting a promotion.`)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: 'Discord Username', value: `<@${user.id}> (${user.username})`, inline: false },
      { name: 'Roblox Username',  value: f.ru, inline: true },
      { name: 'Requested Rank',   value: f.rr, inline: true },
      { name: 'Reason',           value: f.reason, inline: false },
    ),
    `Requested by ${user.username}`, user.displayAvatarURL());
}

function loaRequestEmbed(user, f, title = '🌙 LOA / ROA Request') {
  return withFooter(new EmbedBuilder()
    .setColor(COLORS.loa)
    .setTitle(title)
    .setDescription(`<@${user.id}> is requesting time away.`)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: 'Discord Username', value: `<@${user.id}> (${user.username})`, inline: false },
      { name: 'Roblox Username',  value: f.ru,      inline: true },
      { name: 'Type',             value: f.type,    inline: true },
      { name: 'End Date',         value: f.endDate, inline: true },
      { name: 'Reason',           value: f.reason,  inline: false },
    ),
    `Requested by ${user.username}`, user.displayAvatarURL());
}

// ── Decision DM sent to the requester ───────────────────────────────────────
function decisionDMEmbed({ label, approved, reviewer, guildName, reason }) {
  const e = new EmbedBuilder()
    .setColor(approved ? COLORS.promote : COLORS.infract)
    .setTitle(approved ? '✅ Request Approved' : '❌ Request Denied')
    .setDescription(approved ? `Your ${label} was approved.` : `Your ${label} was denied.`)
    .addFields(
      { name: 'Reviewed by', value: reviewer.username, inline: true },
      { name: 'Server',      value: guildName,         inline: true },
    );
  if (reason) e.addFields({ name: 'Reason', value: reason, inline: false });
  return withFooter(e, guildName, reviewer.displayAvatarURL());
}

// ── LOA lifecycle ───────────────────────────────────────────────────────────
function loaExtendedEmbed(user, loa, oldEnd, newEnd, reason) {
  return withFooter(new EmbedBuilder()
    .setColor(COLORS.extend)
    .setTitle('⏳ LOA Extended')
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: 'Member',       value: `<@${user.id}>`,       inline: false },
      { name: 'Roblox',       value: loa.ru ?? 'Unknown',   inline: true },
      { name: 'Type',         value: loa.type ?? 'Unknown', inline: true },
      { name: 'Old End Date', value: oldEnd,                inline: true },
      { name: 'New End Date', value: newEnd,                inline: true },
      { name: 'Reason',       value: reason,                inline: false },
    ),
    `Extended by ${user.username}`, user.displayAvatarURL());
}

function loaEndedEarlyEmbed(user, loa, note) {
  const e = new EmbedBuilder()
    .setColor(COLORS.promote)
    .setTitle('✅ LOA Ended Early')
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: 'Member',     value: `<@${user.id}>`,          inline: false },
      { name: 'Roblox',     value: loa.ru ?? 'Unknown',      inline: true },
      { name: 'Type',       value: loa.type ?? 'Unknown',    inline: true },
      { name: 'Was Ending', value: loa.endDate ?? 'Unknown', inline: true },
    );
  if (note) e.addFields({ name: 'Note', value: note, inline: false });
  return withFooter(e, `Ended by ${user.username}`, user.displayAvatarURL());
}

function loaCompletedEmbed(user, userId, loa) {
  const e = new EmbedBuilder()
    .setColor(COLORS.promote)
    .setTitle('✅ LOA Completed')
    .addFields(
      { name: 'Member',   value: `<@${userId}>`,           inline: false },
      { name: 'Roblox',   value: loa.ru ?? 'Unknown',      inline: true },
      { name: 'Type',     value: loa.type ?? 'Unknown',    inline: true },
      { name: 'End Date', value: loa.endDate ?? 'Unknown', inline: true },
      { name: 'Note',     value: 'Reached end date (auto-completed).', inline: false },
    );
  if (user) e.setThumbnail(user.displayAvatarURL());
  return withFooter(e, 'LOA Completed', user?.displayAvatarURL());
}

// ── Staff applications (read out of the Google Sheet) ───────────────────────
// The forum post: the whole application, with Approve / Deny buttons on it.
function applicationEmbed({ tab, responder, applicant, rawDiscord, submitted, fields, skipped }) {
  const who = applicant
    ? `<@${applicant.id}> (${applicant.username})`
    : (rawDiscord ? `${rawDiscord} (no matching Discord account found)` : 'Unknown');

  const e = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`📋 ${tab}`.slice(0, 256))
    .setDescription(applicant
      ? `<@${applicant.id}> submitted a staff application.`
      : `**${responder}** submitted a staff application.`)
    .addFields({ name: 'Applicant', value: who, inline: false });

  if (applicant) e.setThumbnail(applicant.displayAvatarURL());
  if (fields?.length) e.addFields(...fields);
  if (skipped) {
    e.addFields({ name: 'Note', value: `${skipped} more answer(s) did not fit here - the full application is attached below.`, inline: false });
  }

  return withFooter(e, submitted ? `Submitted ${submitted}` : 'Staff Application',
    applicant?.displayAvatarURL());
}

// The result posted in the MAIN server's results channel.
function applicationResultEmbed({ tab, responder, applicant, approved, reviewer, reason }) {
  const e = new EmbedBuilder()
    .setColor(approved ? COLORS.promote : COLORS.infract)
    .setTitle(approved ? '✅ Application Accepted' : '❌ Application Denied')
    .setDescription(approved
      ? 'Congratulations! Your staff application has been accepted.'
      : 'Unfortunately, your staff application has been denied this time.')
    .addFields(
      { name: 'Applicant',   value: applicant ? `<@${applicant.id}>` : responder, inline: true },
      { name: 'Application', value: tab,                                          inline: true },
      { name: 'Reviewed by', value: `<@${reviewer.id}>`,                          inline: true },
    );
  if (applicant) e.setThumbnail(applicant.displayAvatarURL());
  if (reason) e.addFields({ name: 'Reason', value: reason, inline: false });
  return withFooter(e, `Reviewed by ${reviewer.username}`, reviewer.displayAvatarURL());
}

// The DM to the applicant. On acceptance it carries the Staff Hub invite.
function applicationDMEmbed({ tab, approved, reviewer, reason, invite, guildName }) {
  const e = new EmbedBuilder()
    .setColor(approved ? COLORS.promote : COLORS.infract)
    .setTitle(approved ? '✅ Application Accepted' : '❌ Application Denied')
    .setDescription(approved
      ? `Your **${tab}** application has been accepted. Welcome to the team!`
      : `Your **${tab}** application has been denied.`)
    .addFields({ name: 'Reviewed by', value: reviewer.username, inline: true });

  if (reason) e.addFields({ name: 'Reason', value: reason, inline: false });
  if (approved && invite) {
    e.addFields({ name: 'Next Step', value: `Join the Staff Hub to get started:\n${invite}`, inline: false });
  }
  if (!approved) {
    e.addFields({ name: 'What Now', value: 'You are welcome to apply again in the future. Keep at it!', inline: false });
  }
  return withFooter(e, guildName || 'Staff Applications', reviewer.displayAvatarURL());
}

// ── Panels ──────────────────────────────────────────────────────────────────
function panelEmbed(title, description, color) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
}

module.exports = {
  COLORS,
  promotionEmbed, infractionEmbed,
  promoRequestEmbed, loaRequestEmbed,
  decisionDMEmbed,
  loaExtendedEmbed, loaEndedEarlyEmbed, loaCompletedEmbed,
  applicationEmbed, applicationResultEmbed, applicationDMEmbed,
  panelEmbed,
};
