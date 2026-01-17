<!-- tldr ::: exit code taxonomy for the wm CLI -->

# Exit Codes

Waymark commands return consistent exit codes for scripting and CI.

| Code | Name | Meaning |
| --- | --- | --- |
| 0 | success | Operation completed successfully |
| 1 | failure | Waymark-level error (lint errors, operation failures) |
| 2 | usage error | Invalid flags or arguments |
| 3 | config error | Invalid configuration or missing config |
| 4 | I/O error | File system failure (missing files, permissions) |

## CI Patterns

- Fail build on `!= 0`.
- Distinguish usage/config errors for developer feedback.

## Signal Codes

- SIGINT exits with 130
- SIGTERM exits with 143
