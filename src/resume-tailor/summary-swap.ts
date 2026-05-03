const LEAD_RE = /^Senior Engineering Leader specializing in [^.]+/;

export function swapLeadClause(baseline: string, jdFocus: string): string {
  if (!jdFocus.trim()) return baseline;
  const replacement = `Senior Engineering Leader specializing in ${jdFocus}`;
  return baseline.replace(LEAD_RE, replacement);
}
