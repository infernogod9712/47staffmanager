require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { getSettings } = require('./handlers/settings');
const { setLoa } = require('./handlers/loaStore');
const {
  buildPromoModal, readPromoFields, buildPromoEmbed,
  buildLoaModal,   readLoaFields,   buildLoaEmbed,
  reviewButtons,   buildDenyReasonModal, buildAppReasonModal,
} = require('./handlers/forms');
const { handleReview } = require('./handlers/review');
const { canReview } = require('./handlers/permissions');
const { postForumRecord } = require('./handlers/post');
const { checkExpiredLoas } = require('./handlers/loaLifecycle');
const { parseEndDate } = require('./handlers/dates');
const { pollApplications } = require('./handlers/applications');
const { handleAppReview } = require('./handlers/appReview');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// Load every command file. Wrapped in try/catch so one broken file cannot
// crash the whole bot on startup (a lesson learned from 47ModBot).
client.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  try {
    const command = require(`./commands/${file}`);
    if (command?.data && command?.execute) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`[StaffMan] Skipped ${file}: missing data or execute.`);
    }
  } catch (err) {
    console.error(`[StaffMan] Failed to load ${file}:`, err.message);
  }
}

client.once('ready', () => {
  console.log(`[StaffMan] Online as ${client.user.tag}`);
  console.log(`[StaffMan] Loaded ${client.commands.size} command(s) in ${client.guilds.cache.size} server(s)`);

  // Auto-complete LOAs whose end date has passed: once on startup, then hourly.
  checkExpiredLoas(client).catch(err => console.error('[StaffMan] LOA check failed:', err.message));
  setInterval(() => {
    checkExpiredLoas(client).catch(err => console.error('[StaffMan] LOA check failed:', err.message));
  }, 60 * 60 * 1000);

  // Watch the staff application sheet and post anything new to the forum.
  const every = Math.max(15, config.applicationPollSeconds || 30) * 1000;
  const runApps = () => pollApplications(client).catch(err => console.error('[StaffMan] Application check failed:', err.message));
  runApps();
  setInterval(runApps, every);
  console.log(`[StaffMan] Checking staff applications every ${every / 1000}s`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    // ── Buttons: open a form, or approve/deny a request ───────────────────────
    if (interaction.isButton()) {
      const [kind, action, userId, threadId] = interaction.customId.split('_');
      if (action === 'open') {
        if (kind === 'promoreq') return interaction.showModal(buildPromoModal());
        if (kind === 'loareq')   return interaction.showModal(buildLoaModal());
        return;
      }
      if (action === 'approve' || action === 'deny') {
        if (!canReview(interaction.member)) {
          return interaction.reply({ content: 'You do not have permission to review requests.', ephemeral: true });
        }
        // Applications ask for a reason on BOTH approve and deny. They are also
        // decided on their forum post, not in an approval channel.
        if (kind === 'app') {
          return interaction.showModal(buildAppReasonModal(action, userId, threadId));
        }
        // Denying a promotion asks the reviewer for a reason first (via a modal).
        if (kind === 'promoreq' && action === 'deny') {
          return interaction.showModal(buildDenyReasonModal(kind, userId, threadId));
        }
        return handleReview(interaction, kind, action, userId, threadId);
      }
      return;
    }

    // ── Form submits: send the request to its approval channel ────────────────
    if (interaction.isModalSubmit()) {
      // An application decision, with the reason the reviewer just typed.
      if (interaction.customId.startsWith('appreason_')) {
        const [, action, userId, threadId] = interaction.customId.split('_');
        const reason = interaction.fields.getTextInputValue('reason');
        return handleAppReview(interaction, action, userId, threadId, reason);
      }

      // A reviewer submitted a denial reason - carry out the denial with it attached.
      if (interaction.customId.startsWith('denyreason_')) {
        const [, kind, userId, threadId] = interaction.customId.split('_');
        const reason = interaction.fields.getTextInputValue('reason');
        return handleReview(interaction, kind, 'deny', userId, threadId, reason);
      }

      if (interaction.customId === 'promoreq_modal') {
        const settings = getSettings();
        if (!settings.promoApprovalId) {
          return interaction.reply({ content: 'No promotion approval channel is set yet. Ask an admin to run /staffhubpermission.', ephemeral: true });
        }
        const fields = readPromoFields(interaction);
        const embed  = buildPromoEmbed(interaction.user, fields);
        try {
          // Record post in the forum (optional), then the button copy in the approval channel.
          let threadId = '0';
          if (settings.promoForumId) {
            try {
              const forum  = await client.channels.fetch(settings.promoForumId);
              const thread = await postForumRecord(forum, `${interaction.user.username} | Promotion`, embed);
              if (thread) threadId = thread.id;
            } catch (e) { console.error('[promoreq] Forum post failed:', e.message); }
          }
          const approval = await client.channels.fetch(settings.promoApprovalId);
          await approval.send({ embeds: [embed], components: [reviewButtons('promoreq', interaction.user.id, threadId)] });
          await interaction.reply({ content: 'Your promotion request has been submitted.', ephemeral: true });
        } catch (err) {
          console.error('[promoreq] Could not post request:', err.message);
          await interaction.reply({ content: 'Could not submit your request. The promo channels may be misconfigured.', ephemeral: true });
        }
        return;
      }

      if (interaction.customId === 'loareq_modal') {
        const settings = getSettings();
        if (!settings.loaApprovalId) {
          return interaction.reply({ content: 'No LOA approval channel is set yet. Ask an admin to run /staffhubpermission.', ephemeral: true });
        }
        const fields = readLoaFields(interaction);
        const embed  = buildLoaEmbed(interaction.user, fields);
        try {
          let threadId = '0';
          if (settings.loaForumId) {
            try {
              const forum  = await client.channels.fetch(settings.loaForumId);
              const thread = await postForumRecord(forum, `${interaction.user.username} | ${fields.type}`, embed);
              if (thread) threadId = thread.id;
            } catch (e) { console.error('[loareq] Forum post failed:', e.message); }
          }
          const approval = await client.channels.fetch(settings.loaApprovalId);
          await approval.send({ embeds: [embed], components: [reviewButtons('loareq', interaction.user.id, threadId)] });
          // Store as 'pending' until a reviewer approves. Keep the forum thread id and
          // parsed end date so we can auto-complete / extend / early-complete later.
          setLoa(interaction.user.id, { ...fields, endTs: parseEndDate(fields.endDate), forumThreadId: threadId });
          await interaction.reply({ content: 'Your LOA request has been submitted.', ephemeral: true });
        } catch (err) {
          console.error('[loareq] Could not post request:', err.message);
          await interaction.reply({ content: 'Could not submit your request. The LOA channels may be misconfigured.', ephemeral: true });
        }
        return;
      }
      return;
    }

    // ── Slash commands ────────────────────────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    await command.execute(interaction);

  } catch (err) {
    console.error(`[StaffMan] interaction error:`, err);
    const msg = { content: 'Something went wrong running that command.', ephemeral: true };
    if (interaction.isRepliable?.()) {
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
  }
});

client.login(config.token);
