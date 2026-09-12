const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { isAdmin } = require('../handlers/permissions');
const { outsideStaffHub } = require('../handlers/guard');
const { getSettings, setValue, toggleRoleInList } = require('../handlers/settings');

// /staffhubpermission - admin-only setup. Every option is optional; the command
// applies whichever ones you filled in. Passing a promote/infract role TOGGLES it
// (adds if missing, removes if present). Run with no options (or view:true) to just
// see the current setup.
//
// For each request type there are two channels:
//   approval channel = text channel that gets the Approve/Deny buttons
//   forum            = forum that holds the record (tagged Awaiting Approval, etc.)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('staffhubpermission')
    .setDescription('Set who can promote/infract and where requests go (Administrator only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(o =>
      o.setName('promote_role').setDescription('Toggle a role that may use /promote'))
    .addRoleOption(o =>
      o.setName('infract_role').setDescription('Toggle a role that may use /infract'))
    .addChannelOption(o =>
      o.setName('promo_approval').setDescription('Text channel for promo Approve/Deny buttons')
        .addChannelTypes(ChannelType.GuildText))
    .addChannelOption(o =>
      o.setName('promo_forum').setDescription('Forum where the promo record is posted')
        .addChannelTypes(ChannelType.GuildForum))
    .addChannelOption(o =>
      o.setName('loa_approval').setDescription('Text channel for LOA Approve/Deny buttons')
        .addChannelTypes(ChannelType.GuildText))
    .addChannelOption(o =>
      o.setName('loa_forum').setDescription('Forum where the LOA record is posted (inactivity-notice)')
        .addChannelTypes(ChannelType.GuildForum))
    .addRoleOption(o =>
      o.setName('main_staff_role').setDescription('The main staff role'))
    .addChannelOption(o =>
      o.setName('app_forum').setDescription('Forum where new staff applications are posted')
        .addChannelTypes(ChannelType.GuildForum))
    .addStringOption(o =>
      o.setName('app_results_id').setDescription('Channel ID in the MAIN server for application results'))
    .addStringOption(o =>
      o.setName('staff_hub_invite').setDescription('Invite link DM\'d to accepted applicants'))
    .addBooleanOption(o =>
      o.setName('view').setDescription('Just show the current settings')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const blocked = outsideStaffHub(interaction);
    if (blocked) return interaction.editReply({ content: blocked });
    if (!isAdmin(interaction.member)) {
      return interaction.editReply({ content: 'You need Administrator to use this command.' });
    }

    const promoteRole = interaction.options.getRole('promote_role');
    const infractRole = interaction.options.getRole('infract_role');
    const promoAppr   = interaction.options.getChannel('promo_approval');
    const promoForum  = interaction.options.getChannel('promo_forum');
    const loaAppr     = interaction.options.getChannel('loa_approval');
    const loaForum    = interaction.options.getChannel('loa_forum');
    const mainStaff   = interaction.options.getRole('main_staff_role');
    const appForum    = interaction.options.getChannel('app_forum');
    const appResults  = interaction.options.getString('app_results_id');
    const hubInvite   = interaction.options.getString('staff_hub_invite');
    const viewOnly    = interaction.options.getBoolean('view');

    const changes = [];

    if (promoteRole) {
      const { added } = toggleRoleInList('promoteRoleIds', promoteRole.id);
      changes.push(`${added ? 'Added' : 'Removed'} <@&${promoteRole.id}> ${added ? 'to' : 'from'} the /promote list.`);
    }
    if (infractRole) {
      const { added } = toggleRoleInList('infractRoleIds', infractRole.id);
      changes.push(`${added ? 'Added' : 'Removed'} <@&${infractRole.id}> ${added ? 'to' : 'from'} the /infract list.`);
    }
    if (promoAppr)  { setValue('promoApprovalId', promoAppr.id);  changes.push(`Promo approval channel set to <#${promoAppr.id}>.`); }
    if (promoForum) { setValue('promoForumId',    promoForum.id); changes.push(`Promo record forum set to <#${promoForum.id}>.`); }
    if (loaAppr)    { setValue('loaApprovalId',   loaAppr.id);    changes.push(`LOA approval channel set to <#${loaAppr.id}>.`); }
    if (loaForum)   { setValue('loaForumId',      loaForum.id);   changes.push(`LOA record forum set to <#${loaForum.id}>.`); }
    if (mainStaff)  { setValue('mainStaffRoleId', mainStaff.id);  changes.push(`Main staff role set to <@&${mainStaff.id}>.`); }
    if (appForum)   { setValue('appForumId',      appForum.id);   changes.push(`Application forum set to <#${appForum.id}>.`); }

    // The results channel lives in the MAIN server, which a channel option cannot
    // list from the Staff Hub, so it is taken as an id and checked by hand.
    if (appResults) {
      const id = appResults.trim().replace(/[<>#]/g, '');
      if (!/^\d{17,20}$/.test(id)) {
        changes.push(`⚠️ \`${appResults}\` is not a channel ID. Right-click the channel in the main server and Copy Channel ID.`);
      } else {
        const ch = await interaction.client.channels.fetch(id).catch(() => null);
        if (!ch)            changes.push(`⚠️ I cannot see channel \`${id}\`. Make sure I am in that server and can view it.`);
        else if (!ch.isTextBased?.()) changes.push(`⚠️ \`${id}\` is not a channel I can post in.`);
        else { setValue('appResultsChannelId', id); changes.push(`Application results channel set to **#${ch.name}** in **${ch.guild?.name ?? 'that server'}**.`); }
      }
    }

    if (hubInvite) {
      const link = hubInvite.trim();
      if (!/^https?:\/\/(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\//i.test(link)) {
        changes.push('⚠️ That does not look like a Discord invite link (it should start with `https://discord.gg/`).');
      } else {
        setValue('staffHubInvite', link);
        changes.push('Staff Hub invite link saved.');
      }
    }

    const s = getSettings();
    const roleList = ids => (ids && ids.length) ? ids.map(id => `<@&${id}>`).join(', ') : 'None (admins only until set)';
    const chan     = id => id ? `<#${id}>` : 'Not set';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('⚙️ Staff Hub Settings')
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setFooter({ text: '47 Database Staff Manager' })
      .setTimestamp()
      .addFields(
        { name: 'Can /promote',           value: roleList(s.promoteRoleIds), inline: false },
        { name: 'Can /infract',           value: roleList(s.infractRoleIds), inline: false },
        { name: 'Promo approval channel', value: chan(s.promoApprovalId), inline: true },
        { name: 'Promo record forum',     value: chan(s.promoForumId),    inline: true },
        { name: 'LOA approval channel',   value: chan(s.loaApprovalId),   inline: true },
        { name: 'LOA record forum',       value: chan(s.loaForumId),      inline: true },
        { name: 'Main staff role',        value: s.mainStaffRoleId ? `<@&${s.mainStaffRoleId}>` : 'Not set', inline: false },
        { name: 'Application forum',      value: chan(s.appForumId),          inline: true },
        { name: 'Results channel (main)', value: chan(s.appResultsChannelId), inline: true },
        { name: 'Staff Hub invite',       value: s.staffHubInvite || 'Not set', inline: false },
      );

    const header = viewOnly || changes.length === 0 ? 'Current settings:' : changes.join('\n');
    await interaction.editReply({ content: header, embeds: [embed] });
  },
};
