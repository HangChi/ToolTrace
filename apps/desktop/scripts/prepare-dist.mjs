import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, rmSync, cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as tar from "tar";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(desktopRoot, "../..");
const resourcesArchivesDir = resolve(desktopRoot, "resources/archives");
const resourcesNodeDir = resolve(desktopRoot, "resources/node");
const resourcesServerRootDir = resolve(desktopRoot, "resources/server");
const resourcesWebRootDir = resolve(desktopRoot, "resources/web");
const stagingDir = resolve(desktopRoot, "resources/staging");
const stagingServerRootDir = resolve(stagingDir, "server");
const stagingServerAppDir = resolve(stagingServerRootDir, "app");
const stagingWebRootDir = resolve(stagingDir, "web");
const stagingWebAppDir = resolve(stagingWebRootDir, "app");
const skipBuild = process.argv.includes("--skip-build");

if (!skipBuild) {
  await runPnpm(["--filter", "@agent-trace/schema", "build"], workspaceRoot);
  await runPnpm(["--filter", "@agent-trace/server", "build"], workspaceRoot);
  await runPnpm(["--filter", "@agent-trace/web", "build"], workspaceRoot);
}

const standaloneDir = resolve(workspaceRoot, "apps/web/.next/standalone");
const staticDir = resolve(workspaceRoot, "apps/web/.next/static");
const publicDir = resolve(workspaceRoot, "apps/web/public");
const nodeExecutableName = process.platform === "win32" ? "node.exe" : "node";

if (!existsSync(standaloneDir)) {
  throw new Error("Next standalone output was not found. Run pnpm --filter @agent-trace/web build first.");
}

if (!existsSync(staticDir)) {
  throw new Error("Next static output was not found. Run pnpm --filter @agent-trace/web build first.");
}

rmSync(resourcesNodeDir, { recursive: true, force: true });
rmSync(resourcesArchivesDir, { recursive: true, force: true });
rmSync(resourcesServerRootDir, { recursive: true, force: true });
rmSync(resourcesWebRootDir, { recursive: true, force: true });
rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(resourcesNodeDir, { recursive: true });
mkdirSync(resourcesArchivesDir, { recursive: true });
mkdirSync(stagingWebAppDir, { recursive: true });

copyFileSync(process.execPath, resolve(resourcesNodeDir, nodeExecutableName));
await runPnpm(
  ["--filter", "@agent-trace/server", "deploy", "--prod", "--legacy", stagingServerAppDir],
  workspaceRoot
);
copyPnpmHoistedDependencies(resolve(stagingServerAppDir, "node_modules"), {
  skipEntries: new Set(["@agent-trace"]),
  skipExisting: true
});

cpSync(standaloneDir, stagingWebAppDir, { recursive: true, dereference: true });
cpSync(staticDir, resolve(stagingWebAppDir, "apps/web/.next/static"), { recursive: true });
copyPnpmHoistedDependencies(resolve(stagingWebAppDir, "node_modules"));

if (existsSync(publicDir)) {
  cpSync(publicDir, resolve(stagingWebAppDir, "apps/web/public"), { recursive: true });
}

createRuntimeArchive(stagingServerRootDir, resolve(resourcesArchivesDir, "server.tgz"));
createRuntimeArchive(stagingWebRootDir, resolve(resourcesArchivesDir, "web.tgz"));
rmSync(stagingDir, { recursive: true, force: true });

function copyPnpmHoistedDependencies(nodeModulesDir, options = {}) {
  const skipEntries = options.skipEntries ?? new Set();
  const skipExisting = options.skipExisting ?? false;
  const hoistedDir = resolve(nodeModulesDir, ".pnpm/node_modules");

  if (!existsSync(hoistedDir)) {
    return;
  }

  for (const entry of readdirSync(hoistedDir)) {
    const targetPath = resolve(nodeModulesDir, entry);

    if (skipEntries.has(entry)) {
      continue;
    }

    if (skipExisting && existsSync(targetPath)) {
      continue;
    }

    cpSync(resolve(hoistedDir, entry), targetPath, {
      recursive: true,
      dereference: true,
      force: true
    });
  }
}

function createRuntimeArchive(cwd, file) {
  tar.c(
    {
      cwd,
      file,
      filter: shouldIncludeRuntimeArchiveEntry,
      follow: true,
      gzip: true,
      noMtime: true,
      portable: true,
      sync: true
    },
    ["app"]
  );
}

function shouldIncludeRuntimeArchiveEntry(entryPath) {
  const normalizedPath = entryPath.replaceAll("\\", "/");

  if (
    normalizedPath.includes("/node_modules/.pnpm/") ||
    normalizedPath.endsWith("/node_modules/.pnpm")
  ) {
    return false;
  }

  return !normalizedPath.endsWith(".map") && !normalizedPath.endsWith(".d.ts");
}

function runPnpm(args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const pnpm = resolvePnpmCommand();
    const child = spawn(pnpm.command, [...pnpm.args, ...args], {
      cwd,
      env: process.env,
      shell: process.platform === "win32" && pnpm.args.length === 0,
      stdio: "inherit"
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`pnpm ${args.join(" ")} exited with code ${code}`));
    });

    child.once("error", reject);
  });
}

function resolvePnpmCommand() {
  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath?.toLowerCase().includes("pnpm")) {
    return {
      command: process.execPath,
      args: [npmExecPath]
    };
  }

  return {
    command: "pnpm",
    args: []
  };
}
