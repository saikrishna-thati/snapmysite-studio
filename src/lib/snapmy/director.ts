/**
 * SnapMySite Creative Director Pipeline
 * Groq LLM-driven choreography with multi-key failover and deterministic fallback
 */
import { jevDecideWithVerification, type JevSemanticDecision } from "./jev";
import { getEnv } from "../env";
import { logger } from "../logger";

export interface WebsiteBrief {
  title: string;
  url: string;
  ratio: "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  extractedElements?: Array<{
    id: string;
    tag: string;
    role: string;
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
}

export interface ChoreographedScene {
  id: string;
  order: number;
  camera: {
    yaw: number;
    pitch: number;
    fov: number;
    dollyZ: number;
  };
  transition: string;
  audioPreset: string;
  durationMs: number;
  focusElementId?: string | undefined;
  narration?: string | undefined;
}

export interface FilmScript {
  version: "2.0";
  ratio: "9:16" | "16:9" | "1:1";
  totalDurationMs: number;
  scenes: ChoreographedScene[];
  soundtrack: {
    themePreset: string;
    ambientSoundscape: string;
  };
}

export function getGroqKeys(): string[] {
  return getEnv().GROQ_API_KEYS;
}

let activeKeyIndex = 0;

export async function executeGroqChat(prompt: string, systemPrompt?: string): Promise<string> {
  const keys = getGroqKeys();
  if (keys.length === 0) {
    logger.debug("No Groq keys configured; falling back to deterministic script generation");
    return "";
  }

  const maxAttempts = keys.length;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const currentKey = keys[activeKeyIndex % keys.length];
    activeKeyIndex = (activeKeyIndex + 1) % keys.length;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        logger.warn(`Groq API returned HTTP ${response.status}`, { keyIndex: activeKeyIndex });
        continue;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      logger.warn("Groq request failed, attempting next key", { error: String(err) });
    }
  }

  logger.warn(
    "All Groq API keys exhausted or rate-limited; falling back to deterministic generation",
  );
  return "";
}

export async function choreographFilmScript(
  brief: WebsiteBrief,
  jevDecisions?: JevSemanticDecision[],
): Promise<FilmScript> {
  const endTimer = logger.timer("choreographFilmScript", {
    title: brief.title,
    ratio: brief.ratio,
  });
  const scenes: ChoreographedScene[] = [];
  const sceneCount = Math.max(3, Math.min(8, Math.floor(brief.durationSeconds / 4)));
  const sceneDurationMs = Math.round((brief.durationSeconds * 1000) / sceneCount);

  for (let i = 0; i < sceneCount; i++) {
    const matchedJev = jevDecisions?.[i % (jevDecisions?.length || 1)];
    scenes.push({
      id: `scene-${i + 1}`,
      order: i + 1,
      camera: {
        yaw: (i % 2 === 0 ? 1 : -1) * (i * 3.5),
        pitch: -2.0 + i * 0.8,
        fov: 45 - i * 1.5,
        dollyZ: 500 - i * 35,
      },
      transition: matchedJev?.motionVector || (i === 0 ? "zoom-cut" : "whip-pan"),
      audioPreset: `preset-${((i * 17) % 100) + 1}`,
      durationMs: sceneDurationMs,
      focusElementId: matchedJev?.elementId || brief.extractedElements?.[i]?.id,
      narration: `Scene ${i + 1}: Highlighting ${brief.title}`,
    });
  }

  endTimer({ sceneCount: scenes.length });
  return {
    version: "2.0",
    ratio: brief.ratio,
    totalDurationMs: brief.durationSeconds * 1000,
    scenes,
    soundtrack: {
      themePreset: "preset-1",
      ambientSoundscape: "subtle-synth-pulse",
    },
  };
}

export async function directWebsite(brief: WebsiteBrief): Promise<{
  brief: WebsiteBrief;
  jevDecisions: JevSemanticDecision[];
  filmScript: FilmScript;
}> {
  const endTimer = logger.timer("directWebsite", { url: brief.url, title: brief.title });
  const elements = brief.extractedElements || [];
  const jevDecisions: JevSemanticDecision[] = [];

  for (const el of elements.slice(0, 10)) {
    const decision = await jevDecideWithVerification({
      elementId: el.id,
      role: el.role,
      bounds: el.bounds,
      text: el.text,
    });
    jevDecisions.push(decision);
  }

  const filmScript = await choreographFilmScript(brief, jevDecisions);
  endTimer({ elementsAnalyzed: jevDecisions.length, scenesGenerated: filmScript.scenes.length });

  return {
    brief,
    jevDecisions,
    filmScript,
  };
}
