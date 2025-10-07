# Shell Completions for Waymark CLI

This directory contains shell completion scripts for the `wm` command across multiple shells.

## Installation

### Zsh

Add to your `~/.zshrc`:

```zsh
# Add waymark completions directory to fpath
fpath=(~/.local/share/waymark/completions $fpath)

# Initialize completions
autoload -Uz compinit && compinit
```

Then copy the completion file:

```bash
mkdir -p ~/.local/share/waymark/completions
cp _wm ~/.local/share/waymark/completions/
```

**Alternative (system-wide):**

```bash
sudo cp _wm /usr/local/share/zsh/site-functions/
```

### Bash

Add to your `~/.bashrc` or `~/.bash_profile`:

```bash
# Load waymark completions
source ~/.local/share/waymark/completions/wm.bash
```

Then copy the completion file:

```bash
mkdir -p ~/.local/share/waymark/completions
cp wm.bash ~/.local/share/waymark/completions/
```

**Alternative (system-wide):**

```bash
sudo cp wm.bash /usr/local/etc/bash_completion.d/
# or on Linux:
sudo cp wm.bash /etc/bash_completion.d/
```

### Fish

Copy the completion file to Fish's completions directory:

```bash
mkdir -p ~/.config/fish/completions
cp wm.fish ~/.config/fish/completions/
```

Fish will automatically load completions from this directory.

### PowerShell

Add to your PowerShell profile (`$PROFILE`):

```powershell
# Load waymark completions
. $env:USERPROFILE\.config\waymark\completions\wm.ps1
```

Then copy the completion file:

```powershell
mkdir -p $env:USERPROFILE\.config\waymark\completions
cp wm.ps1 $env:USERPROFILE\.config\waymark\completions\
```

To find your profile location, run:

```powershell
$PROFILE
```

### Nushell

Add to your Nushell config (`~/.config/nushell/config.nu`):

```nu
# Load waymark completions
source ~/.config/waymark/completions/wm.nu
```

Then copy the completion file:

```bash
mkdir -p ~/.config/waymark/completions
cp wm.nu ~/.config/waymark/completions/
```

## Automated Installation

You can also install completions automatically based on your detected shell:

```bash
# From the waymark repository root
bun run install:completions
```

This will detect your shell and install the appropriate completion script.

## Testing Completions

After installation, restart your shell or source the completion file, then test:

```bash
wm <TAB>           # Should show commands and options
wm format <TAB>    # Should show file completions
wm --type <TAB>    # Should show waymark types
```

## Supported Features

All completion scripts support:

- ✓ Command completion (format, insert, remove, lint, migrate, init, update, help)
- ✓ Option completion (--type, --tag, --mention, etc.)
- ✓ Value completion (waymark types, scopes, formats)
- ✓ File path completion
- ✓ Context-aware suggestions

## Troubleshooting

### Zsh: Completions not working

Ensure `compinit` is called after adding to `fpath`:

```zsh
fpath=(~/.local/share/waymark/completions $fpath)
autoload -Uz compinit && compinit
```

Rebuild completion cache:

```bash
rm -f ~/.zcompdump
exec zsh
```

### Bash: Completions not loading

Ensure bash-completion is installed:

```bash
# macOS (Homebrew)
brew install bash-completion@2

# Ubuntu/Debian
sudo apt-get install bash-completion

# Fedora/RHEL
sudo dnf install bash-completion
```

### Fish: Completions not appearing

Clear Fish's completion cache:

```bash
fish_update_completions
```

### PowerShell: Script execution disabled

Enable script execution:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Nushell: Module not found

Ensure the source path in config.nu is correct:

```bash
ls ~/.config/waymark/completions/wm.nu
```

## Contributing

If you find issues with completions or want to add support for more shells, please open an issue or PR in the waymark repository.
