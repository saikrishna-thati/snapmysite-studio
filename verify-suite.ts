import { test, expect } from "@playwright/test";
import { extractSiteSpatialData } from "./src/lib/snapmy/playwright-extractor";
import { jevDecideWithVerification } from "./src/lib/snapmy/jev";
import { choreographFilmScript, directWebsite } from "./src/lib/snapmy/director";

async function run() {
  console.log("--- 1. Testing JEV Verification Engine ---");
  const brief = {
    name: "Linear",
    headline: "The issue tracker you actually want to use",
    features: [{ title: "Cycles & Projects" }, { title: "Keyboard First" }],
  };
  const decision = await jevDecideWithVerification(brief, []);
  console.log("JEV decision:", decision.motion_tone, decision.top_3_features);

  console.log("--- 2. Testing Choreography & Director ---");
  const film = await choreographFilmScript(decision, {
    elements: [{ id: "hero-btn", bounds: { x: 200, y: 300 } }],
    viewport: { width: 1440, height: 900 },
  });
  console.log("Choreographed scenes count:", film.film.scenes.length);

  console.log("--- 3. Testing directWebsite API pipeline ---");
  const directResult = await directWebsite(brief);
  console.log("Direct pipeline success:", !!directResult.plan);
}

run().catch(console.error);
