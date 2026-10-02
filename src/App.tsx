import { useState, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { ModelStatusPanel } from '@/components/ModelStatusPanel';
import { RepoConnectPanel } from '@/components/RepoConnectPanel';
import { PromptPanel } from '@/components/PromptPanel';
import { ChangesPanel } from '@/components/ChangesPanel';
import { FileTree } from '@/components/FileTree';
import { LlamaProvider, type ModelDiagnostics } from '@/ai/LlamaProvider';
import { AgentController, type AgentRunResult } from '@/agent/AgentController';
import {
  parseGithubUrl,
  getStoredAuth,
  initiateDeviceFlow,
  pollForToken,
  type DeviceCodeResponse,
  type StoredGitHubAuth,
} from '@/github/GitHubAuth';
import { GitHubRepository } from '@/github/GitHubRepository';
import { GitHubBranches } from '@/github/GitHubBranches';
import type {
  ModelStatus,
  ModelLoadProgress,
  AgentPhase,
  AgentLogEntry,
  FileChange,
  ProjectIndex,
  GitHubRepoInfo,
  RepoBranch,
  RepoFile,
  TreeNode,
} from '@/types';

// GitHub OAuth App Client ID — users replace with their own
const GITHUB_CLIENT_ID = 'Ov23li0zFHepxQOIqYI4';

export default function App() {
  // Model state
  const [modelStatus, setModelStatus] = useState<ModelStatus>('not_loaded');
  const [loadProgress, setLoadProgress] = useState<ModelLoadProgress | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelDiagnostics, setModelDiagnostics] = useState<ModelDiagnostics | null>(null);
  const providerRef = useRef<LlamaProvider | null>(null);

  // GitHub state
  const [repoUrl, setRepoUrl] = useState('');
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null);
  const [branches, setBranches] = useState<RepoBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [connected, setConnected] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const authRef = useRef<StoredGitHubAuth | null>(null);
  const repoRef = useRef<GitHubRepository | null>(null);

  // Project state
  const [projectIndex, setProjectIndex] = useState<ProjectIndex | null>(null);
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);

  // Agent state
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [commitResult, setCommitResult] = useState<{ committed: number; created: number; modified: number } | null>(null);
  const agentRef = useRef<AgentController | null>(null);

  const getProvider = useCallback(() => {
    if (!providerRef.current) {
      providerRef.current = new LlamaProvider();
    }
    return providerRef.current;
  }, []);

  const handleLoadModel = useCallback(async () => {
    const provider = getProvider();
    setModelStatus('loading');
    setModelError(null);
    setModelDiagnostics(null);

    await provider.load((progress) => {
      setLoadProgress(progress);
    });

    setModelStatus(provider.getStatus());
    if (provider.getStatus() === 'error') {
      setModelError(provider.getError());
      setModelDiagnostics(provider.getDiagnostics());
    }
  }, [getProvider]);

  const handleClearCache = useCallback(async () => {
    const provider = getProvider();
    await provider.clearModelCache();
    setModelStatus('not_loaded');
    setModelError(null);
    setModelDiagnostics(null);
    setLoadProgress(null);
  }, [getProvider]);

  const handleConnectRepo = useCallback(async (url: string) => {
    setRepoError(null);
    const parsed = parseGithubUrl(url);
    if (!parsed) {
      setRepoError('Invalid GitHub URL. Use https://github.com/user/repository');
      return;
    }

    setRepoUrl(url);

    // Check if we already have auth
    let auth = getStoredAuth();
    if (!auth) {
      setAuthRequired(true);
      return;
    }

    authRef.current = auth;
    setAuthRequired(false);
    await connectToRepo(parsed.owner, parsed.repo, auth);
  }, []);

  const connectToRepo = async (owner: string, repo: string, auth: StoredGitHubAuth) => {
    try {
      setRepoError(null);
      const ghRepo = new GitHubRepository(owner, repo, auth);
      repoRef.current = ghRepo;

      const info = await ghRepo.getRepoInfo();
      setRepoInfo(info);

      const ghBranches = new GitHubBranches(owner, repo, auth);
      const branchList = await ghBranches.listBranches();
      setBranches(branchList);
      setSelectedBranch(info.defaultBranch);

      // Get file tree
      const files = await ghRepo.getTree(info.defaultBranch);
      setRepoFiles(files);

      // Build index
      const agent = new AgentController({
        provider: getProvider(),
        repo: ghRepo,
        branch: info.defaultBranch,
      });
      agentRef.current = agent;

      const index = await agent.buildIndex(files);
      setProjectIndex(index);
      setConnected(true);
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to connect to repository');
      setConnected(false);
    }
  };

  const handleAuthorize = useCallback(async () => {
    setRepoError(null);
    try {
      const deviceCode: DeviceCodeResponse = await initiateDeviceFlow(GITHUB_CLIENT_ID);
      setAuthUrl(deviceCode.verificationUri);

      // Open the verification page
      window.open(deviceCode.verificationUri, '_blank');

      // Start polling
      const auth = await pollForToken(
        GITHUB_CLIENT_ID,
        deviceCode.deviceCode,
        deviceCode.intervalSec,
        deviceCode.expiresAt
      );

      authRef.current = auth;
      setAuthRequired(false);
      setAuthUrl(null);

      // Now connect to the repo
      const parsed = parseGithubUrl(repoUrl);
      if (parsed) {
        await connectToRepo(parsed.owner, parsed.repo, auth);
      }
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Authorization failed');
    }
  }, [repoUrl]);

  const handleSelectBranch = useCallback(async (branch: string) => {
    setSelectedBranch(branch);
    if (!repoRef.current) return;

    try {
      const files = await repoRef.current.getTree(branch);
      setRepoFiles(files);

      const agent = new AgentController({
        provider: getProvider(),
        repo: repoRef.current,
        branch,
      });
      agentRef.current = agent;

      const index = await agent.buildIndex(files);
      setProjectIndex(index);
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to load branch');
    }
  }, [getProvider]);

  const handleRunAgent = useCallback(async (prompt: string) => {
    if (!agentRef.current || !projectIndex) return;
    if (!getProvider().isReady()) return;

    setAgentPhase('analyzing');
    setAgentLogs([]);
    setAnalysis(null);
    setChanges([]);
    setApplied(false);
    setCommitResult(null);

    try {
      const result: AgentRunResult = await agentRef.current.run(projectIndex, prompt);
      setAgentLogs(result.logs);
      setAgentPhase(result.logs[result.logs.length - 1]?.phase ?? 'idle');
      setAnalysis(result.analysis);
      setChanges(result.changes);
    } catch (err) {
      const errorLogs = agentRef.current.getLogs();
      setAgentLogs(errorLogs);
      setAgentPhase('error');
      setAnalysis(err instanceof Error ? err.message : 'Agent failed');
    }
  }, [projectIndex, getProvider]);

  const handleApplyChanges = useCallback(async () => {
    if (!agentRef.current || changes.length === 0) return;

    setApplying(true);
    setAgentPhase('applying');

    try {
      const result = await agentRef.current.applyChanges(changes, 'Dr. Coconut changes');
      setCommitResult(result);
      setApplied(true);
      setAgentPhase('applied');
    } catch (err) {
      setAnalysis(err instanceof Error ? err.message : 'Failed to apply changes');
      setAgentPhase('error');
    } finally {
      setApplying(false);
    }
  }, [changes]);

  const handleRejectChanges = useCallback(() => {
    setChanges([]);
    setAnalysis(null);
    setAgentPhase('idle');
    setAgentLogs([]);
  }, []);

  const handleCommit = useCallback(async (message: string) => {
    if (!repoRef.current || changes.length === 0) return;

    setApplying(true);
    try {
      const result = await agentRef.current!.applyChanges(changes, message);
      setCommitResult(result);
      setApplied(true);
    } catch (err) {
      setAnalysis(err instanceof Error ? err.message : 'Failed to commit');
    } finally {
      setApplying(false);
    }
  }, [changes]);

  const emptyTree: TreeNode = { name: '', path: '', type: 'dir', children: [] };
  const isModelReady = modelStatus === 'ready';
  const canRunAgent = isModelReady && connected && !applied;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar — Model + Repo status */}
          <div className="space-y-4">
            <ModelStatusPanel
              status={modelStatus}
              progress={loadProgress}
              error={modelError}
              diagnostics={modelDiagnostics}
              onLoad={handleLoadModel}
              onClearCache={handleClearCache}
            />
            <RepoConnectPanel
              onConnect={handleConnectRepo}
              onAuthorize={handleAuthorize}
              connected={connected}
              repoInfo={repoInfo}
              branches={branches}
              selectedBranch={selectedBranch}
              onSelectBranch={handleSelectBranch}
              authRequired={authRequired}
              authUrl={authUrl}
              error={repoError}
            />
            {connected && projectIndex && (
              <FileTree tree={projectIndex.structure} />
            )}
          </div>

          {/* Center — Prompt + Agent output */}
          <div className="lg:col-span-2 space-y-4">
            <PromptPanel
              onRun={handleRunAgent}
              phase={agentPhase}
              disabled={!canRunAgent}
              logs={agentLogs}
              analysis={analysis}
            />

            {changes.length > 0 && (
              <ChangesPanel
                changes={changes}
                onApply={handleApplyChanges}
                onReject={handleRejectChanges}
                onCommit={handleCommit}
                applied={applied}
                applying={applying}
                commitResult={commitResult}
              />
            )}

            {!connected && !authRequired && (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
                <p className="text-sm font-mono text-zinc-600">
                  Connect a GitHub repository to begin
                </p>
              </div>
            )}

            {connected && !isModelReady && (
              <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4">
                <p className="text-sm font-mono text-amber-400">
                  Load the Llama 3.2 1B model to start running the agent
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
