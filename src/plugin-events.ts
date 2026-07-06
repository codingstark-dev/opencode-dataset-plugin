import type { Hooks } from "@opencode-ai/plugin"
import type { DatasetCaptureContext } from "./plugin.js"
import { redactDiffs, redactPayload, redactText } from "./redaction.js"
import { createDatasetRecord } from "./schema.js"
import { appendDatasetRecord } from "./storage.js"

export function createDatasetEventHandler(
  capture: DatasetCaptureContext,
): NonNullable<Hooks["event"]> {
  return async ({ event }) => {
    switch (event.type) {
      case "session.created":
      case "session.updated":
      case "session.idle":
      case "session.status":
      case "session.compacted":
        await appendDatasetRecord(
          capture.datasetPath,
          createDatasetRecord({
            kind: "session",
            source: capture.source,
            sessionID:
              "sessionID" in event.properties ? event.properties.sessionID : event.properties.info.id,
            payload: maybeRedactPayload(event.properties, capture),
            metadata: {
              event: event.type,
            },
          }),
        )
        return
      case "session.diff":
        if (!capture.options.captureDiffs) {
          return
        }
        await appendDatasetRecord(
          capture.datasetPath,
          createDatasetRecord({
            kind: "session_diff",
            source: capture.source,
            sessionID: event.properties.sessionID,
            diff: capture.options.redactionEnabled
              ? redactDiffs(event.properties.diff)
              : event.properties.diff,
            files: event.properties.diff.map((diff) => diff.file),
            payload: {
              fileCount: event.properties.diff.length,
            },
            metadata: {
              event: event.type,
            },
          }),
        )
        return
      case "file.edited":
        await appendDatasetRecord(
          capture.datasetPath,
          createDatasetRecord({
            kind: "file_edit",
            source: capture.source,
            sessionID: "unknown",
            files: [event.properties.file],
            payload: maybeRedactPayload(event.properties, capture),
            metadata: {
              event: event.type,
            },
          }),
        )
        return
      case "message.updated":
        if (!capture.options.captureMessages) {
          return
        }
        await appendDatasetRecord(
          capture.datasetPath,
          createDatasetRecord({
            kind: "message",
            source: capture.source,
            sessionID: event.properties.info.sessionID,
            messageID: event.properties.info.id,
            payload: maybeRedactPayload(event.properties.info, capture),
            metadata: {
              event: event.type,
              role: event.properties.info.role,
            },
          }),
        )
        return
      case "message.part.updated":
        if (!capture.options.captureMessages) {
          return
        }
        await appendDatasetRecord(
          capture.datasetPath,
          createDatasetRecord({
            kind: "message_part",
            source: capture.source,
            sessionID: event.properties.part.sessionID,
            messageID: event.properties.part.messageID,
            output: readTextPart(event.properties.part, capture),
            payload: maybeRedactPayload(event.properties, capture),
            metadata: {
              event: event.type,
              partType: event.properties.part.type,
            },
          }),
        )
        return
      case "permission.replied":
        if (!capture.options.capturePermissions) {
          return
        }
        await appendDatasetRecord(
          capture.datasetPath,
          createDatasetRecord({
            kind: "permission",
            source: capture.source,
            sessionID: event.properties.sessionID,
            instruction: event.properties.permissionID,
            output: event.properties.response,
            payload: maybeRedactPayload(event.properties, capture),
            metadata: {
              event: event.type,
            },
          }),
        )
        return
      default:
        return
    }
  }
}

function readTextPart(part: { readonly type: string }, capture: DatasetCaptureContext): string | undefined {
  if (part.type !== "text" && part.type !== "reasoning") {
    return undefined
  }
  if (!("text" in part) || typeof part.text !== "string") {
    return undefined
  }
  return capture.options.redactionEnabled ? redactText(part.text) : part.text
}

function maybeRedactPayload(value: unknown, capture: DatasetCaptureContext): unknown {
  return capture.options.redactionEnabled ? redactPayload(value) : value
}
