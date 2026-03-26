export interface SkillItem {
  slug: string;
  displayName: string;
  summary: string;
  downloads: number;
  installs: number;
  stars: number;
  version: string | null;
  updatedAt: number;
  owner: {
    handle: string;
    displayName: string;
    image: string | null;
  } | null;
}

export interface SkillDetail extends SkillItem {
  readme: string | null;
  changelog: string | null;
  license: string | null;
  versions: number;
  stats: {
    comments: number;
    downloads: number;
    installsAllTime: number;
    installsCurrent: number;
    stars: number;
    versions: number;
  };
}
