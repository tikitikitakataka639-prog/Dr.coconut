import { useState } from 'react';
import { Check, X, GitCommit, Loader2 } from 'lucide-react';
import type { FileChange } from '@/types';
import { DiffViewer } from './DiffViewer';

interface ChangesPanelProps {
  changes: FileChange[];
  onApply: () => void;
  onReject: () => void;
  onCommit: (message: string) => void;
  applied: boolean;
  applying: boolean;
  commitResult: { committed: number; created: number; modified: number } | null;
}

export function ChangesPanel({
  changes,
  onApply,
  onReject,
  onCommit,
  applied,
  applying,
  commitResult,
}: ChangesPanelProps) {
  const [showCommit, setShowCommit] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());

  const toggleDiff = (path: string) => {
    setExpandedDiffs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (applied && commitResult) {
    return (
      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Check className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-mono font-bold text-emerald-400 uppercase tracking-widest">Changes Applied</h3>
        </div>
        <div className="space-y-2 mb-4">
          {commitResult.modified > 0 && (
            <div className="flex items-center gap-2 text-sm font-mono text-zinc-300">
              <Check className="w-4 h-4 text-emerald-400" />
              {commitResult.modified} file{commitResult.modified !== 1 ? 's' : ''} modified
            </div>
          )}
          {commitResult.created > 0 && (
            <div className="flex items-center gap-2 text-sm font-mono text-zinc-300">
              <Check className="w-4 h-4 text-emerald-400" />
              {commitResult.created} file{commitResult.created !== 1 ? 's' : ''} created
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCommit(!showCommit)}
          className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-mono font-medium transition-colors flex items-center justify-center gap-2"
        >
          <GitCommit className="w-4 h-4" />
          Commit & Push
        </button>
        {showCommit && (
          <div className="mt-3 space-y-3">
            <input
              type="text"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Commit message..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-teal-500"
            />
            <button
              onClick={() => commitMsg && onCommit(commitMsg)}
              disabled={!commitMsg || applying}
              className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-mono font-medium transition-colors flex items-center justify-center gap-2"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <GitCommit className="w-4 h-4" />
                  Commit & Push
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500">Proposed Changes</h3>
        <span className="text-xs font-mono text-zinc-400">{changes.length} files</span>
      </div>

      <div className="space-y-2 mb-4">
        {changes.map((change) => (
          <div key={change.path}>
            <button
              onClick={() => toggleDiff(change.path)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    change.type === 'create'
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : change.type === 'delete'
                      ? 'bg-red-900/50 text-red-400'
                      : 'bg-amber-900/50 text-amber-400'
                  }`}
                >
                  {change.type === 'create' ? 'CREATE' : change.type === 'delete' ? 'DELETE' : 'MODIFY'}
                </span>
                <span className="text-sm font-mono text-zinc-300">{change.path}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-emerald-400">+{change.diff.additions}</span>
                <span className="text-red-400">-{change.diff.deletions}</span>
              </div>
            </button>
            {expandedDiffs.has(change.path) && (
              <div className="mt-2">
                <DiffViewer diff={change.diff} path={change.path} changeType={change.type} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onApply}
          className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-mono font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          Apply Changes
        </button>
        <button
          onClick={onReject}
          className="flex-1 py-2.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-mono font-medium transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Reject
        </button>
      </div>
    </div>
  );
}
