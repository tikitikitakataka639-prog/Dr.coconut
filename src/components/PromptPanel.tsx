import { useState, useRef, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';
import type { AgentPhase } from '@/types';

interface PromptPanelProps {
  onRun: (prompt: string) => void;
  phase: AgentPhase;
  disabled: boolean;
  logs: Array<{ phase: AgentPhase; message: string; timestamp: number }>;
  analysis: string | null;
}

export function PromptPanel({ onRun, phase, disabled, logs, analysis }: PromptPanelProps) {
  const [prompt, setPrompt] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const isRunning = ['analyzing', 'searching', 'reading', 'generating', 'applying'].includes(phase);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = () => {
    if (!prompt.trim() || disabled || isRunning) return;
    onRun(prompt.trim());
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-4">Prompt</h3>
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          placeholder="Describe what you want to modify..."
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors resize-none"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || isRunning || !prompt.trim()}
        className="mt-3 w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-mono font-medium transition-colors flex items-center justify-center gap-2"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Running Agent...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Run Agent
          </>
        )}
      </button>

      {(logs.length > 0 || analysis) && (
        <div className="mt-4 space-y-3">
          {logs.length > 0 && (
            <div className="rounded-lg bg-black/40 border border-zinc-800 p-3 max-h-[300px] overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <span className="text-[10px] font-mono text-zinc-700 select-none mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                  <span className={`text-xs font-mono ${getPhaseColor(log.phase)}`}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
          {analysis && (
            <div className="rounded-lg bg-teal-950/20 border border-teal-900/40 p-3">
              <p className="text-xs font-mono text-teal-400 uppercase tracking-wider mb-1">Analysis</p>
              <p className="text-sm text-zinc-300">{analysis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getPhaseColor(phase: AgentPhase): string {
  switch (phase) {
    case 'analyzing': return 'text-sky-400';
    case 'searching': return 'text-violet-400';
    case 'reading': return 'text-amber-400';
    case 'generating': return 'text-teal-400';
    case 'changes_ready': return 'text-emerald-400';
    case 'applying': return 'text-orange-400';
    case 'applied': return 'text-emerald-400';
    case 'error': return 'text-red-400';
    default: return 'text-zinc-400';
  }
}
