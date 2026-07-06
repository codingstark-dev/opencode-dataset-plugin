import type { Plugin } from "@opencode-ai/plugin"
import { createCaptureHooks } from "./plugin-hooks.js"
import { createSaveTrainingTool } from "./plugin-save-tool.js"
import { createDatasetEventHandler } from "./plugin-events.js"
import { PluginOptionsSchema, type DatasetPluginOptions, type DatasetSource } from "./schema.js"
import { resolveDatasetPath } from "./storage.js"

export type DatasetCaptureContext = {
  readonly datasetPath: string
  readonly options: DatasetPluginOptions
  readonly source: DatasetSource
}

export const DatasetPlugin: Plugin = async ({ client, directory, project, worktree }, rawOptions) => {
  const options = PluginOptionsSchema.parse(rawOptions ?? {})
  const capture = {
    datasetPath: resolveDatasetPath(directory, options.datasetPath),
    options,
    source: {
      projectID: project.id,
      directory,
      worktree,
    },
  }

  await client.app.log({
    body: {
      service: "opencode-dataset-plugin",
      level: "info",
      message: `dataset capture enabled at ${capture.datasetPath}`,
    },
  })

  return {
    tool: {
      save_training_example: createSaveTrainingTool(capture),
    },
    ...createCaptureHooks(capture),
    event: createDatasetEventHandler(capture),
  }
}
