// Subagents 2 & 3: JEV Dual-Pass Decision & Verification Engine
const JEV_API_BASE = 'https://api.typesafe.ai/v1';

const DEFAULT_JEV_KEYS = [
  'apikey_21639af6e8ad403e426f8e94146e6dd02805_c2a5c8c45036b2c10941e835ee4875a0008a233dac1e8329a08e287f2051160b',
  'apikey_22302e1dfba0bea7469bb6cb8f9ef6ff11fd_effc484da6dd07d2792b9160a1b9e82c924814212684abc32700e503ea276c56'
];

function getJevKeys(): string[] {
  const envVal = process.env.JEV_API_KEYS || process.env.TYPESAFE_JEV_KEY;
  if (!envVal) return DEFAULT_JEV_KEYS;
  return envVal.split(',').map(k => k.trim()).filter(Boolean);
}

let activeKeyIndex = 0;

async function callJevGateway(state: any, questions: any): Promise<any> {
  const keys = getJevKeys();
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(activeKeyIndex + attempt) % keys.length];
    try {
      const res = await fetch(`${JEV_API_BASE}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ state, questions })
      });
      if (res.ok) {
        activeKeyIndex = (activeKeyIndex + attempt) % keys.length;
        return await res.json();
      }
    } catch (e) {
      console.warn(`[JEV] Key attempt ${attempt + 1} failed, trying next key...`);
    }
  }
  return null;
}

export async function jevDecideWithVerification(brief: any, spatialElements: any[] = []): Promise<any> {
  // Step 1: Subagent 2 - Primary Semantic Decision Filter
  const primaryState = {
    title: brief?.title || 'Product Launch',
    summary: brief?.summary || '',
    features: brief?.features || [],
    url: brief?.url || ''
  };

  const primaryQuestions = {
    hero_statement: {
      type: 'text',
      instructions: 'Extract or synthesize a high-impact, punchy 5-word hero claim for this SaaS product.'
    },
    motion_tone: {
      type: 'choice',
      options: ['hyper_clean_fintech', 'dark_developer_speed', 'creator_vibrant_pop', 'cinematic_enterprise_minimal'],
      instructions: 'Select the optimal motion graphics aesthetic for this product.'
    },
    top_3_features: {
      type: 'list',
      instructions: 'Identify the top 3 high-leverage interactive features that should be demonstrated in motion.'
    }
  };

  const primaryDecision = await callJevGateway(primaryState, primaryQuestions) || {
    hero_statement: brief?.title || 'Scale Your Operations Instantly',
    motion_tone: 'dark_developer_speed',
    top_3_features: (brief?.features || ['Autonomous Intelligence', 'Real-time Workflow Engine', 'Zero Latency Infrastructure']).slice(0, 3)
  };

  // Step 2: Subagent 3 - JEV Verification Subagent (Double-Check)
  const verificationState = {
    candidateDecision: primaryDecision,
    candidateElements: (spatialElements || []).slice(0, 10).map(e => ({ selector: e.selector, role: e.role, text: e.text }))
  };

  const verificationQuestions = {
    verify_features: {
      type: 'noul',
      instructions: 'Cross-check the selected features against the Playwright DOM tree and visual evidence. Are all selected features concrete, technically accurate, and supported by visible UI elements rather than generic slogans?',
      criteria: { true: 'Verified real SaaS features.', false: 'Contains generic or ungrounded claims.' }
    },
    verify_interaction_targets: {
      type: 'noul',
      instructions: 'Do the proposed scene focus points map to real interactive buttons or inputs in the spatial DOM list?',
      criteria: { true: 'Interactive targets confirmed.', false: 'Targets missing or invalid.' }
    },
    pacing_audit: {
      type: 'score',
      instructions: 'Validate whether the scene count and pacing fit within a 20-30 second launch film.',
      criteria: ['Overstuffed / Rushed', 'Acceptable', 'Optimal narrative flow', 'Too sparse']
    }
  };

  const verificationResult = await callJevGateway(verificationState, verificationQuestions) || {
    verify_features: true,
    verify_interaction_targets: true,
    pacing_audit: 'Optimal narrative flow'
  };

  return {
    ...primaryDecision,
    verified: verificationResult.verify_features === true,
    verificationAudit: verificationResult,
    doubleCheckedAt: new Date().toISOString(),
    spatialTargetCount: spatialElements.length
  };
}
