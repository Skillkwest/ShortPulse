/**
 * Dry-run-first recovery command for one owned Voice Changer audio generation.
 * Apply mode reuses the canonical no-provider remux service and never invokes billing.
 */
import { createRequire } from "node:module";
import path from "node:path";
import {
  assertUserScopedMediaStoragePath,
  isVoiceChangerSourceVideoStoragePath,
} from "../frontend/lib/mediaStoragePath";
import { detectVideoMimeType } from "../frontend/lib/server/uploadSignature";

const workingDirectory = process.cwd();
const frontendDirectory =
  path.basename(workingDirectory) === "frontend"
    ? workingDirectory
    : path.join(workingDirectory, "frontend");
const frontendRequire = createRequire(
  path.join(frontendDirectory, "package.json"),
);
const { loadEnvConfig } = frontendRequire("@next/env") as {
  loadEnvConfig: (directory: string) => unknown;
};
loadEnvConfig(frontendDirectory);

const readArg = (name: string): string | null => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  return value?.trim() || null;
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const main = async () => {
  const userId = readArg("--user-id");
  const audioGenerationId = readArg("--audio-generation-id");
  const requestedVideoPath = readArg("--original-video-path");
  const apply = process.argv.includes("--apply");

  if (!userId || !audioGenerationId || !requestedVideoPath) {
    throw new Error(
      "Usage: --user-id <id> --audio-generation-id <id> --original-video-path <path> [--apply]",
    );
  }

  const [
    supabaseAdminModule,
    mediaAudioExtractionModule,
    voiceChangerRemuxModule,
  ] = await Promise.all([
    import("../frontend/lib/server/api/supabaseAdmin"),
    import("../frontend/lib/server/mediaAudioExtraction"),
    import("../frontend/lib/server/voiceChangerRemux"),
  ]);
  const { getSupabaseAdmin } = supabaseAdminModule;
  const { readStoredMediaBuffer } = mediaAudioExtractionModule;
  const {
    buildVoiceChangerRemuxRequestId,
    executeVoiceChangerRemux,
    patchVoiceChangerRemuxMetadata,
    resolveExistingVoiceChangerRemuxGeneration,
  } = voiceChangerRemuxModule;

  const admin = getSupabaseAdmin();
  const generation = await admin
    .from("ai_generations")
    .select("id, user_id, model_id, prompt_text, request_id, metadata")
    .eq("id", audioGenerationId)
    .eq("user_id", userId)
    .eq("mode", "audio")
    .maybeSingle();
  if (generation.error) throw new Error(generation.error.message);
  if (!generation.data) throw new Error("Owned audio generation not found.");

  const audioGeneration = generation.data;
  const metadata = asObject(audioGeneration.metadata);
  const audioStoragePath = assertUserScopedMediaStoragePath({
    path: asString(metadata.generated_audio_storage_path) ?? "",
    userId,
    label: "Generated audio storage path",
  });
  const videoStoragePath = assertUserScopedMediaStoragePath({
    path: requestedVideoPath,
    userId,
    label: "Original video storage path",
  });
  if (!isVoiceChangerSourceVideoStoragePath(videoStoragePath, userId)) {
    throw new Error(
      "Original video path is not canonical Voice Changer source-video authority.",
    );
  }
  const recordedVideoPath = asString(metadata.original_video_storage_path);
  if (recordedVideoPath && recordedVideoPath !== videoStoragePath) {
    throw new Error(
      "Requested original video path does not match recorded generation authority.",
    );
  }

  const remuxRequestId = buildVoiceChangerRemuxRequestId(audioGenerationId);
  const inspectedResolution = await resolveExistingVoiceChangerRemuxGeneration({
    userId,
    remuxRequestId,
    allowMutations: false,
  });

  const objectExists = async (storagePath: string): Promise<boolean> => {
    const parts = storagePath.split("/");
    const filename = parts.pop();
    const folder = parts.join("/");
    if (!filename) return false;
    const listed = await admin.storage.from("media_library").list(folder, {
      limit: 10,
      search: filename,
    });
    if (listed.error) throw new Error(listed.error.message);
    return listed.data.some((item) => item.name === filename);
  };

  const [audioExists, videoExists] = await Promise.all([
    objectExists(audioStoragePath),
    objectExists(videoStoragePath),
  ]);

  const proof = {
    mode: apply ? "apply" : "dry-run",
    userId,
    audioGenerationId,
    audioStoragePath,
    audioExists,
    videoStoragePath,
    videoExists,
    remuxRequestId,
    existingDerivativeState: inspectedResolution.state,
    existingDerivativeGenerationId:
      inspectedResolution.state === "published"
        ? inspectedResolution.generation.generationId
        : "generationId" in inspectedResolution
          ? inspectedResolution.generationId
          : null,
    projectId: asString(metadata.project_id),
    workspaceRuntimeKey: asString(metadata.workspace_runtime_key),
  };

  process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);
  if (!apply) process.exit(0);
  if (!audioExists || !videoExists)
    throw new Error("Recovery inputs are incomplete.");
  const existingResolution = await resolveExistingVoiceChangerRemuxGeneration({
    userId,
    remuxRequestId,
    allowMutations: true,
  });
  if (existingResolution.state === "published")
    throw new Error("A derivative generation already exists.");
  if (existingResolution.state === "in_progress")
    throw new Error("Derivative generation is still in progress.");

  const [audio, video] = await Promise.all([
    readStoredMediaBuffer({ storagePath: audioStoragePath }),
    readStoredMediaBuffer({ storagePath: videoStoragePath }),
  ]);
  const verifiedVideoMimeType = detectVideoMimeType(video.buffer);
  if (!verifiedVideoMimeType) {
    throw new Error("Original video object is not a verified supported video.");
  }
  const result = await executeVoiceChangerRemux({
    userId,
    audioGenerationId,
    sourceVideoBuffer: video.buffer,
    sourceVideoFilename:
      asString(metadata.original_video_name) ??
      videoStoragePath.split("/").pop() ??
      "source-video",
    sourceVideoMimeType: verifiedVideoMimeType,
    convertedAudioBuffer: audio.buffer,
    convertedAudioContentType:
      asString(metadata.mime_type) ?? audio.contentType,
    promptText: `${asString(metadata.original_video_name) ?? "Source video"} recovered video`,
    transcriptText: asString(metadata.transcript_text),
    modelId: asString(audioGeneration.model_id) ?? "eleven_multilingual_sts_v2",
    providerRequestId: asString(metadata.provider_request_id),
    projectId: asString(metadata.project_id),
    workspaceRuntimeKey: asString(metadata.workspace_runtime_key),
    aspect: asString(metadata.original_video_aspect),
    workflowReload: asObject(metadata.workflow_reload),
    extraMetadata: { recovered_without_provider_generation: true },
  });
  await patchVoiceChangerRemuxMetadata({
    userId,
    audioGenerationId,
    patch: {
      remux_status: "succeeded",
      remuxed_video_generation_id: result.persistedVideo.generationId,
      remux_failure_code: null,
      remux_failure_stage: null,
    },
  });
  process.stdout.write(
    `${JSON.stringify({ recoveredVideoGenerationId: result.persistedVideo.generationId }, null, 2)}\n`,
  );
};

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
