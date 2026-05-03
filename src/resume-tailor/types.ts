export type PageCount = number & { readonly __brand: 'PageCount' };

export type ResumeAST = {
  frontmatter: { template_version: number; canonical_version: string };
  header: { name: string; tagline: string; contact: string };
  summary: string;
  keyAccomplishments: KeyAccomplishment[];
  skills: string[];
  roles: Role[];
  education: { degrees: string; school: string };
};

export type KeyAccomplishment = {
  label: string;
  description: string;
  impact: string;
};

export type Role = {
  title: string;
  company: string;
  meta: string;
  subRoles?: SubRole[];
  bullets: Bullet[];
};

export type SubRole = {
  label: string;
  bullets: Bullet[];
};

export type Bullet = {
  text: string;
  impact: string;
};
