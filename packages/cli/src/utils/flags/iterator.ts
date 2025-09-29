// tldr ::: shared iterator utilities for CLI flag parsing

/**
 * Lightweight iterator to traverse CLI arguments while supporting lookahead.
 */
export class ArgIterator {
  private index = 0;
  private readonly argv: readonly string[];

  constructor(argv: readonly string[]) {
    this.argv = argv;
  }

  hasNext(): boolean {
    return this.index < this.argv.length;
  }

  next(): string | undefined {
    if (!this.hasNext()) {
      return;
    }
    const value = this.argv[this.index];
    this.index += 1;
    return value;
  }

  peek(): string | undefined {
    return this.argv[this.index];
  }

  /**
   * Consume the next token, ensuring it is a value rather than another flag.
   */
  consumeValue(optionName: string): string {
    const value = this.next();
    if (typeof value !== "string" || isFlag(value)) {
      throw new Error(`${optionName} requires a value`);
    }
    return value;
  }
}

/**
 * Create an iterator configured for the provided argv slice.
 */
export function createArgIterator(argv: readonly string[]): ArgIterator {
  return new ArgIterator(argv);
}

/**
 * Determine whether the token represents a flag (prefixed with a dash).
 */
export function isFlag(token: string | undefined): boolean {
  return typeof token === "string" && token.startsWith("-");
}

/**
 * Check whether a token matches any of the provided flag names.
 */
export function matchesFlag(
  token: string | undefined,
  names: readonly string[]
): boolean {
  if (typeof token !== "string") {
    return false;
  }
  return names.includes(token);
}
