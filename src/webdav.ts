// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// WebDAV client
// PROPFIND, PUT, DELETE operations

export interface FileInfo {
  name: string;
  href: string;
  size: number;
  lastModified: Date;
  contentType: string;
  isDirectory: boolean;
}

const DAV_NS = "DAV:";
const DAV_PREFIXES = ["D", "d", "DAV"];

/**
 * 名前空間付き要素を検索するヘルパー。
 * getElementsByTagNameNS が機能しない環境（happy-dom 等）では
 * プレフィクス付き getElementsByTagName にフォールバックする。
 */
function findByNS(parent: Element | Document, localName: string): Element[] {
  const byNS = parent.getElementsByTagNameNS(DAV_NS, localName);
  if (byNS.length > 0) return Array.from(byNS);

  // Fallback: try common DAV prefixes
  for (const prefix of DAV_PREFIXES) {
    const byTag = parent.getElementsByTagName(`${prefix}:${localName}`);
    if (byTag.length > 0) return Array.from(byTag);
  }
  // Also try without prefix
  const byLocal = parent.getElementsByTagName(localName);
  return Array.from(byLocal);
}

/** List resources in a directory via PROPFIND */
export async function listFiles(dirUrl: string): Promise<FileInfo[]> {
  const url = dirUrl.endsWith("/") ? dirUrl : dirUrl + "/";

  const res = await fetch(url, {
    method: "PROPFIND",
    headers: { Depth: "1", "Content-Type": "application/xml; charset=utf-8" },
    body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:getcontenttype/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`,
  });

  if (!res.ok && res.status !== 207) {
    throw new Error(`PROPFIND failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  return parsePropfindResponse(xml, url);
}

function parsePropfindResponse(xml: string, baseUrl: string): FileInfo[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const responses = findByNS(doc, "response");
  const files: FileInfo[] = [];

  for (const response of responses) {
    const hrefEl = findByNS(response, "href")[0];
    if (!hrefEl?.textContent) continue;

    const href = decodeURIComponent(hrefEl.textContent);

    // Skip the base directory itself
    const basePath = new URL(baseUrl, location.origin).pathname;
    const resourcePath = new URL(href, location.origin).pathname;
    if (resourcePath === basePath) continue;

    const propstat = findByNS(response, "propstat")[0];
    if (!propstat) continue;
    const prop = findByNS(propstat, "prop")[0];
    if (!prop) continue;

    const resourceType = findByNS(prop, "resourcetype")[0];
    const isDirectory = resourceType
      ? findByNS(resourceType, "collection").length > 0
      : false;

    const displayname = findByNS(prop, "displayname")[0]?.textContent ?? "";
    const name = displayname || decodeURIComponent(hrefEl.textContent.replace(/\/$/, "").split("/").pop() ?? "");

    const sizeText = findByNS(prop, "getcontentlength")[0]?.textContent;
    const size = sizeText ? parseInt(sizeText, 10) : 0;

    const lastModText = findByNS(prop, "getlastmodified")[0]?.textContent;
    const lastModified = lastModText ? new Date(lastModText) : new Date(0);

    const contentType = findByNS(prop, "getcontenttype")[0]?.textContent ?? "application/octet-stream";

    files.push({
      name,
      href: hrefEl.textContent,
      size,
      lastModified,
      contentType,
      isDirectory,
    });
  }

  return files;
}

/** Upload a file (with progress callback) */
export function uploadFile(
  destUrl: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ status: number; statusText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const safeName = file.name.replace(/[\x00-\x1f\x7f]/g, "_");
    const url = destUrl.endsWith("/") ? destUrl : destUrl + "/";
    xhr.open("PUT", url + encodeURIComponent(safeName), true);
    xhr.overrideMimeType("application/octet-stream");

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      });
    }

    xhr.addEventListener("load", () => {
      resolve({ status: xhr.status, statusText: xhr.statusText });
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.send(file);
  });
}

/** Delete a resource */
export async function deleteResource(resourceUrl: string): Promise<{ status: number; statusText: string }> {
  const res = await fetch(resourceUrl, { method: "DELETE" });
  return { status: res.status, statusText: res.statusText };
}

/** Fetch a file as a Blob (for inline viewing) */
export async function fetchAsBlob(fileUrl: string, mimeType: string): Promise<Blob> {
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return new Blob([buf], { type: mimeType });
}
