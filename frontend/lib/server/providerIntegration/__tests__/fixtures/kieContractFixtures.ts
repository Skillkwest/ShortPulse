/**
 * Kie contract fixtures derived from primary-source Veo/Kling docs examples.
 * These fixtures lock submit/callback shape expectations for dark-path regression tests.
 */

export const kieVeoGenerateRequestFixture = {
  prompt: "A dog playing in a park",
  imageUrls: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
  model: "veo3_fast",
  watermark: "MyBrand",
  callBackUrl: "https://example.com/callback/veo",
  aspect_ratio: "16:9",
  seeds: 12345,
  enableFallback: false,
  enableTranslation: true,
  generationType: "REFERENCE_2_VIDEO",
} as const;

export const kieVeoGenerateAcceptedResponseFixture = {
  code: 200,
  msg: "success",
  data: {
    taskId: "veo_task_abcdef123456",
  },
} as const;

export const kieKlingCreateTaskRequestFixture = {
  model: "kling-3.0/video",
  callBackUrl: "https://example.com/callback/kling",
  input: {
    mode: "pro",
    image_urls: ["https://example.com/first-frame.png"],
    sound: true,
    duration: "5",
    aspect_ratio: "16:9",
    multi_shots: false,
    prompt: "In a bright rehearsal room, sunlight streams through the window@element_dog",
  },
} as const;

export const kieKlingCallbackSuccessFixture = {
  code: 200,
  data: {
    state: "success",
    taskId: "e989621f54392584b05867f87b160672",
    resultJson: '{"resultUrls":["https://example.com/generated-video.mp4"]}',
  },
  msg: "Playground task completed successfully.",
} as const;

export const kieKlingCallbackFailureFixture = {
  code: 501,
  data: {
    state: "fail",
    taskId: "bd3a37c523149e4adf45a3ddb5faf1a8",
    failCode: "500",
    failMsg: "Internal server error",
    resultJson: null,
  },
  msg: "Playground task failed.",
} as const;
