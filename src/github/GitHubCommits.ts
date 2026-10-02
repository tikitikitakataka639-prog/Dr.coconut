import { GITHUB_API, getStoredAuth, type StoredGitHubAuth } from './GitHubAuth';

export class GitHubCommits {
  private auth: StoredGitHubAuth;
  owner: string;
  repo: string;

  constructor(owner: string, repo: string, auth?: StoredGitHubAuth) {
    this.owner = owner;
    this.repo = repo;
    this.auth = auth ?? getStoredAuth()!;
    if (!this.auth) throw new Error('Not authenticated with GitHub');
  }

  async createBranch(fromBranch: string, newBranch: string): Promise<void> {
    const shaResp = await fetch(
      `${GITHUB_API}/repos/${this.owner}/${this.repo}/git/refs/heads/${fromBranch}`,
      { headers: this._headers() }
    );
    if (!shaResp.ok) throw new Error(`Failed to get ref: ${shaResp.status}`);
    const shaData = await shaResp.json();

    const resp = await fetch(
      `${GITHUB_API}/repos/${this.owner}/${this.repo}/git/refs`,
      {
        method: 'POST',
        headers: { ...this._headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: `refs/heads/${newBranch}`,
          sha: shaData.object.sha,
        }),
      }
    );
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Failed to create branch: ${resp.status} ${text}`);
    }
  }

  async pushFiles(
    files: Array<{ path: string; content: string; isNew: boolean }>,
    message: string,
    branch: string,
    getFileSha: (path: string, branch: string) => Promise<string | null>
  ): Promise<{ committed: number; created: number; modified: number }> {
    let created = 0;
    let modified = 0;

    for (const file of files) {
      const sha = await getFileSha(file.path, branch);
      if (file.isNew && !sha) created++;
      else modified++;

      const body: Record<string, unknown> = {
        message: `${message}`,
        content: btoa(unescape(encodeURIComponent(file.content))),
        branch,
      };
      if (sha) body.sha = sha;

      const resp = await fetch(
        `${GITHUB_API}/repos/${this.owner}/${this.repo}/contents/${file.path}`,
        {
          method: 'PUT',
          headers: { ...this._headers(), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to push ${file.path}: ${resp.status} ${text}`);
      }
    }

    return { committed: files.length, created, modified };
  }

  private _headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.auth.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }
}
