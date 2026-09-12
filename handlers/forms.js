const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { promoRequestEmbed, loaRequestEmbed } = require('./embeds');

// Every modal input has to sit in its own action row.
function row(input) { return new ActionRowBuilder().addComponents(input); }

// Approve / Deny buttons for the approval-channel copy of a request. The custom id
// carries the requester id (who to DM) and the forum thread id (whose tag to flip),
// so the review handler has everything it needs. kind is 'promoreq'|'loareq'|'loaext'.
// threadId is '0' when there is no forum record.
function reviewButtons(kind, userId, threadId = '0') {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${kind}_approve_${userId}_${threadId}`).setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`${kind}_deny_${userId}_${threadId}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
  );
}

// Modal shown when a reviewer denies a request, to capture why. The context
// (kind, requester id, thread id) rides on the custom id so the submit handler can
// carry out the denial with the reason attached.
function buildDenyReasonModal(kind, userId, threadId = '0') {
  return new ModalBuilder()
    .setCustomId(`denyreason_${kind}_${userId}_${threadId}`)
    .setTitle('Reason for Denial')
    .addComponents(
      row(new TextInputBuilder().setCustomId('reason').setLabel('Why is this being denied?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    );
}

// Staff applications ask for a reason on BOTH Approve and Deny, and that reason is
// shown publicly (forum post, results channel, and the applicant's DM). The action
// rides on the custom id so the submit handler knows which decision to carry out.
function buildAppReasonModal(action, userId, threadId = '0') {
  const approved = action === 'approve';
  return new ModalBuilder()
    .setCustomId(`appreason_${action}_${userId}_${threadId}`)
    .setTitle(approved ? 'Reason for Acceptance' : 'Reason for Denial')
    .addComponents(
      row(new TextInputBuilder()
        .setCustomId('reason')
        .setLabel(approved ? 'Why are they being accepted?' : 'Why is this being denied?')
        .setPlaceholder(approved ? 'The applicant will see this.' : 'The applicant will see this.')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)),
    );
}

// ── Promotion request form ──────────────────────────────────────────────────
// Discord username is captured from the person who clicks, so it is not a field.
function buildPromoModal() {
  return new ModalBuilder()
    .setCustomId('promoreq_modal')
    .setTitle('Promotion Request')
    .addComponents(
      row(new TextInputBuilder().setCustomId('ru').setLabel('Roblox Username (RU)').setStyle(TextInputStyle.Short).setRequired(true)),
      row(new TextInputBuilder().setCustomId('rr').setLabel('Requested Rank (RR)').setStyle(TextInputStyle.Short).setRequired(true)),
      row(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    );
}

function readPromoFields(interaction) {
  return {
    ru:     interaction.fields.getTextInputValue('ru'),
    rr:     interaction.fields.getTextInputValue('rr'),
    reason: interaction.fields.getTextInputValue('reason'),
  };
}

function buildPromoEmbed(user, f) {
  return promoRequestEmbed(user, f);
}

// ── LOA / ROA request form ──────────────────────────────────────────────────
// 5-field cap: Discord username is auto-captured, and start+end share one field.
function buildLoaModal() {
  return new ModalBuilder()
    .setCustomId('loareq_modal')
    .setTitle('LOA / ROA Request')
    .addComponents(
      row(new TextInputBuilder().setCustomId('ru').setLabel('Roblox Username').setStyle(TextInputStyle.Short).setRequired(true)),
      row(new TextInputBuilder().setCustomId('type').setLabel('Type (LOA or ROA)').setStyle(TextInputStyle.Short).setRequired(true)),
      row(new TextInputBuilder().setCustomId('endDate').setLabel('End Date (M/D/YYYY)').setPlaceholder('e.g. 3/16/2026').setStyle(TextInputStyle.Short).setRequired(true)),
      row(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true)),
    );
}

function readLoaFields(interaction) {
  return {
    ru:      interaction.fields.getTextInputValue('ru'),
    type:    interaction.fields.getTextInputValue('type'),
    endDate: interaction.fields.getTextInputValue('endDate'),
    reason:  interaction.fields.getTextInputValue('reason'),
  };
}

function buildLoaEmbed(user, f, title) {
  return loaRequestEmbed(user, f, title);
}

module.exports = {
  buildPromoModal, readPromoFields, buildPromoEmbed,
  buildLoaModal,   readLoaFields,   buildLoaEmbed,
  reviewButtons,   buildDenyReasonModal, buildAppReasonModal,
};
