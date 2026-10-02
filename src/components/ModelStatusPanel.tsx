import { useState } from 'react';
import type { ModelStatus, ModelLoadProgress } from '@/types';
import type { ModelDiagnostics } from '@/ai/LlamaProvider';

interface ModelStatusPanelProps {
  status: ModelStatus;
  progress: ModelLoadProgress | null;
  error: string | null;
  diagnostics: ModelDiagnostics | null;
  onLoad: () => void;
  onClearCache?: () => void;
}

export function ModelStatusPanel({ status, progress, error, diagnostics, onLoad, onClearCache }: ModelStatusPanelProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const statusConfig = {
    not_loaded: { color: 'bg-zinc-500', text: 'NOT LOADED', glow: '' },
    loading: { color: 'bg-amber-500', text: 'LOADING', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.6)]' },
    ready: { color: 'bg-emerald-500', text: 'READY', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.6)]' },
    error: { color: 'bg-red-500', text: 'ERROR', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]' },
  };

  const cfg = statusConfig[status];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500">Model</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${cfg.color} ${cfg.glow} ${status === 'loading' ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-mono font-bold text-zinc-300">{cfg.text}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-zinc-200">Llama 3.2 1B</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-mono">Model Source</span>
          <span className="text-zinc-400 font-mono">Hugging Face</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 font-mono">Runtime</span>
          <span className="text-zinc-400 font-mono">WebGPU / WebLLM</span>
        </div>
      </div>

      {status === 'loading' && progress && (
        <div className="mt-4">
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300 rounded-full"
              style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] font-mono text-zinc-500 truncate">
            {progress.text}
          </p>
          <p className="text-[10px] font-mono text-zinc-600">
            {Math.round(progress.progress * 100)}% · {Math.round(progress.timeElapsed)}s
          </p>
        </div>
      )}

      {status === 'error' && error && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-red-950/30 border border-red-900/50 p-3">
            <p className="text-xs text-red-300 font-mono break-words whitespace-pre-line">{error}</p>
            {error.includes('WebGPU') && (
              <p className="mt-2 text-[10px] text-red-400/70 font-mono">
                Your browser does not support WebGPU. Try Chrome 113+ or Edge 113+.
              </p>
            )}
            {error.includes('Cannot reach Hugging Face') && (
              <p className="mt-2 text-[10px] text-red-400/70 font-mono">
                Check your internet connection, firewall, or browser extensions that may block requests.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onLoad}
              className="flex-1 py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-mono font-medium transition-colors"
            >
              Retry Load
            </button>
            {onClearCache && (
              <button
                onClick={onClearCache}
                className="py-2 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-mono font-medium transition-colors"
              >
                Clear Cache
              </button>
            )}
          </div>
          {diagnostics && (
            <div>
              <button
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
              </button>
              {showDiagnostics && (
                <div className="mt-2 rounded-lg bg-black/40 border border-zinc-800 p-3 space-y-1">
                  <DiagRow label="Model" value={diagnostics.model} />
                  <DiagRow label="Model ID" value={diagnostics.modelId} />
                  <DiagRow label="Model URL" value={diagnostics.modelUrl} />
                  <DiagRow label="Attempt" value={String(diagnostics.attempt)} />
                  <DiagRow label="Error Type" value={diagnostics.errorType} />
                  <DiagRow label="Error" value={diagnostics.errorMessage.slice(0, 100)} />
                  <DiagRow label="Browser" value={diagnostics.browser} />
                  <DiagRow label="WebGPU" value={diagnostics.webgpuAvailable ? 'Available' : 'Not available'} />
                  <DiagRow label="Connection" value={diagnostics.connectionAvailable ? 'Reachable' : 'Unreachable'} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {status === 'not_loaded' && (
        <button
          onClick={onLoad}
          className="mt-4 w-full py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-mono font-medium transition-colors"
        >
          Load Model
        </button>
      )}
    </div>
  );
}

function DiagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[10px] font-mono">
      <span className="text-zinc-600 w-20 flex-shrink-0">{label}</span>
      <span className="text-zinc-400 break-all">{value}</span>
    </div>
  );
}
