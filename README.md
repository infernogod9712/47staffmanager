# 47 Database Staff Manager (Staff Man)

The HR bot for S47. Handles staff **promotions**, **infractions** (demotions are a
type of infraction), **LOA / ROA requests**, and **staff applications** read straight
out of the Google Sheet the application forms write into.
(Point system and shifts are planned but not built yet.)

Uses a **handler + command** structure, same as 47ModBot: `index.js` loads and
routes, `commands/` holds one file per slash command, `handlers/` holds shared logic.

## Commands

| Command | What it does |
|---|---|
| `/promote [user] [rank] [reason]` | Gives the member the rank role you mention and logs it to the promotions channel. |
| `/infract [user] [punishment] [reason]` | Logs an infraction to the infractions channel. A demotion is just an infraction with "Demotion" as the punishment. |
| `/promoreqpanel` | Posts a panel with a button. Staff click it to fill out a promotion request form. |
| `/loareqpanel` | Posts a panel with a button. Staff click it to fill out an LOA / ROA request form. |
| `/loaextend [extra_time] [new_end_date] [reason]` | Ask to extend your current LOA. Only works if you have an LOA on file. Goes to the LOA approval channel. |
| `/appcheck` | Admin-only. Checks the application sheet right now instead of waiting for the timer, and shows how many responses of each tab have been handled. |
| `/staffhubpermission` | Admin-only setup. Sets who can promote/infract, the promo + LOA request channels, the application forum + results channel, and the main staff role. |

**Request flow (promo, LOA, and LOA extend all work the same way):**
1. Someone fills the form.
2. The bot posts it in TWO places: the **forum** as a record tagged `Awaiting Approval`,
   and the **approval channel** as a copy with **Approve / Deny** buttons.
3. HC clicks Approve or Deny in the approval channel.
4. That approval-channel message is **deleted**, the forum tag flips to `Approved` /
   `Denied`, an "Approved by @HC" line is added to the forum post, and the requester
   gets a DM with the outcome.

- Each request type has two channels, set with `/staffhubpermission`: an approval
  channel (buttons) and a forum (record). The forum is optional; without it, only the
  approval-channel copy is posted.
- Approving a **promo** does NOT give the role (the rank was typed as text) - the
  reviewer still runs `/promote`. Approving an **LOA** marks it active so `/loaextend`
  works; denying it clears the record.
- Who can click Approve / Deny: admins, the main staff role, or anyone on the /promote list.
- Forms cannot mention roles or users, so a promo request records the rank as text only.
- `/infract` and `/promote` also DM the member. `/infract` does NOT remove roles, so
  a demotion must be applied by hand (or ask to add auto-demotion later).

## Staff applications

Every Google Form writes its responses into its own tab of one spreadsheet, so
**one tab = one kind of application**. The bot checks that sheet every 30 seconds.

1. Someone submits an application form. A new row appears in the sheet.
2. Within 30 seconds the bot posts it as a **forum thread** in the Staff Hub
   application forum, tagged `Awaiting Approval`, with **Approve / Deny** buttons
   right on the post. The thread is named `applicant | application name`, and the
   embed holds every question and answer.
3. HC clicks Approve or Deny. Either way a box opens asking for a reason, and that
   reason is public: it goes on the forum post, in the results channel, and in the
   applicant's DM.
4. The forum tag flips to `Approved` / `Denied`, the buttons come off so it cannot be
   decided twice, and an "Accepted by @HC" line is added to the post.
5. A result embed goes to the **results channel in the MAIN server** (the applicant is
   pinged outside the embed), and the applicant gets a **DM**. Accepted applicants get
   the Staff Hub invite link in that DM.

Details worth knowing:

- **Old applications are never spammed.** The first time the bot sees a tab it just
  records how many rows are already there and posts nothing. Only rows added after
  that get posted.
- **It knows who applied** by looking for a column with "Discord" in its header. A user
  ID, an @username, or a plain username all work. If nothing matches, the application
  is still posted (marked "no matching Discord account found"), but there is no ping
  and no DM.
- **Long applications are never cut off.** Discord caps an embed at 25 fields and 6000
  characters, so if an application is too big the extra answers are attached to the
  post as `application.txt`.
- **Restart-safe.** Progress is stored in `data/applications.json`, so restarting the
  bot never re-posts an application it already handled. If someone deletes rows from
  the sheet, the bot resyncs instead of getting stuck.
- The forum needs the tags `Awaiting Approval`, `Approved`, and `Denied` (same tag names
  the LOA forum uses). Missing tags are skipped, not crashed on.

## Permissions

- Everything is locked to the **Staff Hub** server. Elsewhere the commands do not exist.
- **Until an admin runs `/staffhubpermission`, only Administrators can use the commands.**
- After setup: Administrators always work; plus any role added to the `/promote` or
  `/infract` list; and the main staff role acts as a fallback.

## Setup

1. `npm install`
2. Copy `config.example.js` to `config.js` and fill in `token`, `clientId`,
   `staffHubGuildId`, `promotionsChannelId`, `infractionsChannelId`.
3. `node deploy-commands.js` to register the slash commands to the Staff Hub.
4. `node index.js` to start the bot.
5. In Discord, run `/staffhubpermission` to set the request channels, the main staff
   role, and which roles can promote / infract.

The bot needs the **Manage Roles** permission, and its role must sit **above** any
rank it will hand out.

### Extra setup for staff applications

1. **Get a Google service account key** (47ModBot already uses one, so you can reuse
   the same Google Cloud project):
   - Google Cloud Console > IAM & Admin > Service Accounts > create one
   - Enable the **Google Sheets API** for the project
   - Keys > Add key > JSON, and save the downloaded file as `credentials.json`
     in this bot's folder (it is gitignored, never commit it)
2. **Share the sheet** with the service account's email (the `client_email` inside
   `credentials.json`) as a **Viewer**.
3. Put the sheet id in `config.js` as `applicationsSheetId`. It is the long code in
   the sheet URL: `docs.google.com/spreadsheets/d/THIS_PART/edit`
4. In Discord run:
   - `/staffhubpermission app_forum:` the Staff Hub forum for applications
   - `/staffhubpermission app_results_id:` the results channel ID **in the main
     server** (right-click the channel there and Copy Channel ID - it has to be an ID
     because Discord will only let the picker list Staff Hub channels)
   - `/staffhubpermission staff_hub_invite:` the invite link accepted applicants get
5. Run `/appcheck` to confirm it can read the sheet. The first run just records where
   each tab currently is; submit a test application to see it post.

The bot must be in **both** servers, and needs **Create Posts** + **Manage Threads**
(to change tags) in the application forum, and **Send Messages** in the results channel.
