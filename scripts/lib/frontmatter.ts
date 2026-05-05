export type FrontmatterMeta = Record<string, string>;

export interface ParsedFrontmatter {
  meta: FrontmatterMeta;
  body: string;
}

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns { meta: {}, body: "" }.
 * If no frontmatter block is present, meta is empty and body is the full input.
 */
export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return { meta: {}, body: markdown };
  }

  // Find the closing delimiter, verifying it is followed by \n, \r\n, or end-of-string
  // (not an arbitrary \n---anything false match).
  let endIndex = markdown.indexOf("\n---", 3);
  while (endIndex !== -1) {
    const afterDelim = endIndex + 4; // position right after "\n---"
    const ch = markdown[afterDelim];
    if (ch === undefined || ch === "\n" || ch === "\r") break; // valid delimiter
    endIndex = markdown.indexOf("\n---", afterDelim);
  }
  if (endIndex === -1) {
    return { meta: {}, body: markdown };
  }

  // Opening delimiter is either "---\n" (4 bytes) or "---\r\n" (5 bytes).
  const openingOffset = markdown.startsWith("---\r\n") ? 5 : 4;
  const yamlBlock = markdown.slice(openingOffset, endIndex);

  // Determine how many bytes the closing "\n---" + line-ending consumes.
  // Pattern: (\r?)\n---(\r?\n|$)
  const afterDelim = endIndex + 4; // index after "\n---"
  const closingLineEnd = markdown[afterDelim] === "\r" ? 2 : markdown[afterDelim] === "\n" ? 1 : 0;
  const body = markdown.slice(endIndex + 4 + closingLineEnd);

  const meta: FrontmatterMeta = {};
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

    // Unescape escaped double-quotes
    value = value.replace(/\\"/g, '"');

    meta[key] = value;
  }

  return { meta, body };
}

/**
 * Serialize a metadata object and body string into a frontmatter markdown string.
 * Values containing colons are automatically quoted.
 */
export function serializeFrontmatter(meta: Record<string, unknown>, body: string): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(meta)) {
    if (value === null || value === undefined) continue;
    const strVal = String(value);
    if (strVal.includes("\n") || strVal.includes("\r")) {
      throw new Error(
        `frontmatter: cannot serialize key "${key}": value contains a newline. Values must be single-line.`
      );
    }
    if (strVal.includes(":")) {
      const escaped = strVal.replace(/"/g, '\\"');
      lines.push(`${key}: "${escaped}"`);
    } else {
      lines.push(`${key}: ${strVal}`);
    }
  }
  lines.push("---");
  // Inject a "\n" separator so parse can always skip "\n---\n" to recover body.
  return lines.join("\n") + "\n" + body;
}
