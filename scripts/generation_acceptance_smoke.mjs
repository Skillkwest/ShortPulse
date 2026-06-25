#!/usr/bin/env node

/**
 * Real-route generation acceptance smoke.
 *
 * Submits through the app API, polls the canonical status route, and verifies
 * DB visibility/settlement for one generation. This is intentionally operator
 * scoped and requires either --token or --email with Supabase service-role env.
 */

import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

loadLocalEnv({
  argv: process.argv.slice(2),
  defaultPaths: [".env.agent.local", "frontend/.env.local"],
});

const DEFAULT_BASE_URL =
  process.env.SHORTPULSE_PUBLIC_API_BASE_URL?.trim() ||
  process.env.APP_BASE_URL?.trim() ||
  "http://localhost:3000";

const CASES = {
  "elevenlabs-text-to-speech": {
    provider: "elevenlabs",
    modelId: "eleven_v3",
    submitPath: "/api/elevenlabs/text-to-speech",
    submitMode: "sync-json",
    timeoutMs: 120_000,
    payload: async ({ prompt, projectId, resolveVoice }) => {
      const voice = await resolveVoice();
      return {
        voiceId: voice.voiceId,
        voiceName: voice.name,
        text: prompt,
        outputFormat: "mp3_44100_128",
        config: {
          model_id: "eleven_v3",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1,
            style: 0,
          },
        },
        ...(projectId ? { project_id: projectId } : {}),
      };
    },
  },
  "elevenlabs-speech-to-speech": {
    provider: "elevenlabs",
    modelId: "eleven_multilingual_sts_v2",
    submitPath: "/api/elevenlabs/speech-to-speech",
    submitMode: "sync-form",
    timeoutMs: 180_000,
    payload: async ({ baseUrl, token, projectId, resolveVoice }) => {
      const voice = await resolveVoice();
      const staged = await stageVoiceChangerSource({ baseUrl, token });
      const formData = new FormData();
      formData.append("voiceId", voice.voiceId);
      formData.append("voiceName", voice.name);
      formData.append("outputFormat", "mp3_44100_128");
      formData.append("modelId", "eleven_multilingual_sts_v2");
      formData.append("inputFormat", "other");
      formData.append("sourceStoragePath", staged.storagePath);
      formData.append("sourceOrigin", "local");
      formData.append("sourceName", staged.name);
      formData.append("removeBackgroundNoise", "false");
      formData.append(
        "voiceSettings",
        JSON.stringify({
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        })
      );
      if (projectId) formData.append("project_id", projectId);
      return formData;
    },
  },
  "elevenlabs-music": {
    provider: "elevenlabs",
    modelId: "music_v1",
    submitPath: "/api/elevenlabs/music",
    submitMode: "sync-json",
    timeoutMs: 180_000,
    payload: ({ prompt, projectId }) => ({
      text: prompt,
      durationSeconds: 8,
      bpm: 112,
      mode: "instrumental",
      structure: "loop",
      energyPercent: 52,
      outputFormat: "mp3_44100_128",
      modelId: "music_v1",
      ...(projectId ? { project_id: projectId } : {}),
    }),
  },
  "elevenlabs-sfx": {
    provider: "elevenlabs",
    modelId: "eleven_text_to_sound_v2",
    submitPath: "/api/elevenlabs/sound-effects",
    submitMode: "sync-json",
    timeoutMs: 120_000,
    payload: ({ prompt, projectId }) => ({
      text: prompt,
      durationSeconds: 1,
      loop: false,
      outputFormat: "mp3_44100_128",
      modelId: "eleven_text_to_sound_v2",
      ...(projectId ? { project_id: projectId } : {}),
    }),
  },
  "fal-flux2klein-text-image": {
    provider: "fal",
    modelId: "fal-ai/flux-2/klein/9b",
    submitPath: "/api/fal/flux2klein-submit",
    statusPath: "/api/fal/flux2klein-status",
    timeoutMs: 240_000,
    pollEveryMs: 5_000,
    payload: ({ prompt, projectId }) => ({
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
      output_format: "jpeg",
      num_inference_steps: 4,
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "fal-nano-banana-pro-text-image": {
    provider: "fal",
    modelId: "fal-ai/nano-banana-pro",
    submitPath: "/api/fal/nano-banana-pro-submit",
    statusPath: "/api/fal/nano-banana-pro-status",
    timeoutMs: 300_000,
    pollEveryMs: 5_000,
    payload: ({ prompt, projectId }) => ({
      prompt,
      num_images: 1,
      aspect_ratio: "1:1",
      output_format: "png",
      resolution: "1K",
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "fal-seedream-45-text-image": {
    provider: "fal",
    modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    submitPath: "/api/fal/seedream-submit",
    statusPath: "/api/fal/seedream-status",
    timeoutMs: 300_000,
    pollEveryMs: 5_000,
    payload: ({ prompt, projectId }) => ({
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
      enable_safety_checker: true,
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "fal-seedream-v5-lite-text-image": {
    provider: "fal",
    modelId: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    submitPath: "/api/fal/seedream-v5-lite-submit",
    statusPath: "/api/fal/seedream-v5-lite-status",
    timeoutMs: 300_000,
    pollEveryMs: 5_000,
    payload: ({ prompt, projectId }) => ({
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
      enable_safety_checker: true,
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "fal-nano-banana-2-edit": {
    provider: "fal",
    modelId: "fal-ai/nano-banana-2/edit",
    submitPath: "/api/fal/nano-banana-2-edit-submit",
    statusPath: "/api/fal/nano-banana-2-edit-status",
    timeoutMs: 300_000,
    pollEveryMs: 5_000,
    payload: async ({ prompt, projectId, resolveImageAsset }) => ({
      prompt,
      num_images: 1,
      aspect_ratio: "auto",
      output_format: "png",
      resolution: "1K",
      image_urls: [await resolveImageAsset("reference")],
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "fal-nano-banana-pro-edit": {
    provider: "fal",
    modelId: "fal-ai/nano-banana-pro/edit",
    submitPath: "/api/fal/nano-banana-pro-edit-submit",
    statusPath: "/api/fal/nano-banana-pro-edit-status",
    timeoutMs: 300_000,
    pollEveryMs: 5_000,
    payload: async ({ prompt, projectId, resolveImageAsset }) => ({
      prompt,
      num_images: 1,
      aspect_ratio: "auto",
      output_format: "png",
      resolution: "1K",
      image_urls: [await resolveImageAsset("reference")],
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "fal-seedream-45-edit": {
    provider: "fal",
    modelId: "fal-ai/bytedance/seedream/v4.5/edit",
    submitPath: "/api/fal/seedream-edit-submit",
    statusPath: "/api/fal/seedream-edit-status",
    timeoutMs: 300_000,
    pollEveryMs: 5_000,
    payload: async ({ prompt, projectId, resolveImageAsset }) => ({
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
      enable_safety_checker: true,
      image_urls: [await resolveImageAsset("reference")],
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "fal-seedream-v5-lite-edit": {
    provider: "fal",
    modelId: "fal-ai/bytedance/seedream/v5/lite/edit",
    submitPath: "/api/fal/seedream-v5-lite-edit-submit",
    statusPath: "/api/fal/seedream-v5-lite-edit-status",
    timeoutMs: 300_000,
    pollEveryMs: 5_000,
    payload: async ({ prompt, projectId, resolveImageAsset }) => ({
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
      enable_safety_checker: true,
      image_urls: [await resolveImageAsset("reference")],
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "fal-bria-background-remove": {
    provider: "fal",
    modelId: "fal-ai/bria/background/remove",
    submitPath: "/api/fal/bria-background-remove-submit",
    statusPath: "/api/fal/bria-background-remove-status",
    timeoutMs: 240_000,
    pollEveryMs: 5_000,
    payload: async ({ projectId, resolveImageAsset }) => ({
      image_url: await resolveImageAsset("reference"),
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "fal-nano-banana-2-text-image": {
    provider: "fal",
    modelId: "fal-ai/nano-banana-2",
    submitPath: "/api/fal/nano-banana-2-submit",
    statusPath: "/api/fal/nano-banana-2-status",
    timeoutMs: 300_000,
    pollEveryMs: 5_000,
    payload: ({ prompt, projectId }) => ({
      prompt,
      num_images: 1,
      aspect_ratio: "1:1",
      output_format: "png",
      resolution: "1K",
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "kie-seedance-2-text-video": {
    provider: "kie",
    modelId: "kie-ai/seedance-2",
    submitPath: "/api/fal/kie-seedance-2-submit",
    statusPath: "/api/fal/kie-seedance-2-status",
    timeoutMs: 900_000,
    pollEveryMs: 10_000,
    payload: ({ prompt, projectId }) => ({
      prompt,
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "720p",
      generate_audio: false,
      return_last_frame: false,
      web_search: false,
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "kie-seedance-2-fast-text-video": {
    provider: "kie",
    modelId: "kie-ai/seedance-2-fast",
    submitPath: "/api/fal/kie-seedance-2-fast-submit",
    statusPath: "/api/fal/kie-seedance-2-fast-status",
    timeoutMs: 900_000,
    pollEveryMs: 10_000,
    payload: ({ prompt, projectId }) => ({
      prompt,
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "720p",
      generate_audio: false,
      return_last_frame: false,
      web_search: false,
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "kie-kling-30-image-video": {
    provider: "kie",
    modelId: "kie-ai/kling-3.0",
    submitPath: "/api/fal/kie-kling-submit",
    statusPath: "/api/fal/kie-kling-status",
    timeoutMs: 900_000,
    pollEveryMs: 10_000,
    payload: async ({ prompt, projectId, resolveImageAsset }) => ({
      prompt,
      image_url: await resolveImageAsset("reference"),
      image_urls: [await resolveImageAsset("reference")],
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "720p",
      cfg_scale: 0.5,
      generate_audio: false,
      sound: false,
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
  "kie-veo-31-fast-text-video": {
    provider: "kie",
    modelId: "kie-ai/veo-3.1-fast-i2v",
    submitPath: "/api/fal/kie-veo-submit",
    statusPath: "/api/fal/kie-veo-status",
    timeoutMs: 900_000,
    pollEveryMs: 10_000,
    payload: ({ prompt, projectId }) => ({
      prompt,
      generation_type: "TEXT_2_VIDEO",
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "720p",
      generate_audio: false,
      ...(projectId ? { shortpulse_context: { project_id: projectId } } : {}),
    }),
  },
};

const usage = () => {
  console.log(`Usage:
  node scripts/generation_acceptance_smoke.mjs --case <name> (--email <user-email> | --token <bearer-token>) [options]

Options:
  --case <name>           One of: ${Object.keys(CASES).join(", ")}
  --email <email>         Mint a short-lived Supabase session for this existing user.
  --token <token>         Existing Supabase bearer token.
  --base-url <url>        App base URL. Default: ${DEFAULT_BASE_URL}
  --project-id <uuid>     Include shortpulse_context.project_id and assert project visibility linkage.
  --request-id <id>       Resume polling an already accepted provider request.
  --generation-id <id>    Optional generation id when resuming.
  --prompt <text>         Prompt to submit.
  --voice-id <id>         ElevenLabs voice id for audio smoke cases.
  --voice-name <name>     ElevenLabs voice display name when --voice-id is supplied.
  --timeout-ms <n>        Override case timeout.
  --poll-ms <n>           Override polling interval.
  --env-file <path>       Optional env file path, repeatable.
  --help                  Show this message.
`);
};

const readArgValue = (argv, index, label) => {
  const value = argv[index + 1];
  if (!value) throw new Error(`${label} requires a value`);
  return value;
};

const parsePositiveInteger = (value, label) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
};

const parseArgs = (argv) => {
  const parsed = {
    caseName: "",
    email: "",
    token: "",
    baseUrl: DEFAULT_BASE_URL,
    projectId: "",
    requestId: "",
    generationId: "",
    prompt: "ShortPulse generation acceptance smoke: clean geometric poster, high detail.",
    voiceId: "",
    voiceName: "",
    timeoutMs: null,
    pollMs: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--case") {
      parsed.caseName = readArgValue(argv, index, "--case").trim();
      index += 1;
      continue;
    }
    if (arg === "--email") {
      parsed.email = readArgValue(argv, index, "--email").trim();
      index += 1;
      continue;
    }
    if (arg === "--token") {
      parsed.token = readArgValue(argv, index, "--token").trim();
      index += 1;
      continue;
    }
    if (arg === "--base-url") {
      parsed.baseUrl = readArgValue(argv, index, "--base-url").trim();
      index += 1;
      continue;
    }
    if (arg === "--project-id") {
      parsed.projectId = readArgValue(argv, index, "--project-id").trim();
      index += 1;
      continue;
    }
    if (arg === "--request-id") {
      parsed.requestId = readArgValue(argv, index, "--request-id").trim();
      index += 1;
      continue;
    }
    if (arg === "--generation-id") {
      parsed.generationId = readArgValue(argv, index, "--generation-id").trim();
      index += 1;
      continue;
    }
    if (arg === "--prompt") {
      parsed.prompt = readArgValue(argv, index, "--prompt").trim();
      index += 1;
      continue;
    }
    if (arg === "--voice-id") {
      parsed.voiceId = readArgValue(argv, index, "--voice-id").trim();
      index += 1;
      continue;
    }
    if (arg === "--voice-name") {
      parsed.voiceName = readArgValue(argv, index, "--voice-name").trim();
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.timeoutMs = parsePositiveInteger(readArgValue(argv, index, "--timeout-ms"), arg);
      index += 1;
      continue;
    }
    if (arg === "--poll-ms") {
      parsed.pollMs = parsePositiveInteger(readArgValue(argv, index, "--poll-ms"), arg);
      index += 1;
      continue;
    }
    if (arg === "--env-file") {
      readArgValue(argv, index, "--env-file");
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  parsed.baseUrl = parsed.baseUrl.replace(/\/+$/, "");
  return parsed;
};

const getRequiredEnv = (name) => {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
};

const getSupabaseStorageConfig = () => ({
  supabaseUrl: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, ""),
  serviceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
});

const assertResponseOk = async (response, label) => {
  if (response.ok) return;
  const body = await response.text().catch(() => "");
  throw new Error(`${label} failed with ${response.status}: ${body.slice(0, 800)}`);
};

const assertRouteResultOk = async (result, label) => {
  if (result.response.ok) return;
  const payloadText = JSON.stringify(result.payload ?? {});
  if (payloadText && payloadText !== "{}") {
    throw new Error(`${label} failed with ${result.response.status}: ${payloadText.slice(0, 800)}`);
  }
  await assertResponseOk(result.response, label);
};

const readJson = async (response, label) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned non-JSON response: ${text.slice(0, 800)}`);
  }
};

const postJson = async ({ baseUrl, path, token, body, timeoutMs }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await readJson(response, path);
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
};

const postForm = async ({ baseUrl, path, token, body, timeoutMs }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body,
      signal: controller.signal,
    });
    const payload = await readJson(response, path);
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
};

const postRaw = async ({ baseUrl, path, token, body, headers, timeoutMs }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      body,
      signal: controller.signal,
    });
    const payload = await readJson(response, path);
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
};

const getJson = async ({ baseUrl, path, token, timeoutMs }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
    const payload = await readJson(response, path);
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
};

const buildSolidPngBuffer = ({ width = 512, height = 512, color }) => {
  const channels = 4;
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * channels + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * channels;
      raw[pixelOffset] = color.r;
      raw[pixelOffset + 1] = color.g;
      raw[pixelOffset + 2] = color.b;
      raw[pixelOffset + 3] = color.a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

const buildSmokeImageBuffer = (kind) => {
  if (kind === "mask") {
    return buildSolidPngBuffer({
      color: { r: 255, g: 255, b: 255, a: 255 },
    });
  }
  if (kind === "secondary-reference") {
    return buildSolidPngBuffer({
      color: { r: 62, g: 160, b: 132, a: 255 },
    });
  }
  return buildSolidPngBuffer({
    color: { r: 92, g: 126, b: 220, a: 255 },
  });
};

const uploadSignedSmokeImageAsset = async ({ userId, kind }) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseStorageConfig();
  const storagePath = `${userId}/generation-smoke/${randomUUID()}-${kind}.png`;
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/media_library/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "image/png",
        "x-upsert": "false",
      },
      body: buildSmokeImageBuffer(kind),
    }
  );
  await assertResponseOk(uploadResponse, `Supabase storage upload ${kind}`);

  const signResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/media_library/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 60 * 60 }),
    }
  );
  await assertResponseOk(signResponse, `Supabase storage sign ${kind}`);
  const signPayload = await signResponse.json();
  const signedPath =
    typeof signPayload?.signedURL === "string"
      ? signPayload.signedURL
      : typeof signPayload?.signedUrl === "string"
        ? signPayload.signedUrl
        : "";
  if (!signedPath) throw new Error(`Supabase storage sign did not return a URL for ${kind}.`);
  return signedPath.startsWith("http") ? signedPath : `${supabaseUrl}/storage/v1${signedPath}`;
};

const buildSmokeWavBuffer = ({ seconds = 1, sampleRate = 16_000, frequency = 440 } = {}) => {
  const sampleCount = Math.max(1, Math.floor(seconds * sampleRate));
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const envelope = Math.min(1, index / 800, (sampleCount - index) / 800);
    const sample = Math.round(
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 12000 * envelope
    );
    buffer.writeInt16LE(sample, 44 + index * 2);
  }
  return buffer;
};

const stageVoiceChangerSource = async ({ baseUrl, token }) => {
  const stage = await postRaw({
    baseUrl,
    path: "/api/media/stage-voice-changer-source",
    token,
    body: buildSmokeWavBuffer(),
    headers: {
      "Content-Type": "audio/wav",
      "x-shortpulse-upload-filename": "generation-smoke-source.wav",
      "x-shortpulse-voice-changer-kind": "audio",
    },
    timeoutMs: 45_000,
  });
  await assertRouteResultOk(stage, "stage voice changer source");
  const source = stage.payload?.source;
  if (!source?.storagePath) {
    throw new Error("Voice changer source staging did not return a storage path.");
  }
  return {
    storagePath: source.storagePath,
    name: source.name || "generation-smoke-source.wav",
  };
};

const parseActionLinkTokenHash = (actionLink) => {
  if (typeof actionLink !== "string" || !actionLink.trim()) return "";
  try {
    const parsed = new URL(actionLink);
    return parsed.searchParams.get("token_hash")?.trim() ?? "";
  } catch {
    return "";
  }
};

const mintExistingUserSession = async (email) => {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const linkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email,
    }),
  });
  await assertResponseOk(linkResponse, "Supabase generate_link");
  const linkPayload = await linkResponse.json();
  const user = linkPayload.user ?? linkPayload;
  const userId = typeof user?.id === "string" ? user.id : "";
  const properties = linkPayload.properties ?? linkPayload;
  const tokenHash =
    typeof properties?.hashed_token === "string" && properties.hashed_token.trim()
      ? properties.hashed_token.trim()
      : parseActionLinkTokenHash(properties?.action_link);
  const emailOtp =
    typeof properties?.email_otp === "string" && properties.email_otp.trim()
      ? properties.email_otp.trim()
      : "";
  if (!userId) throw new Error("Supabase generate_link did not return a user id.");
  if (!tokenHash && !emailOtp) throw new Error("Supabase generate_link did not return an OTP.");

  const verifyBodies = [
    tokenHash ? { type: "magiclink", token_hash: tokenHash } : null,
    emailOtp ? { type: "magiclink", email, token: emailOtp } : null,
  ].filter(Boolean);

  let lastError = "";
  for (const body of verifyBodies) {
    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const verifyPayload = await verifyResponse.json().catch(() => ({}));
    if (verifyResponse.ok && typeof verifyPayload?.access_token === "string") {
      return {
        token: verifyPayload.access_token,
        userId,
        email,
      };
    }
    lastError = `${verifyResponse.status}: ${JSON.stringify(verifyPayload).slice(0, 500)}`;
  }

  throw new Error(`Supabase verify magiclink failed: ${lastError}`);
};

const fetchSupabaseRows = async ({ table, query }) => {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  await assertResponseOk(response, `Supabase ${table} query`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

const queryEq = (key, value) => `${encodeURIComponent(key)}=eq.${encodeURIComponent(value)}`;

const loadGenerationState = async ({ userId, requestId, generationId, projectId }) => {
  const projectionRows = await fetchSupabaseRows({
    table: "generation_projection",
    query: [
      "select=*",
      queryEq("user_id", userId),
      generationId ? queryEq("generation_id", generationId) : queryEq("request_id", requestId),
      "limit=1",
    ].join("&"),
  });
  const projection = projectionRows[0] ?? null;
  const resolvedGenerationId = generationId || projection?.generation_id || "";

  const outputRows = resolvedGenerationId
    ? await fetchSupabaseRows({
        table: "ai_generation_outputs",
        query: [
          "select=id,generation_id,result_url,media_file_id,provider_request_id,created_at",
          queryEq("user_id", userId),
          queryEq("generation_id", resolvedGenerationId),
          "order=created_at.desc",
        ].join("&"),
      })
    : [];

  const reservationRows = await fetchSupabaseRows({
    table: "ai_credit_reservations",
    query: [
      "select=*",
      queryEq("user_id", userId),
      queryEq("provider_request_id", requestId),
      "order=updated_at.desc",
    ].join("&"),
  });

  const projectRows =
    projectId && resolvedGenerationId
      ? await fetchSupabaseRows({
          table: "project_generation_items",
          query: [
            "select=project_id,generation_id,user_id,updated_at",
            queryEq("user_id", userId),
            queryEq("project_id", projectId),
            queryEq("generation_id", resolvedGenerationId),
            "limit=1",
          ].join("&"),
        })
      : [];

  return {
    projection,
    outputs: outputRows,
    reservations: reservationRows,
    projectItems: projectRows,
  };
};

const loadGenerationStateForSyncOutput = async ({ output, userId, projectId }) => {
  const requestId = output?.requestId || output?.request_id || "";
  const generationId = output?.generationId || output?.generation_id || "";
  if (!requestId && !generationId) {
    throw new Error("Sync generation response did not include requestId or generationId.");
  }
  return await loadGenerationState({
    userId,
    requestId,
    generationId,
    projectId,
  });
};

const isTerminalSuccessPayload = (payload) =>
  payload?.shortpulseLifecycle?.taskState === "success" ||
  payload?.status === "completed" ||
  payload?.state === "completed";

const isTerminalFailPayload = (payload) =>
  payload?.shortpulseLifecycle?.taskState === "fail" ||
  payload?.status === "error" ||
  payload?.state === "error";

const assertFinalState = ({ state, projectId }) => {
  const projection = state.projection;
  if (!projection) throw new Error("Missing generation_projection row.");
  if (projection.task_state !== "success") {
    throw new Error(`Projection is not success: ${projection.task_state}`);
  }
  if (projection.hidden_in_reference_grid === true) {
    throw new Error("Projection is hidden_in_reference_grid=true.");
  }
  if (projection.reference_grid_visible === false) {
    throw new Error("Projection is reference_grid_visible=false.");
  }
  const resultUrls = Array.isArray(projection.result_urls) ? projection.result_urls : [];
  if (
    resultUrls.length === 0 &&
    !projection.preview_url &&
    !projection.preview_storage_path &&
    !projection.full_storage_path
  ) {
    throw new Error("Projection has no result URL or storage path.");
  }
  if (state.outputs.length === 0) {
    throw new Error("Missing ai_generation_outputs row.");
  }
  if (state.reservations.some((row) => row.status === "reserved")) {
    throw new Error("Reservation is still reserved.");
  }
  if (projectId) {
    if (projection.project_id !== projectId && state.projectItems.length === 0) {
      throw new Error("Missing project visibility association.");
    }
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const smokeCase = CASES[args.caseName];
  if (!smokeCase) {
    throw new Error(`Unknown --case. Expected one of: ${Object.keys(CASES).join(", ")}`);
  }
  if (!args.token && !args.email) {
    throw new Error("Provide --token or --email.");
  }
  const auth = args.token
    ? { token: args.token, userId: "", email: args.email || "token-user" }
    : await mintExistingUserSession(args.email);
  if (!auth.userId) {
    const userResponse = await fetch(`${getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")}/auth/v1/user`, {
      headers: {
        apikey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        Authorization: `Bearer ${auth.token}`,
      },
    });
    await assertResponseOk(userResponse, "Supabase user lookup");
    const userPayload = await userResponse.json();
    auth.userId = userPayload.id;
  }

  let cachedVoice = null;
  const cachedImageAssets = new Map();
  const resolveVoice = async () => {
    if (cachedVoice) return cachedVoice;
    if (args.voiceId) {
      cachedVoice = {
        voiceId: args.voiceId,
        name: args.voiceName || "Smoke voice",
      };
      return cachedVoice;
    }
    const voices = await getJson({
      baseUrl: args.baseUrl,
      path: "/api/elevenlabs/voices",
      token: auth.token,
      timeoutMs: 45_000,
    });
    await assertRouteResultOk(voices, "ElevenLabs voices");
    const firstVoice = Array.isArray(voices.payload?.voices)
      ? voices.payload.voices.find((voice) => voice?.voiceId && voice?.name)
      : null;
    if (!firstVoice) throw new Error("No ElevenLabs voice is available for audio smoke.");
    cachedVoice = {
      voiceId: firstVoice.voiceId,
      name: firstVoice.name,
    };
    console.log(`[generation-smoke] using ElevenLabs voice=${cachedVoice.name} (${cachedVoice.voiceId})`);
    return cachedVoice;
  };
  const resolveImageAsset = async (kind) => {
    const cacheKey = String(kind || "reference");
    const existing = cachedImageAssets.get(cacheKey);
    if (existing) return existing;
    const signedUrl = await uploadSignedSmokeImageAsset({
      userId: auth.userId,
      kind: cacheKey,
    });
    cachedImageAssets.set(cacheKey, signedUrl);
    console.log(`[generation-smoke] staged image asset kind=${cacheKey}`);
    return signedUrl;
  };

  const startedAt = performance.now();
  let requestId = args.requestId;
  let generationId = args.generationId;
  if (requestId) {
    console.log(
      `[generation-smoke] resuming case=${args.caseName} model=${smokeCase.modelId} user=${auth.email} request_id=${requestId}`
    );
  } else {
    const submitPayload = await smokeCase.payload({
      prompt: args.prompt,
      projectId: args.projectId || null,
      baseUrl: args.baseUrl,
      token: auth.token,
      resolveVoice,
      resolveImageAsset,
    });
    console.log(
      `[generation-smoke] submitting case=${args.caseName} model=${smokeCase.modelId} user=${auth.email} project=${args.projectId || "none"}`
    );
    const submit =
      smokeCase.submitMode === "sync-form"
        ? await postForm({
            baseUrl: args.baseUrl,
            path: smokeCase.submitPath,
            token: auth.token,
            body: submitPayload,
            timeoutMs: smokeCase.timeoutMs,
          })
        : await postJson({
            baseUrl: args.baseUrl,
            path: smokeCase.submitPath,
            token: auth.token,
            body: submitPayload,
            timeoutMs: smokeCase.submitMode === "sync-json" ? smokeCase.timeoutMs : 45_000,
          });
    await assertRouteResultOk(submit, "submit");
    if (smokeCase.submitMode?.startsWith("sync")) {
      const state = await loadGenerationStateForSyncOutput({
        output: submit.payload.output,
        userId: auth.userId,
        projectId: args.projectId || "",
      });
      assertFinalState({ state, projectId: args.projectId || "" });
      console.log(
        `[generation-smoke] PASS case=${args.caseName} request_id=${state.projection?.request_id ?? submit.payload.output?.requestId} generation_id=${state.projection?.generation_id ?? submit.payload.output?.generationId}`
      );
      return;
    }
    requestId = submit.payload.request_id || submit.payload.requestId;
    generationId = submit.payload.generationId || "";
    if (!requestId) throw new Error("Submit response did not include request_id.");
    console.log(
      `[generation-smoke] accepted request_id=${requestId} generation_id=${generationId || "pending"}`
    );
  }

  const timeoutMs = args.timeoutMs ?? smokeCase.timeoutMs;
  const pollEveryMs = args.pollMs ?? smokeCase.pollEveryMs;
  let lastStatus = null;
  let lastState = null;

  while (performance.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollEveryMs));
    const status = await postJson({
      baseUrl: args.baseUrl,
      path: smokeCase.statusPath,
      token: auth.token,
      body: { requestId },
      timeoutMs: 90_000,
    });
    lastStatus = status.payload;
    lastState = await loadGenerationState({
      userId: auth.userId,
      requestId,
      generationId,
      projectId: args.projectId || "",
    });
    const taskState =
      lastState.projection?.task_state ?? lastStatus?.shortpulseLifecycle?.taskState ?? "unknown";
    const resultCount = Array.isArray(lastState.projection?.result_urls)
      ? lastState.projection.result_urls.length
      : 0;
    console.log(
      `[generation-smoke] poll task_state=${taskState} outputs=${lastState.outputs.length} result_urls=${resultCount}`
    );

    if (isTerminalSuccessPayload(lastStatus) || taskState === "success") {
      assertFinalState({ state: lastState, projectId: args.projectId || "" });
      console.log(
        `[generation-smoke] PASS case=${args.caseName} request_id=${requestId} generation_id=${lastState.projection?.generation_id ?? generationId}`
      );
      return;
    }
    if (isTerminalFailPayload(lastStatus) || taskState === "fail") {
      throw new Error(
        `Generation failed: ${JSON.stringify({
          status: lastStatus?.status,
          error: lastStatus?.error,
          detail: lastStatus?.detail,
          projection_error: lastState.projection?.error_message_short,
        }).slice(0, 1000)}`
      );
    }
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms. Last status: ${JSON.stringify(lastStatus).slice(0, 1000)}`
  );
};

main().catch((error) => {
  console.error(`[generation-smoke] FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
