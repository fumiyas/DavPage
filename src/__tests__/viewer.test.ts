// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// Unit tests for viewer.ts — MIME type detection

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
    expect(getViewableMime("photo.webp")).toBe("image/webp");
    expect(getViewableMime("photo.gif")).toBe("image/gif");
  });

  it("SVG を text/plain として返す (XSS 防止)", () => {
    expect(getViewableMime("icon.svg")).toBe("text/plain; charset=utf-8");
  });

  it("HTML/HTM を text/plain として返す (XSS 防止)", () => {
    expect(getViewableMime("page.html")).toBe("text/plain; charset=utf-8");
    expect(getViewableMime("page.htm")).toBe("text/plain; charset=utf-8");
  });

  it("テキスト系ファイルに charset=utf-8 が付与される", () => {
    expect(getViewableMime("readme.txt")).toBe("text/plain; charset=utf-8");
    expect(getViewableMime("data.csv")).toBe("text/csv; charset=utf-8");
    expect(getViewableMime("config.json")).toBe("application/json; charset=utf-8");
    expect(getViewableMime("script.js")).toBe("text/plain; charset=utf-8");
    expect(getViewableMime("style.css")).toBe("text/plain; charset=utf-8");
    expect(getViewableMime("app.py")).toBe("text/plain; charset=utf-8");
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
