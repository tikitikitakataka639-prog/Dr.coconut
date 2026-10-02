import { GitHubRepository } from '@/github/GitHubRepository';

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp',
  'mp4', 'webm', 'avi', 'mov', 'mp3', 'wav', 'ogg', 'flac',
  'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
  'exe', 'dll', 'so', 'dylib', 'bin',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'gguf', 'mlc', 'onnx', 'pt', 'pth', 'safetensors',
  'wasm', 'node', 'o', 'a',
]);

const MAX_FILE_SIZE = 100_000;

export class FileManager {
  private repo: GitHubRepository;
  private branch: string;
  private cache: Map<string, string> = new Map();

  constructor(repo: GitHubRepository, branch: string) {
    this.repo = repo;
    this.branch = branch;
  }

  async readFile(path: string): Promise<string> {
    if (this.cache.has(path)) return this.cache.get(path)!;

    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (BINARY_EXTENSIONS.has(ext)) {
      return '[Binary file - not readable]';
    }

    const content = await this.repo.getFileContent(path, this.branch);
    if (content.length <= MAX_FILE_SIZE) {
      this.cache.set(path, content);
    }
    return content;
  }

  async readFiles(paths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const promises = paths.map(async (path) => {
      const content = await this.readFile(path);
      results.set(path, content);
    });
    await Promise.all(promises);
    return results;
  }

  isBinary(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    return BINARY_EXTENSIONS.has(ext);
  }

  isTooLarge(size: number): boolean {
    return size > MAX_FILE_SIZE;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
