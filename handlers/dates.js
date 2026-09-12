// Parses an end date typed as M/D, M/D/YY, or M/D/YYYY into a timestamp at the end
// of that day. Returns null if it cannot be read (auto-complete just won't fire).
// If no year is given and the date already passed, it assumes next year.
function parseEndDate(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (!m) return null;

  const mo = parseInt(m[1], 10);
  const d  = parseInt(m[2], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const now = new Date();

  let year;
  if (m[3]) {
    year = parseInt(m[3], 10);
    if (m[3].length === 2) year += 2000;
  } else {
    year = now.getFullYear();
  }

  let date = new Date(year, mo - 1, d, 23, 59, 59);
  if (isNaN(date.getTime())) return null;

  // No explicit year and the date is already past -> assume next year.
  if (!m[3] && date.getTime() < now.getTime()) {
    date = new Date(year + 1, mo - 1, d, 23, 59, 59);
  }
  return date.getTime();
}

module.exports = { parseEndDate };
