import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  TextRenderable,
} from "@opentui/core"
import type { DatasetRecord } from "./schema.js"
import { updateRecordStatus } from "./storage.js"

type ReviewState = {
  selectedIndex: number
}

export async function openReviewTui(
  datasetPath: string,
  records: readonly DatasetRecord[],
): Promise<void> {
  const reviewable = records.filter((record) => record.status === "pending")
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    clearOnShutdown: true,
  })

  const state: ReviewState = { selectedIndex: 0 }
  const shell = new BoxRenderable(renderer, {
    width: "100%",
    height: "100%",
    flexDirection: "column",
    padding: 1,
    gap: 1,
    border: true,
    borderStyle: "rounded",
    title: "OpenCode Dataset Review",
  })
  const title = new TextRenderable(renderer, {
    content: "",
    fg: "#7dd3fc",
    height: 1,
  })
  const body = new TextRenderable(renderer, {
    content: "",
    height: "100%",
    flexGrow: 1,
  })
  const footer = new TextRenderable(renderer, {
    content: "j/k move  a accept  r reject  q quit",
    fg: "#a3a3a3",
    height: 1,
  })

  shell.add(title)
  shell.add(body)
  shell.add(footer)
  renderer.root.add(shell)

  const render = () => {
    const total = reviewable.length
    const selected = reviewable[state.selectedIndex]
    title.content =
      total === 0
        ? `No pending records in ${datasetPath}`
        : `Pending ${state.selectedIndex + 1}/${total}  ${selected?.kind ?? ""}`
    body.content = selected === undefined ? "All records have been reviewed." : formatRecord(selected)
    renderer.requestRender()
  }

  render()

  renderer.keyInput.on("keypress", (key) => {
    if (key.name === "q") {
      renderer.destroy()
      return
    }
    if (reviewable.length === 0) {
      return
    }
    if (key.name === "j" || key.name === "down") {
      state.selectedIndex = Math.min(state.selectedIndex + 1, reviewable.length - 1)
      render()
      return
    }
    if (key.name === "k" || key.name === "up") {
      state.selectedIndex = Math.max(state.selectedIndex - 1, 0)
      render()
      return
    }
    if (key.name === "a" || key.name === "r") {
      const selected = reviewable[state.selectedIndex]
      if (selected === undefined) {
        return
      }
      void updateRecordStatus(datasetPath, selected.id, key.name === "a" ? "accepted" : "rejected").then(
        () => {
          reviewable.splice(state.selectedIndex, 1)
          state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, reviewable.length - 1))
          render()
        },
      )
    }
  })

  await new Promise<void>((resolve) => {
    renderer.on(CliRenderEvents.DESTROY, () => resolve())
  })
}

export function formatRecord(record: DatasetRecord): string {
  const lines = [
    `id: ${record.id}`,
    `kind: ${record.kind}`,
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

function clip(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`
}
