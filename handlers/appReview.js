const { EmbedBuilder } = require('discord.js');
const { canReview } = require('./permissions');
const { setThreadStatus } = require('./forumTags');
const { getSettings } = require('./settings');
const { getRecord, deleteRecord } = require('./appStore');
const { getMainGuild } = require('./applications');
const { applicationResultEmbed, applicationDMEmbed } = require('./embeds');

// Handles Approve / Deny on a staff application. Unlike promo and LOA requests,
// the buttons live on the forum post itself, so the post is edited in place
// (tag flipped, buttons removed) instead of being deleted. The outcome then goes
// to the results channel in the MAIN server, and to the applicant in a DM.
async function handleAppReview(interaction, action, userId, threadId, reason = null) {
  if (!canReview(interaction.member)) {
    return interaction.reply({ content: 'You do not have permission to review applications.', ephemeral: true });
  }

  const approved = action === 'approve';
  const reviewer = interaction.user;
  const settings = getSettings();
  const record   = getRecord(threadId) || {};
  const notes    = [];

  await interaction.deferUpdate();

  // Who applied. The button carries the id; the stored record is the backup.
  const applicantId = (userId && userId !== '0') ? userId : record.discordId;
  const applicant   = applicantId
    ? await interaction.client.users.fetch(applicantId).catch(() => null)
    : null;
  const tab       = record.tab       || interaction.channel?.name || 'Staff Application';
  const responder = record.responder || record.rawDiscord || 'Unknown applicant';

  // 1. Update the forum post: swap the tag, stamp the decision on the embed, and
  //    take the buttons off so it cannot be decided twice.
  try {
    const thread = interaction.channel?.isThread?.()
      ? interaction.channel
      : await interaction.client.channels.fetch(threadId).catch(() => null);
    if (thread?.isThread?.()) {
      await setThreadStatus(thread, approved ? 'Approved' : 'Denied')
        .catch(err => console.error('[apps] tag update failed:', err.message));
    }

    const starter = interaction.message;
    if (starter?.embeds?.[0]) {
      const updated = EmbedBuilder.from(starter.embeds[0])
        .setColor(approved ? 0x57F287 : 0xED4245)
        .addFields({
          name: approved ? '✅ Accepted by' : '✖️ Denied by',
          value: `<@${reviewer.id}> (${reviewer.username})`,
          inline: false,
        });
      if (reason) updated.addFields({ name: approved ? 'Acceptance Reason' : 'Denial Reason', value: reason, inline: false });
      await starter.edit({ embeds: [updated], components: [] });
    } else if (starter) {
      await starter.edit({ components: [] });
    }
  } catch (err) {
    console.error('[apps] Could not update the forum post:', err.message);
    notes.push('Could not update the forum post.');
  }

  // 2. Post the result in the main server's results channel.
  if (settings.appResultsChannelId) {
    try {
      const channel = await interaction.client.channels.fetch(settings.appResultsChannelId);
      const embed   = applicationResultEmbed({ tab, responder, applicant, approved, reviewer, reason });
      await channel.send({
        content: applicant ? `<@${applicant.id}>` : undefined,
        embeds: [embed],
      });
    } catch (err) {
      console.error('[apps] Could not post the result:', err.message);
      notes.push('Could not post to the results channel.');
    }
  } else {
    notes.push('No results channel set - run `/staffhubpermission app_results_id:`.');
  }

  // 3. DM the applicant. Accepted applicants get the Staff Hub invite.
  if (!applicant) {
    notes.push('Could not match them to a Discord account, so no DM was sent.');
  } else {
    try {
      const guild = await getMainGuild(interaction.client, settings);
      await applicant.send({
        embeds: [applicationDMEmbed({
          tab, approved, reviewer, reason,
          invite: approved ? settings.staffHubInvite : null,
          guildName: guild?.name,
        })],
      });
    } catch {
      notes.push('Could not DM them (their DMs may be closed).');
    }
    if (approved && !settings.staffHubInvite) {
      notes.push('No Staff Hub invite set - run `/staffhubpermission staff_hub_invite:`.');
    }
  }

  deleteRecord(threadId);

  const summary = [`${approved ? 'Accepted' : 'Denied'} ${responder}'s ${tab} application.`, ...notes];
  await interaction.followUp({ content: summary.join(' '), ephemeral: true });
}

module.exports = { handleAppReview };
