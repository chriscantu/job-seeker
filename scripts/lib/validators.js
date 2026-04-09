const DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/.+/;

function validateSeenPostingsEntry(entry) {
  const errors = [];

  if (!entry.company || !entry.company.trim()) {
    errors.push('company is required');
  }

  if (!entry.title || !entry.title.trim()) {
    errors.push('title is required');
  }

  if (entry.url !== null && entry.url !== undefined && !URL_RE.test(entry.url)) {
    errors.push('url must be a valid HTTP(S) URL or null');
  }

  const hasPosted = entry.posted && DATE_FORMAT_RE.test(entry.posted);
  const hasDiscovered = entry.discovered && DATE_FORMAT_RE.test(entry.discovered);

  if (!hasPosted && !hasDiscovered) {
    if (entry.posted && !DATE_FORMAT_RE.test(entry.posted)) {
      errors.push('posted date must be in YYYY-MM-DD format');
    } else if (entry.discovered && !DATE_FORMAT_RE.test(entry.discovered)) {
      errors.push('discovered date must be in YYYY-MM-DD format');
    } else {
      errors.push('either posted or discovered date (YYYY-MM-DD) is required');
    }
  }

  return { valid: errors.length === 0, errors };
}

function validatePreferencesEntry(entry) {
  const errors = [];

  if (!entry.section || !entry.section.trim()) {
    errors.push('section is required');
  }

  if (!entry.entries || !Array.isArray(entry.entries) || entry.entries.length === 0) {
    errors.push('entries must be a non-empty array');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateSeenPostingsEntry, validatePreferencesEntry };
