#!/usr/bin/env bun

import { runCli } from "./src/cli.js"

export { DatasetPlugin, DatasetPlugin as server } from "./src/plugin.js"
export { runCli } from "./src/cli.js"
export type { DatasetRecord, ExportFormat, ReviewStatus } from "./src/schema.js"

if (import.meta.main) {
  await runCli(Bun.argv)
}
