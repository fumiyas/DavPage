// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// file-list.ts ユニットテスト — DOM 描画、ソート、行選択

import { describe, it, expect, vi, beforeEach } from "vitest";
import { initFileList, compareNames, splitNameChunks } from "../file-list.js";
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

describe("splitNameChunks", () => {
  it("splits mixed text and numbers", () => {
    expect(splitNameChunks("foo-10.tar.gz")).toEqual(["foo-", 10, ".tar.gz"]);
  });

  it("splits leading number", () => {
    expect(splitNameChunks("123abc")).toEqual([123, "abc"]);
  });

  it("handles pure text", () => {
    expect(splitNameChunks("readme.txt")).toEqual(["readme.txt"]);
  });

  it("handles pure number", () => {
    expect(splitNameChunks("42")).toEqual([42]);
  });

  it("handles multiple numeric segments", () => {
    expect(splitNameChunks("v1.2.3")).toEqual(["v", 1, ".", 2, ".", 3]);
  });
});

describe("compareNames", () => {
  describe("version sort enabled (default)", () => {
    it("sorts version numbers naturally", () => {
      expect(compareNames("foo-2", "foo-10", false, true)).toBeLessThan(0);
      expect(compareNames("foo-10", "foo-2", false, true)).toBeGreaterThan(0);
    });

    it("sorts equal names as equal", () => {
      expect(compareNames("foo-10", "foo-10", false, true)).toBe(0);
    });

    it("handles multi-segment versions", () => {
      const names = ["v1.10.0", "v1.2.3", "v1.2.10", "v2.0.0"];
      const sorted = [...names].sort((a, b) => compareNames(a, b, false, true));
      expect(sorted).toEqual(["v1.2.3", "v1.2.10", "v1.10.0", "v2.0.0"]);
    });

    it("sorts names without numbers lexicographically", () => {
      expect(compareNames("alpha", "beta", false, true)).toBeLessThan(0);
    });

    it("handles file extensions with numbers", () => {
      const names = ["log-1.txt", "log-10.txt", "log-2.txt", "log-9.txt"];
      const sorted = [...names].sort((a, b) => compareNames(a, b, false, true));
      expect(sorted).toEqual(["log-1.txt", "log-2.txt", "log-9.txt", "log-10.txt"]);
    });
  });

  describe("version sort disabled", () => {
    it("sorts lexicographically (foo-10 before foo-2)", () => {
      expect(compareNames("foo-10", "foo-2", false, false)).toBeLessThan(0);
    });
  });

  describe("case-insensitive sort", () => {
    it("treats upper and lower case as equal", () => {
      expect(compareNames("Alpha", "alpha", true, false)).toBe(0);
      expect(compareNames("BETA", "beta", true, true)).toBe(0);
    });

    it("sorts mixed case naturally with sensitivity=base", () => {
      const names = ["Banana", "apple", "Cherry"];
      const sorted = [...names].sort((a, b) => compareNames(a, b, true, false));
      expect(sorted).toEqual(["apple", "Banana", "Cherry"]);
    });
  });

  describe("case-sensitive sort (default)", () => {
    it("sorts uppercase before lowercase (codepoint order)", () => {
      // Codepoint: R(0x52) < d(0x64), so README < data
      expect(compareNames("README.txt", "data.csv", false, false)).toBeLessThan(0);
      expect(compareNames("README.txt", "data.csv", false, true)).toBeLessThan(0);
    });

    it("distinguishes upper and lower case", () => {
      expect(compareNames("A", "a", false, false)).not.toBe(0);
      expect(compareNames("A", "a", false, true)).not.toBe(0);
    });
  });

  describe("combined options", () => {
    it("case-insensitive + version sort", () => {
      const names = ["File-10.txt", "file-2.txt", "FILE-1.txt"];
      const sorted = [...names].sort((a, b) => compareNames(a, b, true, true));
      expect(sorted).toEqual(["FILE-1.txt", "file-2.txt", "File-10.txt"]);
    });
  });
});

describe("initFileList with sort options", () => {
  let container: HTMLDivElement;
  let onRefresh: () => void;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    onRefresh = vi.fn() as unknown as () => void;
  });

  function makeVersionFiles(): FileInfo[] {
    return [
      { name: "v1.10.txt", href: "/v1.10.txt", size: 10, lastModified: new Date(0), contentType: "text/plain", isDirectory: false },
      { name: "v1.2.txt", href: "/v1.2.txt", size: 10, lastModified: new Date(0), contentType: "text/plain", isDirectory: false },
      { name: "v1.9.txt", href: "/v1.9.txt", size: 10, lastModified: new Date(0), contentType: "text/plain", isDirectory: false },
    ];
  }

  it("sorts files with version sort by default", () => {
    const fl = initFileList({ container, onRefresh });
    fl.render(makeVersionFiles());

    const names = Array.from(container.querySelectorAll(".col-name a")).map(
      (a) => a.textContent,
    );
    expect(names).toEqual(["v1.2.txt", "v1.9.txt", "v1.10.txt"]);
  });

  it("sorts lexicographically when sortVersion=false", () => {
    const fl = initFileList({ container, onRefresh, sortVersion: false });
    fl.render(makeVersionFiles());

    const names = Array.from(container.querySelectorAll(".col-name a")).map(
      (a) => a.textContent,
    );
    expect(names).toEqual(["v1.10.txt", "v1.2.txt", "v1.9.txt"]);
  });

  it("sorts case-insensitively when sortIgnoreCase=true", () => {
    const files: FileInfo[] = [
      { name: "Banana.txt", href: "/Banana.txt", size: 10, lastModified: new Date(0), contentType: "text/plain", isDirectory: false },
      { name: "apple.txt", href: "/apple.txt", size: 10, lastModified: new Date(0), contentType: "text/plain", isDirectory: false },
    ];
    const fl = initFileList({ container, onRefresh, sortIgnoreCase: true, sortVersion: false });
    fl.render(files);

    const names = Array.from(container.querySelectorAll(".col-name a")).map(
      (a) => a.textContent,
    );
    expect(names).toEqual(["apple.txt", "Banana.txt"]);
  });
});
