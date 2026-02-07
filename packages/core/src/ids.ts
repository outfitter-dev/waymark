// tldr ::: waymark ID management utilities backed by the JSON index

import { createHash } from "node:crypto";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  Result,
  ValidationError,
} from "./errors.ts";

const MIN_ID_SLICE_LENGTH = 4;
const BASE36_RADIX = 36;
const MAX_ID_GENERATION_ATTEMPTS = 25;

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
   * @param metadata - Metadata used to generate or validate the ID.
   * @param requestedId - Optional explicit ID to reserve.
   * @returns Result containing reserved ID or undefined when no ID should be assigned.
   */
  async reserveId(
    metadata: WaymarkIdMetadata,
    requestedId?: string | null
  ): Promise<
    Result<string | undefined, ValidationError | ConflictError | InternalError>
  > {
    const preferredId = requestedId ?? undefined;

    if (preferredId) {
      const normalizedResult = this.normalizeId(preferredId);
      if (normalizedResult.isErr()) {
        return normalizedResult;
      }
      const normalized = normalizedResult.value;

      const availabilityResult = await this.validateAvailability(
        normalized,
        metadata
      );
      if (availabilityResult.isErr()) {
        return availabilityResult;
      }

      if (this.reserved.has(normalized)) {
        return Result.err(
          new ConflictError({
            message: `Waymark ID already reserved in current batch: ${normalized}`,
          })
        );
      }
      this.reserved.add(normalized);
      return Result.ok(normalized);
    }

    if (this.config.mode === "off" || this.config.mode === "manual") {
      return Result.ok(undefined);
    }

    if (this.config.mode === "prompt") {
      // Core layer does not prompt; caller should handle prompting and rerun with an explicit ID.
      return Result.ok(undefined);
    }

    const generatedResult = await this.generateUniqueId(metadata);
    if (generatedResult.isErr()) {
      return generatedResult;
    }
    this.reserved.add(generatedResult.value);
    return Result.ok(generatedResult.value);
  }

  /**
   * Persist a previously reserved ID to the on-disk index.
   * @param id - Reserved ID to persist.
   * @param metadata - Metadata associated with the ID.
   * @returns Result indicating success or a not-found error.
   */
  async commitReservedId(
    id: string,
    metadata: WaymarkIdMetadata
  ): Promise<Result<void, ValidationError | NotFoundError>> {
    const normalizedResult = this.normalizeId(id);
    if (normalizedResult.isErr()) {
      return normalizedResult;
    }
    const normalized = normalizedResult.value;

    if (!this.reserved.has(normalized)) {
      return Result.err(
        new NotFoundError({
          message: `Waymark ID ${normalized} was not reserved`,
          resourceType: "waymark-id",
          resourceId: normalized,
        })
      );
    }
    await this.index.set(this.buildEntry(normalized, metadata));
    this.reserved.delete(normalized);
    return Result.ok();
  }

  /**
   * Update the stored location metadata for an existing ID.
   * @param id - Waymark ID to update.
   * @param metadata - Updated metadata for the ID.
   * @returns Result indicating success or a not-found/validation error.
   */
  async updateLocation(
    id: string,
    metadata: WaymarkIdMetadata
  ): Promise<Result<void, ValidationError | NotFoundError>> {
    const normalizedResult = this.normalizeId(id);
    if (normalizedResult.isErr()) {
      return normalizedResult;
    }
    const normalized = normalizedResult.value;

    const updateResult = await this.index.update(normalized, () =>
      this.buildEntry(normalized, metadata)
    );
    return updateResult;
  }

  /**
   * Remove an ID from the index and optionally record a removal reason.
   * @param id - Waymark ID to remove.
   * @param options - Optional removal metadata.
   * @returns Result indicating success or a validation error.
   */
  async remove(
    id: string,
    options?: { reason?: string; removedBy?: string }
  ): Promise<Result<void, ValidationError>> {
    const normalizedResult = this.normalizeId(id);
    if (normalizedResult.isErr()) {
      return normalizedResult;
    }
    await this.index.delete(normalizedResult.value, options);
    return Result.ok();
  }

  /**
   * Fetch a stored ID entry by ID.
   * @param id - Waymark ID to fetch.
   * @returns Entry if found, otherwise null. Returns null for invalid IDs.
   */
  get(id: string): Promise<IdIndexEntry | null> {
    const normalizedResult = this.normalizeId(id);
    if (normalizedResult.isErr()) {
      return Promise.resolve(null);
    }
    return this.index.get(normalizedResult.value);
  }

  /**
   * Lookup an ID entry by content or context hash.
   * @param fingerprint - Content/context hashes to search for.
   * @returns Matching entry or null.
   */
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

  private normalizeId(id: string): Result<string, ValidationError> {
    // Already in [[hash]] or [[hash|alias]] format
    if (id.startsWith("[[") && id.endsWith("]]")) {
      const content = id.slice(2, -2);
      // Reject empty brackets or whitespace-only content
      if (!content || content.trim().length === 0) {
        return Result.err(
          new ValidationError({
            message: `Invalid waymark ID format: ${id}`,
            field: "id",
          })
        );
      }
      return Result.ok(id);
    }
    return Result.ok(`[[${id}]]`);
  }

  private async validateAvailability(
    id: string,
    metadata: WaymarkIdMetadata,
    options: { allowExisting?: boolean } = {}
  ): Promise<Result<void, ConflictError>> {
    const exists = await this.index.get(id);
    if (!exists) {
      return Result.ok();
    }
    if (options.allowExisting) {
      const sameLocation =
        exists.file === metadata.file && exists.line === metadata.line;
      if (sameLocation) {
        return Result.ok();
      }
    }
    return Result.err(
      new ConflictError({
        message: `Waymark ID already in use: ${id}`,
        context: { id, existingFile: exists.file, existingLine: exists.line },
      })
    );
  }

  private async generateUniqueId(
    metadata: WaymarkIdMetadata
  ): Promise<Result<string, InternalError>> {
    const baseInput = `${metadata.file}|${metadata.line}|${metadata.type}|${metadata.content}`;
    let attempt = 0;

    while (attempt < MAX_ID_GENERATION_ATTEMPTS) {
      const candidate = this.makeId(baseInput, attempt);
      const alreadyReserved = this.reserved.has(candidate);
      const exists = await this.index.has(candidate);
      if (!(alreadyReserved || exists)) {
        return Result.ok(candidate);
      }
      attempt++;
    }

    return Result.err(
      new InternalError({
        message: "Unable to generate unique waymark ID after multiple attempts",
        context: {
          file: metadata.file,
          line: metadata.line,
          attempts: MAX_ID_GENERATION_ATTEMPTS,
        },
      })
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

/**
 * Hash normalized waymark content for ID matching.
 * @param content - Waymark content to hash.
 * @returns SHA-256 content hash.
 */
export function fingerprintContent(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex");
}

/**
 * Hash surrounding context for ID matching.
 * @param context - Surrounding text to hash.
 * @returns SHA-256 context hash.
 */
export function fingerprintContext(context: string): string {
  return createHash("sha256").update(context).digest("hex");
}
