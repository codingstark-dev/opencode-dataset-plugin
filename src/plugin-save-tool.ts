import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { DatasetCaptureContext } from "./plugin.js"
import { redactText } from "./redaction.js"
import { createDatasetRecord, SaveTrainingExampleSchema } from "./schema.js"
import { appendDatasetRecord } from "./storage.js"

export function createSaveTrainingTool(capture: DatasetCaptureContext): ToolDefinition {
  return tool({
    description: "Save a high-quality instruction/output pair into the local fine-tuning dataset.",
    args: {
      instruction: tool.schema.string().min(1).describe("The user task or prompt."),
      input: tool.schema.string().optional().describe("Optional extra context or input."),
      output: tool.schema.string().min(1).describe("The ideal assistant response or result."),
      rejectedOutput: tool.schema
        .string()
        .optional()
        .describe("Optional rejected answer for DPO/preference exports."),
      tags: tool.schema.array(tool.schema.string().min(1)).default([]).describe("Searchable tags."),
      labels: tool.schema.array(tool.schema.string().min(1)).default([]).describe("Dataset labels."),
    },
    async execute(args, context) {
      const parsed = SaveTrainingExampleSchema.parse(args)
      const record = createDatasetRecord({
        kind: "manual",
        status: "accepted",
        source: capture.source,
        sessionID: context.sessionID,
        messageID: context.messageID,
        instruction: redactWhenEnabled(parsed.instruction, capture),
        input:
          parsed.input === undefined ? undefined : redactWhenEnabled(parsed.input, capture),
        output: redactWhenEnabled(parsed.output, capture),
        rejectedOutput:
          parsed.rejectedOutput === undefined
            ? undefined
            : redactWhenEnabled(parsed.rejectedOutput, capture),
        tags: parsed.tags,
        labels: parsed.labels,
      })
      await appendDatasetRecord(capture.datasetPath, record)
      context.metadata({
        title: "Saved training example",
        metadata: {
          datasetPath: capture.datasetPath,
          recordID: record.id,
        },
      })
      return {
        title: "Training example saved",
        output: `Saved ${record.id} to ${capture.datasetPath}`,
        metadata: {
          datasetPath: capture.datasetPath,
          recordID: record.id,
        },
      }
    },
  })
}

function redactWhenEnabled(value: string, capture: DatasetCaptureContext): string {
  return capture.options.redactionEnabled ? redactText(value) : value
}
