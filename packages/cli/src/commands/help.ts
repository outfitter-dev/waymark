// tldr ::: help command helper for waymark CLI

export function displayHelp(usage: string): number {
  process.stdout.write(`${usage.trim()}\n`);
  return 0;
}
