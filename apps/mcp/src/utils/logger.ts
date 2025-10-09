// tldr ::: minimal console logger for MCP server

type LogLevel = "debug" | "info" | "warn" | "error";
type LogMeta = Record<string, unknown>;

class Logger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(meta: LogMeta, message: string): void {
    if (this.shouldLog("debug")) {
      // biome-ignore lint/suspicious/noConsole: MCP server logs to stderr
      console.error(`[DEBUG] ${message}`, meta);
    }
  }

  info(meta: LogMeta, message: string): void {
    if (this.shouldLog("info")) {
      // biome-ignore lint/suspicious/noConsole: MCP server logs to stderr
      console.error(`[INFO] ${message}`, meta);
    }
  }

  warn(meta: LogMeta, message: string): void {
    if (this.shouldLog("warn")) {
      // biome-ignore lint/suspicious/noConsole: MCP server logs to stderr
      console.error(`[WARN] ${message}`, meta);
    }
  }

  error(meta: LogMeta, message: string): void {
    if (this.shouldLog("error")) {
      // biome-ignore lint/suspicious/noConsole: MCP server logs to stderr
      console.error(`[ERROR] ${message}`, meta);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentIndex = levels.indexOf(this.level);
    const targetIndex = levels.indexOf(level);
    return targetIndex >= currentIndex;
  }
}

export const logger = new Logger();
