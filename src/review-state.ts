import { assertNever, type DatasetRecord } from "./schema.js"

export type ReviewState = {
  readonly mode: ReviewMode
  readonly selectedIndex: number
}

export type ReviewMode = "pending" | "all"

export type ReviewView = {
  readonly datasetPath: string
  readonly records: readonly DatasetRecord[]
  readonly state: ReviewState
  readonly selected: DatasetRecord | undefined
}

export function createInitialReviewState(records: readonly DatasetRecord[]): ReviewState {
  return {
    mode: countStatus(records, "pending") > 0 ? "pending" : "all",
    selectedIndex: 0,
  }
}

export function selectReviewRecords(records: readonly DatasetRecord[], mode: ReviewMode): readonly DatasetRecord[] {
  switch (mode) {
    case "pending":
      return records.filter((record) => record.status === "pending")
    case "all":
      return records
    default:
      assertNever(mode)
  }
}

export function toggleReviewMode(records: readonly DatasetRecord[], state: ReviewState): ReviewState {
  const mode: ReviewMode = state.mode === "pending" ? "all" : "pending"
  return clampReviewState({ mode, selectedIndex: state.selectedIndex }, selectReviewRecords(records, mode).length)
}

export function moveReviewSelection(
  state: ReviewState,
  visibleCount: number,
  delta: number,
): ReviewState {
  return clampReviewState(
    {
      ...state,
      selectedIndex: state.selectedIndex + delta,
    },
    visibleCount,
  )
}

export function nextStateAfterStatusChange(records: readonly DatasetRecord[], state: ReviewState): ReviewState {
  const visibleRecords = selectReviewRecords(records, state.mode)
  if (visibleRecords.length === 0 && records.length > 0 && state.mode === "pending") {
    return { mode: "all", selectedIndex: 0 }
  }
  return clampReviewState(state, visibleRecords.length)
}

export function replaceRecord(
  records: readonly DatasetRecord[],
  updatedRecord: DatasetRecord,
): DatasetRecord[] {
  return records.map((record) => (record.id === updatedRecord.id ? updatedRecord : record))
}

export function formatReviewTitle(view: ReviewView): string {
  if (view.records.length === 0) {
    return `No records in ${view.datasetPath}`
  }

  const visibleRecords = selectReviewRecords(view.records, view.state.mode)
  if (view.selected === undefined) {
    return `${formatMode(view.state.mode)} 0/${visibleRecords.length} | ${formatSummary(view.records)}`
  }

  return `${formatMode(view.state.mode)} ${view.state.selectedIndex + 1}/${visibleRecords.length} | ${view.selected.status} ${view.selected.kind} | ${formatSummary(view.records)}`
}

export function formatReviewBody(view: ReviewView): string {
  if (view.records.length === 0) {
    return [
      "No dataset records yet.",
      "",
      "If you expected project data, run this from the project root or pass:",
      "bunx opencode-dataset review --path /path/to/project/.opencode/datasets/opencode-dataset.jsonl",
    ].join("\n")
  }

  if (view.selected === undefined && view.state.mode === "pending") {
    return "No pending records.\n\nPress t to view accepted and rejected records."
  }

  return view.selected === undefined ? "No records in this view." : formatRecord(view.selected)
}

export function formatRecord(record: DatasetRecord): string {
  const lines = [
    `id: ${record.id}`,
    `kind: ${record.kind}`,
    `status: ${record.status}`,
    `session: ${record.sessionID}`,
    `tags: ${record.tags.join(", ") || "none"}`,
    "",
    "instruction:",
    clip(record.instruction ?? "(none)", 1_200),
    "",
    "input:",
    clip(record.input ?? "(none)", 1_200),
    "",
    "output:",
    clip(record.output ?? "(none)", 2_400),
  ]
  return lines.join("\n")
}

function clampReviewState(state: ReviewState, visibleCount: number): ReviewState {
  if (visibleCount <= 0) {
    return { ...state, selectedIndex: 0 }
  }

  return {
    ...state,
    selectedIndex: Math.max(0, Math.min(state.selectedIndex, visibleCount - 1)),
  }
}

function formatSummary(records: readonly DatasetRecord[]): string {
  return [
    `total ${records.length}`,
    `pending ${countStatus(records, "pending")}`,
    `accepted ${countStatus(records, "accepted")}`,
    `rejected ${countStatus(records, "rejected")}`,
  ].join(" | ")
}

function countStatus(records: readonly DatasetRecord[], status: DatasetRecord["status"]): number {
  return records.filter((record) => record.status === status).length
}

function formatMode(mode: ReviewMode): string {
  switch (mode) {
    case "pending":
      return "Pending"
    case "all":
      return "All records"
    default:
      assertNever(mode)
  }
}

function clip(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`
}
