// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// Integration tests — real WebDAV communication via webdav-server
// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { v2 as webdav } from "webdav-server";
import http from "node:http";

let server: InstanceType<typeof webdav.WebDAVServer>;
let baseUrl: string;

function startServer(srv: InstanceType<typeof webdav.WebDAVServer>, port: number): Promise<void> {
  return new Promise((resolve) => {
    srv.start(port, () => resolve());
  });
}

function stopServer(srv: InstanceType<typeof webdav.WebDAVServer>): Promise<void> {
  return new Promise((resolve) => {
    srv.stop(() => resolve());
  });
}

/** Send a raw HTTP request (supports custom methods like PROPFIND) */
function rawRequest(
  url: string,
  method: string,
  headers?: Record<string, string>,
  body?: string | Buffer,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method,
        headers: headers ?? {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

describe("WebDAV integration tests", () => {
  beforeAll(async () => {
    server = new webdav.WebDAVServer();
    await startServer(server, 0);

    const address = (server as unknown as { server: import("node:net").Server }).server.address();
    if (address && typeof address === "object") {
      baseUrl = `http://127.0.0.1:${address.port}`;
    } else {
      throw new Error("Server did not bind to a port");
    }
  });

  afterAll(async () => {
    if (server) await stopServer(server);
  });

  it("uploads a file with PUT and confirms via PROPFIND", async () => {
    const fileContent = "Hello, WebDAV!";
    const putRes = await rawRequest(
      `${baseUrl}/test-file.txt`,
      "PUT",
      { "Content-Type": "application/octet-stream" },
      fileContent,
    );
    expect([200, 201]).toContain(putRes.status);

    const propfindRes = await rawRequest(
      `${baseUrl}/`,
      "PROPFIND",
      {
        Depth: "1",
        "Content-Type": "application/xml; charset=utf-8",
      },
      `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`,
    );

    expect(propfindRes.status).toBe(207);
    expect(propfindRes.body).toContain("test-file.txt");
  });

  it("retrieves an uploaded file with GET", async () => {
    const content = "GET test content";
    await rawRequest(
      `${baseUrl}/get-test.txt`,
      "PUT",
      { "Content-Type": "text/plain" },
      content,
    );

    const getRes = await rawRequest(`${baseUrl}/get-test.txt`, "GET");
    expect(getRes.status).toBe(200);
    expect(getRes.body).toBe(content);
  });

  it("deletes a file with DELETE", async () => {
    await rawRequest(
      `${baseUrl}/to-delete.txt`,
      "PUT",
      { "Content-Type": "application/octet-stream" },
      "delete me",
    );

    const delRes = await rawRequest(`${baseUrl}/to-delete.txt`, "DELETE");
    expect([200, 204]).toContain(delRes.status);

    const getRes = await rawRequest(`${baseUrl}/to-delete.txt`, "GET");
    expect(getRes.status).toBe(404);
  });

  it("returns valid XML from PROPFIND response", async () => {
    const res = await rawRequest(
      `${baseUrl}/`,
      "PROPFIND",
      {
        Depth: "1",
        "Content-Type": "application/xml; charset=utf-8",
      },
      `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:getcontenttype/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`,
    );

    expect(res.status).toBe(207);
    expect(res.body).toContain("multistatus");
    expect(res.body).toContain("response");
    expect(res.body).toContain("href");
  });

  it("creates a directory with MKCOL", async () => {
    const mkcolRes = await rawRequest(`${baseUrl}/new-dir/`, "MKCOL");
    expect([200, 201]).toContain(mkcolRes.status);

    const propfindRes = await rawRequest(
      `${baseUrl}/`,
      "PROPFIND",
      { Depth: "1", "Content-Type": "application/xml; charset=utf-8" },
      `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/></D:prop></D:propfind>`,
    );

    expect(propfindRes.body).toContain("new-dir");
  });
});
