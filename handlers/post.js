const { ChannelType } = require('discord.js');

// Creates the record post in a forum (like the Staff Hub inactivity-notice),
// tagged "Awaiting Approval". No buttons - approving happens in the approval
// channel. Returns the created thread so its id can ride on the approval buttons,
// or null if the given channel is not a forum.
async function postForumRecord(forum, name, embed) {
  if (!forum || forum.type !== ChannelType.GuildForum) return null;
  const awaiting = forum.availableTags.find(t => t.name === 'Awaiting Approval');
  return forum.threads.create({
    name: name.slice(0, 100),
    message: { embeds: [embed] },
    appliedTags: awaiting ? [awaiting.id] : [],
  });
}

module.exports = { postForumRecord };
