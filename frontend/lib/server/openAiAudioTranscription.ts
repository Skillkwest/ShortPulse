/**
 * OpenAI speech-to-text helper for best-effort audio transcription.
 */

const DEFAULT_OPENAI_API_BASE = "https://api.openai.com/v1";
const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;

type TranscribeAudioBufferInput = {
  audioBuffer: Buffer;
  audioContentType: string;
  filename?: string | null;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveOpenAiApiBase = (): string => {
  const raw = (process.env.OPENAI_API_BASE ?? "").trim();
  if (!raw.length) return DEFAULT_OPENAI_API_BASE;
  if (raw.endsWith("/chat/completions")) {
    return raw.slice(0, -"/chat/completions".length);
  }
  if (raw.endsWith("/responses")) {
    return raw.slice(0, -"/responses".length);
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const resolveTranscriptionFilename = ({
  filename,
  audioContentType,
}: {
  filename?: string | null;
  audioContentType: string;
}): string => {
  const normalizedFilename = normalizeOptionalString(filename);
  if (normalizedFilename) return normalizedFilename;
  const normalizedContentType = audioContentType.trim().toLowerCase();
  if (normalizedContentType.includes("mpeg") || normalizedContentType.includes("mp3")) {
    return "voice-changer-output.mp3";
  }
  if (normalizedContentType.includes("wav")) {
    return "voice-changer-output.wav";
  }
  if (normalizedContentType.includes("ogg")) {
    return "voice-changer-output.ogg";
  }
  if (normalizedContentType.includes("webm")) {
    return "voice-changer-output.webm";
  }
  if (normalizedContentType.includes("mp4")) {
    return "voice-changer-output.m4a";
  }
  return "voice-changer-output.audio";
};

const readOpenAiTranscriptionErrorMessage = (payloadText: string): string => {
  if (!payloadText.trim()) return "OpenAI transcription failed.";
  try {
    const payload = JSON.parse(payloadText) as Record<string, unknown>;
    const directError = normalizeOptionalString(payload.error);
    if (directError) return directError;
    const errorRecord =
      payload.error && typeof payload.error === "object" && !Array.isArray(payload.error)
        ? (payload.error as Record<string, unknown>)
        : null;
    return normalizeOptionalString(errorRecord?.message) ?? "OpenAI transcription failed.";
  } catch {
    return payloadText.trim();
  }
};

export const transcribeAudioBuffer = async ({
  audioBuffer,
  audioContentType,
  filename,
}: TranscribeAudioBufferInput): Promise<string> => {
  const apiKey = normalizeOptionalString(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  if (!audioBuffer.length) {
    throw new Error("Audio buffer is empty.");
  }
  if (audioBuffer.length > MAX_TRANSCRIPTION_BYTES) {
    throw new Error("Audio exceeds OpenAI transcription upload size limit.");
  }

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer], { type: audioContentType || "application/octet-stream" }),
    resolveTranscriptionFilename({ filename, audioContentType })
  );
  formData.append(
    "model",
    normalizeOptionalString(process.env.OPENAI_TRANSCRIPTION_MODEL) ??
      DEFAULT_OPENAI_TRANSCRIPTION_MODEL
  );
  formData.append("response_format", "text");

  const response = await fetch(`${resolveOpenAiApiBase()}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(readOpenAiTranscriptionErrorMessage(responseText));
  }
  const transcriptText = responseText.trim();
  if (!transcriptText) {
    throw new Error("OpenAI transcription returned no text.");
  }
  return transcriptText;
};
