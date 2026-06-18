import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installHooks } from "./hooks.js";

const previousCodexHome = process.env.CODEX_HOME;
const codexHome = mkdtempSync(join(tmpdir(), "tooltrace-cli-smoke-"));

try {
  process.env.CODEX_HOME = codexHome;

  installHooks("codex", {
    collectorUrl: "http://localhost:4319",
    redaction: "metadata"
  });

  const hooks = JSON.parse(readFileSync(join(codexHome, "hooks.json"), "utf8")) as {
    hooks?: Record<string, Array<{ hooks?: Array<{ command?: string; commandWindows?: string }> }>>;
  };
  const command = hooks.hooks?.SessionStart?.[0]?.hooks?.[0]?.command;
  const commandWindows = hooks.hooks?.SessionStart?.[0]?.hooks?.[0]?.commandWindows;
  const config = readFileSync(join(codexHome, "config.toml"), "utf8");

  if (!command?.includes('--data-binary "@-"')) {
    throw new Error("Expected primary Codex hook command to quote curl stdin marker.");
  }

  if (!commandWindows?.includes('--data-binary "@-"')) {
    throw new Error("Expected Windows Codex hook command to quote curl stdin marker.");
  }

  if (!commandWindows.includes("curl.exe") || !commandWindows.includes("-o NUL")) {
    throw new Error("Expected Windows Codex hook command to use curl.exe and NUL output.");
  }

  if (process.platform === "win32" && (!command.includes("curl.exe") || !command.includes("-o NUL"))) {
    throw new Error("Expected primary Codex hook command to be Windows-safe on Windows.");
  }

  if (!config.includes("surface=cli") || !config.includes("surface_source=tooltrace-cli")) {
    throw new Error("Expected Codex OTel endpoint to include CLI surface hints.");
  }

  console.log("ToolTrace CLI smoke test passed.");
} finally {
  if (previousCodexHome === undefined) {
    delete process.env.CODEX_HOME;
  } else {
    process.env.CODEX_HOME = previousCodexHome;
  }

  rmSync(codexHome, { recursive: true, force: true });
}
