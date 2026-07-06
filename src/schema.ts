import { z } from "zod"

export const ExportFormatSchema = z.enum(["canonical", "openai", "alpaca", "sharegpt", "dpo"])
export type ExportFormat = z.infer<typeof ExportFormatSchema>

export const ReviewStatusSchema = z.enum(["pending", "accepted", "rejected"])
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>

export const DatasetRecordKindSchema = z.enum([
  "manual",
  "tool_call",
  "session_diff",
  "file_edit",
  "message",
  "message_part",
  "permission",
  "session",
])
export type DatasetRecordKind = z.infer<typeof DatasetRecordKindSchema>

export const DatasetSourceSchema = z.object({
  projectID: z.string().min(1),
  directory: z.string().min(1),
  worktree: z.string().min(1),
})
export type DatasetSource = z.infer<typeof DatasetSourceSchema>

export const DatasetFileDiffSchema = z.object({
  file: z.string().min(1),
  before: z.string(),
  after: z.string(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
})
export type DatasetFileDiff = z.infer<typeof DatasetFileDiffSchema>

export const MetadataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
)
export type DatasetMetadata = z.infer<typeof MetadataSchema>

export const DatasetRecordSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  kind: DatasetRecordKindSchema,
  status: ReviewStatusSchema,
  createdAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
  sessionID: z.string().min(1),
  messageID: z.string().min(1).optional(),
  callID: z.string().min(1).optional(),
  tool: z.string().min(1).optional(),
  source: DatasetSourceSchema,
  instruction: z.string().optional(),
  input: z.string().optional(),
  output: z.string().optional(),
  rejectedOutput: z.string().optional(),
  diff: z.array(DatasetFileDiffSchema),
  files: z.array(z.string()),
  tags: z.array(z.string()),
  labels: z.array(z.string()),
  payload: z.unknown().optional(),
  metadata: MetadataSchema,
})
export type DatasetRecord = z.infer<typeof DatasetRecordSchema>

export const PluginOptionsSchema = z.object({
  datasetPath: z.string().min(1).optional(),
  captureToolResults: z.boolean().default(true),
  captureMessages: z.boolean().default(true),
  captureDiffs: z.boolean().default(true),
  capturePermissions: z.boolean().default(true),
  redactionEnabled: z.boolean().default(true),
})
export type DatasetPluginOptions = z.infer<typeof PluginOptionsSchema>

export const SaveTrainingExampleSchema = z.object({
  instruction: z.string().min(1),
  output: z.string().min(1),
  input: z.string().optional(),
  rejectedOutput: z.string().optional(),
  tags: z.array(z.string().min(1)).default([]),
  labels: z.array(z.string().min(1)).default([]),
})
export type SaveTrainingExample = z.infer<typeof SaveTrainingExampleSchema>

export type RecordBaseInput = {
  readonly kind: DatasetRecordKind
  readonly source: DatasetSource
  readonly sessionID: string
  readonly messageID?: string
  readonly callID?: string
  readonly tool?: string
  readonly instruction?: string
  readonly input?: string
  readonly output?: string
  readonly rejectedOutput?: string
  readonly diff?: readonly DatasetFileDiff[]
  readonly files?: readonly string[]
  readonly tags?: readonly string[]
  readonly labels?: readonly string[]
  readonly payload?: unknown
  readonly metadata?: DatasetMetadata
  readonly status?: ReviewStatus
}

export function createDatasetRecord(input: RecordBaseInput): DatasetRecord {
  const record = {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    kind: input.kind,
    status: input.status ?? "pending",
    createdAt: new Date().toISOString(),
    sessionID: input.sessionID,
    source: input.source,
    diff: [...(input.diff ?? [])],
    files: [...(input.files ?? [])],
    tags: [...(input.tags ?? [])],
    labels: [...(input.labels ?? [])],
    metadata: input.metadata ?? {},
    ...(input.messageID === undefined ? {} : { messageID: input.messageID }),
    ...(input.callID === undefined ? {} : { callID: input.callID }),
    ...(input.tool === undefined ? {} : { tool: input.tool }),
    ...(input.instruction === undefined ? {} : { instruction: input.instruction }),
    ...(input.input === undefined ? {} : { input: input.input }),
    ...(input.output === undefined ? {} : { output: input.output }),
    ...(input.rejectedOutput === undefined ? {} : { rejectedOutput: input.rejectedOutput }),
    ...(input.payload === undefined ? {} : { payload: input.payload }),
  }

  return DatasetRecordSchema.parse(record)
}

export function assertNever(value: never): never {
  throw new UnexpectedVariantError(String(value))
}

export class UnexpectedVariantError extends Error {
  override readonly name = "UnexpectedVariantError"

  constructor(readonly value: string) {
    super(`Unexpected variant: ${value}`)
  }
}
