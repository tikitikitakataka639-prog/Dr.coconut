import type { ProjectIndex, ChatMessage } from '@/types';
import { SearchEngine } from '@/project/SearchEngine';
import { FileManager } from '@/project/FileManager';

const MAX_CONTEXT_CHARS = 8000;
const MAX_FILE_CHARS = 2000;

export interface SelectedContext {
  files: Array<{ path: string; content: string; reason: string }>;
  totalChars: number;
}

export class ContextManager {
  private searchEngine: SearchEngine;
  private fileManager: FileManager;

  constructor(fileManager: FileManager) {
    this.searchEngine = new SearchEngine();
    this.fileManager = fileManager;
  }

  async selectContext(index: ProjectIndex, prompt: string): Promise<SelectedContext> {
    const relevantPaths = this.searchEngine.getRelevantFiles(index, prompt, 6);
    const files: Array<{ path: string; content: string; reason: string }> = [];
    let totalChars = 0;

    for (const path of relevantPaths) {
      if (totalChars >= MAX_CONTEXT_CHARS) break;

      try {
        let content = await this.fileManager.readFile(path);
        if (content === '[Binary file - not readable]') continue;

        if (content.length > MAX_FILE_CHARS) {
          content = content.slice(0, MAX_FILE_CHARS) + '\n... [truncated]';
        }

        const searchResults = this.searchEngine.searchByPrompt(index, prompt);
        const match = searchResults.find((r) => r.path === path);
        const reason = match?.reason ?? 'relevant file';

        files.push({ path, content, reason });
        totalChars += content.length;
      } catch {
        // skip files that fail to read
      }
    }

    return { files, totalChars };
  }

  buildSystemPrompt(index: ProjectIndex, context: SelectedContext): string {
    const fileList = index.files
      .filter((f) => !f.isBinary)
      .map((f) => f.path)
      .slice(0, 100)
      .join('\n');

    const fileContents = context.files
      .map((f) => `--- FILE: ${f.path} ---\n${f.content}`)
      .join('\n\n');

    return `You are Dr. Coconut, an AI code agent that modifies files in GitHub repositories.

You have access to the following project files:
${fileList}

Here are the contents of the most relevant files:
${fileContents}

Project languages: ${JSON.stringify(index.languages)}

When asked to make changes, you MUST respond in the following JSON format ONLY:

\`\`\`json
{
  "analysis": "Brief explanation of what needs to be changed and why",
  "changes": [
    {
      "type": "modify",
      "path": "path/to/file.ext",
      "content": "the complete new file content"
    },
    {
      "type": "create",
      "path": "path/to/new-file.ext",
      "content": "the complete file content"
    },
    {
      "type": "delete",
      "path": "path/to/file-to-delete.ext"
    }
  ]
}
\`\`\`

IMPORTANT RULES:
- Output ONLY the JSON block, nothing before or after it.
- For "modify", provide the COMPLETE new file content, not just the changed lines.
- For "create", provide the complete file content.
- For "delete", only the path is needed.
- Make real, functional code changes that address the user's request.
- Keep changes focused and minimal.
- Do not include binary files.
- Do not invent file paths that don't exist unless creating new files.`;
  }

  buildUserPrompt(prompt: string): string {
    return `User request: ${prompt}\n\nAnalyze the relevant files and generate the necessary changes. Output only the JSON changes block.`;
  }

  buildMessages(
    index: ProjectIndex,
    context: SelectedContext,
    prompt: string
  ): ChatMessage[] {
    return [
      { role: 'system', content: this.buildSystemPrompt(index, context) },
      { role: 'user', content: this.buildUserPrompt(prompt) },
    ];
  }
}
