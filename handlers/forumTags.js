// The four status tags a request post moves through in the forum.
const STATUS_TAGS = ['Awaiting Approval', 'Approved', 'Denied', 'Completed'];

// Sets a forum thread to exactly one status tag: removes any other status tag and
// adds the one named. Keeps any non-status tags the post already has. No-op if the
// channel is not a forum thread.
async function setThreadStatus(thread, statusName) {
  if (!thread?.isThread?.()) return;
  const tags     = thread.parent?.availableTags || [];
  const statusIds = STATUS_TAGS
    .map(name => tags.find(t => t.name === name)?.id)
    .filter(Boolean);
  const targetId = tags.find(t => t.name === statusName)?.id;

  const applied = thread.appliedTags.filter(id => !statusIds.includes(id));
  if (targetId && !applied.includes(targetId)) applied.push(targetId);

  await thread.setAppliedTags(applied.slice(0, 5));
}

module.exports = { setThreadStatus };
