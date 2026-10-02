import type { ProjectIndex, RepoFile } from '@/types';

export interface AgentToolResult {
  success: boolean;
  data: unknown;
  message: string;
}

export class AgentTools {
  private index: ProjectIndex;
  private files: RepoFile[];

  constructor(index: ProjectIndex, files: RepoFile[]) {
    this.index = index;
    this.files = files;
  }

  listFiles(dir?: string): AgentToolResult {
    const prefix = dir ? (dir.endsWith('/') ? dir : dir + '/') : '';
    const files = this.index.files
      .filter((f) => !prefix || f.path.startsWith(prefix))
      .map((f) => ({ path: f.path, size: f.size, isBinary: f.isBinary }));
    return { success: true, data: files, message: `${files.length} files found` };
  }

  searchFiles(query: string): AgentToolResult {
    const queryLower = query.toLowerCase();
    const matches = this.index.files
      .filter((f) => {
        if (f.isBinary) return false;
        return (
          f.path.toLowerCase().includes(queryLower) ||
          f.keywords.some((k) => k.includes(queryLower))
        );
      })
      .map((f) => ({ path: f.path, keywords: f.keywords }));
    return { success: true, data: matches, message: `${matches.length} matches` };
  }

  getProjectStructure(): AgentToolResult {
    return { success: true, data: this.index.structure, message: 'Project structure' };
  }

  getFileInfo(path: string): AgentToolResult {
    const file = this.index.files.find((f) => f.path === path);
    if (!file) return { success: false, data: null, message: 'File not found' };
    return {
      success: true,
      data: { path: file.path, extension: file.extension, size: file.size, keywords: file.keywords, isBinary: file.isBinary, isConfig: file.isConfig },
      message: 'File info',
    };
  }

  getLanguageStats(): AgentToolResult {
    return { success: true, data: this.index.languages, message: 'Language stats' };
  }

  getFilesByExtension(ext: string): AgentToolResult {
    const files = this.index.files
      .filter((f) => f.extension === ext.toLowerCase().replace(/^\./, ''))
      .map((f) => f.path);
    return { success: true, data: files, message: `${files.length} .${ext} files` };
  }
}
