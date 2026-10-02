import type { DiffResult, DiffHunk, DiffLine } from '@/types';

export class DiffEngine {
  computeDiff(oldContent: string | null, newContent: string | null): DiffResult {
    if (oldContent === null && newContent === null) {
      return { hunks: [], additions: 0, deletions: 0 };
    }

    if (oldContent === null) {
      // New file - all additions
      const lines = (newContent ?? '').split('\n');
      const hunk: DiffHunk = {
        oldStart: 0,
        newStart: 1,
        lines: lines.map((content, i) => ({
          type: 'add' as const,
          oldNumber: null,
          newNumber: i + 1,
          content,
        })),
      };
      return { hunks: [hunk], additions: lines.length, deletions: 0 };
    }

    if (newContent === null) {
      // Deleted file - all deletions
      const lines = oldContent.split('\n');
      const hunk: DiffHunk = {
        oldStart: 1,
        newStart: 0,
        lines: lines.map((content, i) => ({
          type: 'del' as const,
          oldNumber: i + 1,
          newNumber: null,
          content,
        })),
      };
      return { hunks: [hunk], additions: 0, deletions: lines.length };
    }

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diffLines = this.lcsDiff(oldLines, newLines);

    const hunks = this.groupIntoHunks(diffLines);
    const additions = diffLines.filter((l) => l.type === 'add').length;
    const deletions = diffLines.filter((l) => l.type === 'del').length;

    return { hunks, additions, deletions };
  }

  private lcsDiff(oldLines: string[], newLines: string[]): DiffLine[] {
    const m = oldLines.length;
    const n = newLines.length;

    // Use Myers-like diff with limited memory for large files
    if (m + n > 5000) {
      return this.simpleDiff(oldLines, newLines);
    }

    // Build LCS table
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to build diff
    const result: DiffLine[] = [];
    let i = m;
    let j = n;
    let oldNum = m;
    let newNum = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        result.unshift({
          type: 'context',
          oldNumber: oldNum,
          newNumber: newNum,
          content: oldLines[i - 1],
        });
        i--;
        j--;
        oldNum--;
        newNum--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.unshift({
          type: 'add',
          oldNumber: null,
          newNumber: newNum,
          content: newLines[j - 1],
        });
        j--;
        newNum--;
      } else {
        result.unshift({
          type: 'del',
          oldNumber: oldNum,
          newNumber: null,
          content: oldLines[i - 1],
        });
        i--;
        oldNum--;
      }
    }

    return result;
  }

  private simpleDiff(oldLines: string[], newLines: string[]): DiffLine[] {
    // Fallback: show everything as removed then added
    const result: DiffLine[] = [];
    for (let i = 0; i < oldLines.length; i++) {
      result.push({ type: 'del', oldNumber: i + 1, newNumber: null, content: oldLines[i] });
    }
    for (let j = 0; j < newLines.length; j++) {
      result.push({ type: 'add', oldNumber: null, newNumber: j + 1, content: newLines[j] });
    }
    return result;
  }

  private groupIntoHunks(lines: DiffLine[]): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffLine[] = [];
    let currentOldStart = 0;
    let currentNewStart = 0;
    let contextCount = 0;

    for (const line of lines) {
      if (line.type === 'context') {
        if (currentHunk.length > 0 && contextCount >= 3) {
          // Flush current hunk if we have enough context after changes
          hunks.push({
            oldStart: currentOldStart,
            newStart: currentNewStart,
            lines: currentHunk,
          });
          currentHunk = [];
        }
        if (currentHunk.length === 0) {
          currentOldStart = line.oldNumber ?? 0;
          currentNewStart = line.newNumber ?? 0;
        }
        currentHunk.push(line);
        contextCount++;
      } else {
        if (currentHunk.length === 0) {
          currentOldStart = line.oldNumber ?? (currentOldStart + 1);
          currentNewStart = line.newNumber ?? (currentNewStart + 1);
        }
        currentHunk.push(line);
        contextCount = 0;
      }
    }

    if (currentHunk.length > 0) {
      const hasChanges = currentHunk.some((l) => l.type !== 'context');
      if (hasChanges) {
        hunks.push({
          oldStart: currentOldStart,
          newStart: currentNewStart,
          lines: currentHunk,
        });
      }
    }

    return hunks;
  }

  formatDiffAsText(diff: DiffResult): string {
    let output = '';
    for (const hunk of diff.hunks) {
      output += `@@ -${hunk.oldStart},0 +${hunk.newStart},0 @@\n`;
      for (const line of hunk.lines) {
        const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
        output += `${prefix}${line.content}\n`;
      }
    }
    return output;
  }
}
