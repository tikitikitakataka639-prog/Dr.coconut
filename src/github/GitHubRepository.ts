import { GITHUB_API, getStoredAuth, type StoredGitHubAuth } from './GitHubAuth';
import type { GitHubRepoInfo, RepoFile } from '@/types';

export class GitHubRepository {
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

  async getRepoInfo(): Promise<GitHubRepoInfo> {
    const resp = await fetch(`${GITHUB_API}/repos/${this.owner}/${this.repo}`, {
      headers: this.headers(),
    });
    if (!resp.ok) {
      if (resp.status === 404) throw new Error('Repository not found or you lack access.');
      throw new Error(`GitHub API error: ${resp.status}`);
    }
    const data = await resp.json();
    return {
      owner: data.owner.login,
      repo: data.name,
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      private: data.private,
    };
  }

  async getTree(branch: string): Promise<RepoFile[]> {
    const resp = await fetch(
      `${GITHUB_API}/repos/${this.owner}/${this.repo}/git/trees/${branch}?recursive=1`,
      { headers: this.headers() }
    );
    if (!resp.ok) throw new Error(`Failed to get tree: ${resp.status}`);
    const data = await resp.json();
    return (data.tree as Array<{ path: string; type: string; size?: number }>)
      .filter((item) => item.type === 'blob')
      .map((item) => ({
        path: item.path,
        type: 'file' as const,
        size: item.size,
      }));
  }

  async getFileContent(path: string, branch: string): Promise<string> {
    const resp = await fetch(
      `${GITHUB_API}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`,
      { headers: this.headers() }
    );
    if (!resp.ok) throw new Error(`Failed to read ${path}: ${resp.status}`);
    const data = await resp.json();
    if (data.encoding === 'base64' && data.content) {
      return atob(data.content.replace(/\n/g, ''));
    }
    return data.content ?? '';
  }

  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
  ): Promise<void> {
    const body: Record<string, unknown> = {
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch,
    };
    if (sha) body.sha = sha;

    const resp = await fetch(
      `${GITHUB_API}/repos/${this.owner}/${this.repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to write ${path}: ${resp.status} ${text}`);
    }
  }

  async deleteFile(path: string, message: string, branch: string, sha: string): Promise<void> {
    const resp = await fetch(
      `${GITHUB_API}/repos/${this.owner}/${this.repo}/contents/${path}`,
      {
        method: 'DELETE',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sha, branch }),
      }
    );
    if (!resp.ok) throw new Error(`Failed to delete ${path}: ${resp.status}`);
  }

  async getFileSha(path: string, branch: string): Promise<string | null> {
    const resp = await fetch(
      `${GITHUB_API}/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`,
      { headers: this.headers() }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.sha ?? null;
  }
}
