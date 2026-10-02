import type {
  AIProvider,
  AICompletionRequest,
  ProjectIndex,
  FileChange,
  AgentPhase,
  AgentLogEntry,
  ChatMessage,
} from '@/types';
import { GitHubRepository } from '@/github/GitHubRepository';
import { FileManager } from '@/project/FileManager';
import { ProjectIndexer } from '@/project/ProjectIndexer';
import { ContextManager, type SelectedContext } from './ContextManager';
import { AgentTools } from './AgentTools';
import { DiffEngine } from '@/changes/DiffEngine';
import { ChangeSet } from '@/changes/ChangeSet';

export interface AgentRunResult {
  changes: FileChange[];
  analysis: string;
  context: SelectedContext;
  logs: AgentLogEntry[];
}

interface AgentConfig {
  provider: AIProvider;
  repo: GitHubRepository;
  branch: string;
}

export class AgentController {
  private provider: AIProvider;
  private repo: GitHubRepository;
  private branch: string;
  private fileManager: FileManager;
  private indexer: ProjectIndexer;
  private contextManager: ContextManager;
  private diffEngine: DiffEngine;
  private logs: AgentLogEntry[] = [];
  private phase: AgentPhase = 'idle';

  constructor(config: AgentConfig) {
    this.provider = config.provider;
    this.repo = config.repo;
    this.branch = config.branch;
    this.fileManager = new FileManager(this.repo, this.branch);
    this.indexer = new ProjectIndexer();
    this.contextManager = new ContextManager(this.fileManager);
    this.diffEngine = new DiffEngine();
  }

  getPhase(): AgentPhase {
    return this.phase;
  }

  getLogs(): AgentLogEntry[] {
    return this.logs;
  }

  private log(phase: AgentPhase, message: string): void {
    this.phase = phase;
    const entry: AgentLogEntry = { phase, message, timestamp: Date.now() };
    this.logs.push(entry);
  }

  async buildIndex(files: import('@/types').RepoFile[]): Promise<ProjectIndex> {
    this.log('analyzing', 'Analyzing repository structure...');
    const index = this.indexer.indexProject(files);

    // Read small text files to enrich with keywords
    const textFiles = files.filter((f) => {
      const ext = f.path.split('.').pop()?.toLowerCase() ?? '';
      const isBinary = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'zip', 'gguf', 'mlc', 'wasm', 'bin'].includes(ext);
      return !isBinary && (f.size ?? 0) < 20000;
    });

    const contentsToEnrich = new Map<string, string>();
    const batchSize = 15;
    for (let i = 0; i < textFiles.length; i += batchSize) {
      const batch = textFiles.slice(i, i + batchSize);
      try {
        const contents = await this.fileManager.readFiles(batch.map((f) => f.path));
        for (const [path, content] of contents) {
          contentsToEnrich.set(path, content);
        }
      } catch {
        // skip batch on error
      }
    }

    this.indexer.enrichWithContent(index.files, contentsToEnrich);
    this.log('analyzing', `Indexed ${index.totalFiles} files, ${Object.keys(index.languages).length} languages detected`);

    return index;
  }

  async run(index: ProjectIndex, prompt: string): Promise<AgentRunResult> {
    this.logs = [];
    this.phase = 'idle';

    if (!this.provider.isReady()) {
      this.log('error', 'Model is not loaded');
      throw new Error('Model is not loaded');
    }

    // Phase 1: Searching files
    this.log('searching', 'Searching for relevant files...');

    // Use agent tools for analysis
    const tools = new AgentTools(index, []);
    const _structure = tools.getProjectStructure();
    const _langStats = tools.getLanguageStats();

    // Phase 2: Select context intelligently
    this.log('searching', 'Selecting intelligent context...');
    const context = await this.contextManager.selectContext(index, prompt);
    this.log('reading', `Reading ${context.files.length} relevant files (${context.totalChars} chars)...`);

    for (const file of context.files) {
      this.log('reading', `  → ${file.path} (${file.reason})`);
    }

    // Phase 3: Generate changes via AI
    this.log('generating', 'Generating modifications with Llama 3.2 1B...');

    const messages = this.contextManager.buildMessages(index, context, prompt);
    const completionReq: AICompletionRequest = {
      messages,
      maxTokens: 1024,
      temperature: 0.3,
    };

    const response = await this.provider.complete(completionReq);
    const rawContent = response.content;

    // Parse the AI response
    const parsed = this.parseChangesResponse(rawContent);
    if (!parsed) {
      this.log('error', 'Failed to parse AI response as changes JSON');
      this.log('error', `Raw response: ${rawContent.slice(0, 500)}`);
      throw new Error('AI did not return valid changes. Please try a more specific prompt.');
    }

    // Build file changes with diffs
    const changes: FileChange[] = [];
    const changeSet = new ChangeSet();

    for (const change of parsed.changes) {
      let oldContent: string | null = null;

      if (change.type === 'modify') {
        try {
          oldContent = await this.fileManager.readFile(change.path);
        } catch {
          oldContent = null;
        }
      }

      const newContent = change.content ?? null;

      const diff = this.diffEngine.computeDiff(oldContent, newContent);

      const fileChange: FileChange = {
        type: change.type,
        path: change.path,
        oldContent,
        newContent,
        diff,
      };

      changes.push(fileChange);
      changeSet.addChange(fileChange);
    }

    this.log('changes_ready', `${changes.length} file changes prepared`);
    for (const change of changes) {
      const action = change.type === 'create' ? 'CREATING' : change.type === 'delete' ? 'DELETING' : 'MODIFYING';
      this.log('changes_ready', `  ${action} ${change.path} (+${change.diff.additions} -${change.diff.deletions})`);
    }

    return {
      changes,
      analysis: parsed.analysis,
      context,
      logs: this.logs,
    };
  }

  private parseChangesResponse(content: string): {
    analysis: string;
    changes: Array<{ type: 'modify' | 'create' | 'delete'; path: string; content?: string }>;
  } | null {
    // Extract JSON from response (may be wrapped in ```json blocks)
    let jsonStr = content.trim();

    // Try to extract from code block
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Find the JSON object
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd = jsonStr.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;

    jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);

    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.changes || !Array.isArray(parsed.changes)) return null;

      const validChanges = parsed.changes.filter(
        (c: { type?: string; path?: string }) =>
          c &&
          typeof c.path === 'string' &&
          typeof c.type === 'string' &&
          ['modify', 'create', 'delete'].includes(c.type)
      );

      if (validChanges.length === 0) return null;

      return {
        analysis: parsed.analysis ?? 'No analysis provided',
        changes: validChanges.map((c: { type: 'modify' | 'create' | 'delete'; path: string; content?: string }) => ({
          type: c.type,
          path: c.path,
          content: c.content,
        })),
      };
    } catch {
      return null;
    }
  }

  async applyChanges(
    changes: FileChange[],
    commitMessage: string
  ): Promise<{ committed: number; created: number; modified: number }> {
    this.log('applying', `Applying ${changes.length} changes to GitHub...`);

    let created = 0;
    let modified = 0;

    for (const change of changes) {
      if (change.type === 'delete') {
        const sha = await this.repo.getFileSha(change.path, this.branch);
        if (sha) {
          await this.repo.deleteFile(change.path, commitMessage, this.branch, sha);
        }
      } else {
        const content = change.newContent ?? '';
        const sha = await this.repo.getFileSha(change.path, this.branch);
        if (!sha) created++;
        else modified++;
        await this.repo.createOrUpdateFile(change.path, content, commitMessage, this.branch, sha ?? undefined);
      }
      this.log('applying', `  ✓ ${change.type === 'create' ? 'Created' : change.type === 'delete' ? 'Deleted' : 'Modified'} ${change.path}`);
    }

    this.log('applied', `${changes.length} files committed: ${created} created, ${modified} modified`);
    return { committed: changes.length, created, modified };
  }
}
