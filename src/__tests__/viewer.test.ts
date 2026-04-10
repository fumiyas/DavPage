// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// viewer.ts ユニットテスト — MIME 判定ロジック

import { describe, it, expect } from "vitest";
import { getViewableMime } from "../viewer.js";

describe("getViewableMime", () => {
  it("PDF ファイルを認識する", () => {
    expect(getViewableMime("report.pdf")).toBe("application/pdf");
    expect(getViewableMime("REPORT.PDF")).toBe("application/pdf");
  });

  it("画像ファイルを認識する", () => {
    expect(getViewableMime("photo.png")).toBe("image/png");
    expect(getViewableMime("photo.jpg")).toBe("image/jpeg");
    expect(getViewableMime("photo.jpeg")).toBe("image/jpeg");
    expect(getViewableMime("icon.svg")).toBe("image/svg+xml");
    expect(getViewableMime("photo.webp")).toBe("image/webp");
    expect(getViewableMime("photo.gif")).toBe("image/gif");
  });

  it("テキスト系ファイルを認識する", () => {
    expect(getViewableMime("readme.txt")).toBe("text/plain");
    expect(getViewableMime("data.csv")).toBe("text/csv");
    expect(getViewableMime("page.html")).toBe("text/html");
    expect(getViewableMime("config.json")).toBe("application/json");
    expect(getViewableMime("script.js")).toBe("text/javascript");
  });

  it("動画・音声ファイルを認識する", () => {
    expect(getViewableMime("movie.mp4")).toBe("video/mp4");
    expect(getViewableMime("sound.mp3")).toBe("audio/mpeg");
    expect(getViewableMime("music.ogg")).toBe("audio/ogg");
  });

  it("非対応ファイルは null を返す", () => {
    expect(getViewableMime("archive.zip")).toBeNull();
    expect(getViewableMime("binary.exe")).toBeNull();
    expect(getViewableMime("document.docx")).toBeNull();
    expect(getViewableMime("noextension")).toBeNull();
  });

  it("大文字の拡張子も認識する", () => {
    expect(getViewableMime("IMAGE.PNG")).toBe("image/png");
    expect(getViewableMime("VIDEO.MP4")).toBe("video/mp4");
  });
});
