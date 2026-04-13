// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// テスト用 WebDAV サーバー起動スクリプト
// Usage: node --import=tsx scripts/serve.ts [port]

import { v2 as webdav } from "webdav-server";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const WEBDAV_ROOT = resolve(ROOT, "tmp", "webdav");
const PORT = parseInt(process.argv[2] ?? "18080", 10);

// Create test directory and sample files
function setupTestFiles(): void {
  const dirs = [
    WEBDAV_ROOT,
    resolve(WEBDAV_ROOT, "documents"),
    resolve(WEBDAV_ROOT, "images"),
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }

  const files: Record<string, string> = {
    "README.txt": "WebDAV テスト用ファイルです。\n",
    "hello.txt": "Hello, WebDAV!\nこれはテスト用のテキストファイルです。\n",
    "data.csv": "名前,年齢,メール\n太郎,30,taro@example.com\n花子,25,hanako@example.com\n",
    "documents/report.txt": "月次レポート\n\n内容はダミーです。\n",
    "sample.html": "<!DOCTYPE html>\n<html><head><title>Sample</title></head><body><h1>Hello</h1></body></html>\n",
    "davpage.conf": [
      "# DavPage configuration (sample)",
      '# title = "File Exchange — ${dirName}"',
      '# heading = "Files: ${dirName}"',
      "",
      "# footer = \"\"\"",
      "# <h2>Notice</h2>",
      "# <div class=\"notice\">",
      "#   <em>This is a shared folder.</em>",
      "# </div>",
      '# """',
      "",
      "# upload_enabled = true",
      "# delete_enabled = true",
      "",
      "# Hide sub-folders from the file list",
      "# index_ignore_folders = false",
      "",
      "# Hide dot-files and dot-folders (names starting with \".\")",
      "# index_ignore_dot_names = true",
      "",
      "# Glob patterns to exclude from the file list (TOML string array)",
      '# index_exclude_names = ["davpage.*", "index.htm*", ".ht*"]',
      "",
      "# Sort file names case-insensitively",
      "# index_sort_ignore_case = false",
      "",
      "# Sort file names with version/natural order (e.g., foo-2 before foo-10)",
      "# index_sort_version = true",
      "",
    ].join("\n"),
  };

  for (const [name, content] of Object.entries(files)) {
    const filePath = resolve(WEBDAV_ROOT, name);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, "utf-8");
    }
  }
}

setupTestFiles();

// Copy dist/davpage.html to WebDAV root
const srcIndex = resolve(ROOT, "dist", "davpage.html");
const dstIndex = resolve(WEBDAV_ROOT, "davpage.html");
if (existsSync(srcIndex)) {
  writeFileSync(dstIndex, readFileSync(srcIndex));
  console.error(`Deployed: dist/davpage.html → ${dstIndex}`);
} else {
  console.error("Warning: dist/davpage.html not found. Run 'make build' first.");
}

// Logging helpers — output to stderr with ISO 8601 timestamp
function logAccess(method: string, url: string, status: number, message?: string): void {
  const ts = new Date().toISOString();
  const msg = message ? ` ${message}` : "";
  process.stderr.write(`${ts} [access] ${method} ${url} ${status}${msg}\n`);
}

function logError(method: string, url: string, error: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`${ts} [error] ${method} ${url} ${error}\n`);
}

function logInfo(message: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`${ts} [info] ${message}\n`);
}

const server = new webdav.WebDAVServer({
  port: PORT,
  rootFileSystem: new webdav.PhysicalFileSystem(WEBDAV_ROOT),
});

// Serve davpage.html for GET requests to directories
server.beforeRequest((ctx, next) => {
  const req = ctx.request;
  const method = req.method ?? "";
  const url = req.url ?? "/";

  if (method === "GET" && url.endsWith("/")) {
    const decodedPath = decodeURIComponent(url);
    const indexPath = resolve(WEBDAV_ROOT, "." + decodedPath, "davpage.html");

    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath);
      const res = ctx.response;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Length", content.length);
      res.writeHead(200);
      res.end(content);
      logAccess(method, url, 200, "→ davpage.html");
      return; // Skip WebDAV processing
    }
  }

  next();
});

// Enforce If-None-Match: * on PUT (webdav-server ignores it by default)
server.beforeRequest((ctx, next) => {
  const req = ctx.request;
  const method = req.method ?? "";
  const url = req.url ?? "/";

  if (method === "PUT" && req.headers["if-none-match"] === "*") {
    const decodedPath = decodeURIComponent(url);
    const targetPath = resolve(WEBDAV_ROOT, "." + decodedPath);

    if (existsSync(targetPath)) {
      const res = ctx.response;
      res.writeHead(412, "Precondition Failed");
      res.end();
      logAccess(method, url, 412, "If-None-Match: * (resource exists)");
      return;
    }
  }

  next();
});

// Access log: runs after each request is handled
server.afterRequest((ctx, next) => {
  const req = ctx.request;
  const res = ctx.response;
  const method = req.method ?? "UNKNOWN";
  const url = req.url ?? "/";
  const status = res.statusCode;
  logAccess(method, url, status);
  next();
});

// Error log: capture response errors via status codes
server.beforeRequest((ctx, next) => {
  const origSetCode = ctx.setCode.bind(ctx);
  ctx.setCode = (code: number, message?: string) => {
    if (code >= 400) {
      const method = ctx.request.method ?? "UNKNOWN";
      const url = ctx.request.url ?? "/";
      logError(method, url, `${code}${message ? " " + message : ""}`);
    }
    origSetCode(code, message);
  };
  next();
});

server.start(() => {
  logInfo(`WebDAV server started on port ${PORT}`);
  logInfo(`Root: ${WEBDAV_ROOT}`);
  console.error("");
  console.error(`  URL:  http://localhost:${PORT}/`);
  console.error(`  Root: ${WEBDAV_ROOT}`);
  console.error("");
  console.error(`  Open http://localhost:${PORT}/ in your browser.`);
  console.error(`  Press Ctrl+C to stop.`);
  console.error("");
});
