import type { DatasetFileDiff } from "./schema.js"

const REDACTION_TOKEN = "[REDACTED]"

const SENSITIVE_KEY_PATTERN =
  /(^|[_-])(api[_-]?key|authorization|bearer|cookie|password|private[_-]?key|secret|session|token)([_-]|$)/i

const SECRET_VALUE_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
] as const

export function redactText(value: string): string {
  let redacted = value
  for (const pattern of SECRET_VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTION_TOKEN)
  }
  return redacted
}

export function stringifyRedacted(value: unknown): string {
  try {
    const serialized = JSON.stringify(value, (key, nestedValue: unknown) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return REDACTION_TOKEN
      }
      if (typeof nestedValue === "string") {
        return redactText(nestedValue)
      }
      return nestedValue
    })
    return serialized === undefined ? "null" : serialized
  } catch (error) {
    if (error instanceof TypeError) {
      return JSON.stringify("[unserializable]")
    }
    throw error
  }
}

export function redactPayload(value: unknown): unknown {
  return JSON.parse(stringifyRedacted(value))
}

export function redactDiffs(diffs: readonly DatasetFileDiff[]): readonly DatasetFileDiff[] {
  return diffs.map((diff) => ({
    file: diff.file,
    before: redactText(diff.before),
    after: redactText(diff.after),
    additions: diff.additions,
    deletions: diff.deletions,
  }))
}
