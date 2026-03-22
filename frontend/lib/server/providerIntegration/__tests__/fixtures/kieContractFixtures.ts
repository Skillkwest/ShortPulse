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

export const kieVeoRecordInfoRunningFixture = {
  code: 200,
  msg: "success",
  data: {
    taskId: "veo_task_abcdef123456",
    successFlag: 0,
    state: "processing",
    response_url: "https://api.kie.ai/api/v1/veo/record-info?taskId=veo_task_abcdef123456",
    response: null,
  },
} as const;

export const kieVeoRecordInfoSuccessFixture = {
  code: 200,
  msg: "success",
  data: {
    taskId: "veo_task_abcdef123456",
    successFlag: 1,
    state: "success",
    response: {
      resultUrls: ["https://example.com/veo-generated-video.mp4"],
    },
    result: {
      resultUrls: ["https://example.com/veo-generated-video.mp4"],
    },
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

export const kieKlingMotionControlRequestFixture = {
  model: "kling-3.0/motion-control",
  callBackUrl: "https://example.com/callback/kling-motion",
  input: {
    prompt: "The cartoon character is dancing.",
    input_urls: ["https://example.com/character.png"],
    video_urls: ["https://example.com/motion.mp4"],
    mode: "720p",
    character_orientation: "image",
    background_source: "input_video",
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

export const kieKlingRecordInfoSuccessFixture = {
  code: 200,
  msg: "success",
  data: {
    taskId: "task_12345678",
    status: "completed",
    responseUrl: "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_12345678",
    result: {
      resultUrls: ["https://example.com/generated-video-from-record-info.mp4"],
    },
  },
} as const;
