const { SlashCommandBuilder } = require('discord.js');
const { outsideStaffHub } = require('../handlers/guard');
const { hasActiveLoa, getLoa, updateLoa } = require('../handlers/loaStore');
const { postToRecord } = require('../handlers/loaLifecycle');
const { loaExtendedEmbed } = require('../handlers/embeds');
const { parseEndDate } = require('../handlers/dates');

// /loaextend - push back the end date of an LOA you already have. Immediate (no
// re-approval), posts a "LOA Extended" embed to the LOA record. Active LOA only.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('loaextend')
    .setDescription('Extend your current LOA')
    .addStringOption(o =>
      o.setName('new_end_date').setDescription('New end date (M/D/YYYY)').setRequired(true))
    .addStringOption(o =>
      o.setName('reason').setDescription('Why you need more time').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const blocked = outsideStaffHub(interaction);
    if (blocked) return interaction.editReply({ content: blocked });

    if (!hasActiveLoa(interaction.user.id)) {
      return interaction.editReply({ content: 'You do not have a active loa.' });
    }

    const newEnd = interaction.options.getString('new_end_date');
    const reason = interaction.options.getString('reason');
    const loa    = getLoa(interaction.user.id);
    const oldEnd = loa.endDate ?? 'Unknown';

    // Update the stored end date so auto-complete uses the new one.
    updateLoa(interaction.user.id, { endDate: newEnd, endTs: parseEndDate(newEnd) });

    const embed = loaExtendedEmbed(interaction.user, loa, oldEnd, newEnd, reason);
    await postToRecord(interaction.client, loa, embed);
    await interaction.editReply({ content: `Your LOA end date was moved to **${newEnd}**.` });
  },
};
