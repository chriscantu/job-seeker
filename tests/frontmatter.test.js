const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseFrontmatter, serializeFrontmatter } = require("../scripts/lib/frontmatter");

describe("parseFrontmatter", () => {
  it("extracts metadata and body from a frontmatter block", () => {
    const input = [
      "---",
      "skill: company-research",
      "company: Natera",
      "rating: 4",
      "remote: true",
      "---",
      "",
      "# Natera — Research Brief",
      "Body content here.",
    ].join("\n");

    const { meta, body } = parseFrontmatter(input);
    assert.equal(meta.skill, "company-research");
    assert.equal(meta.company, "Natera");
    assert.equal(meta.rating, "4");
    assert.equal(meta.remote, "true");
    assert.equal(body, "\n# Natera — Research Brief\nBody content here.");
  });

  it("returns empty meta and full body when no frontmatter present", () => {
    const input = "# Just a heading\n\nSome body text.";
    const { meta, body } = parseFrontmatter(input);
    assert.deepEqual(meta, {});
    assert.equal(body, input);
  });

  it("returns empty meta and full body for empty string", () => {
    const { meta, body } = parseFrontmatter("");
    assert.deepEqual(meta, {});
    assert.equal(body, "");
  });

  it("handles quoted values containing colons", () => {
    const input = [
      "---",
      'url: "https://jobs.lever.co/natera/abc"',
      'comp_range: "$239K-$311K"',
      "---",
      "",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(input);
    assert.equal(meta.url, "https://jobs.lever.co/natera/abc");
    assert.equal(meta.comp_range, "$239K-$311K");
  });

  it("handles values with inline colons without quotes", () => {
    const input = [
      "---",
      "role: VP of Engineering: Platform",
      "---",
      "",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(input);
    assert.equal(meta.role, "VP of Engineering: Platform");
  });

  it("ignores lines without a colon in frontmatter", () => {
    const input = [
      "---",
      "skill: company-research",
      "this line has no key-value",
      "company: Natera",
      "---",
      "",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(input);
    assert.equal(meta.skill, "company-research");
    assert.equal(meta.company, "Natera");
    assert.equal(Object.keys(meta).length, 2);
  });

  it("does not treat --- inside body as frontmatter delimiter", () => {
    const input = [
      "---",
      "skill: resume-tailor",
      "---",
      "",
      "# Resume",
      "",
      "---",
      "",
      "## Experience",
    ].join("\n");

    const { meta, body } = parseFrontmatter(input);
    assert.equal(meta.skill, "resume-tailor");
    assert.ok(body.includes("---"));
    assert.ok(body.includes("## Experience"));
  });
});

describe("serializeFrontmatter", () => {
  it("produces a valid frontmatter block followed by body", () => {
    const meta = { skill: "company-research", company: "Natera", rating: "4" };
    const body = "\n# Natera — Research Brief\nBody.";
    const result = serializeFrontmatter(meta, body);

    assert.ok(result.startsWith("---\n"));
    assert.ok(result.includes("skill: company-research\n"));
    assert.ok(result.includes("company: Natera\n"));
    assert.ok(result.includes("rating: 4\n"));
    assert.ok(result.includes("---\n\n# Natera"));
  });

  it("quotes values that contain colons", () => {
    const meta = { url: "https://example.com/jobs/123" };
    const result = serializeFrontmatter(meta, "\nBody.");

    assert.ok(result.includes('url: "https://example.com/jobs/123"'));
  });

  it("does not double-quote already quoted values", () => {
    const meta = { url: "https://example.com" };
    const result = serializeFrontmatter(meta, "\nBody.");
    assert.ok(!result.includes('""'));
  });
});

describe("roundtrip", () => {
  it("parse(serialize(meta, body)) returns the same meta and body", () => {
    const meta = {
      skill: "company-research",
      company: "Natera",
      slug: "natera",
      role: "VP of Engineering",
      url: "https://jobs.lever.co/natera/abc",
      generated: "2026-04-08",
      rating: "4",
      remote: "true",
      positioning_count: "3",
      gaps_count: "2",
    };
    const body = "\n# Natera — Research Brief\n\nBody content.";

    const serialized = serializeFrontmatter(meta, body);
    const { meta: parsedMeta, body: parsedBody } = parseFrontmatter(serialized);

    assert.deepEqual(parsedMeta, meta);
    assert.equal(parsedBody, body);
  });
});