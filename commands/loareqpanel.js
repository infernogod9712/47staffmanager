const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../handlers/permissions');
const { outsideStaffHub } = require('../handlers/guard');
const { panelEmbed, COLORS } = require('../handlers/embeds');

// /loareqpanel - posts the LOA request panel (a button that opens the form).
module.exports = {
  data: new SlashCommandBuilder()
    .setName('loareqpanel')
    .setDescription('Post the LOA request panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const blocked = outsideStaffHub(interaction);
    if (blocked) return interaction.reply({ content: blocked, ephemeral: true });
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need Administrator to post this panel.', ephemeral: true });
    }

    const embed = panelEmbed(
      '🌙 LOA / ROA Request',
      'Need time away? Click the button below to request an LOA or ROA. Your request will be sent to your department heads for review.',
      COLORS.loa,
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('loareq_open').setLabel('Request LOA').setStyle(ButtonStyle.Primary).setEmoji('🌙'),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'LOA request panel posted.', ephemeral: true });
  },
};
