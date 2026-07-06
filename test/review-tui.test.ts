import { describe, expect, test } from "bun:test"
import {
  createInitialReviewState,
  formatReviewBody,
  formatReviewTitle,
  selectReviewRecords,
  toggleReviewMode,
} from "../src/review-state.js"
import { createDatasetRecord, type DatasetRecord } from "../src/schema.js"

const datasetPath = "/Users/himanshum/.opencode/datasets/opencode-dataset.jsonl"

const source = {
  projectID: "project",
  directory: "/repo",
  worktree: "/repo",
}

describe("review TUI state", () => {
  test("shows all records when no pending records exist", () => {
    const accepted = record("accepted")
    const records = [accepted]
    const state = createInitialReviewState(records)
    const visibleRecords = selectReviewRecords(records, state.mode)

    expect(state.mode).toBe("all")
    expect(visibleRecords).toHaveLength(1)
    expect(formatReviewTitle({ datasetPath, records, state, selected: visibleRecords[0] })).toContain(
      "All records 1/1",
    )
    expect(formatReviewBody({ datasetPath, records, state, selected: visibleRecords[0] })).toContain(
      "status: accepted",
    )
  })

  test("starts in pending mode when review work exists", () => {
    const pending = record("pending")
    const accepted = record("accepted")
    const records = [accepted, pending]
    const state = createInitialReviewState(records)
    const pendingRecords = selectReviewRecords(records, state.mode)
    const allState = toggleReviewMode(records, state)
    const allRecords = selectReviewRecords(records, allState.mode)

    expect(state.mode).toBe("pending")
    expect(pendingRecords).toHaveLength(1)
    expect(pendingRecords[0]?.id).toBe(pending.id)
    expect(allState.mode).toBe("all")
    expect(allRecords).toHaveLength(2)
  })

  test("explains empty dataset paths", () => {
    const records: readonly DatasetRecord[] = []
    const state = createInitialReviewState(records)
    const body = formatReviewBody({ datasetPath, records, state, selected: undefined })

    expect(formatReviewTitle({ datasetPath, records, state, selected: undefined })).toContain(
      "No records in /Users/himanshum/.opencode",
    )
    expect(body).toContain("No dataset records yet.")
    expect(body).toContain("run this from the project root")
  })
})

function record(status: DatasetRecord["status"]): DatasetRecord {
  return createDatasetRecord({
    kind: "manual",
    status,
    source,
    sessionID: "session",
    instruction: "Collect useful data",
    output: "Saved a high quality example.",
  })
}
