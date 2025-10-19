// tldr ::: bash completion generator for waymark CLI

import type { CompletionGenerator, GeneratorOptions } from "./types.ts";
import {
  CONFIG_SCOPES,
  GROUP_BY_OPTIONS,
  getTypesString,
  SORT_BY_OPTIONS,
} from "./utils.ts";

export class BashGenerator implements CompletionGenerator {
  private readonly options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  getFilename(): string {
    return "wm.bash";
  }

  generate(): string {
    const typesString = getTypesString(this.options.types);
    const scopeValues = CONFIG_SCOPES.join(" ");
    const groupValues = GROUP_BY_OPTIONS.join(" ");
    const sortValues = SORT_BY_OPTIONS.join(" ");

    return `# tldr ::: bash completion script for waymark CLI

_wm_completion() {
  local cur prev opts commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Commands
  commands="format insert modify remove lint migrate init update help"

  # Common options
  opts="--version --config --scope --verbose --debug --quiet --help --prompt"

  # Command-specific completion
  case "\${COMP_WORDS[1]}" in
    format|fmt)
      case "\${prev}" in
        format|fmt)
          COMPREPLY=( $(compgen -f "\${cur}") )
          return 0
          ;;
        *)
          opts="\${opts} --write"
          COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
          return 0
          ;;
      esac
      ;;

    insert)
      case "\${prev}" in
        --from)
          COMPREPLY=( $(compgen -f "\${cur}") )
          return 0
          ;;
        --config)
          COMPREPLY=( $(compgen -f "\${cur}") )
          return 0
          ;;
        --signal)
          COMPREPLY=( $(compgen -W "^ *" -- \${cur}) )
          return 0
          ;;
        *)
          opts="\${opts} --from --mention --tag --property --ref --depends --needs --blocks --signal --json --jsonl"
          COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
          return 0
          ;;
      esac
      ;;

    modify)
      opts="\${opts} --id --type --raise --mark-starred --clear-signals --content --write --interactive --json --jsonl"
      COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
      return 0
      ;;

    remove)
      case "\${prev}" in
        --from)
          COMPREPLY=( $(compgen -f "\${cur}") )
          return 0
          ;;
        --config)
          COMPREPLY=( $(compgen -f "\${cur}") )
          return 0
          ;;
        --type)
          COMPREPLY=( $(compgen -W "${typesString}" -- \${cur}) )
          return 0
          ;;
        *)
          opts="\${opts} --write --id --from --criteria --type --tag --mention --property --file --content-pattern --contains --raised --starred --yes --confirm --json --jsonl"
          COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
          return 0
          ;;
      esac
      ;;

    lint)
      case "\${prev}" in
        lint)
          COMPREPLY=( $(compgen -f "\${cur}") )
          return 0
          ;;
        *)
          opts="\${opts} --json"
          COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
          return 0
          ;;
      esac
      ;;

    migrate)
      case "\${prev}" in
        migrate)
          COMPREPLY=( $(compgen -f "\${cur}") )
          return 0
          ;;
        *)
          opts="\${opts} --write"
          COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
          return 0
          ;;
      esac
      ;;

    init)
      case "\${prev}" in
        --format)
          COMPREPLY=( $(compgen -W "toml jsonc yaml yml" -- \${cur}) )
          return 0
          ;;
        --preset)
          COMPREPLY=( $(compgen -W "full minimal" -- \${cur}) )
          return 0
          ;;
        --scope)
          COMPREPLY=( $(compgen -W "project user" -- \${cur}) )
          return 0
          ;;
        --config)
          COMPREPLY=( $(compgen -f "\${cur}") )
          return 0
          ;;
        *)
          opts="\${opts} --format --preset --scope --force"
          COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
          return 0
          ;;
      esac
      ;;

    update)
      opts="\${opts} --dry-run --force --yes --command"
      COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
      return 0
      ;;

    help)
      COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
      return 0
      ;;

    *)
      # Main command (unified)
      case "\${prev}" in
        --type)
          COMPREPLY=( $(compgen -W "${typesString}" -- \${cur}) )
          return 0
          ;;
        --group)
          COMPREPLY=( $(compgen -W "${groupValues}" -- \${cur}) )
          return 0
          ;;
        --sort)
          COMPREPLY=( $(compgen -W "${sortValues}" -- \${cur}) )
          return 0
          ;;
        --scope)
          COMPREPLY=( $(compgen -W "${scopeValues}" -- \${cur}) )
          return 0
          ;;
        --config)
          COMPREPLY=( $(compgen -f "\${cur}") )
          return 0
          ;;
        --tag|--mention|--property|--ref|--depends|--needs|--blocks|--id|--criteria|--file|--content-pattern|--contains|--command)
          # These flags expect free-form values; fall back to default path/word completion
          ;;
        --limit|--page|--context|--after|--before)
          COMPREPLY=( $(compgen -W "" -- \${cur}) )
          return 0
          ;;
        *)
          # First arg: command or path
          if [[ \${COMP_CWORD} -eq 1 ]]; then
            local all_opts="\${commands} \${opts}"
            COMPREPLY=( $(compgen -W "\${all_opts}" -- \${cur}) )
            COMPREPLY+=( $(compgen -f -- "\${cur}") )
          else
            # Subsequent args: options or paths
            local main_opts="\${opts} --type --tag --mention --raised --starred --map --graph --summary --json --jsonl --pretty --long --tree --flat --keep-comment-markers --compact --no-color --group --sort --context --after --before --limit --page"
            COMPREPLY=( $(compgen -W "\${main_opts}" -- \${cur}) )
            COMPREPLY+=( $(compgen -f -- "\${cur}") )
          fi
          return 0
          ;;
      esac
      ;;
  esac
}

complete -F _wm_completion wm
`;
  }
}
