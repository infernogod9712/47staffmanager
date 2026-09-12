const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { canPromote } = require('../handlers/permissions');
const { outsideStaffHub } = require('../handlers/guard');
const { promotionEmbed } = require('../handlers/embeds');
const config = require('../config');

// /promote [user] [rank] [reason]
// Gives the member the rank role you mention, then logs it to the promotions channel.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a staff member to a rank and log it')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o =>
      o.setName('user').setDescription('The staff member to promote').setRequired(true))
    .addRoleOption(o =>
      o.setName('rank').setDescription('The rank role to give them').setRequired(true))
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the promotion').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const blocked = outsideStaffHub(interaction);
    if (blocked) return interaction.editReply({ content: blocked });

    if (!canPromote(interaction.member)) {
      return interaction.editReply({ content: 'You do not have permission to use this command.' });
    }

    const target   = interaction.options.getUser('user');
    const rank     = interaction.options.getRole('rank');
    const reason   = interaction.options.getString('reason');
    const promoter = interaction.user;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.editReply({ content: 'That user is not in this server.' });

    // Give them the new rank role
    try {
      await member.roles.add(rank.id, `Promotion by ${promoter.username}: ${reason}`);
    } catch (err) {
      if (err.code === 50013) {
        return interaction.editReply({ content: `I could not add **${rank.name}**. Make sure my bot role is ABOVE that rank in the role list and I have the Manage Roles permission.` });
      }
      return interaction.editReply({ content: `Could not add the rank: ${err.message}` });
    }

    // Log to the promotions channel, pinging the member outside the embed.
    const embed = promotionEmbed(target, rank, reason, promoter);

    let logged = true;
    try {
      const channel = await interaction.client.channels.fetch(config.promotionsChannelId);
      await channel.send({ content: `<@${target.id}>`, embeds: [embed] });
    } catch (err) {
      logged = false;
      console.error('[promote] Could not post to promotions channel:', err.message);
    }

    // Also DM the member the same notice (silently ignored if their DMs are closed).
    try {
      await target.send({ embeds: [embed] });
    } catch { /* DMs closed - ignore */ }

    await interaction.editReply({
      content: `Promoted <@${target.id}> to <@&${rank.id}>.${logged ? '' : '\n(Could not post to the promotions channel - check promotionsChannelId in config.)'}`,
    });
  },
};
