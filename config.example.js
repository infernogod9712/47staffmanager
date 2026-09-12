// Copy this file to config.js and fill in your real values.
// config.js is gitignored - never commit it (it holds the bot token).
module.exports = {
  token:    'YOUR_BOT_TOKEN',
  clientId: 'YOUR_CLIENT_ID',

  // The Staff Hub server. Commands are registered here and only work here.
  staffHubGuildId: 'STAFF_HUB_GUILD_ID',

  // Log channels for the direct actions (/promote and /infract post here).
  promotionsChannelId:  'PROMOTIONS_CHANNEL_ID',
  infractionsChannelId: 'INFRACTIONS_CHANNEL_ID',

  // ── Staff applications ────────────────────────────────────────────────────
  // The Google Sheet your application forms write into. The id is the long code
  // in the sheet URL: docs.google.com/spreadsheets/d/THIS_PART/edit
  // You also need credentials.json (a Google service account key) in this folder,
  // and the sheet has to be shared with that service account's email as Viewer.
  applicationsSheetId: 'APPLICATIONS_SHEET_ID',

  // How often to check the sheet for new responses, in seconds (minimum 15).
  applicationPollSeconds: 30,

  // NOTE: who can promote/infract, where promo + LOA REQUESTS get sent for approval,
  // the application forum, the results channel, and the Staff Hub invite are all set
  // in Discord with /staffhubpermission (stored in data/settings.json).
};
