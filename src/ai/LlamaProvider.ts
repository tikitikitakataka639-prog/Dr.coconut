import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  ModelInfo,
  ModelLoadProgress,
  ModelStatus,
} from '@/types';

const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
const MODEL_URL = 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC';

const OLD_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC-1k';

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

const MODEL_INFO: ModelInfo = {
  id: 'llama-3.2-1b',
  name: 'Llama 3.2 1B',
  source: 'Hugging Face',
  modelId: 'mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC',
};

type ErrorType = 'network' | 'cache' | 'webgpu' | 'config' | 'unknown';

export interface ModelDiagnostics {
  model: string;
  modelId: string;
  modelUrl: string;
  attempt: number;
  errorType: ErrorType;
  errorMessage: string;
  browser: string;
  webgpuAvailable: boolean;
  connectionAvailable: boolean;
}

function classifyError(err: unknown): ErrorType {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes('cache.add') || msg.includes('cache') && msg.includes('network')) return 'cache';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) return 'network';
  if (msg.includes('webgpu') || msg.includes('gpu') || msg.includes('adapter')) return 'webgpu';
  if (msg.includes('model record') || msg.includes('model_id') || msg.includes('appconfig')) return 'config';
  return 'unknown';
}

function errorTypeMessage(type: ErrorType): string {
  switch (type) {
    case 'network': return 'Network error while downloading model files.';
    case 'cache': return 'Cache storage error during model download.';
    case 'webgpu': return 'WebGPU is not available in this browser.';
    case 'config': return 'Model configuration error — model ID not found.';
    default: return 'Unexpected error during model loading.';
  }
}

function isTransientError(type: ErrorType): boolean {
  return type === 'network' || type === 'cache' || type === 'unknown';
}

export class LlamaProvider implements AIProvider {
  readonly info = MODEL_INFO;
  private status: ModelStatus = 'not_loaded';
  private error: string | null = null;
  private engine: unknown = null;
  private diagnostics: ModelDiagnostics | null = null;

  isReady(): boolean {
    return this.status === 'ready' && this.engine !== null;
  }

  getStatus(): ModelStatus {
    return this.status;
  }

  getError(): string | null {
    return this.error;
  }

  getDiagnostics(): ModelDiagnostics | null {
    return this.diagnostics;
  }

  private async checkConnectivity(): Promise<boolean> {
    try {
      const resp = await fetch(MODEL_URL, { method: 'HEAD', mode: 'no-cors', cache: 'no-cache' });
      return resp.type === 'opaque' || resp.ok;
    } catch {
      return false;
    }
  }

  private detectWebGPU(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  async load(onProgress?: (p: ModelLoadProgress) => void): Promise<void> {
    this.status = 'loading';
    this.error = null;
    this.diagnostics = null;

    try {
      const webllm = await import('@mlc-ai/web-llm');

      // Validate model ID exists in prebuilt config
      const prebuiltConfig = (webllm as unknown as { prebuiltAppConfig: { model_list: Array<{ model_id: string }> } }).prebuiltAppConfig;
      if (prebuiltConfig) {
        const found = prebuiltConfig.model_list.find((m) => m.model_id === MODEL_ID);
        if (!found) {
          throw new Error(
            `Model ID "${MODEL_ID}" not found in WebLLM prebuilt config. ` +
            `Available: ${prebuiltConfig.model_list.slice(0, 5).map((m) => m.model_id).join(', ')}...`
          );
        }
      }

      // Migrate stale cache from old incorrect model ID
      this.migrateOldCache();

      // Check connectivity before attempting download
      onProgress?.({ progress: 0, text: 'Checking connection to Hugging Face...', timeElapsed: 0 });
      const connectionOk = await this.checkConnectivity();

      if (!connectionOk) {
        this.status = 'error';
        this.error = 'Cannot reach Hugging Face. Check your internet connection or browser/network restrictions.';
        this.diagnostics = this.buildDiagnostics(0, 'network', this.error, false);
        return;
      }

      // Attempt load with retry
      let lastError: unknown = null;
      let lastErrorType: ErrorType = 'unknown';

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        onProgress?.({
          progress: 0,
          text: attempt === 1
            ? 'Connecting to model source...'
            : `Retrying (attempt ${attempt}/${MAX_RETRIES})...`,
          timeElapsed: 0,
        });

        try {
          const engine = await webllm.CreateMLCEngine(
            MODEL_ID,
            {
              initProgressCallback: (report: { progress: number; text: string; timeElapsed?: number }) => {
                onProgress?.({
                  progress: report.progress,
                  text: report.text,
                  timeElapsed: report.timeElapsed ?? 0,
                });
              },
            }
          );
          this.engine = engine;
          this.status = 'ready';
          this.diagnostics = null;
          return;
        } catch (err) {
          lastError = err;
          lastErrorType = classifyError(err);

          // Config errors are not transient — don't retry
          if (!isTransientError(lastErrorType)) {
            break;
          }

          // If more retries remain, wait with exponential backoff
          if (attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            onProgress?.({
              progress: 0,
              text: `${errorTypeMessage(lastErrorType)} Retrying in ${delay / 1000}s...`,
              timeElapsed: 0,
            });
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }

      // All retries exhausted
      this.status = 'error';
      const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
      this.error = `${errorTypeMessage(lastErrorType)} (${MAX_RETRIES} attempts failed.)\n${errorMsg}`;
      this.diagnostics = this.buildDiagnostics(MAX_RETRIES, lastErrorType, errorMsg, true);
      this.engine = null;
    } catch (err) {
      this.status = 'error';
      this.error = err instanceof Error ? err.message : String(err);
      const type = classifyError(err);
      this.diagnostics = this.buildDiagnostics(0, type, this.error, await this.checkConnectivity());
      this.engine = null;
    }
  }

  private buildDiagnostics(
    attempt: number,
    errorType: ErrorType,
    errorMessage: string,
    connectionAvailable: boolean
  ): ModelDiagnostics {
    return {
      model: 'Llama 3.2 1B',
      modelId: MODEL_ID,
      modelUrl: MODEL_URL,
      attempt,
      errorType,
      errorMessage,
      browser: navigator.userAgent.split(') ')[0]?.split('(').pop() ?? navigator.userAgent.slice(0, 60),
      webgpuAvailable: this.detectWebGPU(),
      connectionAvailable,
    };
  }

  private migrateOldCache(): void {
    try {
      const dbNames = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
      dbNames.then((dbs) => {
        for (const db of dbs) {
          if (db.name && db.name.includes(OLD_MODEL_ID)) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }).catch(() => {
        // Not all browsers support indexedDB.databases()
      });

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.includes(OLD_MODEL_ID)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Storage access may be blocked
    }
  }

  async clearModelCache(): Promise<void> {
    try {
      // Clear WebLLM Cache API entries
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          if (key.includes(MODEL_ID) || key.includes('webllm') || key.includes('mlc')) {
            await caches.delete(key);
          }
        }
      }

      // Clear IndexedDB entries for this model
      const dbList = indexedDB.databases ? await indexedDB.databases() : [];
      for (const db of dbList) {
        if (db.name && (db.name.includes(MODEL_ID) || db.name.includes('webllm'))) {
          indexedDB.deleteDatabase(db.name);
        }
      }

      // Clear localStorage entries
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.includes(MODEL_ID) || key.includes('webllm'))) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.isReady() || !this.engine) {
      throw new Error('Model is not loaded');
    }

    const engine = this.engine as {
      chat: {
        completion: {
          create: (
            req: {
              stream: boolean;
              messages: Array<{ role: string; content: string }>;
              max_tokens?: number;
              temperature?: number;
            },
            callbacks: {
              stream?: (chunk: { delta: { content: string } }) => void;
              streamEnd?: (final: { usage?: { prompt_tokens: number; completion_tokens: number } }) => void;
            }
          ) => Promise<void>;
        };
      };
    };

    let content = '';
    let usage: { prompt_tokens: number; completion_tokens: number } | undefined;

    await engine.chat.completion.create(
      {
        stream: true,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: req.maxTokens ?? 512,
        temperature: req.temperature ?? 0.7,
      },
      {
        stream: (chunk: { delta: { content: string } }) => {
          content += chunk.delta.content;
        },
        streamEnd: (final: { usage?: { prompt_tokens: number; completion_tokens: number } }) => {
          usage = final.usage;
        },
      }
    );

    return { content, usage };
  }

  async unload(): Promise<void> {
    if (this.engine) {
      try {
        const engine = this.engine as { unload: () => Promise<void> };
        await engine.unload();
      } catch {
        // ignore
      }
      this.engine = null;
    }
    this.status = 'not_loaded';
  }
}
