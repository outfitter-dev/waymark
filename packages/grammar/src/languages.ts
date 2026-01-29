// tldr ::: language registry with comment capability mappings for file extensions and basenames

import { basename, extname } from "node:path";

/**
 * Comment capability for a language, including supported comment leaders.
 * An empty `leaders` array indicates the language has no comment syntax.
 */
export type CommentCapability = {
  readonly leaders: readonly string[];
  readonly language: string;
};

/**
 * Registry mapping file extensions and basenames to their comment capabilities.
 * Use `byExtension` for extension-based lookups (include leading dot).
 * Use `byBasename` for exact filename matches (e.g., Dockerfile, Makefile).
 */
export type LanguageRegistry = {
  readonly byExtension: ReadonlyMap<string, CommentCapability>;
  readonly byBasename: ReadonlyMap<string, CommentCapability>;
};

// Helper to create CommentCapability with readonly arrays
function capability(language: string, leaders: string[]): CommentCapability {
  return { language, leaders: Object.freeze(leaders) as readonly string[] };
}

// No comment support
const NO_COMMENTS = capability("data", []);

// Common comment patterns
const C_STYLE = (lang: string) => capability(lang, ["//", "/*"]);
const HASH = (lang: string) => capability(lang, ["#"]);
const SQL_STYLE = (lang: string) => capability(lang, ["--"]);
const HTML_STYLE = (lang: string) => capability(lang, ["<!--"]);
const PERCENT = (lang: string) => capability(lang, ["%"]);
const SEMICOLON = (lang: string) => capability(lang, [";"]);

// Extension mappings - organized by comment style
const EXTENSION_ENTRIES: [string, CommentCapability][] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // No comment support
  // ═══════════════════════════════════════════════════════════════════════════
  [".json", capability("json", [])],
  [".csv", NO_COMMENTS],
  [".tsv", NO_COMMENTS],
  [".parquet", NO_COMMENTS],
  [".avro", NO_COMMENTS],
  [".lock", NO_COMMENTS],
  [".lockb", NO_COMMENTS],

  // ═══════════════════════════════════════════════════════════════════════════
  // C-style comments (// and /*)
  // ═══════════════════════════════════════════════════════════════════════════
  // TypeScript
  [".ts", C_STYLE("typescript")],
  [".tsx", C_STYLE("tsx")],
  [".mts", C_STYLE("typescript")],
  [".cts", C_STYLE("typescript")],

  // JavaScript
  [".js", C_STYLE("javascript")],
  [".jsx", C_STYLE("jsx")],
  [".mjs", C_STYLE("javascript")],
  [".cjs", C_STYLE("javascript")],

  // JSON with comments
  [".jsonc", C_STYLE("jsonc")],
  [".json5", C_STYLE("json5")],

  // Systems languages
  [".go", C_STYLE("go")],
  [".rs", C_STYLE("rust")],
  [".c", C_STYLE("c")],
  [".h", C_STYLE("c")],
  [".cpp", C_STYLE("cpp")],
  [".cc", C_STYLE("cpp")],
  [".cxx", C_STYLE("cpp")],
  [".hpp", C_STYLE("cpp")],
  [".hxx", C_STYLE("cpp")],

  // JVM languages
  [".java", C_STYLE("java")],
  [".kt", C_STYLE("kotlin")],
  [".kts", C_STYLE("kotlin")],
  [".scala", C_STYLE("scala")],
  [".groovy", C_STYLE("groovy")],

  // .NET languages
  [".cs", C_STYLE("csharp")],
  [".fs", C_STYLE("fsharp")],

  // Mobile
  [".swift", C_STYLE("swift")],
  [".m", C_STYLE("objective-c")],
  [".mm", C_STYLE("objective-cpp")],

  // Web (C-style)
  [".php", C_STYLE("php")],
  [".dart", C_STYLE("dart")],
  [".v", C_STYLE("v")],
  [".zig", C_STYLE("zig")],

  // ═══════════════════════════════════════════════════════════════════════════
  // CSS/styling (block comments only)
  // ═══════════════════════════════════════════════════════════════════════════
  [".css", capability("css", ["/*"])],
  [".scss", capability("scss", ["//", "/*"])],
  [".sass", capability("sass", ["//", "/*"])],
  [".less", capability("less", ["//", "/*"])],
  [".styl", capability("stylus", ["//", "/*"])],

  // ═══════════════════════════════════════════════════════════════════════════
  // Hash comments (#)
  // ═══════════════════════════════════════════════════════════════════════════
  // Python
  [".py", HASH("python")],
  [".pyi", HASH("python")],
  [".pyw", HASH("python")],
  [".pyx", HASH("cython")],

  // Ruby
  [".rb", HASH("ruby")],
  [".rake", HASH("ruby")],
  [".gemspec", HASH("ruby")],

  // Shell
  [".sh", HASH("shell")],
  [".bash", HASH("bash")],
  [".zsh", HASH("zsh")],
  [".fish", HASH("fish")],
  [".ksh", HASH("ksh")],
  [".csh", HASH("csh")],

  // Config formats
  [".yaml", HASH("yaml")],
  [".yml", HASH("yaml")],
  [".toml", HASH("toml")],
  [".ini", HASH("ini")],
  [".conf", HASH("conf")],
  [".cfg", HASH("conf")],

  // Other hash-comment languages
  [".r", HASH("r")],
  [".R", HASH("r")],
  [".pl", HASH("perl")],
  [".pm", HASH("perl")],
  [".ex", HASH("elixir")],
  [".exs", HASH("elixir")],
  [".jl", HASH("julia")],
  [".dockerfile", HASH("dockerfile")],
  [".tf", HASH("terraform")],
  [".tfvars", HASH("terraform")],
  [".hcl", HASH("hcl")],
  [".nix", HASH("nix")],
  [".coffee", HASH("coffeescript")],
  [".cr", HASH("crystal")],
  [".nim", HASH("nim")],
  [".ps1", HASH("powershell")],
  [".psm1", HASH("powershell")],
  [".psd1", HASH("powershell")],

  // ═══════════════════════════════════════════════════════════════════════════
  // SQL-style comments (--)
  // ═══════════════════════════════════════════════════════════════════════════
  [".sql", SQL_STYLE("sql")],
  [".lua", SQL_STYLE("lua")],
  [".hs", SQL_STYLE("haskell")],
  [".lhs", SQL_STYLE("haskell")],
  [".pgsql", SQL_STYLE("plpgsql")],
  [".plsql", SQL_STYLE("plsql")],
  [".ada", SQL_STYLE("ada")],
  [".adb", SQL_STYLE("ada")],
  [".ads", SQL_STYLE("ada")],
  [".vhd", SQL_STYLE("vhdl")],
  [".vhdl", SQL_STYLE("vhdl")],

  // ═══════════════════════════════════════════════════════════════════════════
  // HTML-style comments (<!--)
  // ═══════════════════════════════════════════════════════════════════════════
  [".md", HTML_STYLE("markdown")],
  [".mdx", HTML_STYLE("mdx")],
  [".markdown", HTML_STYLE("markdown")],
  [".html", HTML_STYLE("html")],
  [".htm", HTML_STYLE("html")],
  [".xhtml", HTML_STYLE("html")],
  [".xml", HTML_STYLE("xml")],
  [".svg", HTML_STYLE("svg")],
  [".vue", HTML_STYLE("vue")],
  [".svelte", HTML_STYLE("svelte")],
  [".astro", HTML_STYLE("astro")],

  // ═══════════════════════════════════════════════════════════════════════════
  // Percent comments (%)
  // ═══════════════════════════════════════════════════════════════════════════
  [".tex", PERCENT("latex")],
  [".sty", PERCENT("latex")],
  [".cls", PERCENT("latex")],
  [".bib", PERCENT("bibtex")],
  [".erl", PERCENT("erlang")],
  [".hrl", PERCENT("erlang")],
  [".pro", PERCENT("prolog")],

  // ═══════════════════════════════════════════════════════════════════════════
  // Semicolon comments (;)
  // ═══════════════════════════════════════════════════════════════════════════
  [".asm", SEMICOLON("assembly")],
  [".s", SEMICOLON("assembly")],
  [".S", SEMICOLON("assembly")],
  [".el", SEMICOLON("elisp")],
  [".clj", SEMICOLON("clojure")],
  [".cljs", SEMICOLON("clojurescript")],
  [".cljc", SEMICOLON("clojure")],
  [".edn", SEMICOLON("edn")],
  [".lisp", SEMICOLON("lisp")],
  [".cl", SEMICOLON("common-lisp")],
  [".scm", SEMICOLON("scheme")],
  [".rkt", SEMICOLON("racket")],
];

// Basename mappings for files without extensions
const BASENAME_ENTRIES: [string, CommentCapability][] = [
  // Build/task files
  ["Dockerfile", HASH("dockerfile")],
  ["Containerfile", HASH("dockerfile")],
  ["Makefile", HASH("makefile")],
  ["GNUmakefile", HASH("makefile")],
  ["Justfile", HASH("just")],
  ["Rakefile", HASH("ruby")],
  ["Gemfile", HASH("ruby")],
  ["Vagrantfile", HASH("ruby")],
  ["Brewfile", HASH("ruby")],
  ["Procfile", HASH("procfile")],
  ["Jenkinsfile", C_STYLE("groovy")],
  ["Podfile", HASH("ruby")],

  // Shell config
  [".bashrc", HASH("bash")],
  [".bash_profile", HASH("bash")],
  [".zshrc", HASH("zsh")],
  [".zprofile", HASH("zsh")],
  [".profile", HASH("shell")],
  [".zshenv", HASH("zsh")],

  // Git/VCS
  [".gitignore", HASH("gitignore")],
  [".gitattributes", HASH("gitattributes")],
  [".gitmodules", HASH("gitconfig")],
  [".dockerignore", HASH("dockerignore")],
  [".npmignore", HASH("npmignore")],
  [".eslintignore", HASH("eslintignore")],
  [".prettierignore", HASH("prettierignore")],

  // Environment
  [".env", HASH("dotenv")],
  [".env.local", HASH("dotenv")],
  [".env.development", HASH("dotenv")],
  [".env.production", HASH("dotenv")],
  [".env.test", HASH("dotenv")],
  [".env.example", HASH("dotenv")],
  [".envrc", HASH("direnv")],

  // Editor config
  [".editorconfig", HASH("editorconfig")],

  // No comment support
  ["package-lock.json", capability("json", [])],
  ["bun.lockb", NO_COMMENTS],
  ["yarn.lock", capability("yaml", [])], // yarn.lock uses yaml-like comments
  ["pnpm-lock.yaml", HASH("yaml")],
  ["Cargo.lock", capability("toml", [])], // TOML but typically not edited
  ["composer.lock", capability("json", [])],
  ["Gemfile.lock", NO_COMMENTS],
];

// Build the registry maps
const extensionMap = new Map<string, CommentCapability>();
for (const [ext, cap] of EXTENSION_ENTRIES) {
  extensionMap.set(ext.toLowerCase(), cap);
}

const basenameMap = new Map<string, CommentCapability>();
for (const [name, cap] of BASENAME_ENTRIES) {
  basenameMap.set(name, cap);
}

/**
 * Default language registry with comprehensive extension and basename mappings.
 * Covers ~80 common file extensions and ~30 basenames.
 */
export const DEFAULT_LANGUAGE_REGISTRY: LanguageRegistry = Object.freeze({
  byExtension: extensionMap,
  byBasename: basenameMap,
});

/**
 * Look up comment capability for a file by its path.
 * Checks basename first (for files like Dockerfile, Makefile), then extension.
 * Returns undefined for unknown file types.
 *
 * @param filePath - Path to the file (can be relative or absolute)
 * @param registry - Language registry to use (defaults to DEFAULT_LANGUAGE_REGISTRY)
 * @returns Comment capability or undefined if file type is not recognized
 *
 * @example
 * ```typescript
 * getCommentCapability("src/index.ts")
 * // => { language: "typescript", leaders: ["//", "/*"] }
 *
 * getCommentCapability("data.json")
 * // => { language: "json", leaders: [] }
 *
 * getCommentCapability("Dockerfile")
 * // => { language: "dockerfile", leaders: ["#"] }
 *
 * getCommentCapability("mystery.xyz")
 * // => undefined
 * ```
 */
export function getCommentCapability(
  filePath: string,
  registry: LanguageRegistry = DEFAULT_LANGUAGE_REGISTRY
): CommentCapability | undefined {
  const name = basename(filePath);

  // Check basename first (for Dockerfile, Makefile, etc.)
  const byBasename = registry.byBasename.get(name);
  if (byBasename) {
    return byBasename;
  }

  // Handle special case: .d.ts, .d.tsx, .d.mts, .d.cts
  const lower = filePath.toLowerCase();
  if (
    lower.endsWith(".d.ts") ||
    lower.endsWith(".d.mts") ||
    lower.endsWith(".d.cts")
  ) {
    return registry.byExtension.get(".ts");
  }
  if (lower.endsWith(".d.tsx")) {
    return registry.byExtension.get(".tsx");
  }

  // Check extension (case-insensitive)
  const ext = extname(name).toLowerCase();
  if (ext) {
    return registry.byExtension.get(ext);
  }

  return;
}

/**
 * Check if a file can have comments based on its extension or basename.
 * Returns true if the file type is known and supports comment syntax.
 * Returns false if the file type is known but has no comment syntax (e.g., .json).
 * Returns undefined if the file type is not recognized.
 *
 * @param filePath - Path to the file (can be relative or absolute)
 * @param registry - Language registry to use (defaults to DEFAULT_LANGUAGE_REGISTRY)
 * @returns true if file can have comments, false if it cannot, undefined if unknown
 *
 * @example
 * ```typescript
 * canHaveComments("src/index.ts")   // => true
 * canHaveComments("data.json")      // => false (known, no comments)
 * canHaveComments("mystery.xyz")    // => undefined (unknown)
 * ```
 */
export function canHaveComments(
  filePath: string,
  registry: LanguageRegistry = DEFAULT_LANGUAGE_REGISTRY
): boolean | undefined {
  const cap = getCommentCapability(filePath, registry);
  if (cap === undefined) {
    return;
  }
  return cap.leaders.length > 0;
}

/**
 * Get the language identifier for a file based on its extension or basename.
 * Returns undefined for unknown file types.
 *
 * @param filePath - Path to the file (can be relative or absolute)
 * @param registry - Language registry to use (defaults to DEFAULT_LANGUAGE_REGISTRY)
 * @returns Language identifier string or undefined if not recognized
 *
 * @example
 * ```typescript
 * getLanguageId("src/index.ts")  // => "typescript"
 * getLanguageId("Dockerfile")    // => "dockerfile"
 * getLanguageId("mystery.xyz")   // => undefined
 * ```
 */
export function getLanguageId(
  filePath: string,
  registry: LanguageRegistry = DEFAULT_LANGUAGE_REGISTRY
): string | undefined {
  return getCommentCapability(filePath, registry)?.language;
}
