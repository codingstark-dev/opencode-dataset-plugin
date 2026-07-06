import { exportDataset } from "./exporters.js"
import { ExportFormatSchema, ReviewStatusSchema, type ExportFormat } from "./schema.js"
import {
  appendDatasetRecord,
  readDatasetRecords,
  resolveDatasetPath,
  updateRecordStatus,
} from "./storage.js"
import { createDatasetRecord } from "./schema.js"

const HELP = `opencode-dataset

Commands:
  demo [--path file]                         append one accepted demo record
  stats [--path file]                        print record counts
  export --format <format> [--path file]     write JSONL to stdout
  review [--path file] [--once]              review pending examples
  accept <record-id> [--path file]           mark a record accepted
  reject <record-id> [--path file]           mark a record rejected

Formats: canonical, openai, alpaca, sharegpt, dpo
`

export async function runCli(argv: readonly string[]): Promise<void> {
  const args = argv.slice(2)
  const command = args[0] ?? "help"
  const datasetPath = resolveDatasetPath(process.cwd(), readFlag(args, "--path"))

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      console.log(HELP)
      return
    case "demo":
      await appendDatasetRecord(
        datasetPath,
        createDatasetRecord({
          kind: "manual",
          status: "accepted",
          source: {
            projectID: "demo",
            directory: process.cwd(),
            worktree: process.cwd(),
          },
          sessionID: "demo",
          instruction: "Refactor a small TypeScript helper to be easier to test.",
          input: "The helper currently mixes parsing, IO, and formatting.",
          output: "Split boundary parsing from pure formatting and add a focused unit test.",
          rejectedOutput: "Rewrite the whole app from scratch.",
          tags: ["demo", "typescript"],
        }),
      )
      console.log(`Wrote demo record to ${datasetPath}`)
      return
    case "stats":
      printStats(await readDatasetRecords(datasetPath), datasetPath)
      return
    case "export":
      console.log(
        exportDataset(await readDatasetRecords(datasetPath), readExportFormat(args), {
          includePending: args.includes("--include-pending"),
        }),
      )
      return
    case "review": {
      const records = await readDatasetRecords(datasetPath)
      if (args.includes("--once")) {
        printStats(records, datasetPath)
        return
      }
      const { openReviewTui } = await import("./review-tui.js")
      await openReviewTui(datasetPath, records)
      return
    }
    case "accept":
    case "reject": {
      const recordID = args[1]
      if (recordID === undefined) {
        throw new CliUsageError(`${command} requires a record id`)
      }
      const status = ReviewStatusSchema.parse(command === "accept" ? "accepted" : "rejected")
      const result = await updateRecordStatus(datasetPath, recordID, status)
      switch (result.kind) {
        case "updated":
          console.log(`${result.record.id} -> ${result.record.status}`)
          return
        case "missing":
          throw new CliUsageError(`record not found: ${recordID}`)
        default:
          return
      }
    }
    default:
      throw new CliUsageError(`unknown command: ${command}`)
  }
}

function readExportFormat(args: readonly string[]): ExportFormat {
  return ExportFormatSchema.parse(readFlag(args, "--format") ?? "openai")
}

function readFlag(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index < 0) {
    return undefined
  }
  return args[index + 1]
}

function printStats(records: readonly { readonly kind: string; readonly status: string }[], path: string): void {
  const statusCounts = countBy(records.map((record) => record.status))
  const kindCounts = countBy(records.map((record) => record.kind))
  console.log(
    JSON.stringify(
      {
        path,
        total: records.length,
        status: statusCounts,
        kind: kindCounts,
      },
      undefined,
      2,
    ),
  )
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

class CliUsageError extends Error {
  override readonly name = "CliUsageError"
}
