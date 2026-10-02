import type { AIProvider } from '@/types';

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly info: { id: string; name: string; source: string; modelId: string };
  protected status: import('@/types').ModelStatus = 'not_loaded';
  protected loadError: string | null = null;

  isReady(): boolean {
    return this.status === 'ready';
  }

  getStatus(): import('@/types').ModelStatus {
    return this.status;
  }

  getError(): string | null {
    return this.loadError;
  }

  abstract load(
    onProgress?: (p: import('@/types').ModelLoadProgress) => void
  ): Promise<void>;
  abstract complete(
    req: import('@/types').AICompletionRequest
  ): Promise<import('@/types').AICompletionResponse>;
  abstract unload(): Promise<void>;
  abstract clearModelCache(): Promise<void>;
}
