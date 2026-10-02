import type { IndexedFile, ProjectIndex, TreeNode, RepoFile } from '@/types';

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff',
  'mp4', 'webm', 'avi', 'mov', 'mp3', 'wav', 'ogg', 'flac',
  'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
  'exe', 'dll', 'so', 'dylib', 'bin',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'gguf', 'mlc', 'bin', 'onnx', 'pt', 'pth', 'safetensors',
  'wasm', 'node', 'o', 'a',
]);

const CONFIG_FILES = new Set([
  'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js',
  'tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js',
  '.eslintrc', 'eslint.config.js', '.babelrc', 'babel.config.js',
  'webpack.config.js', 'rollup.config.js', '.env', '.gitignore',
  'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'next.config.js', 'next.config.mjs', 'nuxt.config.js',
  'Cargo.toml', 'Cargo.lock', 'go.mod', 'go.sum',
  'pyproject.toml', 'requirements.txt', 'setup.py',
  'index.html', 'robots.txt', 'manifest.json',
]);

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'less',
  'json', 'yaml', 'yml', 'md', 'txt', 'xml', 'toml',
  'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp',
  'php', 'sh', 'bash', 'sql', 'graphql', 'gql',
  'vue', 'svelte', 'astro',
]);

const KEYWORD_PATTERNS: Array<{ pattern: RegExp; keyword: string }> = [
  { pattern: /\bwebllm\b/i, keyword: 'webllm' },
  { pattern: /\bwebgpu\b/i, keyword: 'webgpu' },
  { pattern: /\bmlc\b/i, keyword: 'mlc' },
  { pattern: /\bllama\b/i, keyword: 'llama' },
  { pattern: /\bmodel\b/i, keyword: 'model' },
  { pattern: /\bworker\b/i, keyword: 'worker' },
  { pattern: /\breact\b/i, keyword: 'react' },
  { pattern: /\bvite\b/i, keyword: 'vite' },
  { pattern: /\bsupabase\b/i, keyword: 'supabase' },
  { pattern: /\berror\b/i, keyword: 'error' },
  { pattern: /\bload\b/i, keyword: 'load' },
  { pattern: /\binit\b/i, keyword: 'init' },
  { pattern: /\bconfig\b/i, keyword: 'config' },
  { pattern: /\brouter\b/i, keyword: 'router' },
  { pattern: /\bcomponent\b/i, keyword: 'component' },
  { pattern: /\bimport\b/i, keyword: 'import' },
  { pattern: /\bexport\b/i, keyword: 'export' },
  { pattern: /\bfetch\b/i, keyword: 'fetch' },
  { pattern: /\basync\b/i, keyword: 'async' },
  { pattern: /\bfunction\b/i, keyword: 'function' },
];

export class ProjectIndexer {
  indexProject(files: RepoFile[]): ProjectIndex {
    const indexed: IndexedFile[] = [];
    const languages: Record<string, number> = {};
    let totalSize = 0;

    for (const file of files) {
      if (file.type !== 'file') continue;
      const ext = this.getExtension(file.path);
      const isBinary = BINARY_EXTENSIONS.has(ext);
      const isConfig = CONFIG_FILES.has(file.path.toLowerCase().split('/').pop() ?? '');
      const size = file.size ?? 0;
      totalSize += size;

      if (!isBinary) {
        const lang = this.getLanguage(ext);
        if (lang) {
          languages[lang] = (languages[lang] ?? 0) + 1;
        }
      }

      indexed.push({
        path: file.path,
        extension: ext,
        size,
        keywords: [],
        isBinary,
        isConfig,
      });
    }

    const structure = this.buildTree(files);

    return {
      files: indexed,
      totalFiles: indexed.length,
      totalSize,
      languages,
      structure,
    };
  }

  enrichWithContent(indexed: IndexedFile[], contents: Map<string, string>): void {
    for (const file of indexed) {
      if (file.isBinary) continue;
      const content = contents.get(file.path);
      if (!content) continue;

      const foundKeywords = new Set<string>();
      for (const { pattern, keyword } of KEYWORD_PATTERNS) {
        if (pattern.test(content)) {
          foundKeywords.add(keyword);
        }
      }
      file.keywords = Array.from(foundKeywords);
    }
  }

  private getExtension(path: string): string {
    const parts = path.split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1].toLowerCase();
  }

  private getLanguage(ext: string): string | null {
    const map: Record<string, string> = {
      js: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
      html: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON',
      py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust',
      java: 'Java', c: 'C', cpp: 'C++', php: 'PHP',
      sh: 'Shell', md: 'Markdown', yaml: 'YAML', yml: 'YAML',
      vue: 'Vue', svelte: 'Svelte',
    };
    return map[ext] ?? null;
  }

  private buildTree(files: RepoFile[]): TreeNode {
    const root: TreeNode = { name: '/', path: '', type: 'dir', children: [] };

    for (const file of files) {
      const parts = file.path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const path = parts.slice(0, i + 1).join('/');

        if (isLast) {
          if (!current.children) current.children = [];
          current.children.push({
            name: part,
            path,
            type: file.type === 'file' ? 'file' : 'dir',
          });
        } else {
          if (!current.children) current.children = [];
          let dir = current.children.find(
            (c) => c.type === 'dir' && c.name === part
          );
          if (!dir) {
            dir = { name: part, path, type: 'dir', children: [] };
            current.children.push(dir);
          }
          current = dir;
        }
      }
    }

    this.sortTree(root);
    return root;
  }

  private sortTree(node: TreeNode): void {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      this.sortTree(child);
    }
  }
}
