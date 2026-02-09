# Chat Completions API Reference

This reference describes the legacy Chat Completions endpoints for ShortPulse (text + multimodal conversations). We capture every call needed to create/stash conversations, review chat messages, and manage stored completions.

## Endpoint summary

| Action | Method | Path |
| --- | --- | --- |
| Create a chat completion | `POST` | `/v1/chat/completions` |
| Retrieve a completion | `GET` | `/v1/chat/completions/{completion_id}` |
| List stored completions | `GET` | `/v1/chat/completions` |
| Get messages for a completion | `GET` | `/v1/chat/completions/{completion_id}/messages` |
| Update completion metadata | `POST` | `/v1/chat/completions/{completion_id}` |
| Delete a stored completion | `DELETE` | `/v1/chat/completions/{completion_id}` |

## Create a chat completion

**Endpoint**: `POST https://api.openai.com/v1/chat/completions`  
Use this for synchronous chat-like interactions when you want the conversation history encoded as an array of `messages`.

### Key request fields
- `model` (string, required): Model ID such as `gpt-4o`/`gpt-5.2`. See the model guide for supported capabilities.
- `messages` (array, required): Ordered list of message objects (`role`, `content`, etc.) that comprise the conversation so far. Modalities can include text, images, audio depending on the model.
- `modalities` (array): Desired output types (default `["text"]`; audio-capable models support `["text","audio"]`).
- `tool_choice` / `tools`: Controls which built-in/custom tools are available or must be called. Recommended over the deprecated `function_call`/`functions`.
- `input` (image/audio) is expressed via message modalities; specify audio outputs through the `audio` object when needed for `["audio"]`.
- `temperature` (number), `top_p` (number), `frequency_penalty`, `presence_penalty`: Standard sampling controls.
- `logit_bias` (map): Bias weights per tokenizer ID to prefer/avoid tokens.
- `max_completion_tokens` (integer): Replacement for the deprecated `max_tokens`, controlling output length.
- `n` (integer): How many distinct choices to return. Each affects cost.
- `stream` + `stream_options`: Enable SSE streaming responses when set to true.
- `prediction`: Optional predicted output config for faster responses with known continuations.
- `prompt_cache_key` / `prompt_cache_retention`: Cache hints to improve latency.
- `metadata` (map): Up to 16 custom key-value tags for later filtering.
- `store` (boolean): When true the completion and its metadata/messages are persisted and retrievable later.
- `service_tier` (auto/default/flex/priority): Override the processing tier for cost/performance.
- `safety_identifier`, `verbosity`, `reasoning_effort`, `seed` (beta), `web_search_options`, `stop`, `audio` (output-level config): Use these for advanced flows.

### Example request
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5.2",
    "messages": [
      {"role": "developer", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Common response fields
- `choices`: Array of completion choices. Each has an `index`, `message`, `logprobs`, and `finish_reason`.
- `usage`: Counts for `prompt_tokens`, `completion_tokens`, and `total_tokens` with optional breakdowns (`reasoning_tokens`, `audio_tokens`, etc.).
- `service_tier`, `model`, `created`, `id`, `object` describe metadata about the request execution.

## Managing stored completions

- `GET /v1/chat/completions/{completion_id}`: Returns a stored completion when `store=true`.
- `POST /v1/chat/completions/{completion_id}`: Update metadata (`metadata` map) on a stored completion.
- `DELETE /v1/chat/completions/{completion_id}`: Delete a stored completion that was previously stored.
- `GET /v1/chat/completions/{completion_id}/messages`: Paginated list of messages for a stored conversation (`after`, `limit`, `order`).
- `GET /v1/chat/completions`: List stored completions with filters (`after`, `limit`, `model`, metadata key-value filters, `order`).

## Response objects

- **Chat completion object**: `{ id, object: "chat.completion", created, model, usage, choices, service_tier, system_fingerprint, top_p, temperature, presence_penalty, frequency_penalty, metadata, tools }`.
- **Chat completion list**: `{ object: "list", data: [<chat completion objects>], first_id, last_id, has_more }`.
- **Chat completion messages list**: `{ object: "list", data: [<message objects>], first_id, last_id, has_more }`.
- Each stored message includes `id`, `role`, `content`, optional `name`, `content_parts`.

## Best practices

1. Prefer the Responses API for new work, but keep Chat Completions docs handy since some workflows still depend on stored completions or message history.
2. Use `store: true` when you need to audit conversations; otherwise keep `store` false to avoid retention.
3. Use metadata filters when listing completions to segment experiments or per-user histories.
4. When streaming, handle `choices` chunk events and respect `finish_reason` to know when the model is done.
