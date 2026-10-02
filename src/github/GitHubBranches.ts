import { GITHUB_API, getStoredAuth, type StoredGitHubAuth } from './GitHubAuth';
import type { RepoBranch } from '@/types';

export class GitHubBranches {
  private auth: StoredGitHubAuth;
  owner: string;
  repo: string;

  constructor(owner: string, repo: string, auth?: StoredGitHubAuth) {
    this.owner = owner;
    this.repo = repo;
    this.auth = auth ?? getStoredAuth()!;
    if (!this.auth) throw new Error('Not authenticated with GitHub');
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.auth.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async listBranches(): Promise<RepoBranch[]> {
    const branches: RepoBranch[] = [];
    let page = 1;
    while (true) {
      const resp = await fetch(
        `${GITHUB_API}/repos/${this.owner}/${this.repo}/branches?per_page=100&page=${page}`,
        { headers: this.headers() }
      );
      if (!resp.ok) throw new Error(`Failed to list branches: ${resp.status}`);
      const data = await resp.json();
      if (data.length === 0) break;
      for (const b of data) {
        branches.push({
          name: b.name,
          commitSha: b.commit?.sha ?? '',
          protected: b.protected ?? false,
        });
      }
      if (data.length < 100) break;
      page++;
    }
    return branches;
  }
}
