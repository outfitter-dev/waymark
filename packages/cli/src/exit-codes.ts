// tldr ::: standardized CLI exit codes for waymark commands [[cli/exit-codes]]

export const ExitCode = {
  success: 0,
  failure: 1,
  usageError: 2,
  configError: 3,
  ioError: 4,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
