// tldr ::: value parsing utilities for unified command flags

import type { createArgIterator } from "../../utils/flags/iterator";

/**
 * Parse a non-negative integer argument.
 * @param token - Flag token being parsed.
 * @param iterator - Iterator for remaining args.
 * @returns Parsed non-negative integer.
 */
export function parseNonNegativeInt(
  token: string,
  iterator: ReturnType<typeof createArgIterator>
): number {
  const value = iterator.next();
  if (!value) {
    throw new Error(`${token} requires a value`);
  }
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num) || num < 0) {
    throw new Error(`${token} requires a non-negative integer`);
  }
  return num;
}

/**
 * Parse a positive integer argument.
 * @param token - Flag token being parsed.
 * @param iterator - Iterator for remaining args.
 * @returns Parsed positive integer.
 */
export function parsePositiveInt(
  token: string,
  iterator: ReturnType<typeof createArgIterator>
): number {
  const value = iterator.next();
  if (!value) {
    throw new Error(`${token} requires a value`);
  }
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num) || num <= 0) {
    throw new Error(`${token} requires a positive integer`);
  }
  return num;
}

/**
 * Parse an enum value argument.
 * @param token - Flag token being parsed.
 * @param iterator - Iterator for remaining args.
 * @param validValues - Allowed enum values.
 * @returns Parsed enum value.
 */
export function parseEnumValue<T extends string>(
  token: string,
  iterator: ReturnType<typeof createArgIterator>,
  validValues: T[]
): T {
  const value = iterator.next();
  if (!value) {
    throw new Error(`${token} requires a value`);
  }
  if (!validValues.includes(value as T)) {
    throw new Error(`${token} must be one of: ${validValues.join(", ")}`);
  }
  return value as T;
}
