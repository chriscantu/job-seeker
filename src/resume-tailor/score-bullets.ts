const STOPWORDS = new Set([
  'the','a','an','and','or','of','for','to','in','on','at','by','with','as',
  'is','are','was','were','be','been','being','this','that','these','those',
  'we','you','they','it','its','our','your','their','i','my','me',
]);

const PHRASE_KEYWORDS = [
  'design system', 'micro-frontend', 'ci/cd', 'feature flags', 'progressive rollouts',
  'monolith to microservices', 'platform engineering', 'team leadership',
  'international team', 'delivery transformation', 'engineering strategy',
];

export function extractKeywords(jd: string): string[] {
  const lower = jd.toLowerCase();
  const phrases = PHRASE_KEYWORDS.filter((p) => lower.includes(p));
  const words = lower
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  return Array.from(new Set([...phrases, ...words]));
}

export function scoreBullet(bullet: string, keywords: string[]): number {
  if (!bullet.trim()) return 0;
  const lower = bullet.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      // Multi-word keywords (phrase signals) count more.
      score += kw.includes(' ') || kw.includes('/') ? 2 : 1;
    }
  }
  return score;
}
