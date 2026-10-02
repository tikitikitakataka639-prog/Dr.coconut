import type { IndexedFile, ProjectIndex } from '@/types';

export interface SearchResult {
  path: string;
  score: number;
  reason: string;
}

export class SearchEngine {
  searchByPrompt(index: ProjectIndex, prompt: string): SearchResult[] {
    const promptLower = prompt.toLowerCase();
    const promptWords = this.tokenize(promptLower);
    const results: SearchResult[] = [];

    for (const file of index.files) {
      if (file.isBinary) continue;

      let score = 0;
      const reasons: string[] = [];

      // Match keywords from content analysis
      for (const keyword of file.keywords) {
        if (promptLower.includes(keyword)) {
          score += 10;
          reasons.push(`keyword: ${keyword}`);
        }
      }

      // Match prompt words in file path
      const pathLower = file.path.toLowerCase();
      for (const word of promptWords) {
        if (word.length < 3) continue;
        if (pathLower.includes(word)) {
          score += 5;
          reasons.push(`path contains: ${word}`);
        }
      }

      // Config files are often relevant
      if (file.isConfig) {
        if (promptLower.includes('config') || promptLower.includes('setup') ||
            promptLower.includes('install') || promptLower.includes('error')) {
          score += 3;
          reasons.push('config file');
        }
      }

      // Match file extension to prompt context
      if (promptLower.includes('css') && file.extension === 'css') {
        score += 4;
        reasons.push('CSS file');
      }
      if (promptLower.includes('html') && file.extension === 'html') {
        score += 4;
        reasons.push('HTML file');
      }
      if ((promptLower.includes('component') || promptLower.includes('ui')) &&
          ['jsx', 'tsx'].includes(file.extension)) {
        score += 4;
        reasons.push('component file');
      }

      // Error-related keywords
      if (promptLower.includes('error') || promptLower.includes('bug') ||
          promptLower.includes('fix') || promptLower.includes('broken')) {
        if (file.keywords.includes('error') || file.keywords.includes('load')) {
          score += 5;
          reasons.push('error-related');
        }
      }

      if (score > 0) {
        results.push({ path: file.path, score, reason: reasons.join(', ') });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  searchByKeywords(index: ProjectIndex, keywords: string[]): SearchResult[] {
    const results: SearchResult[] = [];

    for (const file of index.files) {
      if (file.isBinary) continue;

      let score = 0;
      const reasons: string[] = [];

      for (const keyword of keywords) {
        const kwLower = keyword.toLowerCase();
        if (file.keywords.includes(kwLower)) {
          score += 8;
          reasons.push(`keyword match: ${keyword}`);
        }
        if (file.path.toLowerCase().includes(kwLower)) {
          score += 4;
          reasons.push(`path match: ${keyword}`);
        }
      }

      if (score > 0) {
        results.push({ path: file.path, score, reason: reasons.join(', ') });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  getRelevantFiles(index: ProjectIndex, prompt: string, maxFiles = 8): string[] {
    const results = this.searchByPrompt(index, prompt);
    const selected = results.slice(0, maxFiles).map((r) => r.path);

    // Always include package.json if it exists
    const pkgJson = index.files.find((f) => f.path === 'package.json');
    if (pkgJson && !selected.includes('package.json')) {
      selected.push('package.json');
    }

    return selected;
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }
}
