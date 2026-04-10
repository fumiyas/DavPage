// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// インライン表示（PDF, 画像, テキスト, 動画/音声）

import { fetchAsBlob } from "./webdav.js";

/** MIME type mapping for inline-viewable file types */
const VIEWABLE_EXTENSIONS: Record<string, string> = {
  // PDF
  ".pdf": "application/pdf",
  // 画像
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  // テキスト
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "text/xml",
  ".json": "application/json",
  ".md": "text/markdown",
  ".log": "text/plain",
  ".yml": "text/yaml",
  ".yaml": "text/yaml",
  ".ini": "text/plain",
  ".conf": "text/plain",
  ".cfg": "text/plain",
  ".sh": "text/x-shellscript",
  ".py": "text/x-python",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".css": "text/css",
  // 動画
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  // 音声
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
};

/** Get inline-viewable MIME type from filename (returns null if not supported) */
export function getViewableMime(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = fileName.slice(dot).toLowerCase();
  return VIEWABLE_EXTENSIONS[ext] ?? null;
}

/** Open a file inline in a new tab */
export async function openInlineView(fileUrl: string, fileName: string): Promise<void> {
  const mime = getViewableMime(fileName);
  if (!mime) {
    throw new Error(`Unsupported file type: ${fileName}`);
  }

  const blob = await fetchAsBlob(fileUrl, mime);
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");

  // Prevent memory leak: revoke after a short delay
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
