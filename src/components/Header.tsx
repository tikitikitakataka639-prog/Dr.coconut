import { Atom } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-900/30">
              <Atom className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Dr. Coconut</h1>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">AI Code Agent</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-xs font-mono text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              WebGPU Powered
            </span>
            <span>Llama 3.2 1B</span>
          </div>
        </div>
      </div>
    </header>
  );
}
