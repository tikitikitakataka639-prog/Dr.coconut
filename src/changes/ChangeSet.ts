import type { FileChange } from '@/types';

export class ChangeSet {
  private changes: FileChange[] = [];

  addChange(change: FileChange): void {
    // Replace if already exists
    const idx = this.changes.findIndex((c) => c.path === change.path);
    if (idx >= 0) {
      this.changes[idx] = change;
    } else {
      this.changes.push(change);
    }
  }

  removeChange(path: string): void {
    this.changes = this.changes.filter((c) => c.path !== path);
  }

  getChanges(): FileChange[] {
    return [...this.changes];
  }

  getChange(path: string): FileChange | undefined {
    return this.changes.find((c) => c.path === path);
  }

  clear(): void {
    this.changes = [];
  }

  getSummary(): { modified: number; created: number; deleted: number; total: number } {
    return {
      modified: this.changes.filter((c) => c.type === 'modify').length,
      created: this.changes.filter((c) => c.type === 'create').length,
      deleted: this.changes.filter((c) => c.type === 'delete').length,
      total: this.changes.length,
    };
  }

  isEmpty(): boolean {
    return this.changes.length === 0;
  }
}
