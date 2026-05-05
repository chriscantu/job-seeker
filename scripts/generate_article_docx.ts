#!/usr/bin/env bun
/**
 * Generate a formatted .docx article from the fat-marker LinkedIn article markdown.
 *
 * Usage:
 *   bun scripts/generate_article_docx.ts
 *
 * Output: output/linkedin-article-fat-marker.docx
 *
 * Reads the markdown source and embeds screenshots at placeholder locations.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, ExternalHyperlink, BorderStyle,
} from 'docx';
import { errorMessage } from './lib/util';

// ── Config ──────────────────────────────────────────────────────────────────
const FONT = "Calibri";
const COLORS = { black: "333333", gray: "555555", blue: "1F4E79", midBlue: "2E75B6" };

const IMAGE_MAP: Record<string, string> = {
  "constraints": "/tmp/article-img-11-42-44AM.jpg",
  "fat-marker":  "/tmp/article-img-1-14-14PM.jpg",
  "variants":    "/tmp/article-img-2-40-37PM.jpg",
};


function jpegDimensions(buf: Buffer): { pxH: number; pxW: number } {
  // Walk JPEG markers to find SOF0/SOF2 (0xFFC0/0xFFC2) which contain dimensions
  let offset = 2; // skip SOI marker
  while (offset < buf.length) {
    if (buf[offset] !== 0xFF) break;
    const marker = buf[offset + 1];
    if (marker === 0xC0 || marker === 0xC2) {
      return { pxH: buf.readUInt16BE(offset + 5), pxW: buf.readUInt16BE(offset + 7) };
    }
    const len = buf.readUInt16BE(offset + 2);
    offset += 2 + len;
  }
  throw new Error("Could not read JPEG dimensions");
}

function loadImage(key: string): { buf: Buffer; pxW: number; pxH: number } {
  const filePath = IMAGE_MAP[key];
  const buf = fs.readFileSync(filePath);
  const { pxW, pxH } = jpegDimensions(buf);
  return { buf, pxW, pxH };
}

// ── Text helpers ─────────────────────────────────────────────────────────────
const bodyStyle = { font: FONT, size: 22, color: COLORS.black };
const italicStyle = { ...bodyStyle, italics: true, color: COLORS.gray };
const boldStyle = { ...bodyStyle, bold: true };
const h1Style = { font: FONT, size: 36, bold: true, color: COLORS.blue };
const h2Style = { font: FONT, size: 26, bold: true, color: COLORS.blue };

type ParagraphChild = TextRun | ExternalHyperlink;

function bodyPara(runs: ParagraphChild[], spacing: { after: number; line?: number; before?: number } = { after: 200, line: 276 }): Paragraph {
  return new Paragraph({ spacing, children: runs });
}

function heading1(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 200 },
    children: [new TextRun({ text, ...h1Style })],
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, ...h2Style })],
  });
}

function imageParagraph(key: string, caption?: string): Paragraph[] {
  const { buf, pxW, pxH } = loadImage(key);
  // Scale to max 624px wide (6.5" at 96dpi) preserving aspect ratio
  const maxPx = 624;
  const scale = Math.min(maxPx / pxW, 1);
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [
        new ImageRun({
          data: buf,
          type: "jpg",
          transformation: {
            width: Math.round(pxW * scale),
            height: Math.round(pxH * scale),
          },
        }),
      ],
    }),
  ];
  if (caption) {
    children.push(new Paragraph({
      spacing: { after: 200 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: caption, ...italicStyle, size: 20 })],
    }));
  }
  return children;
}

function linkRun(text: string, url: string): ExternalHyperlink {
  return new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text, ...bodyStyle, color: COLORS.midBlue, underline: {} })],
  });
}

function rule(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.gray, space: 1 } },
    spacing: { before: 300, after: 200 },
    children: [],
  });
}

// ── Build document ───────────────────────────────────────────────────────────
const children: Paragraph[] = [];

// Title
children.push(heading1("We Forgot About the User"));
children.push(bodyPara([
  new TextRun({ text: "How encoding problem-first thinking into my AI workflow changed what I ship", ...italicStyle }),
]));

// === THE PROBLEM ===
children.push(heading2("The problem"));

children.push(bodyPara([
  new TextRun({ text: "We’re wired to jump to solutions. It’s human nature — someone describes a problem and we’re already building the fix in our heads. Product teams have operated this way for decades, and it shows: ", ...bodyStyle }),
  linkRun("Pendo’s analysis of 615 software products", "https://www.pendo.io/resources/the-2019-feature-adoption-report/"),
  new TextRun({ text: " found that 80% of features are rarely or never used. Only 12% of features drive 80% of actual daily usage.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "AI-assisted development makes this problem worse. The cost of building dropped from weeks to minutes, but the cost of shipping the wrong feature to customers didn’t change at all. Bad features still erode trust, still waste user attention, still crowd out the features that actually matter. We just ship them faster now.", ...bodyStyle }),
]));

// === THE CONFESSION ===
children.push(heading2("The confession"));

children.push(bodyPara([
  new TextRun({ text: "One of my first AI projects started with a clear problem and ended with a convoluted mess. An AI Advisory Board — a group of agents that could advise on different facets of an engineering leader’s job — turned into a status report generator, then a Jira integration, then a PRD generator, then sentiment analysis on Slack conversations. Somewhere in between, the original problem quietly left the building.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "The project got abandoned. Not because the technology failed — because the speed of AI-assisted development didn’t help with thinking more clearly. It helped skip thinking entirely.", ...bodyStyle }),
]));

// === WHAT CAME NEXT ===
children.push(heading2("What came next"));

children.push(bodyPara([
  new TextRun({ text: "So I built structure into my Claude workflow — rules that make First Principles Thinking, User Driven Design, and Fat Marker sketches the heart of feature development. Not a process document people ignore — a set of rules and skills wired directly into the AI workflow that make it structurally difficult to skip the thinking.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "The pipeline:", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "Define the Problem → First Principles Decomposition → Fat Marker Sketch → Design → Implementation", ...boldStyle }),
], { after: 200, line: 276 }));

children.push(bodyPara([
  new TextRun({ text: "Each stage has hard gates. The AI agent literally cannot proceed to the next stage without completing the current one.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "Define the Problem", ...boldStyle }),
  new TextRun({ text: " forces five questions before any solution gets considered: Who has this problem? What’s the pain? What evidence do we have? What happens if we do nothing? What constraints exist? If the answers are vague — “users might want this” instead of “I missed three overdue check-ins last week” — the system flags it and pushes for deeper investigation.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "First Principles Decomposition", ...boldStyle }),
  new TextRun({ text: " separates facts from assumptions, maps dependencies, and surfaces second-order effects. The systems thinking that experienced leaders do intuitively — except now it happens every time, not just when someone remembers to slow down.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "Fat Marker Sketch", ...boldStyle }),
  new TextRun({ text: " comes from Basecamp’s ", ...bodyStyle }),
  linkRun("Shape Up", "https://basecamp.com/shapeup/1.3-chapter-04"),
  new TextRun({ text: " methodology. The idea: sketch your solution with a marker so thick you physically can’t add detail. You’re forced to capture only the essential structure — what’s in, what’s out, how the pieces connect. It keeps the conversation at the altitude where the important decisions live.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "All of this is encoded directly into the AI agent’s workflow. Before it can write a single line of detailed design, it has to produce a fat marker sketch and get confirmation that the shape is right. Not the pixels. The shape.", ...bodyStyle }),
]));

// === WHAT IT LOOKS LIKE IN PRACTICE ===
children.push(heading2("What it looks like in practice"));

children.push(bodyPara([
  new TextRun({ text: "Here’s a real example. The task: design a guided savings feature for a credit union.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "Before the agent sketched anything, it walked through constraints — surfacing the regulatory, technical, and data boundaries it could infer, then asking for confirmation on what it couldn’t:", ...bodyStyle }),
]));

// Screenshot 1: Constraints
children.push(...imageParagraph("constraints", "The agent surfaces constraints it can infer and asks about the ones it can’t."));

children.push(bodyPara([
  new TextRun({ text: "Then, instead of jumping to a detailed wireframe, the agent produced a fat marker sketch — four screens showing the full user journey, with just enough detail to evaluate the flow:", ...bodyStyle }),
]));

// Screenshot 2: Fat marker sketch
children.push(...imageParagraph("fat-marker", "A fat marker sketch: four screens, structural boxes, bracketed actions, and a flow diagram. Enough to evaluate the journey — not enough to implement from."));

children.push(bodyPara([
  new TextRun({ text: "That sketch surfaced a design question that hadn’t come up yet: should the “Your Plan” screen be opinionated (here’s what we recommend) or configurable (pick your own products)? The agent sketched both variants:", ...bodyStyle }),
]));

// Screenshot 3: Variants
children.push(...imageParagraph("variants", "Default vs. Power User — showing the trade-off between simplicity and control."));

children.push(bodyPara([
  new TextRun({ text: "Before a single line of code existed, scope was validated, the user flow made sense, constraints were mapped, and a key UX trade-off was already on the table. That’s the work that matters. The code is the easy part.", ...bodyStyle }),
]));

// === THE ACTUAL LESSON ===
children.push(heading2("The actual lesson"));

children.push(bodyPara([
  new TextRun({ text: "The lesson from the abandoned Advisory Board project wasn’t “get better tools.” It was: faster tools require more discipline, not less.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "This is the same pattern that shows up across engineering organizations at scale. When deployment gets faster, we need better testing practices — not fewer. When communication gets easier, we need clearer decision-making frameworks — not less process. Speed amplifies whatever habits already exist. If those habits include skipping problem definition, speed just helps build the wrong thing with more confidence.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "The job of an engineering leader isn’t to ship faster. It’s to build systems that protect the thinking — systems that make it structurally difficult for smart, well-intentioned people to skip the hard work of understanding what to build before building it.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "The fix here wasn’t “try harder to slow down.” It was encoding the discipline into the system itself. The same approach applies to teams: don’t rely on people remembering to do the right thing under pressure. Build the checkpoints into the workflow.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "We’re still figuring out what good process looks like when building is nearly free. But one thing seems clear: the tools got faster. The fundamentals didn’t.", ...bodyStyle }),
]));

children.push(bodyPara([
  new TextRun({ text: "Pick up a fat marker before you pick up an AI agent.", ...boldStyle }),
]));

// === FOOTER ===
children.push(rule());

children.push(bodyPara([
  new TextRun({ text: "The rules and skills described in this article are open source: ", ...italicStyle }),
  linkRun("github.com/chriscantu/claude-config", "https://github.com/chriscantu/claude-config"),
], { after: 120, line: 276 }));

children.push(bodyPara([
  new TextRun({ text: "Sources:", ...italicStyle }),
], { after: 60 }));

children.push(bodyPara([
  new TextRun({ text: "• ", ...italicStyle }),
  linkRun("Pendo Feature Adoption Report", "https://www.pendo.io/resources/the-2019-feature-adoption-report/"),
  new TextRun({ text: " — 80% of features rarely or never used across 615 products", ...italicStyle }),
], { after: 60 }));

children.push(bodyPara([
  new TextRun({ text: "• Basecamp, ", ...italicStyle }),
  linkRun("Shape Up — Chapter 4: Find the Elements", "https://basecamp.com/shapeup/1.3-chapter-04"),
  new TextRun({ text: " — Fat Marker sketches and shaping at the right level of abstraction", ...italicStyle }),
]));

// ── Assemble and write ───────────────────────────────────────────────────────
const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
    },
    children,
  }],
});

const OUTPUT = path.join(__dirname, "..", "output", "linkedin-article-fat-marker.docx");

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("DOCX written to:", OUTPUT);
}).catch(err => {
  const msg = errorMessage(err);
  console.error("Failed to generate DOCX:", msg);
  process.exit(1);
});
