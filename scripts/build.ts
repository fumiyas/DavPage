// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// Build script: bundle TS/CSS with esbuild into a single HTML file

import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = resolve(ROOT, "src");
const DIST = resolve(ROOT, "dist");

const isWatch = process.argv.includes("--watch");

async function build(): Promise<void> {
  mkdirSync(DIST, { recursive: true });

  // JS バンドル
  const jsResult = await esbuild.build({
    entryPoints: [resolve(SRC, "main.ts")],
    bundle: true,
    minify: !isWatch,
    format: "iife",
    target: "es2022",
    write: false,
    sourcemap: isWatch ? "inline" : false,
  });
  const jsCode = jsResult.outputFiles[0].text;

  // CSS バンドル
  const cssResult = await esbuild.build({
    entryPoints: [resolve(SRC, "styles.css")],
    bundle: true,
    minify: !isWatch,
    write: false,
  });
  const cssCode = cssResult.outputFiles[0].text;

  // Embed into HTML template
  // Use split/join instead of replace to avoid $ replacement patterns in JS code
  const htmlTemplate = readFileSync(resolve(SRC, "davpage.html"), "utf-8");
  const html = htmlTemplate
    .split("/* __INLINE_CSS__ */").join(cssCode)
    .split("/* __INLINE_JS__ */").join(jsCode);

  const outPath = resolve(DIST, "davpage.html");
  writeFileSync(outPath, html, "utf-8");
  console.log(`Built: ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
}

if (isWatch) {
  console.log("Watching for changes...");
  const chokidar = await import("node:fs").then((fs) => fs.watch);

  // 初回ビルド
  await build();

  // Watch src/ and rebuild
  const { watch } = await import("node:fs");
  watch(SRC, { recursive: true }, async (_event, filename) => {
    if (!filename) return;
    console.log(`Changed: ${filename}`);
    try {
      await build();
    } catch (err) {
      console.error("Build error:", err);
    }
  });
} else {
  await build();
}
