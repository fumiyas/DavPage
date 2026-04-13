// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// upload.ts unit tests — UI construction and file selection logic

import { describe, it, expect, beforeEach } from "vitest";
import { initUpload } from "../upload.js";

describe("initUpload", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("builds required UI elements", () => {
    initUpload({
      container,
      targetUrl: "http://localhost/dav/",
      onAllComplete: () => {},
    });

    expect(container.querySelector(".upload-dropzone")).not.toBeNull();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(container.querySelector(".upload-file-list")).not.toBeNull();
    expect(container.querySelector(".upload-controls")).not.toBeNull();
  });

  it("sets multiple attribute on file input", () => {
    initUpload({
      container,
      targetUrl: "http://localhost/dav/",
      onAllComplete: () => {},
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input?.multiple).toBe(true);
  });

  it("disables buttons initially", () => {
    initUpload({
      container,
      targetUrl: "http://localhost/dav/",
      onAllComplete: () => {},
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>(".upload-controls button");
    for (const btn of buttons) {
      expect(btn.disabled).toBe(true);
    }
  });

  it("has overwrite checkbox defaulting to unchecked", () => {
    initUpload({
      container,
      targetUrl: "http://localhost/dav/",
      onAllComplete: () => {},
    });

    const cb = container.querySelector<HTMLInputElement>(".upload-overwrite-checkbox");
    expect(cb).not.toBeNull();
    expect(cb?.checked).toBe(false);
  });

  it("triggers file input on dropzone click", () => {
    initUpload({
      container,
      targetUrl: "http://localhost/dav/",
      onAllComplete: () => {},
    });

    const dropZone = container.querySelector<HTMLDivElement>(".upload-dropzone")!;
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    let clickTriggered = false;
    input.addEventListener("click", (e) => {
      e.preventDefault();
      clickTriggered = true;
    });

    dropZone.click();
    expect(clickTriggered).toBe(true);
  });
});
