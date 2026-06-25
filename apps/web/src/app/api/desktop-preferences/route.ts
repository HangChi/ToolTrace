import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CloseBehavior = "ask" | "exit" | "minimize";

type Preferences = {
  closeBehavior?: unknown;
  [key: string]: unknown;
};

const defaultCloseBehavior: CloseBehavior = "ask";

export async function GET() {
  const preferencesPath = getPreferencesPath();

  if (!preferencesPath) {
    return NextResponse.json({
      available: false,
      closeBehavior: defaultCloseBehavior
    });
  }

  const preferences = await readPreferences(preferencesPath);

  return NextResponse.json({
    available: true,
    closeBehavior: parseCloseBehavior(preferences.closeBehavior)
  });
}

export async function PUT(request: NextRequest) {
  const preferencesPath = getPreferencesPath();

  if (!preferencesPath) {
    return NextResponse.json(
      {
        available: false,
        closeBehavior: defaultCloseBehavior
      },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => undefined)) as { closeBehavior?: unknown } | undefined;
  const closeBehavior = parseCloseBehavior(body?.closeBehavior);

  if (body?.closeBehavior !== closeBehavior) {
    return NextResponse.json(
      {
        available: true,
        closeBehavior: parseCloseBehavior((await readPreferences(preferencesPath)).closeBehavior)
      },
      { status: 400 }
    );
  }

  const preferences = await readPreferences(preferencesPath);
  preferences.closeBehavior = closeBehavior;

  await mkdir(path.dirname(preferencesPath), { recursive: true });
  await writeFile(preferencesPath, `${JSON.stringify(preferences, null, 2)}\n`, "utf8");

  return NextResponse.json({
    available: true,
    closeBehavior
  });
}

function getPreferencesPath() {
  const configured = process.env.AGENT_TRACE_DESKTOP_PREFERENCES_PATH;

  return configured && path.isAbsolute(configured) ? configured : undefined;
}

async function readPreferences(preferencesPath: string): Promise<Preferences> {
  try {
    const raw = await readFile(preferencesPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseCloseBehavior(value: unknown): CloseBehavior {
  return value === "exit" || value === "minimize" || value === "ask" ? value : defaultCloseBehavior;
}

function isRecord(value: unknown): value is Preferences {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
