import { extractSiteSpatialData } from './playwright-extractor';
import { jevDecideWithVerification } from './jev';
import { choreographFilmScript } from './director';

export async function buildFullLaunchFilm(url: string, rawBrief: any): Promise<any> {
  // Step 1: Spatial extraction with Playwright
  const spatialData = await extractSiteSpatialData(url);

  // Step 2: Dual-Pass JEV Semantic Decision & Verification
  const verifiedBrief = await jevDecideWithVerification(rawBrief, spatialData.elements);

  // Step 3: Groq LLM Coordinate-Aware Choreography
  const filmScript = await choreographFilmScript(verifiedBrief, spatialData);

  return {
    url,
    spatial: {
      viewport: spatialData.viewport,
      elementCount: spatialData.elements.length,
      elements: spatialData.elements
    },
    decision: verifiedBrief,
    script: filmScript,
    generatedAt: new Date().toISOString()
  };
}
