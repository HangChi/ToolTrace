import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { installHooks } from "./hooks.js";

const previousCodexHome = process.env.CODEX_HOME;
const previousClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
const codexHome = mkdtempSync(join(tmpdir(), "agent-trace-cli-smoke-"));
const claudeConfigDir = mkdtempSync(join(tmpdir(), "agent-trace-cli-smoke-claude-"));

try {
  process.env.CODEX_HOME = codexHome;
  process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;

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

  if (!command.includes("||") || !commandWindows.includes("|| exit /b 0")) {
    throw new Error("Expected Codex hook command to ignore collector delivery failures.");
  }

  if (!commandWindows.includes("curl.exe") || !commandWindows.includes("-o NUL")) {
    throw new Error("Expected Windows Codex hook command to use curl.exe and NUL output.");
  }

  if (!command.includes("surface=cli") || !command.includes("surface_source=agent-trace-cli")) {
    throw new Error("Expected default Codex hook command to include CLI surface hints.");
  }

  if (process.platform === "win32" && (!command.includes("curl.exe") || !command.includes("-o NUL"))) {
    throw new Error("Expected primary Codex hook command to be Windows-safe on Windows.");
  }

  if (!config.includes("surface=cli") || !config.includes("surface_source=agent-trace-cli")) {
    throw new Error("Expected Codex OTel endpoint to include CLI surface hints.");
  }

  installHooks("codex", {
    collectorUrl: "http://localhost:4319",
    redaction: "metadata",
    surface: "desktop"
  });

  const desktopHooks = JSON.parse(readFileSync(join(codexHome, "hooks.json"), "utf8")) as {
    hooks?: Record<string, Array<{ hooks?: Array<{ command?: string; commandWindows?: string }> }>>;
  };
  const desktopCommand = desktopHooks.hooks?.SessionStart?.[0]?.hooks?.[0]?.command;
  const desktopConfig = readFileSync(join(codexHome, "config.toml"), "utf8");

  if (
    !desktopCommand?.includes("surface=desktop") ||
    !desktopCommand.includes("surface_source=agent-trace-desktop")
  ) {
    throw new Error("Expected Codex desktop hook command to include desktop surface hints.");
  }

  if (
    !desktopConfig.includes("surface=desktop") ||
    !desktopConfig.includes("surface_source=agent-trace-desktop")
  ) {
    throw new Error("Expected Codex OTel endpoint to include desktop surface hints.");
  }

  installHooks("claude-code", {
    collectorUrl: "http://localhost:4319",
    redaction: "metadata"
  });

  const claudeSettings = JSON.parse(readFileSync(join(claudeConfigDir, "settings.json"), "utf8")) as {
    hooks?: Record<string, Array<{ hooks?: Array<{ type?: string; command?: string; url?: string }> }>>;
  };
  const claudeHandler = claudeSettings.hooks?.UserPromptSubmit?.[0]?.hooks?.[0];
  const claudeCommand = claudeHandler?.command;

  if (claudeHandler?.type !== "command" || claudeHandler.url !== undefined) {
    throw new Error("Expected Claude Code hook to use a non-blocking command handler.");
  }

  if (!claudeCommand?.includes("/integrations/claude-code/hook")) {
    throw new Error("Expected Claude Code hook command to post to the Claude Code integration.");
  }

  if (!claudeCommand.includes("||")) {
    throw new Error("Expected Claude Code hook command to ignore collector delivery failures.");
  }

  if (process.platform === "win32" && (!claudeCommand.includes("curl.exe") || !claudeCommand.includes("-o NUL"))) {
    throw new Error("Expected Claude Code hook command to be Windows-safe on Windows.");
  }

  console.log("Agent-Trace CLI smoke test passed.");
} finally {
  if (previousCodexHome === undefined) {
    delete process.env.CODEX_HOME;
  } else {
    process.env.CODEX_HOME = previousCodexHome;
  }

  if (previousClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR;
  } else {
    process.env.CLAUDE_CONFIG_DIR = previousClaudeConfigDir;
  }

  rmSync(codexHome, { recursive: true, force: true });
  rmSync(claudeConfigDir, { recursive: true, force: true });
}
