// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// Tests for config parser, placeholder expansion, and config builder

import { describe, it, expect } from "vitest";
import { parseConfig, expandPlaceholders, defaultConfig, globToRegex, matchesAnyPattern } from "../config.js";
import type { PlaceholderVars } from "../config.js";

describe("parseConfig", () => {
  it("parses double-quoted string values", () => {
    const result = parseConfig('title = "Hello World"');
    expect(result).toEqual({ title: "Hello World" });
  });

  it("parses multiple key-value pairs", () => {
    const result = parseConfig(
      'title = "My Title"\nheading = "My Heading"',
    );
    expect(result).toEqual({ title: "My Title", heading: "My Heading" });
  });

  it("parses boolean values", () => {
    const result = parseConfig("upload_enabled = true\ndelete_enabled = false");
    expect(result).toEqual({ upload_enabled: true, delete_enabled: false });
  });

  it("ignores comments and blank lines", () => {
    const input = `
# This is a comment
title = "Test"

# Another comment
upload_enabled = true
`;
    const result = parseConfig(input);
    expect(result).toEqual({ title: "Test", upload_enabled: true });
  });

  it("parses triple-quoted multi-line strings", () => {
    const input = `footer = """\n<div>\n  <em>Notice</em>\n</div>\n"""`;
    const result = parseConfig(input);
    expect(result["footer"]).toBe("<div>\n  <em>Notice</em>\n</div>\n");
  });

  it("parses triple-quoted string on single line", () => {
    const result = parseConfig('title = """inline"""');
    expect(result).toEqual({ title: "inline" });
  });

  it("handles escape sequences in double-quoted strings", () => {
    const result = parseConfig('msg = "line1\\nline2\\ttab"');
    expect(result).toEqual({ msg: "line1\nline2\ttab" });
  });

  it("handles escaped quotes and backslashes", () => {
    const result = parseConfig('msg = "say \\"hello\\\\"');
    expect(result).toEqual({ msg: 'say "hello\\' });
  });

  it("handles unquoted values", () => {
    const result = parseConfig("theme = dark");
    expect(result).toEqual({ theme: "dark" });
  });

  it("strips inline comments from unquoted values", () => {
    const result = parseConfig("theme = dark # comment here");
    expect(result).toEqual({ theme: "dark" });
  });

  it("ignores lines without = sign", () => {
    const result = parseConfig("invalid line\ntitle = \"ok\"");
    expect(result).toEqual({ title: "ok" });
  });

  it("handles empty input", () => {
    expect(parseConfig("")).toEqual({});
  });

  it("handles keys with spaces around =", () => {
    const result = parseConfig("  title  =  \"spaced\"  ");
    expect(result).toEqual({ title: "spaced" });
  });
});

describe("expandPlaceholders", () => {
  const vars: PlaceholderVars = {
    baseUrl: "https://example.com",
    dirName: "shared-files",
    path: "/dav/shared-files/",
  };

  it("expands ${baseUrl}", () => {
    expect(expandPlaceholders("Server: ${baseUrl}", vars)).toBe(
      "Server: https://example.com",
    );
  });

  it("expands ${dirName}", () => {
    expect(expandPlaceholders("Folder: ${dirName}", vars)).toBe(
      "Folder: shared-files",
    );
  });

  it("expands ${path}", () => {
    expect(expandPlaceholders("Path: ${path}", vars)).toBe(
      "Path: /dav/shared-files/",
    );
  });

  it("expands multiple placeholders in one string", () => {
    const template = "${dirName} @ ${baseUrl}${path}";
    expect(expandPlaceholders(template, vars)).toBe(
      "shared-files @ https://example.com/dav/shared-files/",
    );
  });

  it("returns string unchanged when no placeholders", () => {
    expect(expandPlaceholders("plain text", vars)).toBe("plain text");
  });

  it("handles repeated placeholders", () => {
    expect(expandPlaceholders("${dirName}/${dirName}", vars)).toBe(
      "shared-files/shared-files",
    );
  });
});

describe("defaultConfig", () => {
  it("returns expected defaults", () => {
    const cfg = defaultConfig();
    expect(cfg.title).toBe("");
    expect(cfg.heading).toBe("");
    expect(cfg.footer).toBe("");
    expect(cfg.upload_enabled).toBe(true);
    expect(cfg.delete_enabled).toBe(true);
    expect(cfg.index_exclude_names).toEqual(["index.html"]);
    expect(cfg.index_ignore_folders).toBe(false);
  });
});

describe("globToRegex", () => {
  it("matches exact filename", () => {
    expect(globToRegex("index.html").test("index.html")).toBe(true);
    expect(globToRegex("index.html").test("INDEX.HTML")).toBe(true);
    expect(globToRegex("index.html").test("index.htm")).toBe(false);
  });

  it("matches * wildcard", () => {
    const re = globToRegex("*.tmp");
    expect(re.test("file.tmp")).toBe(true);
    expect(re.test(".tmp")).toBe(true);
    expect(re.test("file.txt")).toBe(false);
  });

  it("matches ? wildcard", () => {
    const re = globToRegex("file?.txt");
    expect(re.test("file1.txt")).toBe(true);
    expect(re.test("fileA.txt")).toBe(true);
    expect(re.test("file.txt")).toBe(false);
    expect(re.test("file12.txt")).toBe(false);
  });

  it("matches .ht* pattern", () => {
    const re = globToRegex(".ht*");
    expect(re.test(".htaccess")).toBe(true);
    expect(re.test(".htpasswd")).toBe(true);
    expect(re.test(".html")).toBe(true); // .html starts with .ht
    expect(re.test(".hidden")).toBe(false);
    expect(re.test("readme")).toBe(false);
  });

  it("escapes regex special characters", () => {
    const re = globToRegex("file[1].txt");
    expect(re.test("file[1].txt")).toBe(true);
    expect(re.test("file1.txt")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(globToRegex("README.md").test("readme.MD")).toBe(true);
  });
});

describe("matchesAnyPattern", () => {
  const patterns = ["index.html", "davpage.conf", ".ht*", "*.tmp"];

  it("matches exact names in pattern list", () => {
    expect(matchesAnyPattern("index.html", patterns)).toBe(true);
    expect(matchesAnyPattern("davpage.conf", patterns)).toBe(true);
  });

  it("matches glob patterns in list", () => {
    expect(matchesAnyPattern(".htaccess", patterns)).toBe(true);
    expect(matchesAnyPattern("data.tmp", patterns)).toBe(true);
  });

  it("returns false for non-matching names", () => {
    expect(matchesAnyPattern("readme.txt", patterns)).toBe(false);
    expect(matchesAnyPattern("report.pdf", patterns)).toBe(false);
  });

  it("returns false with empty pattern list", () => {
    expect(matchesAnyPattern("anything", [])).toBe(false);
  });
});

describe("parseConfig index_exclude_names (TOML array)", () => {
  it("parses inline string array", () => {
    const result = parseConfig('index_exclude_names = ["index.html", ".ht*"]');
    expect(result["index_exclude_names"]).toEqual(["index.html", ".ht*"]);
  });

  it("parses multi-line string array", () => {
    const input = `index_exclude_names = [
  "index.html",
  "davpage.conf",
  ".ht*",
]`;
    const result = parseConfig(input);
    expect(result["index_exclude_names"]).toEqual(["index.html", "davpage.conf", ".ht*"]);
  });

  it("parses empty array", () => {
    const result = parseConfig("index_exclude_names = []");
    expect(result["index_exclude_names"]).toEqual([]);
  });

  it("handles array with single element", () => {
    const result = parseConfig('index_exclude_names = ["only"]');
    expect(result["index_exclude_names"]).toEqual(["only"]);
  });
});

describe("parseConfig index_ignore_dot_names", () => {
  it("parses index_ignore_dot_names boolean", () => {
    expect(parseConfig("index_ignore_dot_names = false")["index_ignore_dot_names"]).toBe(false);
    expect(parseConfig("index_ignore_dot_names = true")["index_ignore_dot_names"]).toBe(true);
  });

  it("defaults to true", () => {
    expect(defaultConfig().index_ignore_dot_names).toBe(true);
  });
});

describe("parseConfig index_sort options", () => {
  it("parses index_sort_ignore_case boolean", () => {
    const result = parseConfig("index_sort_ignore_case = true");
    expect(result["index_sort_ignore_case"]).toBe(true);
  });

  it("parses index_sort_version boolean", () => {
    const result = parseConfig("index_sort_version = false");
    expect(result["index_sort_version"]).toBe(false);
  });

  it("defaults: index_sort_ignore_case=false, index_sort_version=true", () => {
    const cfg = defaultConfig();
    expect(cfg.index_sort_ignore_case).toBe(false);
    expect(cfg.index_sort_version).toBe(true);
  });
});
