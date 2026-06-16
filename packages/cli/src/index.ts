#!/usr/bin/env node

import { spawn, type ChildProcess } from "node:child_process";

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "dev") {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printDevHelp();
    process.exit(0);
  }

  await runDev();
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
printHelp();
process.exit(1);

async function runDev() {
  const serverPort = process.env.TOOLTRACE_SERVER_PORT ?? "4319";
  const webPort = process.env.TOOLTRACE_WEB_PORT ?? "3000";
  const serverUrl = `http://localhost:${serverPort}`;
  const children: ChildProcess[] = [];

  console.log("Starting ToolTrace local dashboard...");
  console.log(`Collector: ${serverUrl}`);
  console.log(`Dashboard: http://localhost:${webPort}`);

  await runPnpm(["--filter", "@tooltrace/server", "db:init"], {
    TOOLTRACE_DB_PATH: process.env.TOOLTRACE_DB_PATH
  });

  children.push(
    spawnPnpm(["--filter", "@tooltrace/server", "dev"], {
      PORT: serverPort,
      TOOLTRACE_DB_PATH: process.env.TOOLTRACE_DB_PATH
    })
  );

  children.push(
    spawnPnpm(["--filter", "@tooltrace/web", "dev", "--", "-p", webPort], {
      TOOLTRACE_API_URL: serverUrl
    })
  );

  const stop = () => {
    for (const child of children) {
      child.kill();
    }
  };

  process.once("SIGINT", () => {
    stop();
    process.exit(130);
  });

  process.once("SIGTERM", () => {
    stop();
    process.exit(143);
  });

  await Promise.race(
    children.map(
      (child) =>
        new Promise<void>((resolve, reject) => {
          child.once("exit", (code) => {
            if (code === 0 || code === null) {
              resolve();
            } else {
              reject(new Error(`ToolTrace child process exited with code ${code}`));
            }
          });
        })
    )
  );
}

function runPnpm(args: string[], env: NodeJS.ProcessEnv = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawnPnpm(args, env);

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pnpm ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

function spawnPnpm(args: string[], env: NodeJS.ProcessEnv = {}) {
  const pnpm = resolvePnpmCommand();
  const child = spawn(pnpm.command, [...pnpm.args, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...withoutUndefined(env)
    },
    shell: process.platform === "win32" && pnpm.args.length === 0,
    stdio: "inherit"
  });

  child.once("error", (error) => {
    console.error(error.message);
  });

  return child;
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

function withoutUndefined(env: NodeJS.ProcessEnv) {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined));
}

function printHelp() {
  console.log(`ToolTrace CLI

Usage:
  tooltrace dev

Commands:
  dev    Start the local collector and dashboard
`);
}

function printDevHelp() {
  console.log(`tooltrace dev

Starts:
  collector   http://localhost:4319
  dashboard   http://localhost:3000

Environment:
  TOOLTRACE_DB_PATH       SQLite database path
  TOOLTRACE_SERVER_PORT   Collector port, default 4319
  TOOLTRACE_WEB_PORT      Dashboard port, default 3000
`);
}
