// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// Entry point: initialization and component wiring

import { listFiles } from "./webdav.js";
import { initUpload } from "./upload.js";
import { initFileList } from "./file-list.js";
import { loadConfig, matchesAnyPattern } from "./config.js";
import type { AppConfig } from "./config.js";

/** Apply loaded config to the DOM */
function applyConfig(config: AppConfig): void {
  // Title
  if (config.title) {
    document.title = config.title;
    const titleEl = document.getElementById("page-title");
    if (titleEl) titleEl.textContent = config.title;
  }

  // Heading (uses title if heading is not set)
  const headingText = config.heading || config.title;
  if (headingText) {
    const headingEl = document.getElementById("page-heading");
    if (headingEl) headingEl.textContent = headingText;
  }

  // Footer
  const customFooter = document.getElementById("custom-footer");
  const defaultFooter = document.getElementById("default-footer");
  if (config.footer && customFooter && defaultFooter) {
    customFooter.innerHTML = config.footer;
    defaultFooter.classList.add("hidden");
  }

  // Upload enabled/disabled
  if (!config.upload_enabled) {
    const uploadWrapper = document.getElementById("upload-wrapper");
    if (uploadWrapper) uploadWrapper.classList.add("hidden");
  }

  // Delete enabled/disabled — store on dataset for file-list to read
  if (!config.delete_enabled) {
    const fileListSection = document.getElementById("filelist-section");
    if (fileListSection) fileListSection.dataset.deleteEnabled = "false";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const uploadContainer = document.getElementById("upload-section");
  const fileListContainer = document.getElementById("filelist-section");

  if (!uploadContainer || !fileListContainer) {
    console.error("Required DOM containers not found");
    return;
  }

  // Load config (cached or fetched)
  const config = await loadConfig();
  applyConfig(config);

  const baseUrl = window.location.href;

  // Initialize file list
  const fileList = initFileList({
    container: fileListContainer,
    onRefresh: () => loadFileList(),
    sortIgnoreCase: config.index_sort_ignore_case,
    sortVersion: config.index_sort_version,
  });

  // Initialize upload
  initUpload({
    container: uploadContainer,
    targetUrl: baseUrl,
    onAllComplete: () => loadFileList(),
  });

  // Load file list
  async function loadFileList(): Promise<void> {
    try {
      const allFiles = await listFiles(baseUrl);
      const files = allFiles.filter(
        (f) =>
          !matchesAnyPattern(f.name, config.index_exclude_names) &&
          !(config.index_ignore_dot_names && f.name.startsWith(".")) &&
          !(config.index_ignore_folders && f.isDirectory),
      );
      fileList.render(files);
    } catch (err) {
      console.error("Failed to load file list:", err);
      fileListContainer!.innerHTML = `<p class="error">ファイル一覧の取得に失敗しました。再読み込みしてください。</p>`;
    }
  }

  loadFileList();
});
