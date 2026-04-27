export type ElevenLabsDefaultVoiceDefinition = {
  fallbackVoiceId: string;
  name: string;
  description: string;
};

export const ELEVENLABS_DEFAULT_VOICES: readonly ElevenLabsDefaultVoiceDefinition[] = [
  {
    fallbackVoiceId: "elevenlabs-default:darian",
    name: "Darian",
    description: "Warm, grounded storyteller",
  },
  {
    fallbackVoiceId: "elevenlabs-default:talia",
    name: "Talia",
    description: "Clear, modern, conversational",
  },
  {
    fallbackVoiceId: "elevenlabs-default:elara",
    name: "Elara",
    description: "Soft, expressive narrator",
  },
  {
    fallbackVoiceId: "elevenlabs-default:baxter",
    name: "Baxter",
    description: "Smooth, trustworthy British narrator",
  },
  {
    fallbackVoiceId: "elevenlabs-default:eldrin",
    name: "Eldrin",
    description: "Confident, charismatic spokesperson",
  },
  {
    fallbackVoiceId: "elevenlabs-default:kellan",
    name: "Kellan",
    description: "Smooth, professional British narrator",
  },
  {
    fallbackVoiceId: "elevenlabs-default:elowen",
    name: "Elowen",
    description: "Crisp, versatile British voice",
  },
  {
    fallbackVoiceId: "elevenlabs-default:kaelen",
    name: "Kaelen",
    description: "Warm, natural conversationalist",
  },
  {
    fallbackVoiceId: "elevenlabs-default:lawrence",
    name: "Lawrence",
    description: "Smooth, reliable British narrator",
  },
  {
    fallbackVoiceId: "elevenlabs-default:alicia",
    name: "Alicia",
    description: "Calm, engaging, global English",
  },
  {
    fallbackVoiceId: "elevenlabs-default:maisie",
    name: "Maisie",
    description: "Bright, friendly British voice",
  },
  {
    fallbackVoiceId: "elevenlabs-default:warren",
    name: "Warren",
    description: "Warm, friendly, everyday American",
  },
  {
    fallbackVoiceId: "elevenlabs-default:jade",
    name: "Jade",
    description: "Soft, natural, trustworthy narrator",
  },
  {
    fallbackVoiceId: "elevenlabs-default:eddie",
    name: "Eddie",
    description: "Relaxed, confident American",
  },
  {
    fallbackVoiceId: "elevenlabs-default:caleb",
    name: "Caleb",
    description: "Warm, approachable British voice",
  },
  {
    fallbackVoiceId: "elevenlabs-default:sawyer",
    name: "Sawyer",
    description: "Bright, friendly, youthful voice",
  },
  {
    fallbackVoiceId: "elevenlabs-default:finley",
    name: "Finley",
    description: "Calm, versatile British narrator",
  },
  {
    fallbackVoiceId: "elevenlabs-default:florence",
    name: "Florence",
    description: "Soft, elegant British narrator",
  },
  {
    fallbackVoiceId: "elevenlabs-default:wyatt",
    name: "Wyatt",
    description: "Strong, steady, confident voice",
  },
] as const;
