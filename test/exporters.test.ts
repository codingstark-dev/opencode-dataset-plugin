import { describe, expect, test } from "bun:test"
import { exportDataset, toExamples } from "../src/exporters.js"
import { createDatasetRecord } from "../src/schema.js"

const source = {
  projectID: "project",
  directory: "/repo",
  worktree: "/repo",
}

describe("exporters", () => {
  test("exports accepted records as OpenAI chat JSONL", () => {
    const record = createDatasetRecord({
      kind: "manual",
      status: "accepted",
      source,
      sessionID: "session",
      instruction: "Fix the bug",
      output: "The bug is fixed.",
    })

    const jsonl = exportDataset([record], "openai", { includePending: false })

    expect(jsonl).toBe(
      '{"messages":[{"role":"user","content":"Fix the bug"},{"role":"assistant","content":"The bug is fixed."}]}',
    )
  })

  test("skips pending records unless explicitly included", () => {
    const record = createDatasetRecord({
      kind: "manual",
      status: "pending",
      source,
      sessionID: "session",
      instruction: "Fix the bug",
      output: "The bug is fixed.",
    })

    expect(toExamples([record], { includePending: false })).toHaveLength(0)
    expect(toExamples([record], { includePending: true })).toHaveLength(1)
  })

  test("exports preference examples for DPO when rejected output exists", () => {
    const record = createDatasetRecord({
      kind: "manual",
      status: "accepted",
      source,
      sessionID: "session",
      instruction: "Choose the better patch",
      output: "Use the small patch.",
      rejectedOutput: "Rewrite everything.",
    })

    const jsonl = exportDataset([record], "dpo", { includePending: false })

    expect(jsonl).toBe(
      '{"prompt":"Choose the better patch","chosen":"Use the small patch.","rejected":"Rewrite everything."}',
    )
  })

  test("exports ShareGPT conversation JSONL", () => {
    const record = createDatasetRecord({
      kind: "manual",
      status: "accepted",
      source,
      sessionID: "session",
      instruction: "Summarize the diff",
      output: "Two files changed.",
    })

    const jsonl = exportDataset([record], "sharegpt", { includePending: false })

    expect(jsonl).toBe(
      '{"conversations":[{"from":"human","value":"Summarize the diff"},{"from":"gpt","value":"Two files changed."}]}',
    )
  })
})
