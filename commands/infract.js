const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { canInfract } = require('../handlers/permissions');
const { outsideStaffHub } = require('../handlers/guard');
const { infractionEmbed } = require('../handlers/embeds');
const config = require('../config');

// /infract [user] [punishment] [reason]
// Logs an infraction to the infractions channel. Demotions are just an infraction
// with "Demotion" as the punishment. This command does NOT change any roles - it
// only records the infraction and notifies the member.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('infract')
    .setDescription('Log an infraction (including demotions) against a staff member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o =>
      o.setName('user').setDescription('The staff member being infracted').setRequired(true))
    .addStringOption(o =>
      o.setName('punishment').setDescription('The punishment (e.g. Strike 1, Demotion, Warning)').setRequired(true))
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the infraction').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const blocked = outsideStaffHub(interaction);
    if (blocked) return interaction.editReply({ content: blocked });

    if (!canInfract(interaction.member)) {
      return interaction.editReply({ content: 'You do not have permission to use this command.' });
    }

    const target     = interaction.options.getUser('user');
    const punishment = interaction.options.getString('punishment');
    const reason     = interaction.options.getString('reason');
    const issuer     = interaction.user;

    // Log to the infractions channel, pinging the member outside the embed.
    const embed = infractionEmbed(target, punishment, reason, issuer);

    let logged = true;
    try {
      const channel = await interaction.client.channels.fetch(config.infractionsChannelId);
      await channel.send({ content: `<@${target.id}>`, embeds: [embed] });
    } catch (err) {
      logged = false;
      console.error('[infract] Could not post to infractions channel:', err.message);
    }

    // Also DM the member the same notice (silently ignored if their DMs are closed).
    try {
      await target.send({ embeds: [embed] });
    } catch { /* DMs closed - ignore */ }

    await interaction.editReply({
      content: `Logged infraction for <@${target.id}> - **${punishment}**.${logged ? '' : '\n(Could not post to the infractions channel - check infractionsChannelId in config.)'}`,
    });
  },
};
