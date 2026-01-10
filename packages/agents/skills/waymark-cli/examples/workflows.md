<!-- tldr ::: multi-command workflows for waymark CLI -->

# Workflows

## Find and Resolve TODOs

```bash
wm find src/ --type todo --json | jq 'length'
wm find src/ --type todo
```

## Remove Completed Work

```bash
wm find src/ --type done --json \
  | jq -r '.[] | "\(.file):\(.startLine)"' \
  | xargs -I {} wm rm {} --write
```

## Format Then Lint

```bash
wm fmt src/ --write
wm lint src/ --json
```
