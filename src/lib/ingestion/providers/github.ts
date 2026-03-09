/**
 * GitHub native ingestion adapter
 * Scans repos, issues, PRs, and commits to extract dev patterns.
 */

import { saveMemory } from '@/lib/memory/service';
import { IngestResult } from '../engine';
import { getIntegrationToken } from './utils';

const GITHUB_API = 'https://api.github.com';

async function githubGet(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${path}`);
  return res.json();
}

interface GHRepo {
  name: string;
  full_name: string;
  language: string | null;
  pushed_at: string;
  stargazers_count: number;
  fork: boolean;
  private: boolean;
}

interface GHIssue {
  number: number;
  title: string;
  state: string;
  created_at: string;
  user: { login: string };
  pull_request?: unknown;
}

interface GHCommit {
  sha: string;
  commit: { author: { name: string; date: string }; message: string };
  author: { login: string } | null;
}

export async function scanGitHub(userId: string, scope: 'quick' | 'full'): Promise<IngestResult> {
  const startMs = Date.now();

  const token = await getIntegrationToken(userId, 'github');
  if (!token) throw new Error('GitHub integration not connected or missing access token');

  // Fetch repos
  const repos = await githubGet(token, '/user/repos?sort=pushed&per_page=20&affiliation=owner,collaborator') as GHRepo[];
  const ownRepos = repos.filter(r => !r.fork);

  // Language distribution
  const langFreq: Record<string, number> = {};
  for (const repo of repos) {
    if (repo.language) langFreq[repo.language] = (langFreq[repo.language] ?? 0) + 1;
  }
  const languages = Object.entries(langFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `${lang}(${count})`);

  // Fetch recent issues/PRs from top repos
  const topRepos = ownRepos.slice(0, scope === 'quick' ? 3 : 5);
  const collaborators: Record<string, number> = {};
  let totalIssues = 0;
  let totalPRs = 0;
  const activeProjects: string[] = [];

  for (const repo of topRepos) {
    try {
      const issues = await githubGet(token, `/repos/${repo.full_name}/issues?state=all&per_page=20&sort=updated`) as GHIssue[];
      for (const issue of issues) {
        if (issue.pull_request) {
          totalPRs++;
        } else {
          totalIssues++;
        }
        if (issue.user?.login) {
          collaborators[issue.user.login] = (collaborators[issue.user.login] ?? 0) + 1;
        }
      }
      if (issues.length > 0) activeProjects.push(repo.name);
    } catch {
      // skip repos we can't access
    }

    // Recent commits for commit frequency
    try {
      const commits = await githubGet(token, `/repos/${repo.full_name}/commits?per_page=10`) as GHCommit[];
      for (const commit of commits) {
        const login = commit.author?.login;
        if (login) collaborators[login] = (collaborators[login] ?? 0) + 1;
      }
    } catch {
      // skip
    }
  }

  // Top collaborators (excluding the user's own commits — will show up but that's ok)
  const topCollaborators = Object.entries(collaborators)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([login, count]) => ({ name: login, frequency: count }));

  const rawContext = [
    `GitHub: ${repos.length} repos (${ownRepos.length} owned, ${repos.length - ownRepos.length} collaborating)`,
    languages.length > 0 ? `Languages: ${languages.join(', ')}` : '',
    `Active projects: ${activeProjects.join(', ')}`,
    `Scanned ${topRepos.length} repos: ${totalIssues} issues, ${totalPRs} PRs`,
    topCollaborators.length > 0 ? `Top collaborators: ${topCollaborators.slice(0, 5).map(c => c.name).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const result: IngestResult = {
    provider: 'github',
    scannedAt: new Date().toISOString(),
    scope,
    insights: {
      contacts: topCollaborators,
      topics: activeProjects,
      rawContext,
    },
    metadata: {
      itemsScanned: repos.length + totalIssues + totalPRs,
      timeMs: Date.now() - startMs,
    },
  };

  // Persist to memory
  const entries: Array<{ key: string; value: string; category: 'contact' | 'context' | 'schedule' | 'preference'; importance: number }> = [];

  if (languages.length > 0) {
    entries.push({ key: 'github_languages', value: languages.join(', '), category: 'context', importance: 4 });
  }
  if (activeProjects.length > 0) {
    entries.push({ key: 'github_active_projects', value: activeProjects.join(', '), category: 'context', importance: 4 });
  }
  if (topCollaborators.length > 0) {
    entries.push({ key: 'github_collaborators', value: topCollaborators.map(c => c.name).join(', '), category: 'contact', importance: 3 });
  }

  await Promise.all(
    entries.map(e => saveMemory(userId, e.key, e.value, { category: e.category, source: 'scan', importance: e.importance }))
  );

  return result;
}
