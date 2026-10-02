export type ModelStatus = 'not_loaded' | 'loading' | 'ready' | 'error';

export interface ModelInfo {
  id: string;
  name: string;
  source: string;
  modelId: string;
}

export interface ModelLoadProgress {
  progress: number;
  text: string;
  timeElapsed: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface AIProvider {
  readonly info: ModelInfo;
  isReady(): boolean;
  getStatus(): ModelStatus;
  load(onProgress?: (p: ModelLoadProgress) => void): Promise<void>;
  complete(req: AICompletionRequest): Promise<AICompletionResponse>;
  unload(): Promise<void>;
  clearModelCache(): Promise<void>;
}

export interface RepoFile {
  path: string;
  type: 'file' | 'dir';
  size?: number;
  content?: string;
  encoding?: string;
}

export interface RepoBranch {
  name: string;
  commitSha: string;
  protected: boolean;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  private: boolean;
}

export interface GitHubToken {
  token: string;
  scope: string;
}

export type ChangeType = 'modify' | 'create' | 'delete';

export interface FileChange {
  type: ChangeType;
  path: string;
  oldContent: string | null;
  newContent: string | null;
  diff: DiffResult;
}

export interface DiffResult {
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'del' | 'context';
  oldNumber: number | null;
  newNumber: number | null;
  content: string;
}

export type AgentPhase =
  | 'idle'
  | 'analyzing'
  | 'searching'
  | 'reading'
  | 'generating'
  | 'changes_ready'
  | 'applying'
  | 'applied'
  | 'error';

export interface AgentLogEntry {
  phase: AgentPhase;
  message: string;
  timestamp: number;
}

export interface IndexedFile {
  path: string;
  extension: string;
  size: number;
  keywords: string[];
  isBinary: boolean;
  isConfig: boolean;
}

export interface ProjectIndex {
  files: IndexedFile[];
  totalFiles: number;
  totalSize: number;
  languages: Record<string, number>;
  structure: TreeNode;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}
