// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// webdav.ts ユニットテスト — PROPFIND XML パース、fetch モック

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const SAMPLE_PROPFIND_XML = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/folder/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>folder</D:displayname>
        <D:getcontentlength>0</D:getcontentlength>
        <D:getlastmodified>Thu, 01 Jan 2026 00:00:00 GMT</D:getlastmodified>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/folder/document.pdf</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>document.pdf</D:displayname>
        <D:getcontentlength>12345</D:getcontentlength>
        <D:getlastmodified>Wed, 15 Jan 2026 10:30:00 GMT</D:getlastmodified>
        <D:getcontenttype>application/pdf</D:getcontenttype>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/folder/subdir/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>subdir</D:displayname>
        <D:getcontentlength>0</D:getcontentlength>
        <D:getlastmodified>Mon, 10 Feb 2026 08:00:00 GMT</D:getlastmodified>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/folder/%E6%97%A5%E6%9C%AC%E8%AA%9E.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>日本語.txt</D:displayname>
        <D:getcontentlength>256</D:getcontentlength>
        <D:getlastmodified>Fri, 20 Mar 2026 15:45:00 GMT</D:getlastmodified>
        <D:getcontenttype>text/plain</D:getcontenttype>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

describe("listFiles", () => {
  let listFiles: typeof import("../webdav.js").listFiles;

  beforeEach(async () => {
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost", href: "http://localhost/dav/folder/" },
      writable: true,
      configurable: true,
    });

    vi.stubGlobal("fetch", vi.fn());

    const mod = await import("../webdav.js");
    listFiles = mod.listFiles;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PROPFIND レスポンス XML を正しくパースする", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 207,
      text: () => Promise.resolve(SAMPLE_PROPFIND_XML),
    } as Response);

    const files = await listFiles("http://localhost/dav/folder/");

    // ベースディレクトリ自身はスキップされる
    expect(files).toHaveLength(3);

    // ファイル
    const pdf = files.find((f) => f.name === "document.pdf");
    expect(pdf).toBeDefined();
    expect(pdf!.isDirectory).toBe(false);
    expect(pdf!.size).toBe(12345);
    expect(pdf!.contentType).toBe("application/pdf");
    expect(pdf!.href).toBe("/dav/folder/document.pdf");

    // ディレクトリ
    const subdir = files.find((f) => f.name === "subdir");
    expect(subdir).toBeDefined();
    expect(subdir!.isDirectory).toBe(true);

    // 日本語ファイル名
    const jpFile = files.find((f) => f.name === "日本語.txt");
    expect(jpFile).toBeDefined();
    expect(jpFile!.size).toBe(256);
    expect(jpFile!.contentType).toBe("text/plain");
  });

  it("空のディレクトリの場合は空配列を返す", async () => {
    const emptyXml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/folder/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 207,
      text: () => Promise.resolve(emptyXml),
    } as Response);

    const files = await listFiles("http://localhost/dav/folder/");
    expect(files).toHaveLength(0);
  });

  it("PROPFIND が失敗した場合はエラーをスローする", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: () => Promise.resolve(""),
    } as Response);

    await expect(listFiles("http://localhost/dav/folder/")).rejects.toThrow(
      "PROPFIND failed: 403 Forbidden",
    );
  });

  it("PROPFIND リクエストに正しいヘッダーを送信する", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 207,
      text: () =>
        Promise.resolve(`<?xml version="1.0"?><D:multistatus xmlns:D="DAV:"></D:multistatus>`),
    } as Response);

    await listFiles("http://localhost/dav/folder/");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost/dav/folder/",
      expect.objectContaining({
        method: "PROPFIND",
        headers: expect.objectContaining({ Depth: "1" }),
      }),
    );
  });
});

describe("deleteResource", () => {
  let deleteResource: typeof import("../webdav.js").deleteResource;

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    const mod = await import("../webdav.js");
    deleteResource = mod.deleteResource;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("DELETE リクエストを送信して結果を返す", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 204,
      statusText: "No Content",
    } as Response);

    const result = await deleteResource("http://localhost/dav/folder/file.txt");

    expect(fetch).toHaveBeenCalledWith("http://localhost/dav/folder/file.txt", {
      method: "DELETE",
    });
    expect(result.status).toBe(204);
  });
});
