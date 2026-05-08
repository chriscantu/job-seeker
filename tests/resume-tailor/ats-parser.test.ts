import { describe, expect, test } from 'bun:test';
import { parseResume } from '../../scripts/generate_ats_resume_docx';

const baseHeader = [
  '# Test Person',
  '',
  '**Tagline**',
  '',
  'a@b.com',
  '',
  'summary text',
  '',
  '## Key Accomplishments',
  '',
  '- **A** — desc.',
  '',
  '## Skills',
  '',
  'X | Y | Z',
  '',
  '## Professional Experience',
  '',
].join('\n');

const baseFooter = [
  '',
  '## Education',
  '',
  '**Degree**',
  '',
  'School',
  '',
].join('\n');

function build(roleBlock: string): string {
  return baseHeader + roleBlock + baseFooter;
}

describe('parseResume (ATS docx generator)', () => {
  test('captures meta + plain mandate joined by soft line-break (current schema)', () => {
    const md = build([
      '### Title | Company',
      '',
      '*Loc | dates | scope*\\',
      'Hired to do the thing.',
      '',
      '- bullet one.',
      '',
    ].join('\n'));
    const parsed = parseResume(md);
    expect(parsed.experience[0].meta).toBe('Loc | dates | scope');
    expect(parsed.experience[0].mandate).toBe('Hired to do the thing.');
  });

  test('captures legacy italic-wrapped mandate (back-compat)', () => {
    const md = build([
      '### Title | Company',
      '',
      '*Loc | dates | scope*\\',
      '*Hired to do the thing.*',
      '',
      '- bullet one.',
      '',
    ].join('\n'));
    const parsed = parseResume(md);
    expect(parsed.experience[0].meta).toBe('Loc | dates | scope');
    expect(parsed.experience[0].mandate).toBe('Hired to do the thing.');
  });

  test('captures mandate when separated by a blank line (plain or italic)', () => {
    const md = build([
      '### Title | Company',
      '',
      '*Loc | dates | scope*',
      '',
      'Hired to do the thing.',
      '',
      '- bullet one.',
      '',
    ].join('\n'));
    const parsed = parseResume(md);
    expect(parsed.experience[0].meta).toBe('Loc | dates | scope');
    expect(parsed.experience[0].mandate).toBe('Hired to do the thing.');
  });

  test('mandate undefined when no follow-on line present under meta', () => {
    const md = build([
      '### Title | Company',
      '',
      '*Loc | dates | scope*',
      '',
      '- bullet one.',
      '',
    ].join('\n'));
    const parsed = parseResume(md);
    expect(parsed.experience[0].meta).toBe('Loc | dates | scope');
    expect(parsed.experience[0].mandate).toBeUndefined();
  });

  test('does not consume a bold line as mandate', () => {
    const md = build([
      '### Title | Company',
      '',
      '*Loc | dates | scope*',
      '',
      '**Sublabel**',
      '',
      '- bullet one.',
      '',
    ].join('\n'));
    const parsed = parseResume(md);
    expect(parsed.experience[0].mandate).toBeUndefined();
  });

  test('does not absorb mandate from later in role into meta', () => {
    const md = build([
      '### Title | Company',
      '',
      '*Loc | dates | scope*\\',
      'Hired mandate.',
      '',
      '- bullet one.',
      '- bullet two.',
      '',
    ].join('\n'));
    const parsed = parseResume(md);
    expect(parsed.experience[0].items.filter((it) => it.type === 'bullet')).toHaveLength(2);
  });
});
