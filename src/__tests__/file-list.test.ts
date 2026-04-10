// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// file-list.ts ユニットテスト — DOM 描画、ソート、行選択

import { describe, it, expect, vi, beforeEach } from "vitest";
import { initFileList } from "../file-list.js";
import type { FileInfo } from "../webdav.js";

function makeFiles(): FileInfo[] {
  return [
    {
      name: "alpha.txt",
      href: "/dav/alpha.txt",
      size: 100,
      lastModified: new Date("2026-01-10T00:00:00Z"),
      contentType: "text/plain",
      isDirectory: false,
    },
    {
      name: "beta.pdf",
      href: "/dav/beta.pdf",
      size: 50000,
      lastModified: new Date("2026-02-20T00:00:00Z"),
      contentType: "application/pdf",
      isDirectory: false,
    },
    {
      name: "subdir",
      href: "/dav/subdir/",
      size: 0,
      lastModified: new Date("2026-03-01T00:00:00Z"),
      contentType: "httpd/unix-directory",
      isDirectory: true,
    },
  ];
}

describe("initFileList", () => {
  let container: HTMLDivElement;
  let onRefresh: () => void;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    onRefresh = vi.fn() as unknown as () => void;
  });

  it("ファイル一覧をテーブルとして描画する", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeFiles());

    const table = container.querySelector("table.filelist-table");
    expect(table).not.toBeNull();

    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3);
  });

  it("ディレクトリを先頭に配置する", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeFiles());

    const rows = container.querySelectorAll("tbody tr");
    const firstRowName = rows[0].querySelector(".col-name a")?.textContent;
    expect(firstRowName).toBe("subdir/");
  });

  it("行クリックで選択トグルする", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeFiles());

    const row = container.querySelector<HTMLTableRowElement>("tbody tr")!;
    row.click();
    expect(row.classList.contains("selected")).toBe(true);

    row.click();
    expect(row.classList.contains("selected")).toBe(false);
  });

  it("チェックボックス操作で選択トグルする", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeFiles());

    const row = container.querySelector<HTMLTableRowElement>("tbody tr")!;
    const cb = row.querySelector<HTMLInputElement>('input[type="checkbox"]')!;

    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
    expect(row.classList.contains("selected")).toBe(true);
  });

  it("選択件数が表示される", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeFiles());

    const rows = container.querySelectorAll<HTMLTableRowElement>("tbody tr");
    rows[0].click();
    rows[1].click();

    const countEl = container.querySelector(".filelist-selected-count");
    expect(countEl?.textContent).toContain("2");
  });

  it("PDF ファイルに表示ボタンがある", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeFiles());

    const rows = container.querySelectorAll<HTMLTableRowElement>("tbody tr");
    const pdfRow = Array.from(rows).find(
      (r) => r.querySelector(".col-name a")?.textContent === "beta.pdf",
    );
    expect(pdfRow).toBeDefined();

    const viewBtn = pdfRow!.querySelector("button.btn-small");
    expect(viewBtn?.textContent).toBe("表示");
  });

  it("ディレクトリにはダウンロード・表示ボタンがない", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeFiles());

    const rows = container.querySelectorAll<HTMLTableRowElement>("tbody tr");
    const dirRow = Array.from(rows).find(
      (r) => r.querySelector(".col-name a")?.textContent === "subdir/",
    );
    const actionBtns = dirRow!.querySelectorAll(".col-action .btn, .col-action button");
    expect(actionBtns).toHaveLength(0);
  });

  it("空一覧ではメッセージを表示する", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render([]);

    const empty = container.querySelector(".filelist-empty");
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain("ファイルがありません");
  });

  it("ソートヘッダークリックで再描画する", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeFiles());

    const sizeHeader = container.querySelector<HTMLButtonElement>("th.col-size button");
    expect(sizeHeader).not.toBeNull();
    sizeHeader!.click();

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
    // ディレクトリは常に先頭
    expect(rows[0].querySelector(".col-name a")?.textContent).toBe("subdir/");
  });

  it("削除ボタンは選択がないと無効", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeFiles());

    const deleteBtn = container.querySelector<HTMLButtonElement>(".btn-danger");
    expect(deleteBtn?.disabled).toBe(true);
  });
});
