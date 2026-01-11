// tldr ::: waymark ID management utilities backed by the JSON index

import { createHash } from "node:crypto";

const MIN_ID_SLICE_LENGTH = 4;
const BASE36_RADIX = 36;

// note ::: content/context fingerprints use SHA-256 for cryptographic properties
// note ::: IDs use wyhash for speed (10-20x faster, sufficient collision resistance)

import type { IdIndexEntry, JsonIdIndex } from "./id-index.ts";
import type { WaymarkIdConfig } from "./types.ts";

/** Metadata used to generate and persist waymark IDs. */
export type WaymarkIdMetadata = {
  file: string;
  line: number;
  type: string;
  content: string;
  contentHash: string;
  contextHash: string;
  source?: string;
  sourceType?: IdIndexEntry["sourceType"];
};

/** Manages waymark ID generation and persistence using the JSON index. */
export class WaymarkIdManager {
  private readonly config: WaymarkIdConfig;
  private readonly index: JsonIdIndex;
  private readonly reserved = new Set<string>();

  constructor(config: WaymarkIdConfig, index: JsonIdIndex) {
    this.config = config;
    this.index = index;
  }

  /**
   * Reserve an ID for the provided metadata without immediately writing to disk.
   * Call {@link commitReservedId} after the file write succeeds to persist the mapping.
   */
  async reserveId(
    metadata: WaymarkIdMetadata,
    requestedId?: string | null
  ): Promise<string | undefined> {
    const preferredId = requestedId ?? undefined;

    if (preferredId) {
      const normalized = this.normalizeId(preferredId);
      await this.validateAvailability(normalized, metadata);
      if (this.reserved.has(normalized)) {
        throw new Error(
          `Waymark ID already reserved in current batch: ${normalized}`
        );
      }
      this.reserved.add(normalized);
      return normalized;
    }

    if (this.config.mode === "off" || this.config.mode === "manual") {
      return;
    }

    if (this.config.mode === "prompt") {
      // Core layer does not prompt; caller should handle prompting and rerun with an explicit ID.
      return;
    }

    const generated = await this.generateUniqueId(metadata);
    this.reserved.add(generated);
    return generated;
  }

  /**
   * Persist a previously reserved ID to the on-disk index.
   */
  async commitReservedId(
    id: string,
    metadata: WaymarkIdMetadata
  ): Promise<void> {
    const normalized = this.normalizeId(id);
    if (!this.reserved.has(normalized)) {
      throw new Error(`Waymark ID ${normalized} was not reserved`);
    }
    await this.index.set(this.buildEntry(normalized, metadata));
    this.reserved.delete(normalized);
  }

  async updateLocation(id: string, metadata: WaymarkIdMetadata): Promise<void> {
    const normalized = this.normalizeId(id);
    await this.index.update(normalized, () =>
      this.buildEntry(normalized, metadata)
    );
  }

  async remove(
    id: string,
    options?: { reason?: string; removedBy?: string }
  ): Promise<void> {
    const normalized = this.normalizeId(id);
    await this.index.delete(normalized, options);
  }

  get(id: string): Promise<IdIndexEntry | null> {
    const normalized = this.normalizeId(id);
    return this.index.get(normalized);
  }

  lookupByFingerprint(fingerprint: {
    contentHash?: string;
    contextHash?: string;
  }): Promise<IdIndexEntry | null> {
    return this.index.findByFingerprint(fingerprint);
  }

  private buildEntry(id: string, metadata: WaymarkIdMetadata): IdIndexEntry {
    const entry: IdIndexEntry = {
      id,
      file: metadata.file,
      line: metadata.line,
      type: metadata.type,
      content: metadata.content,
      contentHash: metadata.contentHash,
      contextHash: metadata.contextHash,
      updatedAt: Date.now(),
    };
    if (metadata.source) {
      entry.source = metadata.source;
    }
    if (metadata.sourceType) {
      entry.sourceType = metadata.sourceType;
    }
    return entry;
  }

  private normalizeId(id: string): string {
    // Already in [[hash]] or [[hash|alias]] format
    if (id.startsWith("[[") && id.endsWith("]]")) {
      const content = id.slice(2, -2);
      // Reject empty brackets or whitespace-only content
      if (!content || content.trim().length === 0) {
        throw new Error(`Invalid waymark ID format: ${id}`);
      }
      return id;
    }
    return `[[${id}]]`;
  }

  private async validateAvailability(
    id: string,
    metadata: WaymarkIdMetadata,
    options: { allowExisting?: boolean } = {}
  ): Promise<void> {
    const exists = await this.index.get(id);
    if (!exists) {
      return;
    }
    if (options.allowExisting) {
      const sameLocation =
        exists.file === metadata.file && exists.line === metadata.line;
      if (sameLocation) {
        return;
      }
    }
    throw new Error(`Waymark ID already in use: ${id}`);
  }

  private async generateUniqueId(metadata: WaymarkIdMetadata): Promise<string> {
    const baseInput = `${metadata.file}|${metadata.line}|${metadata.type}|${metadata.content}`;
    let attempt = 0;
    const maxAttempts = 25;

    while (attempt < maxAttempts) {
      const candidate = this.makeId(baseInput, attempt);
      const alreadyReserved = this.reserved.has(candidate);
      const exists = await this.index.has(candidate);
      if (!(alreadyReserved || exists)) {
        return candidate;
      }
      attempt++;
    }

    throw new Error(
      "Unable to generate unique waymark ID after multiple attempts"
    );
  }

  private makeId(input: string, attempt: number): string {
    // Use Bun's built-in wyhash (10-20x faster than SHA-256)
    // Non-cryptographic but sufficient collision resistance for short IDs
    const combined = `${input}|${attempt}`;
    const hash = Bun.hash.wyhash(combined);
    const sliceLength = Math.max(MIN_ID_SLICE_LENGTH, this.config.length);
    const base36 = hash
      .toString(BASE36_RADIX)
      .padStart(sliceLength, "0")
      .slice(0, sliceLength);
    return `[[${base36}]]`;
  }
}

/** Hash normalized waymark content for ID matching. */
export function fingerprintContent(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex");
}

/** Hash surrounding context for ID matching. */
export function fingerprintContext(context: string): string {
  return createHash("sha256").update(context).digest("hex");
}
