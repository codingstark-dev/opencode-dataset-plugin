import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  TextRenderable,
} from "@opentui/core"
import { assertNever, type DatasetRecord } from "./schema.js"
import {
  createInitialReviewState,
  formatReviewBody,
  formatReviewTitle,
  moveReviewSelection,
  nextStateAfterStatusChange,
  replaceRecord,
  selectReviewRecords,
  toggleReviewMode,
} from "./review-state.js"
import { updateRecordStatus } from "./storage.js"

export {
  createInitialReviewState,
  formatRecord,
  formatReviewBody,
  formatReviewTitle,
  moveReviewSelection,
  replaceRecord,
  selectReviewRecords,
  toggleReviewMode,
} from "./review-state.js"
export type { ReviewMode, ReviewState, ReviewView } from "./review-state.js"

export async function openReviewTui(
  datasetPath: string,
  records: readonly DatasetRecord[],
): Promise<void> {
  let allRecords = [...records]
  let state = createInitialReviewState(allRecords)
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    clearOnShutdown: true,
  })

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
    content: "j/k move  a accept  r reject  t pending/all  q quit",
    fg: "#a3a3a3",
    height: 1,
  })

  shell.add(title)
  shell.add(body)
  shell.add(footer)
  renderer.root.add(shell)

  const render = () => {
    const visibleRecords = selectReviewRecords(allRecords, state.mode)
    const selected = visibleRecords[state.selectedIndex]
    const view = { datasetPath, records: allRecords, state, selected }
    title.content = formatReviewTitle(view)
    body.content = formatReviewBody(view)
    renderer.requestRender()
  }

  render()

  renderer.keyInput.on("keypress", (key) => {
    if (key.name === "q") {
      renderer.destroy()
      return
    }
    if (key.name === "t" || key.name === "tab") {
      state = toggleReviewMode(allRecords, state)
      render()
      return
    }

    const visibleRecords = selectReviewRecords(allRecords, state.mode)
    if (visibleRecords.length === 0) {
      return
    }
    if (key.name === "j" || key.name === "down") {
      state = moveReviewSelection(state, visibleRecords.length, 1)
      render()
      return
    }
    if (key.name === "k" || key.name === "up") {
      state = moveReviewSelection(state, visibleRecords.length, -1)
      render()
      return
    }
    if (key.name === "a" || key.name === "r") {
      const selected = visibleRecords[state.selectedIndex]
      if (selected === undefined) {
        return
      }
      void updateRecordStatus(datasetPath, selected.id, key.name === "a" ? "accepted" : "rejected").then(
        (result) => {
          switch (result.kind) {
            case "updated": {
              allRecords = replaceRecord(allRecords, result.record)
              state = nextStateAfterStatusChange(allRecords, state)
              render()
              return
            }
            case "missing":
              body.content = `Record no longer exists: ${selected.id}`
              renderer.requestRender()
              return
            default:
              assertNever(result)
          }
        },
        (error: unknown) => {
          body.content = `Could not update record: ${formatUnknownError(error)}`
          render()
        },
      )
    }
  })

  await new Promise<void>((resolve) => {
    renderer.on(CliRenderEvents.DESTROY, () => resolve())
  })
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return "unknown error"
}
