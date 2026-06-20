import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { initializeDatabase } from "./storage.js";

const port = Number(process.env.PORT ?? 4319);

initializeDatabase();

serve({
  fetch: createApp().fetch,
  port
});

console.log(`Agent-Trace server running at http://localhost:${port}`);
