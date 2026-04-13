// SPDX-License-Identifier: GPL-3.0-only
// SPDX-FileCopyrightText: 2026 SATOH Fumiyasu @ OSSTech Corp., Japan

// Configuration file loader and parser
// Reads a TOML-subset config file (davpage.conf) from the same directory as davpage.html

export interface AppConfig {
  title: string;
  heading: string;
  footer: string;
  upload_enabled: boolean;
  delete_enabled: boolean;
  index_ignore_folders: boolean;
  index_ignore_dot_names: boolean;
  index_exclude_names: string[];
  index_sort_ignore_case: boolean;
  index_sort_version: boolean;
}

const CONFIG_FILE = "davpage.conf";
const STORAGE_KEY = "davpage-config";

/** Default configuration */
export function defaultConfig(): AppConfig {
  return {
    title: "",
    heading: "",
    footer: "",
    upload_enabled: true,
    delete_enabled: true,
    index_ignore_folders: false,
    index_ignore_dot_names: true,
    index_exclude_names: ["davpage.*", "index.htm*", ".ht*"],
    index_sort_ignore_case: false,
    index_sort_version: true,
  };
}

// --- TOML subset parser ---

/**
 * Parse a minimal TOML-subset string into key-value pairs.
 * Supports:
 *   - `key = "value"` (double-quoted strings with basic escapes)
 *   - `key = """..."""` (multi-line literal strings)
 *   - `key = true / false` (booleans)
 *   - `key = ["a", "b"]` (string arrays, single or multi-line)
 *   - `# comment` lines
 *   - blank lines
 */
export type ConfigValue = string | boolean | string[];
export function parseConfig(text: string): Record<string, ConfigValue> {
  const result: Record<string, ConfigValue> = {};
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    i++;

    // Skip blank lines and comments
    if (line === "" || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex < 0) continue;

    const key = line.slice(0, eqIndex).trim();
    const rawValue = line.slice(eqIndex + 1).trim();

    if (key === "") continue;

    // String array: [ ... ]
    if (rawValue.startsWith("[")) {
      let arrayText = rawValue;
      // Collect lines until ] is found
      if (!rawValue.includes("]")) {
        const parts = [rawValue];
        while (i < lines.length) {
          const nextLine = lines[i];
          i++;
          parts.push(nextLine);
          if (nextLine.includes("]")) break;
        }
        arrayText = parts.join("\n");
      }
      result[key] = parseStringArray(arrayText);
      continue;
    }

    // Triple-quoted multi-line string
    if (rawValue.startsWith('"""')) {
      const afterOpen = rawValue.slice(3);
      // Check if closing """ is on the same line
      const closeIdx = afterOpen.indexOf('"""');
      if (closeIdx >= 0) {
        result[key] = afterOpen.slice(0, closeIdx);
      } else {
        // Collect lines until closing """
        // Skip the rest of the opening line if it's empty (TOML convention)
        const parts: string[] = afterOpen === "" ? [] : [afterOpen];
        while (i < lines.length) {
          const nextLine = lines[i];
          i++;
          const endIdx = nextLine.indexOf('"""');
          if (endIdx >= 0) {
            parts.push(nextLine.slice(0, endIdx));
            break;
          }
          parts.push(nextLine);
        }
        result[key] = parts.join("\n");
      }
      continue;
    }

    // Double-quoted string
    if (rawValue.startsWith('"')) {
      const str = parseQuotedString(rawValue);
      if (str !== null) {
        result[key] = str;
      }
      continue;
    }

    // Boolean
    if (rawValue === "true") {
      result[key] = true;
      continue;
    }
    if (rawValue === "false") {
      result[key] = false;
      continue;
    }

    // Unquoted value — treat as string (strip inline comments)
    const commentIdx = rawValue.indexOf(" #");
    result[key] = commentIdx >= 0 ? rawValue.slice(0, commentIdx).trim() : rawValue;
  }

  return result;
}

/** Parse a TOML basic double-quoted string (handles \n, \t, \\, \") */
function parseQuotedString(raw: string): string | null {
  if (!raw.startsWith('"')) return null;

  let result = "";
  let i = 1;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') return result;
    if (ch === "\\") {
      i++;
      const esc = raw[i];
      if (esc === "n") result += "\n";
      else if (esc === "t") result += "\t";
      else if (esc === "\\") result += "\\";
      else if (esc === '"') result += '"';
      else result += esc ?? "";
    } else {
      result += ch;
    }
    i++;
  }
  // No closing quote found
  return result;
}

/** Parse a TOML-style string array: ["a", "b", "c"] (supports multi-line, trailing comma) */
function parseStringArray(raw: string): string[] {
  // Extract content between [ and ]
  const openIdx = raw.indexOf("[");
  const closeIdx = raw.lastIndexOf("]");
  if (openIdx < 0 || closeIdx < 0) return [];
  const inner = raw.slice(openIdx + 1, closeIdx);

  const items: string[] = [];
  // Match all double-quoted strings within the array
  const re = /"(?:[^"\\]|\\.)*"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(inner)) !== null) {
    const parsed = parseQuotedString(match[0]);
    if (parsed !== null) items.push(parsed);
  }
  return items;
}

// --- Glob pattern matching ---

/** Convert a file glob pattern to a RegExp (case-insensitive, full-name match) */
export function globToRegex(pattern: string): RegExp {
  let re = "";
  for (const ch of pattern) {
    if (ch === "*") re += ".*";
    else if (ch === "?") re += ".";
    else if (".+^${}()|[]\\".includes(ch)) re += "\\" + ch;
    else re += ch;
  }
  return new RegExp(`^${re}$`, "i");
}

/** Test if a filename matches any of the given glob patterns */
export function matchesAnyPattern(name: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegex(p).test(name));
}

// --- Placeholder expansion ---

export interface PlaceholderVars {
  baseUrl: string;
  dirName: string;
  path: string;
}

/** Derive placeholder variables from the current page URL */
export function getPlaceholderVars(): PlaceholderVars {
  const loc = window.location;
  const baseUrl = `${loc.protocol}//${loc.host}`;
  const path = decodeURIComponent(loc.pathname);
  // dirName: last non-empty segment of the path
  const segments = path.replace(/\/$/, "").split("/");
  const dirName = segments[segments.length - 1] || "";

  return { baseUrl, dirName, path };
}

/** Expand `${var}` placeholders in a string */
export function expandPlaceholders(template: string, vars: PlaceholderVars): string {
  return template
    .replace(/\$\{baseUrl\}/g, vars.baseUrl)
    .replace(/\$\{dirName\}/g, vars.dirName)
    .replace(/\$\{path\}/g, vars.path);
}

// --- Config loader with sessionStorage caching ---

/** Build the config from parsed key-value pairs */
function buildConfig(
  parsed: Record<string, ConfigValue>,
  vars: PlaceholderVars,
): AppConfig {
  const cfg = defaultConfig();

  if (typeof parsed["title"] === "string") {
    cfg.title = expandPlaceholders(parsed["title"], vars);
  }
  if (typeof parsed["heading"] === "string") {
    cfg.heading = expandPlaceholders(parsed["heading"], vars);
  }
  if (typeof parsed["footer"] === "string") {
    cfg.footer = expandPlaceholders(parsed["footer"], vars);
  }
  if (typeof parsed["upload_enabled"] === "boolean") {
    cfg.upload_enabled = parsed["upload_enabled"];
  }
  if (typeof parsed["delete_enabled"] === "boolean") {
    cfg.delete_enabled = parsed["delete_enabled"];
  }
  if (typeof parsed["index_ignore_folders"] === "boolean") {
    cfg.index_ignore_folders = parsed["index_ignore_folders"];
  }
  if (typeof parsed["index_ignore_dot_names"] === "boolean") {
    cfg.index_ignore_dot_names = parsed["index_ignore_dot_names"];
  }
  if (Array.isArray(parsed["index_exclude_names"])) {
    cfg.index_exclude_names = parsed["index_exclude_names"];
  }
  if (typeof parsed["index_sort_ignore_case"] === "boolean") {
    cfg.index_sort_ignore_case = parsed["index_sort_ignore_case"];
  }
  if (typeof parsed["index_sort_version"] === "boolean") {
    cfg.index_sort_version = parsed["index_sort_version"];
  }

  return cfg;
}

/** Fetch and parse the config file. Returns null on 404 or error. */
async function fetchAndParse(configUrl: string): Promise<Record<string, ConfigValue> | null> {
  try {
    const res = await fetch(configUrl);
    if (!res.ok) return null;
    const text = await res.text();
    return parseConfig(text);
  } catch {
    return null;
  }
}

/**
 * Load configuration with sessionStorage caching.
 *
 * - If cached data exists in sessionStorage, use it immediately.
 * - Then fetch in the background to update the cache for next load.
 * - If no cache, fetch synchronously (awaited).
 */
export async function loadConfig(): Promise<AppConfig> {
  const vars = getPlaceholderVars();
  const configUrl = new URL(CONFIG_FILE, window.location.href).href;

  // Try sessionStorage cache
  let cached: Record<string, ConfigValue> | null = null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      cached = JSON.parse(raw) as Record<string, string | boolean>;
    }
  } catch {
    // sessionStorage unavailable or parse error
  }

  if (cached !== null) {
    // Use cache, refresh in background
    fetchAndParse(configUrl).then((parsed) => {
      try {
        if (parsed !== null) {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // sessionStorage unavailable
      }
    });
    return buildConfig(cached, vars);
  }

  // No cache — fetch and wait
  const parsed = await fetchAndParse(configUrl);
  if (parsed !== null) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      // sessionStorage unavailable
    }
    return buildConfig(parsed, vars);
  }

  return defaultConfig();
}
