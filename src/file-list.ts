// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// File list UI (rendering, sorting, row selection, actions)

import type { FileInfo } from "./webdav.js";
import { deleteResource } from "./webdav.js";
import { getViewableMime, openInlineView } from "./viewer.js";
import { showError } from "./notifications.js";

export interface FileListOptions {
  container: HTMLElement;
  onRefresh: () => void;
  sortIgnoreCase?: boolean;
  sortVersion?: boolean;
}

type SortKey = "name" | "size" | "lastModified";
type SortDir = "asc" | "desc";

export function initFileList({ container, onRefresh, sortIgnoreCase = false, sortVersion = true }: FileListOptions) {
  const selected = new Set<string>();
  let currentFiles: FileInfo[] = [];
  let sortKey: SortKey = "name";
  let sortDir: SortDir = "asc";
  const deleteEnabled = container.dataset.deleteEnabled !== "false";

  // 削除ボタン
  const toolbar = document.createElement("div");
  toolbar.className = "filelist-toolbar";
  if (!deleteEnabled) toolbar.classList.add("hidden");

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-danger";
  deleteBtn.textContent = "選択したファイルを削除";
  deleteBtn.disabled = true;
  deleteBtn.addEventListener("click", () => handleDelete());

  const selectedCount = document.createElement("span");
  selectedCount.className = "filelist-selected-count";

  toolbar.append(deleteBtn, selectedCount);

  const tableWrapper = document.createElement("div");
  tableWrapper.className = "filelist-table-wrapper";

  container.innerHTML = "";
  container.append(toolbar, tableWrapper);

  function render(files: FileInfo[]): void {
    currentFiles = files;
    selected.clear();
    updateSelectionUI();

    const sorted = [...files].sort((a, b) => {
      // Directories always come first
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = compareNames(a.name, b.name, sortIgnoreCase, sortVersion);
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "lastModified":
          cmp = a.lastModified.getTime() - b.lastModified.getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    const table = document.createElement("table");
    table.className = "filelist-table";

    // ヘッダー
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const thCheck = document.createElement("th");
    thCheck.className = "col-check";
    if (!deleteEnabled) thCheck.classList.add("hidden");
    const selectAllCb = document.createElement("input");
    selectAllCb.type = "checkbox";
    selectAllCb.title = "すべて選択/解除";
    selectAllCb.addEventListener("change", () => {
      if (selectAllCb.checked) {
        sorted.forEach((f) => selected.add(f.href));
      } else {
        selected.clear();
      }
      updateRowSelection(table);
      updateSelectionUI();
    });
    thCheck.appendChild(selectAllCb);

    const thName = createSortableHeader("名前", "name");
    const thSize = createSortableHeader("サイズ", "size");
    const thDate = createSortableHeader("更新日時", "lastModified");
    const thAction = document.createElement("th");
    thAction.className = "col-action";
    thAction.textContent = "操作";

    headerRow.append(thCheck, thName, thSize, thDate, thAction);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // ボディ
    const tbody = document.createElement("tbody");
    for (const file of sorted) {
      const tr = document.createElement("tr");
      tr.className = "filelist-row";
      tr.dataset.href = file.href;

      // チェックボックス列
      const tdCheck = document.createElement("td");
      tdCheck.className = "col-check";
      if (!deleteEnabled) tdCheck.classList.add("hidden");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = selected.has(file.href);
      cb.addEventListener("click", (e) => e.stopPropagation());
      cb.addEventListener("change", () => {
        toggleSelection(file.href, cb.checked);
        updateRowHighlight(tr, file.href);
        updateSelectionUI();
      });
      tdCheck.appendChild(cb);

      // 名前列
      const tdName = document.createElement("td");
      tdName.className = "col-name";
      const nameLink = document.createElement("a");
      nameLink.href = file.href;
      nameLink.textContent = file.isDirectory ? `${file.name}/` : file.name;
      if (!file.isDirectory) {
        nameLink.download = file.name;
      }
      nameLink.addEventListener("click", (e) => e.stopPropagation());
      tdName.appendChild(nameLink);

      // サイズ列
      const tdSize = document.createElement("td");
      tdSize.className = "col-size";
      tdSize.textContent = file.isDirectory ? "-" : formatSize(file.size);

      // 更新日時列
      const tdDate = document.createElement("td");
      tdDate.className = "col-date";
      tdDate.textContent = formatDate(file.lastModified);

      // 操作列
      const tdAction = document.createElement("td");
      tdAction.className = "col-action";

      if (!file.isDirectory) {
        // ダウンロードボタン
        const dlBtn = document.createElement("a");
        dlBtn.href = file.href;
        dlBtn.download = file.name;
        dlBtn.className = "btn btn-small";
        dlBtn.textContent = "DL";
        dlBtn.title = "ダウンロード";
        dlBtn.addEventListener("click", (e) => e.stopPropagation());
        tdAction.appendChild(dlBtn);

        // Inline view button (for supported types only)
        if (getViewableMime(file.name)) {
          const viewBtn = document.createElement("button");
          viewBtn.type = "button";
          viewBtn.className = "btn btn-small";
          viewBtn.textContent = "表示";
          viewBtn.title = "ブラウザで表示";
          viewBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            try {
              await openInlineView(file.href, file.name);
            } catch (err) {
              alert(`表示エラー: ${err instanceof Error ? err.message : err}`);
            }
          });
          tdAction.appendChild(viewBtn);
        }
      }

      tr.append(tdCheck, tdName, tdSize, tdDate, tdAction);

      // Row click to toggle selection
      if (deleteEnabled) {
        tr.addEventListener("click", () => {
          const nowSelected = !selected.has(file.href);
          toggleSelection(file.href, nowSelected);
          cb.checked = nowSelected;
          updateRowHighlight(tr, file.href);
          updateSelectionUI();
        });
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    tableWrapper.innerHTML = "";
    if (sorted.length === 0) {
      const empty = document.createElement("p");
      empty.className = "filelist-empty";
      empty.textContent = "ファイルがありません。";
      tableWrapper.appendChild(empty);
    } else {
      tableWrapper.appendChild(table);
    }
  }

  function createSortableHeader(label: string, key: SortKey): HTMLTableCellElement {
    const th = document.createElement("th");
    th.className = `col-${key} sortable`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    if (sortKey === key) {
      btn.textContent += sortDir === "asc" ? " ▲" : " ▼";
    }
    btn.addEventListener("click", () => {
      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDir = "asc";
      }
      render(currentFiles);
    });
    th.appendChild(btn);
    return th;
  }

  function toggleSelection(href: string, select: boolean): void {
    if (select) {
      selected.add(href);
    } else {
      selected.delete(href);
    }
  }

  function updateRowHighlight(tr: HTMLElement, href: string): void {
    tr.classList.toggle("selected", selected.has(href));
  }

  function updateRowSelection(table: HTMLTableElement): void {
    for (const tr of table.querySelectorAll<HTMLTableRowElement>("tbody tr")) {
      const href = tr.dataset.href;
      if (!href) continue;
      const cb = tr.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (cb) cb.checked = selected.has(href);
      tr.classList.toggle("selected", selected.has(href));
    }
  }

  function updateSelectionUI(): void {
    const count = selected.size;
    deleteBtn.disabled = count === 0;
    selectedCount.textContent = count > 0 ? `${count} 件選択中` : "";
  }

  async function handleDelete(): Promise<void> {
    if (selected.size === 0) return;

    const names = currentFiles
      .filter((f) => selected.has(f.href))
      .map((f) => (f.isDirectory ? `${f.name}/` : f.name));

    if (!confirm(`選択した ${names.length} 件を削除しますか?\n\n${names.join("\n")}`)) {
      return;
    }

    deleteBtn.disabled = true;
    document.body.style.cursor = "wait";

    const results = await Promise.allSettled(
      [...selected].map((href) => deleteResource(href)),
    );

    document.body.style.cursor = "";

    const errors: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        errors.push(`${[...selected][i]}: ${r.reason}`);
      } else if (r.value.status !== 204 && r.value.status !== 200) {
        errors.push(`${[...selected][i]}: HTTP ${r.value.status}`);
      }
    });

    if (errors.length > 0) {
      showError(`削除でエラーが発生しました:\n${errors.join("\n")}`);
    }

    selected.clear();
    onRefresh();
  }

  return { render };
}

/**
 * Split a string into alternating text and numeric segments.
 * E.g., "foo-10.tar.gz" → ["foo-", 10, ".tar.gz"]
 */
export function splitNameChunks(name: string): (string | number)[] {
  const chunks: (string | number)[] = [];
  const re = /(\d+)/;
  for (const part of name.split(re)) {
    if (part === "") continue;
    const num = Number(part);
    chunks.push(Number.isNaN(num) ? part : num);
  }
  return chunks;
}

/** Compare two strings by Unicode codepoint order (like POSIX C locale) */
function codepointCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Compare two file names with optional case-insensitive and version-aware sort */
export function compareNames(
  a: string,
  b: string,
  ignoreCase: boolean,
  versionSort: boolean,
): number {
  // Case-insensitive: use localeCompare with sensitivity "base"
  // Case-sensitive: use codepoint order (uppercase before lowercase, like POSIX C locale)
  const compareStrings = ignoreCase
    ? (s1: string, s2: string) => s1.localeCompare(s2, undefined, { sensitivity: "base" })
    : codepointCompare;

  if (!versionSort) {
    return compareStrings(a, b);
  }

  // Natural/version sort: compare chunk by chunk
  const chunksA = splitNameChunks(ignoreCase ? a.toLowerCase() : a);
  const chunksB = splitNameChunks(ignoreCase ? b.toLowerCase() : b);
  const len = Math.min(chunksA.length, chunksB.length);

  for (let i = 0; i < len; i++) {
    const ca = chunksA[i];
    const cb = chunksB[i];

    // Both numbers — compare numerically
    if (typeof ca === "number" && typeof cb === "number") {
      if (ca !== cb) return ca - cb;
      continue;
    }

    // Both strings — compare lexicographically
    if (typeof ca === "string" && typeof cb === "string") {
      const cmp = compareStrings(ca, cb);
      if (cmp !== 0) return cmp;
      continue;
    }

    // Mixed: number before string
    return typeof ca === "number" ? -1 : 1;
  }

  return chunksA.length - chunksB.length;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(date: Date): string {
  if (date.getTime() === 0) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
