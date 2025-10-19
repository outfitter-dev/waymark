// tldr ::: zsh completion generator for waymark CLI

import type { CompletionGenerator, GeneratorOptions } from "./types.ts";
import {
  CONFIG_SCOPES,
  GROUP_BY_OPTIONS,
  getTypesString,
  SIGNAL_OPTIONS,
  SORT_BY_OPTIONS,
} from "./utils.ts";

export class ZshGenerator implements CompletionGenerator {
  private readonly options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  getFilename(): string {
    return "_wm";
  }

  generate(): string {
    const typesString = getTypesString(this.options.types);
    const scopeList = CONFIG_SCOPES.join(" ");
    const groupList = GROUP_BY_OPTIONS.join(" ");
    const sortList = SORT_BY_OPTIONS.join(" ");
    const signalList = SIGNAL_OPTIONS.join(" ");

    return `#compdef wm
# tldr ::: zsh completion script for waymark CLI

_wm() {
  local curcontext="$curcontext" state line
  typeset -A opt_args
  local -a _wm_types _wm_scopes _wm_groups _wm_sorts _wm_signals
  _wm_types=(${typesString})
  _wm_scopes=(${scopeList})
  _wm_groups=(${groupList})
  _wm_sorts=(${sortList})
  _wm_signals=(${signalList})

  local -a common_opts
  common_opts=(
    '(-v --version)'{-v,--version}'[Output version number]'
    '--config[Config file]:config:_files'
    "--scope[Config scope]:scope:(\${_wm_scopes})"
    '--verbose[Enable verbose logging]'
    '--debug[Enable debug logging]'
    '(-q --quiet)'{-q,--quiet}'[Only show errors]'
    '(-h --help)'{-h,--help}'[Display help]'
    '--prompt[Show agent-facing documentation]'
  )

  local -a filter_opts
  filter_opts=(
    '(-t --type)'{-t,--type}"[Filter by waymark type]:type:(\${_wm_types})"
    '--tag[Filter by hashtag]:tag:'
    '--mention[Filter by mention]:mention:'
    '(-r --raised)'{-r,--raised}'[Show only raised waymarks]'
    '(-s --starred)'{-s,--starred}'[Show only important waymarks]'
  )

  local -a output_opts
  output_opts=(
    '--json[Output as JSON]'
    '--jsonl[Output as JSON Lines]'
    '--pretty[Output as pretty JSON]'
  )

  local -a display_opts
  display_opts=(
    '--map[Show file tree with TLDRs]'
    '--graph[Show dependency graph]'
    '--summary[Show summary footer]'
    '--long[Show detailed information]'
    '--tree[Group by directory]'
    '--flat[Show flat list]'
    '--keep-comment-markers[Keep comment syntax]'
    '--compact[Compact output]'
    '--no-color[Disable colors]'
    "--group[Group by]:group:(\${_wm_groups})"
    "--sort[Sort by]:sort:(\${_wm_sorts})"
    '(-C --context)'{-C,--context}'[Context lines]:lines:'
    '(-A --after)'{-A,--after}'[Lines after]:lines:'
    '(-B --before)'{-B,--before}'[Lines before]:lines:'
    '--limit[Limit results]:limit:'
    '--page[Page number]:page:'
  )

  _arguments -C \\
    $common_opts \\
    '1: :->cmds' \\
    '*:: :->args'

  case $state in
    cmds)
      local -a commands
      commands=(
        'format:Format waymarks in a file'
        'insert:Insert waymarks into files'
        'modify:Modify existing waymarks'
        'remove:Remove waymarks from files'
        'lint:Validate waymark structure'
        'migrate:Migrate legacy comments'
        'init:Initialize waymark config'
        'update:Update CLI to latest version'
        'help:Display help for command'
      )
      _describe 'command' commands
      _arguments $filter_opts $output_opts $display_opts
      _files
      ;;
    args)
      case $line[1] in
        format)
          _arguments \\
            $common_opts \\
            '(-w --write)'{-w,--write}'[Write changes to file]' \\
            '*:file:_files'
          ;;
        insert)
          _arguments \\
            $common_opts \\
            '--from[Read from JSON file]:file:_files' \\
            '--mention[Add mention]:mention:' \\
            '--tag[Add hashtag]:tag:' \\
            '--property[Add property]:property:' \\
            '--ref[Set canonical reference]:ref:' \\
            '--depends[Add dependency]:depends:' \\
            '--needs[Add needs relation]:needs:' \\
            '--blocks[Add blocks relation]:blocks:' \\
            "--signal[Add signal]:signal:(\${_wm_signals})" \\
            '--json[Output as JSON]' \\
            '--jsonl[Output as JSON Lines]'
          ;;
        modify)
          _arguments \\
            $common_opts \\
            '--id[Modify by waymark ID]:id:' \\
            "--type[Change waymark type]:type:(\${_wm_types})" \\
            '--raise[Add raised signal]' \\
            '--mark-starred[Add starred signal]' \\
            '--clear-signals[Remove all signals]' \\
            '--content[Replace content]:text:' \\
            '(-w --write)'{-w,--write}'[Apply modifications]' \\
            '--interactive[Interactive flow]' \\
            '--json[Output as JSON]' \\
            '--jsonl[Output as JSON Lines]'
          ;;
        remove)
          _arguments \\
            $common_opts \\
            '(-w --write)'{-w,--write}'[Actually remove]' \\
            '--id[Remove by ID]:id:' \\
            '--from[Read from JSON file]:file:_files' \\
            '--criteria[Filter criteria]:criteria:' \\
            "--type[Filter by waymark type]:type:(\${_wm_types})" \\
            '--tag[Filter by hashtag]:tag:' \\
            '--mention[Filter by mention]:mention:' \\
            '--property[Filter by property]:property:' \\
            '--file[Filter by file pattern]:file:_files' \\
            '--content-pattern[Filter by content regex]:pattern:' \\
            '--contains[Filter by content substring]:text:' \\
            '--raised[Filter by raised signal]' \\
            '--starred[Filter by starred signal]' \\
            '--yes[Skip confirmation]' \\
            '--confirm[Force confirmation]' \\
            '--json[Output as JSON]' \\
            '--jsonl[Output as JSON Lines]'
          ;;
        lint)
          _arguments \\
            $common_opts \\
            '--json[Output as JSON]' \\
            '*:file:_files'
          ;;
        migrate)
          _arguments \\
            $common_opts \\
            '(-w --write)'{-w,--write}'[Write changes to file]' \\
            '*:file:_files'
          ;;
        init)
          _arguments \\
            $common_opts \\
            '(-f --format)'{-f,--format}'[Config format]:format:(toml jsonc yaml yml)' \\
            '(-p --preset)'{-p,--preset}'[Config preset]:preset:(full minimal)' \\
            '(-s --scope)'{-s,--scope}'[Config scope]:scope:(project user)' \\
            '--force[Overwrite existing]'
          ;;
        update)
          _arguments \\
            $common_opts \\
            '--dry-run[Print command without executing]' \\
            '--force[Run even if install method unknown]' \\
            '--yes[Skip confirmation]' \\
            '--command[Override update command]:command:'
          ;;
        help)
          local -a help_commands
          help_commands=(format insert modify remove lint migrate init update help)
          _describe 'command' help_commands
          ;;
      esac
      ;;
  esac
}

_wm "$@"
`;
  }
}
