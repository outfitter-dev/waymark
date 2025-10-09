// tldr ::: tests for shell completion generators

import { describe, expect, test } from "bun:test";
import {
  BashGenerator,
  type CompletionGenerator,
  FishGenerator,
  getAllTypes,
  NushellGenerator,
  PowerShellGenerator,
  ZshGenerator,
} from "./index.ts";

// Test constants
const VERSION_PATTERN = /version/;
const HELP_PATTERN = /help/;
const TYPE_PATTERN = /type/;
const WRITE_PATTERN = /write/;
const TLDR_PATTERN = /tldr\s*:::/;
const BASH_TYPE_FLAG_PATTERN = /--type\)/;
const SIGNAL_PATTERN = /[\\^]\^|\*|--signal/;
const MIN_EXPECTED_TYPE_COUNT = 20;

describe("completion generators", () => {
  const types = getAllTypes();
  const options = { types };

  // Shared test function for all generators
  function testGenerator(
    name: string,
    generator: CompletionGenerator,
    expectedFilename: string,
    syntaxChecks: Array<string | RegExp>
  ) {
    describe(name, () => {
      test("returns correct filename", () => {
        expect(generator.getFilename()).toBe(expectedFilename);
      });

      test("generates non-empty output", () => {
        const output = generator.generate();
        expect(output.length).toBeGreaterThan(0);
      });

      test("includes all waymark types", () => {
        const output = generator.generate();
        // Check that all types appear in the completion script
        for (const type of types) {
          expect(output).toContain(type);
        }
      });

      test("contains expected shell syntax", () => {
        const output = generator.generate();
        for (const check of syntaxChecks) {
          if (typeof check === "string") {
            expect(output).toContain(check);
          } else {
            expect(output).toMatch(check);
          }
        }
      });

      test("includes core commands", () => {
        const output = generator.generate();
        const commands = [
          "format",
          "insert",
          "modify",
          "remove",
          "lint",
          "migrate",
          "init",
          "update",
          "help",
        ];
        for (const cmd of commands) {
          expect(output).toContain(cmd);
        }
      });

      test("includes common flags", () => {
        const output = generator.generate();
        // Use flexible checks - some shells use long forms, others short
        expect(output).toMatch(VERSION_PATTERN);
        expect(output).toMatch(HELP_PATTERN);
        expect(output).toMatch(TYPE_PATTERN);
        expect(output).toContain("json");
        expect(output).toMatch(WRITE_PATTERN);
      });

      test("includes tldr comment", () => {
        const output = generator.generate();
        expect(output).toMatch(TLDR_PATTERN);
      });
    });
  }

  // Test each generator with shell-specific syntax checks
  testGenerator("NushellGenerator", new NushellGenerator(options), "wm.nu", [
    "export extern",
    'def "nu-complete',
    '--type(-t): string@"nu-complete wm types"',
    "--raised(-r)",
    "--starred(-s)",
  ]);

  testGenerator("BashGenerator", new BashGenerator(options), "wm.bash", [
    "_wm_completion()",
    "COMPREPLY=(",
    "complete -F _wm_completion wm",
    "compgen -W",
    BASH_TYPE_FLAG_PATTERN,
  ]);

  testGenerator("FishGenerator", new FishGenerator(options), "wm.fish", [
    "complete -c wm",
    "__fish_use_subcommand",
    "__fish_seen_subcommand_from",
    "-s v -l version",
    "-s t -l type",
  ]);

  testGenerator("ZshGenerator", new ZshGenerator(options), "_wm", [
    "#compdef wm",
    "_wm()",
    "_arguments",
    "_describe",
    "'(-t --type)'",
  ]);

  testGenerator(
    "PowerShellGenerator",
    new PowerShellGenerator(options),
    "wm.ps1",
    [
      "Register-ArgumentCompleter",
      "[CompletionResult]::",
      "[CompletionResultType]::",
      "switch ($command)",
      "-CommandName 'wm'",
    ]
  );

  describe("type extraction", () => {
    test("getAllTypes returns all types and aliases", () => {
      const allTypes = getAllTypes();

      // Should include canonical types
      expect(allTypes).toContain("todo");
      expect(allTypes).toContain("fix");
      expect(allTypes).toContain("note");
      expect(allTypes).toContain("tldr");

      // Should include aliases
      expect(allTypes).toContain("fixme");
      expect(allTypes).toContain("why");
      expect(allTypes).toContain("tmp");
      expect(allTypes).toContain("ask");

      // Should have reasonable length (17 canonical + aliases)
      expect(allTypes.length).toBeGreaterThanOrEqual(MIN_EXPECTED_TYPE_COUNT);
    });

    test("getAllTypes returns readonly array", () => {
      const allTypes = getAllTypes();
      // TypeScript enforces readonly, but we can verify it's an array
      expect(Array.isArray(allTypes)).toBe(true);
    });
  });

  describe("output format consistency", () => {
    test("all generators include scope options", () => {
      const generators: CompletionGenerator[] = [
        new NushellGenerator(options),
        new BashGenerator(options),
        new FishGenerator(options),
        new ZshGenerator(options),
        new PowerShellGenerator(options),
      ];

      const scopes = ["default", "project", "user"];

      for (const generator of generators) {
        const output = generator.generate();
        for (const scope of scopes) {
          expect(output).toContain(scope);
        }
      }
    });

    test("all generators include signal options", () => {
      const generators: CompletionGenerator[] = [
        new NushellGenerator(options),
        new BashGenerator(options),
        new FishGenerator(options),
        new ZshGenerator(options),
        new PowerShellGenerator(options),
      ];

      for (const generator of generators) {
        const output = generator.generate();
        // Check for signal mentions (some shells might escape them)
        expect(output).toMatch(SIGNAL_PATTERN);
      }
    });

    test("all generators include group/sort options", () => {
      const generators: CompletionGenerator[] = [
        new NushellGenerator(options),
        new BashGenerator(options),
        new FishGenerator(options),
        new ZshGenerator(options),
        new PowerShellGenerator(options),
      ];

      const groupOptions = ["file", "dir", "type"];
      const sortOptions = ["file", "line", "type", "modified"];

      for (const generator of generators) {
        const output = generator.generate();

        // Check group options
        for (const opt of groupOptions) {
          expect(output).toContain(opt);
        }

        // Check sort options
        for (const opt of sortOptions) {
          expect(output).toContain(opt);
        }
      }
    });
  });

  describe("shell-specific features", () => {
    test("Nushell uses custom completion functions", () => {
      const generator = new NushellGenerator(options);
      const output = generator.generate();

      expect(output).toContain('def "nu-complete wm types"');
      expect(output).toContain('def "nu-complete wm scope"');
      expect(output).toContain('def "nu-complete wm commands"');
    });

    test("Bash uses COMPREPLY for completions", () => {
      const generator = new BashGenerator(options);
      const output = generator.generate();

      expect(output).toContain("COMPREPLY=(");
      expect(output).toContain("compgen -W");
      expect(output).toContain("compgen -f");
    });

    test("Fish uses condition checks", () => {
      const generator = new FishGenerator(options);
      const output = generator.generate();

      expect(output).toContain("__fish_use_subcommand");
      expect(output).toContain("__fish_seen_subcommand_from");
    });

    test("Zsh uses _arguments for completion", () => {
      const generator = new ZshGenerator(options);
      const output = generator.generate();

      expect(output).toContain("_arguments");
      expect(output).toContain("_describe");
      expect(output).toContain("_files");
    });

    test("PowerShell uses CompletionResult objects", () => {
      const generator = new PowerShellGenerator(options);
      const output = generator.generate();

      expect(output).toContain("[CompletionResult]::new(");
      expect(output).toContain("[CompletionResultType]::");
    });
  });
});
