import { useState } from 'react';
import { Github } from 'lucide-react';

interface RepoConnectPanelProps {
  onConnect: (url: string) => void;
  onAuthorize: () => void;
  connected: boolean;
  repoInfo: { owner: string; repo: string; fullName: string; defaultBranch: string } | null;
  branches: { name: string; protected: boolean }[];
  selectedBranch: string;
  onSelectBranch: (branch: string) => void;
  authRequired: boolean;
  authUrl: string | null;
  error: string | null;
}

export function RepoConnectPanel({
  onConnect,
  onAuthorize,
  connected,
  repoInfo,
  branches,
  selectedBranch,
  onSelectBranch,
  authRequired,
  authUrl,
  error,
}: RepoConnectPanelProps) {
  const [url, setUrl] = useState('');

  if (connected && repoInfo) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">Repository</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Github className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-mono text-zinc-200">{repoInfo.fullName}</span>
            <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          </div>
          <div>
            <label className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-teal-500 transition-colors"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                  {b.protected ? ' (protected)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">GitHub Authorization</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Dr. Coconut needs access to your repository. Authorize via GitHub Device Flow — no token pasting required.
        </p>
        <button
          onClick={onAuthorize}
          className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-mono font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Github className="w-4 h-4" />
          Authorize with GitHub
        </button>
        {authUrl && (
          <div className="mt-4 rounded-lg bg-zinc-800/50 border border-zinc-700 p-3">
            <p className="text-xs text-zinc-400 font-mono mb-1">Open this URL and enter the code:</p>
            <p className="text-sm text-teal-400 font-mono break-all">{authUrl}</p>
          </div>
        )}
        {error && (
          <p className="mt-3 text-xs text-red-400 font-mono">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">Repository</h3>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && url && onConnect(url)}
        placeholder="https://github.com/user/repository"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
      />
      <button
        onClick={() => url && onConnect(url)}
        disabled={!url}
        className="mt-3 w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-mono font-medium transition-colors"
      >
        Connect Repository
      </button>
      {error && (
        <p className="mt-3 text-xs text-red-400 font-mono">{error}</p>
      )}
    </div>
  );
}
