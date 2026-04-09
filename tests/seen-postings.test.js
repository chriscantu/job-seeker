const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseSeenPostings, parseSeenPostingsFile } = require('../scripts/lib/seen-postings');

const FIXTURES = path.join(__dirname, 'fixtures');

describe('seen-postings parser', () => {
  describe('Gen 1 format (2026-03-14)', () => {
    it('parses bullet entries with URL and square-bracket flags', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen1-seen-postings.md'));
      assert.ok(entries.length > 0, 'should parse entries');

      const closed = entries.find(e => e.company === 'Umbrella Corp');
      assert.ok(closed, 'should find Umbrella Corp');
      assert.equal(closed.url, 'https://jobs.lever.co/umbrella/7ddaf873-7e89-4085-b76c-04bdcb585ce5');
      assert.ok(closed.flags.includes('CLOSED'), 'should have CLOSED flag');
    });

    it('parses entries with cover letter + resume notes', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen1-seen-postings.md'));
      const acme = entries.find(e => e.company === 'Acme Corp');
      assert.ok(acme, 'should find Acme Corp');
      assert.equal(acme.url, 'https://jobs.ashbyhq.com/acme/b66510c0-8d15-4981-9deb-fd6111fe9668');
      assert.equal(acme.title, 'VP of Engineering');
    });

    it('parses entries with no flags', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen1-seen-postings.md'));
      const initech = entries.find(e => e.company === 'Initech');
      assert.ok(initech, 'should find Initech');
      assert.equal(initech.url, 'https://apply.workable.com/initech/j/7A461611AE/');
      assert.deepEqual(initech.flags, []);
    });

    it('parses compound square-bracket flags', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen1-seen-postings.md'));
      const wonka = entries.find(e => e.company === 'Wonka Industries');
      assert.ok(wonka, 'should find Wonka Industries');
      assert.ok(wonka.flags.includes('ONSITE SF - SKIP'), 'should capture full bracket content');
    });

    it('assigns section date to entries', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen1-seen-postings.md'));
      const acme = entries.find(e => e.company === 'Acme Corp');
      assert.equal(acme.date, '2026-03-14');
      const oscorp = entries.find(e => e.company === 'Oscorp');
      assert.equal(oscorp.date, '2026-03-16');
    });
  });

  describe('Gen 2 format (2026-03-27)', () => {
    it('parses entries with location field', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen2-seen-postings.md'));
      const hooli = entries.find(e => e.company === 'Hooli');
      assert.ok(hooli, 'should find Hooli');
      assert.equal(hooli.url, 'https://jobs.lever.co/hooli/97e59baf-cbdc-45b0-b086-fdbb075eeb55');
      assert.equal(hooli.title, 'VP, Engineering');
    });

    it('parses entries with no URL', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen2-seen-postings.md'));
      const seefood = entries.find(e => e.company === 'SeeFood');
      assert.ok(seefood, 'should find SeeFood');
      assert.equal(seefood.url, null);
    });

    it('parses mixed bracket and non-bracket flags', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen2-seen-postings.md'));
      const aviato = entries.find(e => e.company === 'Aviato');
      assert.ok(aviato, 'should find Aviato');
      assert.ok(aviato.flags.includes('CLOSED'), 'should have CLOSED flag');
    });

    it('parses EXCLUDED and PASSED statuses', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen2-seen-postings.md'));
      const bachmanity = entries.find(e => e.company === 'Bachmanity');
      assert.ok(bachmanity);
      assert.equal(bachmanity.status, 'Excluded');

      const endframe = entries.find(e => e.company === 'Endframe');
      assert.ok(endframe);
      assert.equal(endframe.status, 'PASSED');
    });

    it('parses discovered: dates', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen2-seen-postings.md'));
      const trueSearch = entries.find(e => e.company === 'TrueSearch');
      assert.ok(trueSearch);
      assert.equal(trueSearch.discovered, '2026-03-26');
    });

    it('parses star ratings', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen2-seen-postings.md'));
      const healthFirst = entries.find(e => e.company === 'HealthFirst');
      assert.ok(healthFirst);
      assert.equal(healthFirst.stars, 4);
    });
  });

  describe('Gen 3 format (2026-03-30+)', () => {
    it('parses markdown table entries', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const percona = entries.find(e => e.company === 'Percona');
      assert.ok(percona, 'should find Percona');
      assert.equal(percona.url, 'https://jobs.ashbyhq.com/percona/cf23fe7e-cd27-476c-a545-1d2f9f9443f9');
      assert.equal(percona.status, 'Surfaced');
    });

    it('parses posted: dates', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const circle = entries.find(e => e.company === 'Circle');
      assert.ok(circle);
      assert.equal(circle.posted, '2026-02-06');
    });

    it('parses multiple pipe-delimited flags', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const nyt = entries.find(e => e.company === 'NYT Wirecutter');
      assert.ok(nyt, 'should find NYT Wirecutter');
      assert.ok(nyt.flags.includes('RESEARCHED'));
      assert.ok(nyt.flags.includes('RESUME TAILORED'));
      assert.ok(nyt.flags.includes('COVER LETTER'));
      assert.ok(nyt.flags.some(f => f.startsWith('APPLIED')));
    });

    it('parses source tags', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const natera = entries.find(e => e.company === 'Natera');
      assert.ok(natera);
      assert.equal(natera.source, 'email-linkedin');
    });

    it('parses entries with CLOSED status and no dates', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const divvy = entries.find(e => e.company === 'Divvy Homes');
      assert.ok(divvy);
      assert.ok(divvy.flags.includes('CLOSED'));
    });

    it('parses discovered: dates (no URL)', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const kadence = entries.find(e => e.company === 'kadence');
      assert.ok(kadence);
      assert.equal(kadence.discovered, '2026-03-31');
      assert.equal(kadence.url, null);
    });

    it('captures section labels (e.g., email scan — iCloud)', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const kadence = entries.find(e => e.company === 'kadence');
      assert.ok(kadence);
      assert.equal(kadence.sectionLabel, 'email scan — iCloud');
    });

    it('parses star ratings from Unicode stars', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const fivetran = entries.find(e => e.company === 'Fivetran');
      assert.ok(fivetran);
      assert.equal(fivetran.stars, 4);

      const lpl = entries.find(e => e.company === 'LPL Financial');
      assert.ok(lpl);
      assert.equal(lpl.stars, 2);
    });

    it('parses Excluded status with parenthetical detail', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const helm = entries.find(e => e.company === 'Helm Health');
      assert.ok(helm);
      assert.equal(helm.status, 'Excluded');
      assert.equal(helm.statusDetail, '19 employees, player-coach, below comp');
    });
  });

  describe('URL extraction for dedup', () => {
    it('extracts all URLs across all formats', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const urls = entries.filter(e => e.url).map(e => e.url);
      assert.ok(urls.length > 0, 'should have URLs');
      urls.forEach(url => {
        assert.ok(url.startsWith('http'), `URL should start with http: ${url}`);
      });
    });

    it('handles entries with no URL gracefully', () => {
      const entries = parseSeenPostingsFile(path.join(FIXTURES, 'gen3-seen-postings.md'));
      const noUrl = entries.filter(e => e.url === null);
      assert.ok(noUrl.length > 0, 'should have entries without URLs');
      noUrl.forEach(entry => {
        assert.ok(entry.company, 'entries without URLs should still have company');
      });
    });
  });

  describe('parseSeenPostings (multi-file)', () => {
    const MULTI_FIXTURES = path.join(FIXTURES, 'multi');

    it('merges entries from multiple files', () => {
      const entries = parseSeenPostings(MULTI_FIXTURES);
      const companies = entries.map(e => e.company);
      // Gen 1 entry
      assert.ok(companies.includes('Acme Corp'), 'should include Gen 1 entries');
      // Gen 2 entry
      assert.ok(companies.includes('Hooli'), 'should include Gen 2 entries');
      // Gen 3 entry
      assert.ok(companies.includes('Natera'), 'should include Gen 3 entries');
    });

    it('returns entries sorted chronologically', () => {
      const entries = parseSeenPostings(MULTI_FIXTURES);
      const firstDate = entries[0].date;
      const lastDate = entries[entries.length - 1].date;
      assert.ok(firstDate <= lastDate, 'entries should be chronologically ordered');
    });

    it('returns empty array when directory does not exist', () => {
      const entries = parseSeenPostings('/tmp/nonexistent-dir-12345');
      assert.deepEqual(entries, []);
    });
  });
});
