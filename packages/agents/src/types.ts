// tldr ::: type definitions for agent toolkit configuration

import type { WaymarkConfig } from "@waymarks/core";

/**
 * Partial waymark configuration for agent toolkit customization.
 * All fields are optional to allow incremental configuration overrides.
 */
export type PartialWaymarkConfig = Partial<WaymarkConfig>;
