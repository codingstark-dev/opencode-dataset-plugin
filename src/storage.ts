import { appendFile, mkdir } from "node:fs/promises"
import { dirname, isAbsolute, join } from "node:path"
import { DatasetRecordSchema, ReviewStatusSchema, type DatasetRecord, type ReviewStatus } from "./schema.js"

export const DEFAULT_DATASET_PATH = ".opencode/datasets/opencode-dataset.jsonl"

export type UpdateStatusResult =
  | {
      readonly kind: "updated"
      readonly record: DatasetRecord
    }
  | {
      readonly kind: "missing"
    }

export function resolveDatasetPath(directory: string, configuredPath?: string): string {
  const path = configuredPath ?? DEFAULT_DATASET_PATH
  return isAbsolute(path) ? path : join(directory, path)
}

export async function appendDatasetRecord(path: string, record: DatasetRecord): Promise<void> {
  await ensureParentDirectory(path)
  const parsed = DatasetRecordSchema.parse(record)
  await appendFile(path, `${JSON.stringify(parsed)}\n`, "utf8")
}

export async function readDatasetRecords(path: string): Promise<readonly DatasetRecord[]> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    return []
  }

  const text = await file.text()
  const records: DatasetRecord[] = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.length > 0) {
      const parsed: unknown = JSON.parse(trimmed)
      records.push(DatasetRecordSchema.parse(parsed))
    }
  }
  return records
}

export async function writeDatasetRecords(
  path: string,
  records: readonly DatasetRecord[],
): Promise<void> {
  await ensureParentDirectory(path)
  const content = records.map((record) => JSON.stringify(DatasetRecordSchema.parse(record))).join("\n")
  await Bun.write(path, content.length === 0 ? "" : `${content}\n`)
}

export async function updateRecordStatus(
  path: string,
  recordID: string,
  status: ReviewStatus,
): Promise<UpdateStatusResult> {
  const parsedStatus = ReviewStatusSchema.parse(status)
  const records = await readDatasetRecords(path)
  let updatedRecord: DatasetRecord | undefined
  const nextRecords = records.map((record) => {
    if (record.id !== recordID) {
      return record
    }
    updatedRecord = DatasetRecordSchema.parse({
      ...record,
      status: parsedStatus,
      reviewedAt: new Date().toISOString(),
    })
    return updatedRecord
  })

  if (updatedRecord === undefined) {
    return { kind: "missing" }
  }

  await writeDatasetRecords(path, nextRecords)
  return { kind: "updated", record: updatedRecord }
}

export async function ensureParentDirectory(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
}
