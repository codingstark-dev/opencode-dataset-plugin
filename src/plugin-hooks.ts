import type { Hooks } from "@opencode-ai/plugin"
import type { DatasetCaptureContext } from "./plugin.js"
import { redactPayload, redactText, stringifyRedacted } from "./redaction.js"
import { createDatasetRecord } from "./schema.js"
import { appendDatasetRecord } from "./storage.js"

type CaptureHooks = Pick<
  Hooks,
  "chat.message" | "tool.execute.before" | "tool.execute.after" | "permission.ask"
>

type PendingToolCall = {
  readonly args: unknown
  readonly startedAt: string
}

export function createCaptureHooks(capture: DatasetCaptureContext): CaptureHooks {
  const pendingTools = new Map<string, PendingToolCall>()

  return {
    "chat.message": async (input, output) => {
      if (!capture.options.captureMessages) {
        return
      }
      const text = extractTextParts(output.parts)
      if (text.length === 0) {
        return
      }
      const redactedText = redactWhenEnabled(text, capture)
      await appendDatasetRecord(
        capture.datasetPath,
        createDatasetRecord({
          kind: "message",
          source: capture.source,
          sessionID: input.sessionID,
          messageID: input.messageID,
          instruction: redactedText,
          output: redactedText,
          payload: maybeRedactPayload(output.message, capture),
          metadata: {
            agent: input.agent ?? "unknown",
            providerID: input.model?.providerID ?? "unknown",
            modelID: input.model?.modelID ?? "unknown",
          },
        }),
      )
    },
    "tool.execute.before": async (input, output) => {
      if (!capture.options.captureToolResults) {
        return
      }
      pendingTools.set(toolCallKey(input.sessionID, input.callID), {
        args: output.args,
        startedAt: new Date().toISOString(),
      })
    },
    "tool.execute.after": async (input, output) => {
      if (!capture.options.captureToolResults) {
        return
      }
      const key = toolCallKey(input.sessionID, input.callID)
      const pending = pendingTools.get(key)
      pendingTools.delete(key)
      const args = pending?.args ?? input.args
      await appendDatasetRecord(
        capture.datasetPath,
        createDatasetRecord({
          kind: "tool_call",
          source: capture.source,
          sessionID: input.sessionID,
          callID: input.callID,
          tool: input.tool,
          input: capture.options.redactionEnabled ? stringifyRedacted(args) : JSON.stringify(args),
          output: redactWhenEnabled(output.output, capture),
          payload: maybeRedactPayload({ title: output.title, metadata: output.metadata }, capture),
          metadata: {
            tool: input.tool,
            startedAt: pending?.startedAt ?? "unknown",
          },
        }),
      )
    },
    "permission.ask": async (input, output) => {
      if (!capture.options.capturePermissions) {
        return
      }
      await appendDatasetRecord(
        capture.datasetPath,
        createDatasetRecord({
          kind: "permission",
          source: capture.source,
          sessionID: input.sessionID,
          messageID: input.messageID,
          callID: input.callID,
          instruction: input.title,
          output: output.status,
          payload: maybeRedactPayload(input.metadata, capture),
          metadata: {
            permissionType: input.type,
            status: output.status,
          },
        }),
      )
    },
  }
}

function extractTextParts(parts: readonly { readonly type: string; readonly text?: string }[]): string {
  return parts
    .flatMap((part) => {
      if (part.type === "text" && part.text !== undefined) {
        return [part.text]
      }
      return []
    })
    .join("\n\n")
}

function toolCallKey(sessionID: string, callID: string): string {
  return `${sessionID}:${callID}`
}

function redactWhenEnabled(value: string, capture: DatasetCaptureContext): string {
  return capture.options.redactionEnabled ? redactText(value) : value
}

function maybeRedactPayload(value: unknown, capture: DatasetCaptureContext): unknown {
  return capture.options.redactionEnabled ? redactPayload(value) : value
}
