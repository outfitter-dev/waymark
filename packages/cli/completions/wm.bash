# tldr ::: bash completion script for waymark CLI

_wm_completion() {
  local cur prev opts commands
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  # Commands
  commands="format insert modify remove lint migrate init update help"

  # Common options
  opts="--version --scope --verbose --debug --quiet --help --prompt"

  # Command-specific completion
  case "${COMP_WORDS[1]}" in
    format|fmt)
      case "${prev}" in
        format|fmt)
          COMPREPLY=( $(compgen -f "${cur}") )
          return 0
          ;;
        *)
          opts="${opts} --write"
          COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
          return 0
          ;;
      esac
      ;;

    insert)
      case "${prev}" in
        --from)
          COMPREPLY=( $(compgen -f "${cur}") )
          return 0
          ;;
        --signal)
          COMPREPLY=( $(compgen -W "^ *" -- ${cur}) )
          return 0
          ;;
        *)
          opts="${opts} --from --mention --tag --property --ref --depends --needs --blocks --signal --json --jsonl"
          COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
          return 0
          ;;
      esac
      ;;

    modify)
      opts="${opts} --id --type --raise --important --no-signal --content --write --interactive --json --jsonl"
      COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
      return 0
      ;;

    remove)
      case "${prev}" in
        --from)
          COMPREPLY=( $(compgen -f "${cur}") )
          return 0
          ;;
        *)
          opts="${opts} --write --id --from --criteria --yes --confirm --json --jsonl"
          COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
          return 0
          ;;
      esac
      ;;

    lint)
      case "${prev}" in
        lint)
          COMPREPLY=( $(compgen -f "${cur}") )
          return 0
          ;;
        *)
          opts="${opts} --json"
          COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
          return 0
          ;;
      esac
      ;;

    migrate)
      case "${prev}" in
        migrate)
          COMPREPLY=( $(compgen -f "${cur}") )
          return 0
          ;;
        *)
          opts="${opts} --write"
          COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
          return 0
          ;;
      esac
      ;;

    init)
      case "${prev}" in
        --format)
          COMPREPLY=( $(compgen -W "toml jsonc yaml yml" -- ${cur}) )
          return 0
          ;;
        --preset)
          COMPREPLY=( $(compgen -W "full minimal" -- ${cur}) )
          return 0
          ;;
        --scope)
          COMPREPLY=( $(compgen -W "project user" -- ${cur}) )
          return 0
          ;;
        *)
          opts="${opts} --format --preset --scope --force"
          COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
          return 0
          ;;
      esac
      ;;

    update)
      opts="${opts} --dry-run --force --yes --command"
      COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
      return 0
      ;;

    help)
      COMPREPLY=( $(compgen -W "${commands}" -- ${cur}) )
      return 0
      ;;

    *)
      # Main command (unified)
      case "${prev}" in
        --type)
          COMPREPLY=( $(compgen -W "todo fix wip done review test check note context tldr this example idea comment warn alert deprecated temp hack blocked needs question" -- ${cur}) )
          return 0
          ;;
        --group)
          COMPREPLY=( $(compgen -W "file dir type" -- ${cur}) )
          return 0
          ;;
        --sort)
          COMPREPLY=( $(compgen -W "file line type modified" -- ${cur}) )
          return 0
          ;;
        --scope)
          COMPREPLY=( $(compgen -W "default project user" -- ${cur}) )
          return 0
          ;;
        *)
          # First arg: command or path
          if [[ ${COMP_CWORD} -eq 1 ]]; then
            local all_opts="${commands} ${opts}"
            COMPREPLY=( $(compgen -W "${all_opts}" -- ${cur}) )
            compgen -f "${cur}" >> COMPREPLY
          else
            # Subsequent args: options or paths
            local main_opts="${opts} --type --tag --mention --raised --starred --map --graph --summary --json --jsonl --pretty --long --tree --flat --keep-comment-markers --compact --no-color --group --sort --context --after --before --limit --page"
            COMPREPLY=( $(compgen -W "${main_opts}" -- ${cur}) )
            compgen -f "${cur}" >> COMPREPLY
          fi
          return 0
          ;;
      esac
      ;;
  esac
}

complete -F _wm_completion wm
