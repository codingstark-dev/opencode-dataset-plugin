# opencode-dataset

Capture OpenCode agent sessions into a local JSONL dataset, review examples in an OpenTUI terminal UI, and export to the formats LLM researchers actually use.

## Fast path

Install once:

```sh
opencode plugin opencode-dataset
```

Add the plugin to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "opencode-dataset",
      {
        "datasetPath": ".opencode/datasets/opencode-dataset.jsonl"
      }
    ]
  ]
}
```

The older `opencode-dataset-plugin` package name also works, but `opencode-dataset` is the shorter recommended name.

OpenCode installs npm plugins with Bun at startup. Captured records are written as newline-delimited JSON so they are easy to diff, stream, and load with Hugging Face Datasets:

```python
from datasets import load_dataset

dataset = load_dataset("json", data_files=".opencode/datasets/opencode-dataset.jsonl")
```

## What It Captures

- Tool calls with redacted args/output
- Session diffs and edited file paths
- Message and message-part events
- Permission ask/reply records
- Explicit high-quality examples through the `save_training_example` tool

Secrets are redacted before storage for common API keys, bearer tokens, GitHub tokens, AWS access keys, JWTs, private keys, and sensitive object keys like `password`, `token`, `secret`, and `authorization`.

## Review

Run the OpenTUI review surface:

```sh
bunx opencode-dataset review --path .opencode/datasets/opencode-dataset.jsonl
```

Keys:

- `j` / `k`: move
- `a`: accept
- `r`: reject
- `q`: quit

For CI or quick checks:

```sh
bunx opencode-dataset review --once --path .opencode/datasets/opencode-dataset.jsonl
```

## Export

Accepted records export by default. Add `--include-pending` when you want a quick raw dump before review.

```sh
bunx opencode-dataset export --format openai --path .opencode/datasets/opencode-dataset.jsonl > train.openai.jsonl
bunx opencode-dataset export --format alpaca --path .opencode/datasets/opencode-dataset.jsonl > train.alpaca.jsonl
bunx opencode-dataset export --format sharegpt --path .opencode/datasets/opencode-dataset.jsonl > train.sharegpt.jsonl
bunx opencode-dataset export --format dpo --path .opencode/datasets/opencode-dataset.jsonl > train.dpo.jsonl
```

Formats:

- `canonical`: raw plugin records
- `openai`: `{ "messages": [{ "role": "user" }, { "role": "assistant" }] }`
- `alpaca`: `{ "instruction", "input", "output" }`
- `sharegpt`: `{ "conversations": [{ "from": "human" }, { "from": "gpt" }] }`
- `dpo`: `{ "prompt", "chosen", "rejected" }`

## Agent Tool

The plugin registers `save_training_example`. Ask OpenCode to call it after a good completed task:

```text
Save this as a training example with tags ["typescript", "bugfix"].
```

The saved record is marked `accepted` immediately, so it exports without needing review.

## Local Development

```sh
bun install
bun run build
bun run typecheck
bun test
bun run demo
bun run review -- --once
bun run export:openai
```

`bun run demo` appends a sample accepted record to `.opencode/datasets/opencode-dataset.jsonl`.
