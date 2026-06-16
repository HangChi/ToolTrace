import { createRunSchema, createTraceEventSchema, updateRunSchema } from "@tooltrace/schema";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { createEvent, createRun, listEventsByRunId, listRuns, updateRun } from "./storage.js";

export function createApp() {
  const app = new Hono();

  app.use("*", cors());

  app.get("/health", (c) => {
    return c.json({ ok: true });
  });

  app.post("/runs", async (c) => {
    const body = await readJson(c.req);
    const parsed = createRunSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "invalid_run", issues: parsed.error.issues }, 400);
    }

    await createRun(parsed.data);

    return c.json({ ok: true }, 201);
  });

  app.patch("/runs/:id", async (c) => {
    const body = await readJson(c.req);
    const parsed = updateRunSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "invalid_run_update", issues: parsed.error.issues }, 400);
    }

    await updateRun(c.req.param("id"), parsed.data);

    return c.json({ ok: true });
  });

  app.post("/events", async (c) => {
    const body = await readJson(c.req);
    const parsed = createTraceEventSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "invalid_trace_event", issues: parsed.error.issues }, 400);
    }

    await createEvent(parsed.data);

    return c.json({ ok: true }, 201);
  });

  app.get("/runs", async (c) => {
    const runs = await listRuns();

    return c.json(runs);
  });

  app.get("/runs/:id/events", async (c) => {
    const events = await listEventsByRunId(c.req.param("id"));

    return c.json(events);
  });

  return app;
}

async function readJson(request: { json: () => Promise<unknown> }) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
