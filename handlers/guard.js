const config = require('../config');

// Returns an error message if the interaction is NOT in the Staff Hub, else null.
// Commands are registered only to the Staff Hub, so they should not appear in
// other servers at all - this is a backup in case that ever changes.
function outsideStaffHub(interaction) {
  if (interaction.guildId === config.staffHubGuildId) return null;
  return 'This command is only available in the Staff Hub.';
}

module.exports = { outsideStaffHub };
