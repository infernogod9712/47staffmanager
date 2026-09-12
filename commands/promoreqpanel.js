const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../handlers/permissions');
const { outsideStaffHub } = require('../handlers/guard');
const { panelEmbed, COLORS } = require('../handlers/embeds');

// /promoreqpanel - posts the promotion request panel (a button that opens the form).
module.exports = {
  data: new SlashCommandBuilder()
    .setName('promoreqpanel')
    .setDescription('Post the promotion request panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const blocked = outsideStaffHub(interaction);
    if (blocked) return interaction.reply({ content: blocked, ephemeral: true });
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need Administrator to post this panel.', ephemeral: true });
    }

    const embed = panelEmbed(
      '📈 Promotion Request',
      'Think you have earned a promotion? Click the button below and fill out the form. Your request will be sent to the high-ranking team for review.',
      COLORS.info,
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('promoreq_open').setLabel('Request Promotion').setStyle(ButtonStyle.Success).setEmoji('📈'),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Promotion request panel posted.', ephemeral: true });
  },
};
