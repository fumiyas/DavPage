// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// Inline viewer (PDF, images, text, video/audio)
// HTML/SVG are rendered as text/plain to prevent XSS via embedded scripts.

import { fetchAsBlob } from "./webdav.js";

/** MIME type mapping for inline-viewable file types */
const VIEWABLE_EXTENSIONS: Record<string, string> = {
  // PDF
  ".pdf": "application/pdf",
  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  // SVG rendered as plain text to prevent XSS via embedded scripts
  ".svg": "text/plain; charset=utf-8",
  // HTML/HTM rendered as plain text to prevent XSS via embedded scripts
  ".html": "text/plain; charset=utf-8",
  ".htm": "text/plain; charset=utf-8",
  // Text
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".xml": "text/xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".ini": "text/plain; charset=utf-8",
  ".conf": "text/plain; charset=utf-8",
  ".cfg": "text/plain; charset=utf-8",
  ".sh": "text/plain; charset=utf-8",
  ".py": "text/plain; charset=utf-8",
  ".js": "text/plain; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
  ".css": "text/plain; charset=utf-8",
  // Video
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  // Audio
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
