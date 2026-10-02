import type { TreeNode } from '@/types';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { useState } from 'react';

interface FileTreeProps {
  tree: TreeNode;
  selectedPath?: string;
  onSelect?: (path: string) => void;
}

export function FileTree({ tree, selectedPath, onSelect }: FileTreeProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 max-h-[400px] overflow-y-auto">
      <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">Project Files</h3>
      <div className="space-y-0.5">
        {tree.children?.map((child) => (
          <TreeItem key={child.path} node={child} depth={0} selectedPath={selectedPath} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedPath?: string;
  onSelect?: (path: string) => void;
}

function TreeItem({ node, depth, selectedPath, onSelect }: TreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 w-full text-left py-0.5 hover:bg-zinc-800/50 rounded px-1"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-zinc-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-zinc-500 flex-shrink-0" />
          )}
          <Folder className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
          <span className="text-xs font-mono text-zinc-300 truncate">{node.name}</span>
        </button>
        {expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect?.(node.path)}
      className={`flex items-center gap-1 w-full text-left py-0.5 hover:bg-zinc-800/50 rounded px-1 ${
        selectedPath === node.path ? 'bg-zinc-800 text-teal-400' : ''
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <File className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
      <span className="text-xs font-mono text-zinc-400 truncate">{node.name}</span>
    </button>
  );
}
