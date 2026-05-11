# Responses API Reference

OpenAI's Responses API powers ShortPulse's internal model interaction points (text, images, and tool-assisted flows). This reference captures every endpoint and payload field you need to keep conversations, reasoning, and tool calls under control when integrating generation models.
Primary ShortPulse baseline model: `gpt-5.4-nano` (`https://developers.openai.com/api/docs/pricing`).
Current ShortPulse text-pricing references covered by this document: `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.4-mini`, and `gpt-5.4-nano` (pricing source: `https://openai.com/api/pricing/`).

## Endpoint summary

| Action | Method | Path |
| --- | --- | --- |
| Generate a response | `POST` | `/v1/responses` |
| Fetch a response | `GET` | `/v1/responses/{response_id}` |
| Delete a response | `DELETE` | `/v1/responses/{response_id}` |
| Cancel an in-progress background response | `POST` | `/v1/responses/{response_id}/cancel` |
| Compact a long conversation | `POST` | `/v1/responses/compact` |
| List input items | `GET` | `/v1/responses/{response_id}/input_items` |
| Token counts for inputs | `POST` | `/v1/responses/input_tokens` |

## Create a model response

**Endpoint**: `POST https://api.openai.com/v1/responses`  
Provide text, image, or file inputs plus optional tooling instructions. ShortPulse can wire this endpoint into any workspace that needs to tap GPT-4o/gpt-5 and related generation models.

### Key request fields
- `model` (string): Model ID such as `gpt-4o` or `o3`.
- `input` (string | array): Text/image/file inputs (see Text Inputs and Outputs, Image Inputs, File Inputs).
- `instructions` (string): System/developer message inserted into the context. Overrides `previous_response_id` instructions when provided.
- `conversation` (string | object): Thread identifier; items are prepended to `input_items` and responses auto-added to this conversation after completion.
- `previous_response_id` (string): Use to chain turns without managing the conversation object manually (mutually exclusive with `conversation`).
- `include` (array): Extra data to return (`web_search_call.action.sources`, `code_interpreter_call.outputs`, `file_search_call.results`, `message.input_image.image_url`, `message.output_text.logprobs`, `reasoning.encrypted_content`, etc.).
- `tools` (array): Built-in or custom tools the model can call.
- `tool_choice` (string | object): Prefer a specific tool during generation.
- `prompt` (object): Reference a prompt template and its variables.
- `prompt_cache_key` / `prompt_cache_retention`: Control caching behavior for repeated prompts.
- `metadata` (map): Up to 16 custom key-value pairs for filtering or tracing requests.
- `temperature` (number, 0–2), `top_p` (number), `max_output_tokens` (integer), `max_tool_calls` (integer), `parallel_tool_calls` (boolean): Standard sampling/truncation controls.
- `background` (boolean): When true the response runs asynchronously so it can be cancelled later.
- `min_tool_calls`, `stream`, `stream_options`, `service_tier`, `store`, `safety_identifier`, `reasoning`, `text`, `computer_call_output`, `function_call`, `truncation`, `input` subfields: Use as needed for advanced flows.

### Response example
```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4.1",
    "input": "Tell me a three sentence bedtime story about a unicorn."
  }'
```

## Reading, deleting, and cancelling responses

- `GET /v1/responses/{response_id}`: Returns the full response object. Use `include` query parameter to fetch tool outputs, reasoning metadata, or additional streams.
- `DELETE /v1/responses/{response_id}`: Removes the stored response (low-impact cleanup).
- `POST /v1/responses/{response_id}/cancel`: Cancels background responses initiated with `background: true`. Cancelled responses still return the partial output emitted before cancellation.

## Compaction

`POST /v1/responses/compact` lets you shrink long-running conversations into an encrypted compaction artifact (`response.compaction`). Supply the same `model`, `instructions`, and any `previous_response_id` or `input` payloads you need to keep context.

### Example
```bash
curl -X POST https://api.openai.com/v1/responses/compact \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{ ... }'
```
Inspect the returned `output` array for the `<input_text` of the user turn(s) followed by a `compaction` item that stores encrypted reasoning content.

## Input items

- `GET /v1/responses/{response_id}/input_items`: Lists all user messages and other items used to seed the response.
- Pagination: supports `after`, `limit`, `order`, and `include` just like the main responses endpoint.
- Response shape includes `first_id`, `last_id`, `data`, and `has_more`.

## Token accounting

- `POST /v1/responses/input_tokens`: Returns how many tokens would be consumed given the `model`, `input`, `conversation`, `instructions`, and other generation parameters.
- Useful for cost tracking before issuing heavy requests.

## Response object structure

The response object (returned by every fetch, create, cancel, etc.) contains:

- `id`, `object`, `created_at`, `status`, `model`, `temperature`, `top_p`, `parallel_tool_calls`, `reasoning`, `service_tier`, `metadata`, `safety_identifier`.
- `output`: Array of assistant/tool messages. Prefer `output_text` inside items when extracting human-readable text. Content might include `message`, `tool_call`, `observation`, or reasoning entries.
- `usage`: Token breakdown (`input_tokens`, `output_tokens`, `reasoning_tokens`, `total_tokens`).
- `conversation`, `previous_response_id`, `prompt`, `instructions`, `truncation`, `store`, `stream`, `text`, `tools`, `tool_choice`, `include_obfuscation`.
- `error` or `incomplete_details` populate when the model fails.

## Best practices

1. Cache frequent prompts via `prompt_cache_key`/`template` combinations to reduce latency.
2. Use `include` to fetch tool outputs when debugging tool-assisted logic.
3. Set `conversation` objects for multi-turn flows; rely on `compact` when context grows too large.
4. Respect `max_tool_calls`, `max_output_tokens`, and `parallel_tool_calls` to prevent runaway costs.
