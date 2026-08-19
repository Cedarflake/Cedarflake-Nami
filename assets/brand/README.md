# Brand assets

This directory is the source of truth for checked-in Nami brand images.

| Source | Responsibility |
| --- | --- |
| `wordmark.webp` | General Nami wordmark used by the repository README |
| `favicon.webp` | High-resolution product artwork used by the documentation homepage |
| `favicon.ico` | Canonical product icon used in application navigation, site favicons, and QR codes |

Replace a source file without changing its filename, then run these commands from the repository root:

```bash
pnpm assets:sync
pnpm assets:check
```

The sync command copies browser assets into the WebUI and documentation public directories and generates the Runtime favicon module. Generated destinations must not be edited directly.
