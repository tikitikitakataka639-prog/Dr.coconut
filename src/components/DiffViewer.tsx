import type { DiffResult, DiffLine } from '@/types';

interface DiffViewerProps {
  diff: DiffResult;
  path: string;
  changeType: 'modify' | 'create' | 'delete';
}

export function DiffViewer({ diff, path, changeType }: DiffViewerProps) {
  const typeColor =
    changeType === 'create'
      ? 'text-emerald-400'
      : changeType === 'delete'
      ? 'text-red-400'
      : 'text-amber-400';

  const typeLabel =
    changeType === 'create'
      ? 'CREATED'
      : changeType === 'delete'
      ? 'DELETED'
      : 'MODIFIED';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold ${typeColor}`}>{typeLabel}</span>
          <span className="text-sm font-mono text-zinc-300">{path}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-emerald-400">+{diff.additions}</span>
          <span className="text-red-400">-{diff.deletions}</span>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <pre className="text-xs font-mono leading-relaxed">
          {diff.hunks.map((hunk, hi) => (
            <div key={hi}>
              <div className="px-4 py-1 text-zinc-600 bg-zinc-800/50 text-[10px]">
                @@ -{hunk.oldStart} +{hunk.newStart} @@
              </div>
              {hunk.lines.map((line, li) => (
                <DiffLineRow key={li} line={line} />
              ))}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const bg =
    line.type === 'add'
      ? 'bg-emerald-950/30'
      : line.type === 'del'
      ? 'bg-red-950/30'
      : '';
  const color =
    line.type === 'add'
      ? 'text-emerald-300'
      : line.type === 'del'
      ? 'text-red-300'
      : 'text-zinc-400';
  const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';

  return (
    <div className={`flex ${bg}`}>
      <span className="w-10 flex-shrink-0 text-right pr-2 text-zinc-700 select-none">
        {line.oldNumber ?? ''}
      </span>
      <span className="w-10 flex-shrink-0 text-right pr-2 text-zinc-700 select-none border-r border-zinc-800/50">
        {line.newNumber ?? ''}
      </span>
      <span className={`pl-2 pr-4 ${color} whitespace-pre`}>
        {prefix}
        {line.content}
      </span>
    </div>
  );
}
