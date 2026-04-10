"use strict";

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns { meta: {}, body: "" }.
 * If no frontmatter block is present, meta is empty and body is the full input.
 */
function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return { meta: {}, body: markdown };
  }

  const endIndex = markdown.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { meta: {}, body: markdown };
  }

  const yamlBlock = markdown.slice(4, endIndex);
  // Skip "\n---\n" (5 chars) — the closing delimiter and its trailing newline.
  // Body retains its own leading "\n" so that serialize/parse roundtrips cleanly.
  const body = markdown.slice(endIndex + 5);

  const meta = {};
  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Strip surrounding quotes
    if (
      value.length >= 2 &&
      ((value[0] === '"' && value[value.length - 1] === '"') ||
        (value[0] === "'" && value[value.length - 1] === "'"))
    ) {
      value = value.slice(1, -1);
    }

    meta[key] = value;
  }

  return { meta, body };
}

/**
 * Serialize a metadata object and body string into a frontmatter markdown string.
 * Values containing colons are automatically quoted.
 */
function serializeFrontmatter(meta, body) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(meta)) {
    const strVal = String(value);
    if (strVal.includes(":")) {
      lines.push(`${key}: "${strVal}"`);
    } else {
      lines.push(`${key}: ${strVal}`);
    }
  }
  lines.push("---");
  // Inject a "\n" separator so parse can always skip "\n---\n" to recover body.
  return lines.join("\n") + "\n" + body;
}

module.exports = { parseFrontmatter, serializeFrontmatter };