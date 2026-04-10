// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// 複数ファイルアップロード UI & ロジック

import { uploadFile } from "./webdav.js";

export interface UploadManagerOptions {
  container: HTMLElement;
  targetUrl: string;
  onAllComplete: () => void;
}

interface QueuedFile {
  file: File;
  id: string;
}

let fileIdCounter = 0;

export function initUpload({ container, targetUrl, onAllComplete }: UploadManagerOptions): void {
  const queue: QueuedFile[] = [];

  // --- DOM 構築 ---
  container.innerHTML = "";

  const dropZone = document.createElement("div");
  dropZone.className = "upload-dropzone";
  dropZone.textContent = "ファイルをドラッグ＆ドロップ、またはクリックして選択";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.multiple = true;
  fileInput.className = "upload-input-hidden";

  const fileListEl = document.createElement("ul");
  fileListEl.className = "upload-file-list";

  const controls = document.createElement("div");
  controls.className = "upload-controls";

  const uploadBtn = document.createElement("button");
  uploadBtn.type = "button";
  uploadBtn.textContent = "アップロード開始";
  uploadBtn.className = "btn btn-primary";
  uploadBtn.disabled = true;

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "すべて取消";
  clearBtn.className = "btn";
  clearBtn.disabled = true;

  controls.append(uploadBtn, clearBtn);

  const progressArea = document.createElement("div");
  progressArea.className = "upload-progress hidden";

  const overallLabel = document.createElement("span");
  overallLabel.className = "upload-overall-label";

  const overallBar = document.createElement("progress");
  overallBar.className = "upload-overall-bar";
  overallBar.max = 100;
  overallBar.value = 0;

  progressArea.append(overallLabel, overallBar);

  container.append(dropZone, fileInput, fileListEl, controls, progressArea);

  // --- イベント ---
  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer?.files) {
      addFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files) {
      addFiles(fileInput.files);
      fileInput.value = "";
    }
  });

  uploadBtn.addEventListener("click", () => startUpload());
  clearBtn.addEventListener("click", () => clearAll());

  // --- ロジック ---
  function addFiles(files: FileList): void {
    for (const file of files) {
      const id = `upload-${++fileIdCounter}`;
      queue.push({ file, id });
    }
    renderQueue();
  }

  function removeFile(id: string): void {
    const idx = queue.findIndex((q) => q.id === id);
    if (idx >= 0) queue.splice(idx, 1);
    renderQueue();
  }

  function clearAll(): void {
    queue.length = 0;
    renderQueue();
  }

  function renderQueue(): void {
    fileListEl.innerHTML = "";
    for (const item of queue) {
      const li = document.createElement("li");
      li.className = "upload-file-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "upload-file-name";
      nameSpan.textContent = item.file.name;

      const sizeSpan = document.createElement("span");
      sizeSpan.className = "upload-file-size";
      sizeSpan.textContent = formatSize(item.file.size);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-remove";
      removeBtn.textContent = "✕";
      removeBtn.title = "取消";
      removeBtn.addEventListener("click", () => removeFile(item.id));

      li.append(nameSpan, sizeSpan, removeBtn);
      fileListEl.appendChild(li);
    }

    const hasFiles = queue.length > 0;
    uploadBtn.disabled = !hasFiles;
    clearBtn.disabled = !hasFiles;
  }

  async function startUpload(): Promise<void> {
    if (queue.length === 0) return;

    const filesToUpload = [...queue];
    queue.length = 0;

    uploadBtn.disabled = true;
    clearBtn.disabled = true;
    dropZone.classList.add("disabled");
    fileInput.disabled = true;
    progressArea.classList.remove("hidden");

    const total = filesToUpload.length;
    let completed = 0;
    let hasError = false;

    fileListEl.innerHTML = "";
    for (const item of filesToUpload) {
      const li = document.createElement("li");
      li.className = "upload-file-item uploading";

      const nameSpan = document.createElement("span");
      nameSpan.className = "upload-file-name";
      nameSpan.textContent = item.file.name;

      const bar = document.createElement("progress");
      bar.className = "upload-file-bar";
      bar.max = 100;
      bar.value = 0;

      const statusSpan = document.createElement("span");
      statusSpan.className = "upload-file-status";
      statusSpan.textContent = "待機中";

      li.append(nameSpan, bar, statusSpan);
      fileListEl.appendChild(li);

      try {
        statusSpan.textContent = "アップロード中…";
        const result = await uploadFile(targetUrl, item.file, (loaded, fileTotal) => {
          const pct = (loaded / fileTotal) * 100;
          bar.value = pct;
        });

        if (result.status === 201 || result.status === 204) {
          bar.value = 100;
          statusSpan.textContent = "✓ 完了";
          li.classList.add("done");
        } else {
          statusSpan.textContent = `✗ エラー (${result.status})`;
          li.classList.add("error");
          hasError = true;
        }
      } catch {
        statusSpan.textContent = "✗ ネットワークエラー";
        li.classList.add("error");
        hasError = true;
      }

      completed++;
      overallBar.value = (completed / total) * 100;
      overallLabel.textContent = `${completed} / ${total} ファイル`;
    }

    overallLabel.textContent = hasError
      ? `完了 (${completed} 中一部エラーあり)`
      : `全 ${completed} ファイル完了`;

    setTimeout(() => {
      progressArea.classList.add("hidden");
      overallBar.value = 0;
      dropZone.classList.remove("disabled");
      fileInput.disabled = false;
      renderQueue();
      onAllComplete();
    }, 1500);
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
