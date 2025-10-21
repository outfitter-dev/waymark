declare module "safe-regex" {
  export type SafeRegexOptions = {
    limit?: number;
  };

  export default function safeRegex(
    pattern: string | RegExp | { source: string; flags?: string },
    options?: SafeRegexOptions
  ): boolean;
}
