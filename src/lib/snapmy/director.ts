// Subagent 4: Groq LLM Spatial Scene Choreographer
import { jevDecideWithVerification } from "./jev";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function getGroqKeys(): string[] {
  const envVal = process.env["GROQ_API_KEYS"] || process.env["GROQ_API_KEY"];
  if (!envVal) return [];
  return envVal
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

let groqKeyIndex = 0;

async function executeGroqChat(messages: any[], temperature = 0.2): Promise<string | null> {
  const keys = getGroqKeys();
  if (!keys.length) {
    return null;
  }
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(groqKeyIndex + attempt) % keys.length];
    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature,
          response_format: { type: "json_object" },
        }),
      });

      if (res.ok) {
        groqKeyIndex = (groqKeyIndex + attempt + 1) % keys.length;
        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;
      }
      if (res.status === 429) {
        console.warn(`[Groq] Key ${attempt + 1} rate-limited (429), cycling to next key...`);
        continue;
      }
    } catch {
      console.warn(`[Groq] Network error on key index ${attempt}, failover triggered.`);
    }
  }
  return null;
}

export async function choreographFilmScript(verifiedBrief: any, spatialData: any): Promise<any> {
  const prompt = [
    {
      role: "system",
      content: `You are an elite Hollywood & Apple-caliber Motion Design Director and Spatial Choreographer.
Author a continuous 24.0s SaaS launch film script in strict JSON based on the provided verified brief and spatial DOM coordinates.
Output MUST conform to:
{
  "film": {
    "title": "string",
    "totalDuration": 24.0,
    "fps": 60,
    "aesthetic": "string",
    "scenes": [
      {
        "id": "scene_01_hook",
        "type": "screen_zoom" | "isometric_orbit" | "workflow_click" | "feature_reveal" | "metric_slam" | "cta_resolve",
        "duration": number,
        "headline": "string",
        "subline": "string",
        "camera": {
          "initial": { "x": number, "y": number, "z": number, "pitch": number, "yaw": number },
          "target": { "x": number, "y": number, "z": number, "pitch": number, "yaw": number },
          "easing": "cubic-bezier(0.16, 1, 0.3, 1)"
        },
        "interaction": {
          "type": "cursor_click" | "pointer_hover" | "drag_drop" | "none",
          "targetElementId": "string",
          "targetCoordinates": { "x": number, "y": number },
          "triggerAt": number,
          "handMotion": "natural_curve",
          "rippleEffect": true
        },
        "transitionOut": "warp_dolly_push" | "diagonal_split_wipe" | "card_to_fullscreen_morph" | "frosted_glass_dissolve" | "rgb_split_dropout",
        "audioCue": "sfx_woosh_heavy" | "ui_click_tick" | "braam_impact"
      }
    ]
  }
}`,
    },
    {
      role: "user",
      content: JSON.stringify({
        brief: verifiedBrief,
        elements: (spatialData?.elements || []).slice(0, 8),
        viewport: spatialData?.viewport || { width: 1440, height: 900 },
      }),
    },
  ];

  const rawJson = await executeGroqChat(prompt);
  if (rawJson) {
    try {
      return JSON.parse(rawJson);
    } catch {
      console.warn(
        "[Director] Failed parsing Groq JSON output, generating deterministic choreography.",
      );
    }
  }

  // High-fidelity fallback choreography adhering to Subagents 4-6
  const primaryEl = spatialData?.elements?.[1] || { id: "elem_cta", bounds: { x: 720, y: 450 } };
  return {
    film: {
      title: `${verifiedBrief?.title || "Product"} Launch Film`,
      totalDuration: 24.0,
      fps: 60,
      aesthetic: verifiedBrief?.motion_tone || "dark_developer_speed",
      scenes: [
        {
          id: "scene_01_hook",
          type: "screen_zoom",
          duration: 3.5,
          headline: verifiedBrief?.hero_statement || "Next-Generation Autonomous Workflow",
          subline: "Engineered for exponential developer velocity",
          camera: {
            initial: { x: 0, y: 0, z: 950, pitch: 0, yaw: 0 },
            target: { x: 120, y: 80, z: 520, pitch: 10, yaw: -14 },
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          },
          interaction: {
            type: "cursor_click",
            targetElementId: primaryEl.id,
            targetCoordinates: { x: primaryEl.bounds.x + 40, y: primaryEl.bounds.y + 20 },
            triggerAt: 2.1,
            handMotion: "natural_curve",
            rippleEffect: true,
          },
          transitionOut: "warp_dolly_push",
          audioCue: "sfx_woosh_heavy",
        },
        {
          id: "scene_02_feature",
          type: "isometric_orbit",
          duration: 4.5,
          headline: verifiedBrief?.top_3_features?.[0] || "Realtime Distributed State",
          subline: "Multi-plane 3D isometric view of live infrastructure",
          camera: {
            initial: { x: 120, y: 80, z: 520, pitch: 10, yaw: -14 },
            target: { x: -240, y: 160, z: 410, pitch: 18, yaw: 22 },
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          },
          interaction: {
            type: "pointer_hover",
            targetElementId: "elem_card_1",
            targetCoordinates: { x: 360, y: 560 },
            triggerAt: 1.8,
            handMotion: "natural_curve",
            rippleEffect: false,
          },
          transitionOut: "diagonal_split_wipe",
          audioCue: "ui_tick_b",
        },
        {
          id: "scene_03_deep_dive",
          type: "workflow_click",
          duration: 5.0,
          headline: verifiedBrief?.top_3_features?.[1] || "Sub-Millisecond Execution",
          subline: "Direct hardware-accelerated processing engine",
          camera: {
            initial: { x: -240, y: 160, z: 410, pitch: 18, yaw: 22 },
            target: { x: 0, y: -40, z: 320, pitch: 4, yaw: -4 },
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          },
          interaction: {
            type: "cursor_click",
            targetElementId: "elem_card_2",
            targetCoordinates: { x: 720, y: 560 },
            triggerAt: 2.8,
            handMotion: "natural_curve",
            rippleEffect: true,
          },
          transitionOut: "card_to_fullscreen_morph",
          audioCue: "mouse_click_b",
        },
        {
          id: "scene_04_scale",
          type: "metric_slam",
          duration: 5.5,
          headline: "10x Performance Amplification",
          subline: "Validated across global enterprise clusters",
          camera: {
            initial: { x: 0, y: -40, z: 320, pitch: 4, yaw: -4 },
            target: { x: 80, y: -120, z: 260, pitch: 12, yaw: 16 },
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          },
          interaction: {
            type: "none",
            targetElementId: "",
            targetCoordinates: { x: 0, y: 0 },
            triggerAt: 0,
            handMotion: "natural_curve",
            rippleEffect: false,
          },
          transitionOut: "frosted_glass_dissolve",
          audioCue: "sfx_woosh_heavy",
        },
        {
          id: "scene_05_cta",
          type: "cta_resolve",
          duration: 5.5,
          headline: "Deploy In Seconds",
          subline: "Experience the modern standard of launch motion",
          camera: {
            initial: { x: 80, y: -120, z: 260, pitch: 12, yaw: 16 },
            target: { x: 0, y: 0, z: 700, pitch: 0, yaw: 0 },
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          },
          interaction: {
            type: "cursor_click",
            targetElementId: primaryEl.id,
            targetCoordinates: { x: 720, y: 480 },
            triggerAt: 3.2,
            handMotion: "natural_curve",
            rippleEffect: true,
          },
          transitionOut: "warp_dolly_push",
          audioCue: "mouse_click_b",
        },
      ],
    },
  };
}

export async function directWebsite(brief: any): Promise<any> {
  const verifiedDecision = await jevDecideWithVerification(brief, brief?.evidenceAssets || []);
  const script = await choreographFilmScript(verifiedDecision, {
    elements: brief?.evidenceAssets || [],
    viewport: { width: 1440, height: 900 },
  });

  return {
    brief,
    decision: verifiedDecision,
    plan: {
      title: brief?.name || "SnapMySite SaaS Film",
      style: verifiedDecision?.motion_tone || "kinetic",
      scenes: script.film.scenes,
      film: script.film,
    },
    script,
  };
}
