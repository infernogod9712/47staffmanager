const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../handlers/permissions');
const { outsideStaffHub } = require('../handlers/guard');
const { pollApplications } = require('../handlers/applications');
const { getCursors } = require('../handlers/appStore');
const { COLORS } = require('../handlers/embeds');

// /appcheck - check the application sheet right now instead of waiting for the
// timer, and show how many responses of each tab have been posted so far.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('appcheck')
    .setDescription('Check the staff application sheet for new responses right now')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const blocked = outsideStaffHub(interaction);
    if (blocked) return interaction.editReply({ content: blocked });
    if (!isAdmin(interaction.member)) {
      return interaction.editReply({ content: 'You need Administrator to use this command.' });
    }

    const result  = await pollApplications(interaction.client, { quiet: false });
    const cursors = getCursors();
    const watched = Object.entries(cursors);

    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📋 Application Check')
      .setDescription(result.slice(0, 4000))
      .addFields({
        name: 'Tabs being watched',
        value: watched.length
          ? watched.map(([tab, n]) => `**${tab}** - ${n} response(s) handled`).join('\n').slice(0, 1024)
          : 'None yet.',
        inline: false,
      })
      .setFooter({ text: '47 Database Staff Manager' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
