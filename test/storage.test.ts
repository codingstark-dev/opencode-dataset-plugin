import { describe, expect, test } from "bun:test"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createDatasetRecord } from "../src/schema.js"
import {
  appendDatasetRecord,
  readDatasetRecords,
  resolveDatasetPath,
  updateRecordStatus,
} from "../src/storage.js"

const source = {
  projectID: "project",
  directory: "/repo",
  worktree: "/repo",
}

describe("storage", () => {
  test("appends records as JSONL and reads them back", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opencode-dataset-"))
    const path = join(dir, "records.jsonl")
    const record = createDatasetRecord({
      kind: "manual",
      status: "accepted",
      source,
      sessionID: "session",
      instruction: "Collect data",
      output: "Done.",
    })

    await appendDatasetRecord(path, record)
    const records = await readDatasetRecords(path)

    expect(records).toHaveLength(1)
    expect(records[0]?.id).toBe(record.id)
  })

  test("updates review status in place", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opencode-dataset-"))
    const path = join(dir, "records.jsonl")
    const record = createDatasetRecord({
      kind: "manual",
      status: "pending",
      source,
      sessionID: "session",
      instruction: "Collect data",
      output: "Done.",
    })

    await appendDatasetRecord(path, record)
    const result = await updateRecordStatus(path, record.id, "accepted")
    const records = await readDatasetRecords(path)

    expect(result.kind).toBe("updated")
    expect(records[0]?.status).toBe("accepted")
    expect(records[0]?.reviewedAt).toBeString()
  })

  test("resolves relative dataset paths below the OpenCode directory", () => {
    const path = resolveDatasetPath("/repo", "data/train.jsonl")

    expect(path).toBe("/repo/data/train.jsonl")
  })
})
