const GITHUB_API = 'https://api.github.com';

export interface StoredGitHubAuth {
  token: string;
  scope: string;
  username: string;
  expiresAt: number;
}

const STORAGE_KEY = 'drcoconut_github_auth';

function getRedirectUri(): string {
  return window.location.origin + window.location.pathname;
}

export function getStoredAuth(): StoredGitHubAuth | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGitHubAuth;
    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeAuth(auth: StoredGitHubAuth): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = trimmed.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  intervalSec: number;
}

export async function initiateDeviceFlow(clientId: string): Promise<DeviceCodeResponse> {
  const resp = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: 'repo',
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub device code request failed: ${text}`);
  }

  const data = await resp.json();
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresAt: Date.now() + data.expires_in * 1000,
    intervalSec: data.interval ?? 5,
  };
}

export async function pollForToken(
  clientId: string,
  deviceCode: string,
  intervalSec: number,
  expiresAt: number
): Promise<StoredGitHubAuth> {
  while (Date.now() < expiresAt) {
    await new Promise((r) => setTimeout(r, intervalSec * 1000));

    const resp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const data = await resp.json();

    if (data.error) {
      if (data.error === 'authorization_pending') continue;
      if (data.error === 'slow_down') {
        intervalSec += 5;
        continue;
      }
      if (data.error === 'expired_token') {
        throw new Error('The device code expired. Please try again.');
      }
      if (data.error === 'access_denied') {
        throw new Error('Authorization was denied. Please try again.');
      }
      throw new Error(data.error_description || data.error);
    }

    if (data.access_token) {
      // Get username
      const userResp = await fetch(`${GITHUB_API}/user`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const user = await userResp.json();

      const auth: StoredGitHubAuth = {
        token: data.access_token,
        scope: data.scope || 'repo',
        username: user.login || 'unknown',
        expiresAt: Date.now() + 3600 * 1000,
      };
      storeAuth(auth);
      return auth;
    }
  }

  throw new Error('Device code expired before authorization was completed.');
}

export { GITHUB_API };
