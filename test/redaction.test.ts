import { describe, expect, test } from "bun:test"
import { redactDiffs, redactPayload, redactText, stringifyRedacted } from "../src/redaction.js"

describe("redaction", () => {
  test("redacts common secret values when text contains credentials", () => {
    const text = "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234567890"

    const redacted = redactText(text)

    expect(redacted).toBe("OPENAI_API_KEY=[REDACTED]")
  })

  test("redacts sensitive object keys before JSONL storage", () => {
    const payload = {
      authorization: "Bearer sk-abcdefghijklmnopqrstuvwxyz1234567890",
      nested: {
        token: "ghp_abcdefghijklmnopqrstuvwxyz123456",
      },
      safe: "keep me",
    }

    const redacted = stringifyRedacted(payload)

    expect(redacted).toContain('"authorization":"[REDACTED]"')
    expect(redacted).toContain('"token":"[REDACTED]"')
    expect(redacted).toContain('"safe":"keep me"')
  })

  test("redacts file diffs without changing file stats", () => {
    const redacted = redactDiffs([
      {
        file: "src/index.ts",
        before: "const key = 'sk-abcdefghijklmnopqrstuvwxyz1234567890'",
        after: "const key = 'sk-abcdefghijklmnopqrstuvwxyz1234567890'",
        additions: 1,
        deletions: 1,
      },
    ])

    expect(redacted[0]?.file).toBe("src/index.ts")
    expect(redacted[0]?.before).toContain("[REDACTED]")
    expect(redacted[0]?.additions).toBe(1)
  })

  test("redactPayload returns JSON-compatible redacted data", () => {
    const redacted = redactPayload({ api_key: "sk-abcdefghijklmnopqrstuvwxyz1234567890" })

    expect(JSON.stringify(redacted)).toBe('{"api_key":"[REDACTED]"}')
  })
})
