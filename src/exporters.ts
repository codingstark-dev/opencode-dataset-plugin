import { assertNever, ExportFormatSchema, type DatasetRecord, type ExportFormat } from "./schema.js"

export type ExportOptions = {
  readonly includePending: boolean
}

type SftExample = {
  readonly instruction: string
  readonly input: string
  readonly output: string
  readonly rejectedOutput?: string
  readonly tags: readonly string[]
  readonly metadata: DatasetRecord["metadata"]
}

type OpenAIMessage = {
  readonly role: "user" | "assistant"
  readonly content: string
}

type OpenAIExample = {
  readonly messages: readonly OpenAIMessage[]
}

type AlpacaExample = {
  readonly instruction: string
  readonly input: string
  readonly output: string
}

type ShareGptTurn = {
  readonly from: "human" | "gpt"
  readonly value: string
}

type ShareGptExample = {
  readonly conversations: readonly ShareGptTurn[]
}

type DpoExample = {
  readonly prompt: string
  readonly chosen: string
  readonly rejected: string
}

export function exportDataset(
  records: readonly DatasetRecord[],
  format: ExportFormat,
  options: ExportOptions,
): string {
  const parsedFormat = ExportFormatSchema.parse(format)
  switch (parsedFormat) {
    case "canonical":
      return toJsonl(records.filter((record) => isAllowedByStatus(record, options)))
    case "openai":
      return toJsonl(toExamples(records, options).map(toOpenAIExample))
    case "alpaca":
      return toJsonl(toExamples(records, options).map(toAlpacaExample))
    case "sharegpt":
      return toJsonl(toExamples(records, options).map(toShareGptExample))
    case "dpo":
      return toJsonl(toExamples(records, options).flatMap(toDpoExample))
    default:
      return assertNever(parsedFormat)
  }
}

export function toExamples(
  records: readonly DatasetRecord[],
  options: ExportOptions,
): readonly SftExample[] {
  return records.flatMap((record) => {
    if (!isAllowedByStatus(record, options)) {
      return []
    }
    if (record.instruction === undefined || record.output === undefined) {
      return []
    }
    return [
      {
        instruction: record.instruction,
        input: record.input ?? "",
        output: record.output,
        ...(record.rejectedOutput === undefined ? {} : { rejectedOutput: record.rejectedOutput }),
        tags: record.tags,
        metadata: record.metadata,
      },
    ]
  })
}

function isAllowedByStatus(record: DatasetRecord, options: ExportOptions): boolean {
  if (record.status === "accepted") {
    return true
  }
  if (record.status === "pending") {
    return options.includePending
  }
  return false
}

function toOpenAIExample(example: SftExample): OpenAIExample {
  return {
    messages: [
      { role: "user", content: example.instruction },
      { role: "assistant", content: example.output },
    ],
  }
}

function toAlpacaExample(example: SftExample): AlpacaExample {
  return {
    instruction: example.instruction,
    input: example.input,
    output: example.output,
  }
}

function toShareGptExample(example: SftExample): ShareGptExample {
  return {
    conversations: [
      { from: "human", value: example.instruction },
      { from: "gpt", value: example.output },
    ],
  }
}

function toDpoExample(example: SftExample): readonly DpoExample[] {
  if (example.rejectedOutput === undefined) {
    return []
  }
  return [
    {
      prompt: example.instruction,
      chosen: example.output,
      rejected: example.rejectedOutput,
    },
  ]
}

function toJsonl(rows: readonly unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n")
}
