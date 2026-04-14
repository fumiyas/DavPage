DavPage
======================================================================

A lightweight, single-file WebDAV folder explorer for the browser.

Deploy one `davpage.html` to your WebDAV folder and get a full-featured
file management UI — no server-side setup beyond a standard WebDAV server.

## Features

- **Single-file deployment** — build produces a self-contained
  `dist/davpage.html` (HTML + CSS + JS inlined) that you simply copy to your
  WebDAV folder
- **Multi-file upload** with drag & drop, per-file progress, and cancel
- **Inline file viewing** — open PDFs, images, text, audio/video directly
  in the browser
- **File list with sorting** — sort by name, size, or date
- **Row-click selection** for batch delete
- **Configurable** via a simple config file (`davpage.conf`) placed alongside
  `davpage.html`
- **Zero runtime dependencies** — pure vanilla JS in the browser
- **No mod_autoindex dependency** — uses WebDAV PROPFIND to list files

## Requirements

- A WebDAV server (Apache httpd + mod_dav, Nginx + ngx-dav, etc.)
- A modern browser (ES2022+)

## Quick Start

```bash
# Install dev dependencies
make deps

# Build dist/davpage.html
make build

# Copy to your WebDAV folder
cp dist/davpage.html /path/to/your/webdav/folder/
```

## Development

### Prerequisites

- Node.js >= 20
- GNU Make

### Commands

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `make deps`      | Install dependencies                         |
| `make build`     | Build `dist/davpage.html`                    |
| `make test`      | Run tests                                    |
| `make lint`      | Type-check with `tsc`                        |
| `make serve`     | Start a local test WebDAV server             |
| `make dev`       | Build in watch mode + start test server      |
| `make clean`     | Remove build artifacts                       |
| `make distclean` | Remove build artifacts and `node_modules`    |
| `make help`      | Show all available targets                   |

### Project Structure

```
src/
  main.ts          — Entry point
  webdav.ts        — WebDAV client (PROPFIND, PUT, DELETE)
  upload.ts        — Multi-file upload UI
  file-list.ts     — File list table with sorting and selection
  viewer.ts        — Inline file viewing (MIME detection)
  config.ts        — Config file parser and loader
  styles.css       — Stylesheet
  davpage.html     — HTML template
  __tests__/       — Unit and integration tests
scripts/
  build.ts         — esbuild bundler (produces single HTML)
  serve.ts         — Test WebDAV server
dist/
  davpage.html     — Built output (deploy this)
```

## Configuration

Place a `davpage.conf` file in the same directory as `davpage.html`.
If the file is absent or returns 404, default settings are used.

The format is a TOML subset supporting strings, multi-line strings,
booleans, string arrays, and `#` comments.

### Example

```toml
# Page title (supports placeholder variables)
title = "File Exchange — ${folderName}"

# Heading (defaults to title if omitted)
heading = "Shared Files: ${folderName}"

# Footer HTML (replaces the default notice)
footer = """
<h2>Notice</h2>
<div class="notice">
  <em>Do not share the URL with unauthorized parties.</em>
</div>
"""

# Enable/disable upload and delete UI
upload_enabled = true
delete_enabled = true

# Hide sub-folders from the file list
index_ignore_folders = false

# Hide dot-files and dot-folders (names starting with ".") from the file list
index_ignore_dot_names = true

# Glob patterns to exclude from the file list
index_exclude_names = ["davpage.*", "index.htm*", ".ht*"]

# Sort file names case-insensitively
index_sort_ignore_case = false

# Sort file names with version/natural order (e.g., foo-2 before foo-10)
index_sort_version = true
```

### Placeholder Variables

| Variable        | Description                                      |
| --------------- | ------------------------------------------------ |
| `${baseUrl}`    | URL without the path (scheme + host + port)      |
| `${folderName}` | Last path segment (parent directory name)        |
| `${path}`       | Full URL path                                    |

### Caching

Config is cached in `sessionStorage` for the browser session.
On normal page loads the cached config is used immediately while
a background fetch updates the cache for the next load.
A hard reload (Ctrl+Shift+R) bypasses the HTTP cache, causing a
fresh fetch.

## License

Copyright (C) 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 3 of the License.

See [LICENSE](LICENSE) for the full text.
