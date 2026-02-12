// tldr ::: lightweight JSON-backed index for waymark IDs and file metadata

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { InternalError, NotFoundError, Result } from "./errors.ts";

/** Source categories for IDs tracked in the index. */
export type WaymarkIdSourceType = "cli" | "mcp" | "api" | "manual";

/** Stored metadata for a single waymark ID. */
export type IdIndexEntry = {
  id: string;
  file: string;
  line: number;
  type: string;
  content: string;
  contentHash: string;
  contextHash: string;
  source?: string;
  sourceType?: WaymarkIdSourceType;
  updatedAt: number;
};

/** Stored metadata for a scanned file. */
export type FileIndexEntry = {
  hash?: string | null;
  lastSeen: string;
};

/** Serialized index payload stored on disk. */
export type IdIndexData = {
  version: number;
  ids: Record<string, IdIndexEntry>;
  files: Record<string, FileIndexEntry>;
  metadata: {
    lastRefreshed?: string;
  };
};

const DEFAULT_INDEX: IdIndexData = {
  version: 1,
  ids: {},
  files: {},
  metadata: {},
};

/** Options for configuring the JSON index location and history. */
export type JsonIdIndexOptions = {
  workspaceRoot: string;
  trackHistory?: boolean;
};

/** Historic entry recorded when an ID is removed. */
export interface HistoryEntry extends IdIndexEntry {
  removedAt: string;
  removedBy?: string;
  reason?: string;
}

/** JSON-backed index for waymark IDs and file metadata. */
export class JsonIdIndex {
  private readonly indexPath: string;
  private readonly historyPath: string;
  private readonly trackHistory: boolean;
  private data: IdIndexData = {
    ...DEFAULT_INDEX,
    ids: {},
    files: {},
    metadata: {},
  };
  private history: HistoryEntry[] = [];
  private loaded = false;

  constructor(options: JsonIdIndexOptions) {
    const workspaceRoot = options.workspaceRoot;
    this.indexPath = join(workspaceRoot, ".waymark", "index.json");
    this.historyPath = join(workspaceRoot, ".waymark", "history.json");
    this.trackHistory = options.trackHistory ?? false;
  }

  /**
   * Load index and history from disk once per instance.
   * @returns Promise that resolves when the index is initialized.
   * @throws Re-throws InternalError if index or history files are corrupted.
   */
  async init(): Promise<void> {
    if (this.loaded) {
      return;
    }
    await this.ensureDirectory();

    const indexResult = await this.readIndex();
    if (indexResult.isErr()) {
      throw indexResult.error;
    }
    this.data = indexResult.value;

    if (this.trackHistory) {
      const historyResult = await this.readHistory();
      if (historyResult.isErr()) {
        throw historyResult.error;
      }
      this.history = historyResult.value;
    }

    this.loaded = true;
  }

  /**
   * Check whether a waymark ID exists in the index.
   * @param id - Waymark ID to check.
   * @returns True if the ID exists.
   */
  async has(id: string): Promise<boolean> {
    await this.init();
    return Boolean(this.data.ids[id]);
  }

  /**
   * Fetch a waymark ID entry, if present.
   * @param id - Waymark ID to fetch.
   * @returns Matching entry or null.
   */
  async get(id: string): Promise<IdIndexEntry | null> {
    await this.init();
    return this.data.ids[id] ?? null;
  }

  /**
   * Insert or replace a waymark ID entry.
   * @param entry - Entry to persist.
   * @returns Promise that resolves when saved.
   */
  async set(entry: IdIndexEntry): Promise<void> {
    await this.init();
    this.data.ids[entry.id] = entry;
    await this.save();
  }

  /**
   * Update an existing entry via an updater function.
   * @param id - Waymark ID to update.
   * @param updater - Function to transform the existing entry.
   * @returns Result indicating success or a not-found error.
   */
  async update(
    id: string,
    updater: (entry: IdIndexEntry) => IdIndexEntry
  ): Promise<Result<void, NotFoundError>> {
    await this.init();
    const current = this.data.ids[id];
    if (!current) {
      return Result.err(NotFoundError.create("waymark-id", id));
    }
    this.data.ids[id] = updater(current);
    await this.save();
    return Result.ok();
  }

  /**
   * Remove an entry and optionally record it in history.
   * @param id - Waymark ID to remove.
   * @param history - Optional history fields to record with removal.
   * @returns Promise that resolves when saved.
   */
  async delete(
    id: string,
    history?: Partial<Omit<HistoryEntry, "removedAt">>
  ): Promise<void> {
    await this.init();
    const existing = this.data.ids[id];
    if (!existing) {
      return;
    }
    delete this.data.ids[id];
    if (this.trackHistory && existing) {
      const entry: HistoryEntry = {
        ...existing,
        removedAt: new Date().toISOString(),
        ...(history ?? {}),
      };
      this.history.push(entry);
      await this.saveHistory();
    }
    await this.save();
  }

  /**
   * Record a file hash and last-seen timestamp.
   * @param filePath - File path to update.
   * @param hash - Optional content hash.
   * @returns Promise that resolves when saved.
   */
  async touchFile(filePath: string, hash?: string | null): Promise<void> {
    await this.init();
    this.data.files[filePath] = {
      hash: hash ?? null,
      lastSeen: new Date().toISOString(),
    };
    await this.save();
  }

  /**
   * Remove file metadata from the index.
   * @param filePath - File path to remove.
   * @returns Promise that resolves when saved.
   */
  async removeFile(filePath: string): Promise<void> {
    await this.init();
    delete this.data.files[filePath];
    await this.save();
  }

  /**
   * Set the last refresh timestamp for the index metadata.
   * @param date - Date to record as last refresh.
   * @returns Promise that resolves when saved.
   */
  async setLastRefreshed(date: Date): Promise<void> {
    await this.init();
    this.data.metadata.lastRefreshed = date.toISOString();
    await this.save();
  }

  /**
   * Retrieve the last refresh timestamp, if recorded.
   * @returns Date of last refresh or null.
   */
  async getLastRefreshed(): Promise<Date | null> {
    await this.init();
    const value = this.data.metadata.lastRefreshed;
    return value ? new Date(value) : null;
  }

  /**
   * Find the first entry where either content or context hash matches.
   * @param fingerprint - Content or context hashes to match.
   * @returns Matching entry or null.
   */
  async findByFingerprint(fingerprint: {
    contentHash?: string;
    contextHash?: string;
  }): Promise<IdIndexEntry | null> {
    await this.init();
    const { contentHash, contextHash } = fingerprint;
    if (!(contentHash || contextHash)) {
      return null;
    }
    const entries = Object.values(this.data.ids);
    for (const entry of entries) {
      if (contentHash && entry.contentHash === contentHash) {
        return entry;
      }
      if (contextHash && entry.contextHash === contextHash) {
        return entry;
      }
    }
    return null;
  }

  /**
   * List all stored ID entries.
   * @returns All entries in the index.
   */
  async listIds(): Promise<IdIndexEntry[]> {
    await this.init();
    return Object.values(this.data.ids);
  }

  private async ensureDirectory(): Promise<void> {
    const dir = dirname(this.indexPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  private async readIndex(): Promise<Result<IdIndexData, InternalError>> {
    if (!existsSync(this.indexPath)) {
      return Result.ok(structuredClone(DEFAULT_INDEX));
    }
    const raw = await readFile(this.indexPath, "utf8");
    try {
      const parsed = JSON.parse(raw) as IdIndexData;
      return Result.ok({
        ...structuredClone(DEFAULT_INDEX),
        ...parsed,
        ids: parsed.ids ?? {},
        files: parsed.files ?? {},
        metadata: parsed.metadata ?? {},
      });
    } catch (error) {
      return Result.err(
        InternalError.create(
          `Failed to parse ${this.indexPath}: ${error instanceof Error ? error.message : String(error)}`,
          { path: this.indexPath }
        )
      );
    }
  }

  private async readHistory(): Promise<Result<HistoryEntry[], InternalError>> {
    if (!existsSync(this.historyPath)) {
      return Result.ok([]);
    }
    const raw = await readFile(this.historyPath, "utf8");
    try {
      const parsed = JSON.parse(raw) as HistoryEntry[];
      return Result.ok(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      return Result.err(
        InternalError.create(
          `Failed to parse ${this.historyPath}: ${error instanceof Error ? error.message : String(error)}`,
          { path: this.historyPath }
        )
      );
    }
  }

  private async save(): Promise<void> {
    await writeFile(
      this.indexPath,
      `${JSON.stringify(this.data, null, 2)}\n`,
      "utf8"
    );
  }

  private async saveHistory(): Promise<void> {
    if (!this.trackHistory) {
      return;
    }
    await writeFile(
      this.historyPath,
      `${JSON.stringify(this.history, null, 2)}\n`,
      "utf8"
    );
  }
}
