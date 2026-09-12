const { SlashCommandBuilder } = require('discord.js');
const { outsideStaffHub } = require('../handlers/guard');
const { hasActiveLoa, getLoa } = require('../handlers/loaStore');
const { completeLoa } = require('../handlers/loaLifecycle');
const { loaEndedEarlyEmbed } = require('../handlers/embeds');

// /loaearlycomplete - end your LOA before its end date. Marks the forum post
// Completed, posts a "LOA Ended Early" embed, and clears your LOA. Active LOA only.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('loaearlycomplete')
    .setDescription('End your current LOA early')
    .addStringOption(o =>
      o.setName('note').setDescription('Anything to add (optional)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const blocked = outsideStaffHub(interaction);
    if (blocked) return interaction.editReply({ content: blocked });

    if (!hasActiveLoa(interaction.user.id)) {
      return interaction.editReply({ content: 'You do not have a active loa.' });
    }

    const note = interaction.options.getString('note');
    const loa  = getLoa(interaction.user.id);

    const embed = loaEndedEarlyEmbed(interaction.user, loa, note);
    await completeLoa(interaction.client, interaction.user.id, loa, embed);
    await interaction.editReply({ content: 'Your LOA has been ended early and marked completed.' });
  },
};
