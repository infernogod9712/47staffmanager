// Run this after adding or changing any slash command:
//   node deploy-commands.js
// Registers commands to the Staff Hub server only, so they appear and work only
// there (instant, no 1-hour wait). Set staffHubGuildId in config.js first.

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const commands = [];
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'))) {
  const command = require(`./commands/${file}`);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.staffHubGuildId),
      { body: commands },
    );
    console.log(`Registered ${commands.length} command(s) to the Staff Hub (${config.staffHubGuildId}).`);
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
})();
