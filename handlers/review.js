const { EmbedBuilder } = require('discord.js');
const { canReview } = require('./permissions');
const { setStatus, clearLoa } = require('./loaStore');
const { setThreadStatus } = require('./forumTags');
const { decisionDMEmbed } = require('./embeds');

const KIND_LABEL = {
  promoreq: 'promotion request',
  loareq:   'LOA request',
  loaext:   'LOA extension',
};

// Handles an Approve / Deny decision. Called from the button click, or from the
// deny-reason modal (which passes a reason). We know who requested, what, and which
// forum post to update ('0' means there is no forum record).
async function handleReview(interaction, kind, action, userId, threadId, reason = null) {
  if (!canReview(interaction.member)) {
    return interaction.reply({ content: 'You do not have permission to review requests.', ephemeral: true });
  }

  const approved = action === 'approve';
  const reviewer = interaction.user;
  const label    = KIND_LABEL[kind] || 'request';

  // Acknowledge the button - we are about to delete this approval message.
  await interaction.deferUpdate();

  // An approved LOA becomes active; a denied one is cleared. Extensions do not
  // change the stored LOA either way.
  if (kind === 'loareq') {
    if (approved) setStatus(userId, 'active');
    else          clearLoa(userId);
  }

  // Update the forum record: swap "Awaiting Approval" for the decision tag and add
  // who decided it to the post.
  if (threadId && threadId !== '0') {
    try {
      const thread = await interaction.client.channels.fetch(threadId);
      if (thread?.isThread?.()) {
        await setThreadStatus(thread, approved ? 'Approved' : 'Denied');

        const starter = await thread.fetchStarterMessage().catch(() => null);
        if (starter && starter.embeds[0]) {
          const updated = EmbedBuilder.from(starter.embeds[0])
            .setColor(approved ? 0x57F287 : 0xED4245)
            .addFields({ name: approved ? '✅ Approved by' : '✖️ Denied by', value: `<@${reviewer.id}> (${reviewer.username})`, inline: false });
          if (reason) updated.addFields({ name: 'Denial Reason', value: reason, inline: false });
          await starter.edit({ embeds: [updated] });
        }
      }
    } catch (err) {
      console.error('[review] Could not update forum post:', err.message);
    }
  }

  // DM the requester the outcome (silently ignored if their DMs are closed).
  let dmOk = true;
  try {
    const target = await interaction.client.users.fetch(userId);
    const dm = decisionDMEmbed({ label, approved, reviewer, guildName: interaction.guild.name, reason });
    await target.send({ embeds: [dm] });
  } catch {
    dmOk = false;
  }

  // Remove the approval-channel message now that the decision is made.
  await interaction.message.delete().catch(() => {});

  // Private confirmation to the reviewer.
  const extra = [`${approved ? 'Approved' : 'Denied'} ${label}.`];
  if (kind === 'promoreq' && approved) extra.push('Run `/promote` to actually give them the rank.');
  if (!dmOk) extra.push('Could not DM them (their DMs may be closed).');
  await interaction.followUp({ content: extra.join(' '), ephemeral: true });
}

module.exports = { handleReview };
