#!/usr/bin/env bun
// @bun
var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// src/schema.ts
import { z } from "zod";
function createDatasetRecord(input) {
  const record = {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    kind: input.kind,
    status: input.status ?? "pending",
    createdAt: new Date().toISOString(),
    sessionID: input.sessionID,
    source: input.source,
    diff: [...input.diff ?? []],
    files: [...input.files ?? []],
    tags: [...input.tags ?? []],
    labels: [...input.labels ?? []],
    metadata: input.metadata ?? {},
    ...input.messageID === undefined ? {} : { messageID: input.messageID },
    ...input.callID === undefined ? {} : { callID: input.callID },
    ...input.tool === undefined ? {} : { tool: input.tool },
    ...input.instruction === undefined ? {} : { instruction: input.instruction },
    ...input.input === undefined ? {} : { input: input.input },
    ...input.output === undefined ? {} : { output: input.output },
    ...input.rejectedOutput === undefined ? {} : { rejectedOutput: input.rejectedOutput },
    ...input.payload === undefined ? {} : { payload: input.payload }
  };
  return DatasetRecordSchema.parse(record);
}
function assertNever(value) {
  throw new UnexpectedVariantError(String(value));
}
var ExportFormatSchema, ReviewStatusSchema, DatasetRecordKindSchema, DatasetSourceSchema, DatasetFileDiffSchema, MetadataSchema, DatasetRecordSchema, PluginOptionsSchema, SaveTrainingExampleSchema, UnexpectedVariantError;
var init_schema = __esm(() => {
  ExportFormatSchema = z.enum(["canonical", "openai", "alpaca", "sharegpt", "dpo"]);
  ReviewStatusSchema = z.enum(["pending", "accepted", "rejected"]);
  DatasetRecordKindSchema = z.enum([
    "manual",
    "tool_call",
    "session_diff",
    "file_edit",
    "message",
    "message_part",
    "permission",
    "session"
  ]);
  DatasetSourceSchema = z.object({
    projectID: z.string().min(1),
    directory: z.string().min(1),
    worktree: z.string().min(1)
  });
  DatasetFileDiffSchema = z.object({
    file: z.string().min(1),
    before: z.string(),
    after: z.string(),
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative()
  });
  MetadataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
  DatasetRecordSchema = z.object({
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
    metadata: MetadataSchema
  });
  PluginOptionsSchema = z.object({
    datasetPath: z.string().min(1).optional(),
    captureToolResults: z.boolean().default(true),
    captureMessages: z.boolean().default(true),
    captureDiffs: z.boolean().default(true),
    capturePermissions: z.boolean().default(true),
    redactionEnabled: z.boolean().default(true)
  });
  SaveTrainingExampleSchema = z.object({
    instruction: z.string().min(1),
    output: z.string().min(1),
    input: z.string().optional(),
    rejectedOutput: z.string().optional(),
    tags: z.array(z.string().min(1)).default([]),
    labels: z.array(z.string().min(1)).default([])
  });
  UnexpectedVariantError = class UnexpectedVariantError extends Error {
    value;
    name = "UnexpectedVariantError";
    constructor(value) {
      super(`Unexpected variant: ${value}`);
      this.value = value;
    }
  };
});

// src/storage.ts
import { appendFile, mkdir } from "fs/promises";
import { dirname, isAbsolute, join } from "path";
function resolveDatasetPath(directory, configuredPath) {
  const path = configuredPath ?? DEFAULT_DATASET_PATH;
  return isAbsolute(path) ? path : join(directory, path);
}
async function appendDatasetRecord(path, record) {
  await ensureParentDirectory(path);
  const parsed = DatasetRecordSchema.parse(record);
  await appendFile(path, `${JSON.stringify(parsed)}
`, "utf8");
}
async function readDatasetRecords(path) {
  const file = Bun.file(path);
  if (!await file.exists()) {
    return [];
  }
  const text = await file.text();
  const records = [];
  for (const line of text.split(`
`)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      const parsed = JSON.parse(trimmed);
      records.push(DatasetRecordSchema.parse(parsed));
    }
  }
  return records;
}
async function writeDatasetRecords(path, records) {
  await ensureParentDirectory(path);
  const content = records.map((record) => JSON.stringify(DatasetRecordSchema.parse(record))).join(`
`);
  await Bun.write(path, content.length === 0 ? "" : `${content}
`);
}
async function updateRecordStatus(path, recordID, status) {
  const parsedStatus = ReviewStatusSchema.parse(status);
  const records = await readDatasetRecords(path);
  let updatedRecord;
  const nextRecords = records.map((record) => {
    if (record.id !== recordID) {
      return record;
    }
    updatedRecord = DatasetRecordSchema.parse({
      ...record,
      status: parsedStatus,
      reviewedAt: new Date().toISOString()
    });
    return updatedRecord;
  });
  if (updatedRecord === undefined) {
    return { kind: "missing" };
  }
  await writeDatasetRecords(path, nextRecords);
  return { kind: "updated", record: updatedRecord };
}
async function ensureParentDirectory(path) {
  await mkdir(dirname(path), { recursive: true });
}
var DEFAULT_DATASET_PATH = ".opencode/datasets/opencode-dataset.jsonl";
var init_storage = __esm(() => {
  init_schema();
});

// src/review-tui.ts
var exports_review_tui = {};
__export(exports_review_tui, {
  openReviewTui: () => openReviewTui,
  formatRecord: () => formatRecord
});
import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  TextRenderable
} from "@opentui/core";
async function openReviewTui(datasetPath, records) {
  const reviewable = records.filter((record) => record.status === "pending");
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    clearOnShutdown: true
  });
  const state = { selectedIndex: 0 };
  const shell = new BoxRenderable(renderer, {
    width: "100%",
    height: "100%",
    flexDirection: "column",
    padding: 1,
    gap: 1,
    border: true,
    borderStyle: "rounded",
    title: "OpenCode Dataset Review"
  });
  const title = new TextRenderable(renderer, {
    content: "",
    fg: "#7dd3fc",
    height: 1
  });
  const body = new TextRenderable(renderer, {
    content: "",
    height: "100%",
    flexGrow: 1
  });
  const footer = new TextRenderable(renderer, {
    content: "j/k move  a accept  r reject  q quit",
    fg: "#a3a3a3",
    height: 1
  });
  shell.add(title);
  shell.add(body);
  shell.add(footer);
  renderer.root.add(shell);
  const render = () => {
    const total = reviewable.length;
    const selected = reviewable[state.selectedIndex];
    title.content = total === 0 ? `No pending records in ${datasetPath}` : `Pending ${state.selectedIndex + 1}/${total}  ${selected?.kind ?? ""}`;
    body.content = selected === undefined ? "All records have been reviewed." : formatRecord(selected);
    renderer.requestRender();
  };
  render();
  renderer.keyInput.on("keypress", (key) => {
    if (key.name === "q") {
      renderer.destroy();
      return;
    }
    if (reviewable.length === 0) {
      return;
    }
    if (key.name === "j" || key.name === "down") {
      state.selectedIndex = Math.min(state.selectedIndex + 1, reviewable.length - 1);
      render();
      return;
    }
    if (key.name === "k" || key.name === "up") {
      state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
      render();
      return;
    }
    if (key.name === "a" || key.name === "r") {
      const selected = reviewable[state.selectedIndex];
      if (selected === undefined) {
        return;
      }
      updateRecordStatus(datasetPath, selected.id, key.name === "a" ? "accepted" : "rejected").then(() => {
        reviewable.splice(state.selectedIndex, 1);
        state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, reviewable.length - 1));
        render();
      });
    }
  });
  await new Promise((resolve) => {
    renderer.on(CliRenderEvents.DESTROY, () => resolve());
  });
}
function formatRecord(record) {
  const lines = [
    `id: ${record.id}`,
    `kind: ${record.kind}`,
    `session: ${record.sessionID}`,
    `tags: ${record.tags.join(", ") || "none"}`,
    "",
    "instruction:",
    clip(record.instruction ?? "(none)", 1200),
    "",
    "input:",
    clip(record.input ?? "(none)", 1200),
    "",
    "output:",
    clip(record.output ?? "(none)", 2400)
  ];
  return lines.join(`
`);
}
function clip(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}
...[truncated ${value.length - maxLength} chars]`;
}
var init_review_tui = __esm(() => {
  init_storage();
});

// src/exporters.ts
init_schema();
function exportDataset(records, format, options) {
  const parsedFormat = ExportFormatSchema.parse(format);
  switch (parsedFormat) {
    case "canonical":
      return toJsonl(records.filter((record) => isAllowedByStatus(record, options)));
    case "openai":
      return toJsonl(toExamples(records, options).map(toOpenAIExample));
    case "alpaca":
      return toJsonl(toExamples(records, options).map(toAlpacaExample));
    case "sharegpt":
      return toJsonl(toExamples(records, options).map(toShareGptExample));
    case "dpo":
      return toJsonl(toExamples(records, options).flatMap(toDpoExample));
    default:
      return assertNever(parsedFormat);
  }
}
function toExamples(records, options) {
  return records.flatMap((record) => {
    if (!isAllowedByStatus(record, options)) {
      return [];
    }
    if (record.instruction === undefined || record.output === undefined) {
      return [];
    }
    return [
      {
        instruction: record.instruction,
        input: record.input ?? "",
        output: record.output,
        ...record.rejectedOutput === undefined ? {} : { rejectedOutput: record.rejectedOutput },
        tags: record.tags,
        metadata: record.metadata
      }
    ];
  });
}
function isAllowedByStatus(record, options) {
  if (record.status === "accepted") {
    return true;
  }
  if (record.status === "pending") {
    return options.includePending;
  }
  return false;
}
function toOpenAIExample(example) {
  return {
    messages: [
      { role: "user", content: example.instruction },
      { role: "assistant", content: example.output }
    ]
  };
}
function toAlpacaExample(example) {
  return {
    instruction: example.instruction,
    input: example.input,
    output: example.output
  };
}
function toShareGptExample(example) {
  return {
    conversations: [
      { from: "human", value: example.instruction },
      { from: "gpt", value: example.output }
    ]
  };
}
function toDpoExample(example) {
  if (example.rejectedOutput === undefined) {
    return [];
  }
  return [
    {
      prompt: example.instruction,
      chosen: example.output,
      rejected: example.rejectedOutput
    }
  ];
}
function toJsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join(`
`);
}

// src/cli.ts
init_schema();
init_storage();
init_schema();
var HELP = `opencode-dataset

Commands:
  demo [--path file]                         append one accepted demo record
  stats [--path file]                        print record counts
  export --format <format> [--path file]     write JSONL to stdout
  review [--path file] [--once]              review pending examples
  accept <record-id> [--path file]           mark a record accepted
  reject <record-id> [--path file]           mark a record rejected

Formats: canonical, openai, alpaca, sharegpt, dpo
`;
async function runCli(argv) {
  const args = argv.slice(2);
  const command = args[0] ?? "help";
  const datasetPath = resolveDatasetPath(process.cwd(), readFlag(args, "--path"));
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;
    case "demo":
      await appendDatasetRecord(datasetPath, createDatasetRecord({
        kind: "manual",
        status: "accepted",
        source: {
          projectID: "demo",
          directory: process.cwd(),
          worktree: process.cwd()
        },
        sessionID: "demo",
        instruction: "Refactor a small TypeScript helper to be easier to test.",
        input: "The helper currently mixes parsing, IO, and formatting.",
        output: "Split boundary parsing from pure formatting and add a focused unit test.",
        rejectedOutput: "Rewrite the whole app from scratch.",
        tags: ["demo", "typescript"]
      }));
      console.log(`Wrote demo record to ${datasetPath}`);
      return;
    case "stats":
      printStats(await readDatasetRecords(datasetPath), datasetPath);
      return;
    case "export":
      console.log(exportDataset(await readDatasetRecords(datasetPath), readExportFormat(args), {
        includePending: args.includes("--include-pending")
      }));
      return;
    case "review": {
      const records = await readDatasetRecords(datasetPath);
      if (args.includes("--once")) {
        printStats(records, datasetPath);
        return;
      }
      const { openReviewTui: openReviewTui2 } = await Promise.resolve().then(() => (init_review_tui(), exports_review_tui));
      await openReviewTui2(datasetPath, records);
      return;
    }
    case "accept":
    case "reject": {
      const recordID = args[1];
      if (recordID === undefined) {
        throw new CliUsageError(`${command} requires a record id`);
      }
      const status = ReviewStatusSchema.parse(command === "accept" ? "accepted" : "rejected");
      const result = await updateRecordStatus(datasetPath, recordID, status);
      switch (result.kind) {
        case "updated":
          console.log(`${result.record.id} -> ${result.record.status}`);
          return;
        case "missing":
          throw new CliUsageError(`record not found: ${recordID}`);
        default:
          return;
      }
    }
    default:
      throw new CliUsageError(`unknown command: ${command}`);
  }
}
function readExportFormat(args) {
  return ExportFormatSchema.parse(readFlag(args, "--format") ?? "openai");
}
function readFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) {
    return;
  }
  return args[index + 1];
}
function printStats(records, path) {
  const statusCounts = countBy(records.map((record) => record.status));
  const kindCounts = countBy(records.map((record) => record.kind));
  console.log(JSON.stringify({
    path,
    total: records.length,
    status: statusCounts,
    kind: kindCounts
  }, undefined, 2));
}
function countBy(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

class CliUsageError extends Error {
  name = "CliUsageError";
}

// src/redaction.ts
var REDACTION_TOKEN = "[REDACTED]";
var SENSITIVE_KEY_PATTERN = /(^|[_-])(api[_-]?key|authorization|bearer|cookie|password|private[_-]?key|secret|session|token)([_-]|$)/i;
var SECRET_VALUE_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
];
function redactText(value) {
  let redacted = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTION_TOKEN);
  }
  return redacted;
}
function stringifyRedacted(value) {
  try {
    const serialized = JSON.stringify(value, (key, nestedValue) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return REDACTION_TOKEN;
      }
      if (typeof nestedValue === "string") {
        return redactText(nestedValue);
      }
      return nestedValue;
    });
    return serialized === undefined ? "null" : serialized;
  } catch (error) {
    if (error instanceof TypeError) {
      return JSON.stringify("[unserializable]");
    }
    throw error;
  }
}
function redactPayload(value) {
  return JSON.parse(stringifyRedacted(value));
}
function redactDiffs(diffs) {
  return diffs.map((diff) => ({
    file: diff.file,
    before: redactText(diff.before),
    after: redactText(diff.after),
    additions: diff.additions,
    deletions: diff.deletions
  }));
}

// src/plugin-hooks.ts
init_schema();
init_storage();
function createCaptureHooks(capture) {
  const pendingTools = new Map;
  return {
    "chat.message": async (input, output) => {
      if (!capture.options.captureMessages) {
        return;
      }
      const text = extractTextParts(output.parts);
      if (text.length === 0) {
        return;
      }
      const redactedText = redactWhenEnabled(text, capture);
      await appendDatasetRecord(capture.datasetPath, createDatasetRecord({
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
          modelID: input.model?.modelID ?? "unknown"
        }
      }));
    },
    "tool.execute.before": async (input, output) => {
      if (!capture.options.captureToolResults) {
        return;
      }
      pendingTools.set(toolCallKey(input.sessionID, input.callID), {
        args: output.args,
        startedAt: new Date().toISOString()
      });
    },
    "tool.execute.after": async (input, output) => {
      if (!capture.options.captureToolResults) {
        return;
      }
      const key = toolCallKey(input.sessionID, input.callID);
      const pending = pendingTools.get(key);
      pendingTools.delete(key);
      const args = pending?.args ?? input.args;
      await appendDatasetRecord(capture.datasetPath, createDatasetRecord({
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
          startedAt: pending?.startedAt ?? "unknown"
        }
      }));
    },
    "permission.ask": async (input, output) => {
      if (!capture.options.capturePermissions) {
        return;
      }
      await appendDatasetRecord(capture.datasetPath, createDatasetRecord({
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
          status: output.status
        }
      }));
    }
  };
}
function extractTextParts(parts) {
  return parts.flatMap((part) => {
    if (part.type === "text" && part.text !== undefined) {
      return [part.text];
    }
    return [];
  }).join(`

`);
}
function toolCallKey(sessionID, callID) {
  return `${sessionID}:${callID}`;
}
function redactWhenEnabled(value, capture) {
  return capture.options.redactionEnabled ? redactText(value) : value;
}
function maybeRedactPayload(value, capture) {
  return capture.options.redactionEnabled ? redactPayload(value) : value;
}

// src/plugin-save-tool.ts
import { tool } from "@opencode-ai/plugin";
init_schema();
init_storage();
function createSaveTrainingTool(capture) {
  return tool({
    description: "Save a high-quality instruction/output pair into the local fine-tuning dataset.",
    args: {
      instruction: tool.schema.string().min(1).describe("The user task or prompt."),
      input: tool.schema.string().optional().describe("Optional extra context or input."),
      output: tool.schema.string().min(1).describe("The ideal assistant response or result."),
      rejectedOutput: tool.schema.string().optional().describe("Optional rejected answer for DPO/preference exports."),
      tags: tool.schema.array(tool.schema.string().min(1)).default([]).describe("Searchable tags."),
      labels: tool.schema.array(tool.schema.string().min(1)).default([]).describe("Dataset labels.")
    },
    async execute(args, context) {
      const parsed = SaveTrainingExampleSchema.parse(args);
      const record = createDatasetRecord({
        kind: "manual",
        status: "accepted",
        source: capture.source,
        sessionID: context.sessionID,
        messageID: context.messageID,
        instruction: redactWhenEnabled2(parsed.instruction, capture),
        input: parsed.input === undefined ? undefined : redactWhenEnabled2(parsed.input, capture),
        output: redactWhenEnabled2(parsed.output, capture),
        rejectedOutput: parsed.rejectedOutput === undefined ? undefined : redactWhenEnabled2(parsed.rejectedOutput, capture),
        tags: parsed.tags,
        labels: parsed.labels
      });
      await appendDatasetRecord(capture.datasetPath, record);
      context.metadata({
        title: "Saved training example",
        metadata: {
          datasetPath: capture.datasetPath,
          recordID: record.id
        }
      });
      return {
        title: "Training example saved",
        output: `Saved ${record.id} to ${capture.datasetPath}`,
        metadata: {
          datasetPath: capture.datasetPath,
          recordID: record.id
        }
      };
    }
  });
}
function redactWhenEnabled2(value, capture) {
  return capture.options.redactionEnabled ? redactText(value) : value;
}

// src/plugin-events.ts
init_schema();
init_storage();
function createDatasetEventHandler(capture) {
  return async ({ event }) => {
    switch (event.type) {
      case "session.created":
      case "session.updated":
      case "session.idle":
      case "session.status":
      case "session.compacted":
        await appendDatasetRecord(capture.datasetPath, createDatasetRecord({
          kind: "session",
          source: capture.source,
          sessionID: "sessionID" in event.properties ? event.properties.sessionID : event.properties.info.id,
          payload: maybeRedactPayload2(event.properties, capture),
          metadata: {
            event: event.type
          }
        }));
        return;
      case "session.diff":
        if (!capture.options.captureDiffs) {
          return;
        }
        await appendDatasetRecord(capture.datasetPath, createDatasetRecord({
          kind: "session_diff",
          source: capture.source,
          sessionID: event.properties.sessionID,
          diff: capture.options.redactionEnabled ? redactDiffs(event.properties.diff) : event.properties.diff,
          files: event.properties.diff.map((diff) => diff.file),
          payload: {
            fileCount: event.properties.diff.length
          },
          metadata: {
            event: event.type
          }
        }));
        return;
      case "file.edited":
        await appendDatasetRecord(capture.datasetPath, createDatasetRecord({
          kind: "file_edit",
          source: capture.source,
          sessionID: "unknown",
          files: [event.properties.file],
          payload: maybeRedactPayload2(event.properties, capture),
          metadata: {
            event: event.type
          }
        }));
        return;
      case "message.updated":
        if (!capture.options.captureMessages) {
          return;
        }
        await appendDatasetRecord(capture.datasetPath, createDatasetRecord({
          kind: "message",
          source: capture.source,
          sessionID: event.properties.info.sessionID,
          messageID: event.properties.info.id,
          payload: maybeRedactPayload2(event.properties.info, capture),
          metadata: {
            event: event.type,
            role: event.properties.info.role
          }
        }));
        return;
      case "message.part.updated":
        if (!capture.options.captureMessages) {
          return;
        }
        await appendDatasetRecord(capture.datasetPath, createDatasetRecord({
          kind: "message_part",
          source: capture.source,
          sessionID: event.properties.part.sessionID,
          messageID: event.properties.part.messageID,
          output: readTextPart(event.properties.part, capture),
          payload: maybeRedactPayload2(event.properties, capture),
          metadata: {
            event: event.type,
            partType: event.properties.part.type
          }
        }));
        return;
      case "permission.replied":
        if (!capture.options.capturePermissions) {
          return;
        }
        await appendDatasetRecord(capture.datasetPath, createDatasetRecord({
          kind: "permission",
          source: capture.source,
          sessionID: event.properties.sessionID,
          instruction: event.properties.permissionID,
          output: event.properties.response,
          payload: maybeRedactPayload2(event.properties, capture),
          metadata: {
            event: event.type
          }
        }));
        return;
      default:
        return;
    }
  };
}
function readTextPart(part, capture) {
  if (part.type !== "text" && part.type !== "reasoning") {
    return;
  }
  if (!("text" in part) || typeof part.text !== "string") {
    return;
  }
  return capture.options.redactionEnabled ? redactText(part.text) : part.text;
}
function maybeRedactPayload2(value, capture) {
  return capture.options.redactionEnabled ? redactPayload(value) : value;
}

// src/plugin.ts
init_schema();
init_storage();
var DatasetPlugin = async ({ client, directory, project, worktree }, rawOptions) => {
  const options = PluginOptionsSchema.parse(rawOptions ?? {});
  const capture = {
    datasetPath: resolveDatasetPath(directory, options.datasetPath),
    options,
    source: {
      projectID: project.id,
      directory,
      worktree
    }
  };
  await client.app.log({
    body: {
      service: "opencode-dataset-plugin",
      level: "info",
      message: `dataset capture enabled at ${capture.datasetPath}`
    }
  });
  return {
    tool: {
      save_training_example: createSaveTrainingTool(capture)
    },
    ...createCaptureHooks(capture),
    event: createDatasetEventHandler(capture)
  };
};

// index.ts
if (import.meta.main) {
  await runCli(Bun.argv);
}
export {
  DatasetPlugin as server,
  runCli,
  DatasetPlugin
};
