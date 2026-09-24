// Real product launch films for the hero + reel.
// Briefs were read from each live site by the server reader (JEV), then
// curated: headline, features, stats and brand colors are the site's own.
//
// Every sample carries its own `direction` record:
//   concept   one-line creative idea for the film
//   structure ordered scene types — the film's unique skeleton. Every ordered
//             consecutive pair (except the universal cta>endcard / logos>endcard
//             connectors) appears in exactly ONE film, so the reel can never
//             read as one template recoloured twelve times
//   camera    push/track/orbit/match/reveal/static, cycled so neighbours differ
//   opening   the scene type that lands real content on screen inside 1.5s;
//             always the first entry of `structure`
//   hero      true for the single flagship film (Claude): longest beat, richest
//             structure and a held hero moment
//   beat      target runtime seconds (flagship 30, others 16–24)
//   holds     1–2 scene types that receive the long 5–6s quiet hold
//   scenes    explicit skeleton matching `structure` field for field, filled
//             with the brief's own headline, features, stats, cta and colors;
//             product beats use `shot` 0/1 as placeholder captures that the
//             reader replaces with real screenshots at compose time.
//
// Banned in every film: the tiled self-name marquee, the hardcoded 01/02/03
// feature run, and the recap-of-the-opening-headline beat. `stat` appears in
// at most one per film (five films include a stat beat). No film repeats a scene type.

export const SAMPLES = [
  {
    style: "editorial",
    motionVariation: "mv004",
    note: "AI assistant",
    aspect: "16:9",
    direction: {
      concept: "One agent becoming a whole team — open inside the interface, then let the system multiply itself.",
      structure: ["depthReveal", "statement", "scroll", "hook", "screen", "flyin", "quote", "logos", "featureStack", "matchcut", "endcard"],
      camera: "push",
      opening: "depthReveal",
      hero: true,
      beat: 30,
      holds: ["depthReveal", "quote"]
    },
    scenes: [
      { type: "depthReveal", text: "Claude Platform", shot: 0 },
      { type: "statement", text: "Claude is a next generation AI assistant built by Anthropic and trained to be safe, accurate and secure.", kicker: "AI assistant" },
      { type: "scroll", shot: 1, caption: "Think fast, build faster" },
      { type: "hook", words: ["Think fast","build","faster"] },
      { type: "screen", shot: 2, caption: "Memory tool" },
      { type: "flyin", shot: 0, caption: "Multiagent orchestration" },
      { type: "quote", text: "Claude delegates to other agents, each with its own independent context window.", author: "Claude" },
      { type: "logos", kicker: "Trusted by teams", names: ["Acme","Northwind","Globex"] },
      { type: "featureStack", items: ["Multiagent orchestration","Claude Platform","Memory tool"] },
      { type: "matchcut", text: "Multiagent orchestration", from: 1, to: 2 },
      { type: "endcard", text: "Claude is a next generation AI assistant built by Anthropic" }
    ],
    brief: {
      name: "Claude",
      domain: "claude.com",
      headline: "Think fast, build faster",
      hook: ["Think fast", "build", "faster"],
      description: "Claude is a next generation AI assistant built by Anthropic and trained to be safe, accurate and secure.",
      features: [
        { title: "Claude Platform", desc: "Claude delegates to other agents, each with its own independent context window." },
        { title: "Memory tool", desc: "Claude reads and writes to memory stores, so every session gets progressively better." },
        { title: "Multiagent orchestration", desc: "Route work across agents that reason independently, then converge on an answer." }
      ],
      stats: [{ value: "20x", label: "more usage than Pro" }, { value: "5x", label: "faster on long tasks" }],
      cta: "Try Claude",
      colors: ["#d97757", "#fbbc05", "#4285f4"],
      category: "AI assistant"
    }
  },
  {
    style: "neon",
    motionVariation: "mv009",
    note: "Developer tools",
    aspect: "16:9",
    direction: {
      concept: "A raw page cleans itself into structure; the crawl is the argument, so the camera moves across it.",
      structure: ["matchcut", "logos", "coldopen", "split", "track", "feature", "depthReveal", "flyin", "cta", "endcard"],
      camera: "track",
      opening: "matchcut",
      hero: false,
      beat: 23,
      holds: ["matchcut"]
    },
    scenes: [
      { type: "matchcut", text: "Easily connect your agents", from: 0, to: 1 },
      { type: "logos", kicker: "Trusted by teams", names: ["Acme","Northwind","Globex"] },
      { type: "coldopen", word: "Firecrawl" },
      { type: "split", text: "Power AI agents with clean web data", shot: 0 },
      { type: "track", shot: 1, caption: "Easily connect your agents" },
      { type: "feature", title: "We handle the hard stuff", sub: "Sierra uses Firecrawl to ingest web data into knowledge bases that power AI" },
      { type: "depthReveal", text: "The knowledge library", shot: 2 },
      { type: "flyin", shot: 0, caption: "Easily connect your agents" },
      { type: "cta", text: "Start scraping", button: "Start scraping" },
      { type: "endcard", text: "The web data API to search, scrape and interact with the" }
    ],
    brief: {
      name: "Firecrawl",
      domain: "firecrawl.dev",
      headline: "Power AI agents with clean web data",
      hook: ["Power AI agents", "with clean", "web data"],
      description: "The web data API to search, scrape and interact with the web at scale. Turn any source into clean Markdown.",
      features: [
        { title: "Easily connect your agents", desc: "Zapier uses Firecrawl to power custom web knowledge in Zapier Chatbots." },
        { title: "We handle the hard stuff", desc: "Firecrawl is the engine behind custom web knowledge sources." },
        { title: "The knowledge library", desc: "Sierra uses Firecrawl to ingest web data into knowledge bases that power AI chat." }
      ],
      stats: [{ value: "75M", label: "in Series B funding" }, { value: "50x", label: "faster with AgentOps" }],
      cta: "Start scraping",
      colors: ["#3186ff", "#781e00", "#fabc12"],
      category: "developer tool"
    }
  },
  {
    style: "pop",
    motionVariation: "mv006",
    note: "Marketing",
    aspect: "16:9",
    direction: {
      concept: "A silent operator working around the clock; product windows take shifts, one after another.",
      structure: ["track", "flashword", "flyin", "split", "hook", "statement", "depthReveal", "quote", "endcard"],
      camera: "orbit",
      opening: "track",
      hero: false,
      beat: 22,
      holds: ["track"]
    },
    scenes: [
      { type: "track", shot: 0, caption: "Scale output, not overhead" },
      { type: "flashword", word: "Naise AI" },
      { type: "flyin", shot: 1, caption: "A team that never sleeps" },
      { type: "split", text: "Automate your marketing 10x faster", shot: 2 },
      { type: "hook", words: ["Automate your","marketing","10x faster"] },
      { type: "statement", text: "Your AI teammate for marketing. One AI runs social, influencer, PR and image generation in any language.", kicker: "marketing automation" },
      { type: "depthReveal", text: "A team that never sleeps", shot: 0 },
      { type: "quote", text: "Naise acts as a silent operator for every client account.", author: "Naise AI" },
      { type: "endcard", text: "Your AI teammate for marketing. One AI runs social," }
    ],
    brief: {
      name: "Naise AI",
      domain: "naise.ai",
      headline: "Automate your marketing 10x faster",
      hook: ["Automate your", "marketing", "10x faster"],
      description: "Your AI teammate for marketing. One AI runs social, influencer, PR and image generation in any language.",
      features: [
        { title: "Scale output, not overhead", desc: "Naise acts as a silent operator for every client account." },
        { title: "A team that never sleeps", desc: "One AI teammate runs your Social, Influencer and PR in any language, any market." },
        { title: "Your marketing, fully automated", desc: "Image generation, media lists, campaigns and reporting, handled end to end." }
      ],
      stats: [{ value: "10M", label: "AI matches made" }, { value: "2 weeks", label: "to get started" }],
      cta: "Meet your AI teammate",
      colors: ["#d4ff00", "#0b7b3e", "#16c060"],
      category: "marketing automation"
    }
  },
  {
    style: "editorial",
    motionVariation: "mv008",
    note: "AI assistant",
    aspect: "16:9",
    direction: {
      concept: "The blank reply box is the villain; open inside the app, hold on the draft, let context fill the silence.",
      structure: ["flyin", "feature", "scroll", "coldopen", "quote", "screen", "stat", "depthReveal", "logos", "endcard"],
      camera: "reveal",
      opening: "flyin",
      hero: false,
      beat: 20,
      holds: ["flyin"]
    },
    scenes: [
      { type: "flyin", shot: 0, caption: "The right reply starts with" },
      { type: "feature", title: "The right reply starts with context", sub: "Draft replies that still sound like you, in every app you write in." },
      { type: "scroll", shot: 1, caption: "You don't have to be stuck on" },
      { type: "coldopen", word: "ToneBird" },
      { type: "quote", text: "ToneBird understands your relationships, what you've already said, and where you left off.", author: "ToneBird" },
      { type: "screen", shot: 2, caption: "Keep your voice intact" },
      { type: "stat", value: "3", label: "apps, one assistant" },
      { type: "depthReveal", text: "From reply to follow-up", shot: 0 },
      { type: "logos", kicker: "Trusted by teams", names: ["Acme","Northwind","Globex"] },
      { type: "endcard", text: "Draft replies in your email and chat apps using past" }
    ],
    brief: {
      name: "ToneBird",
      domain: "tonebird.ai",
      headline: "You don't have to be stuck on words again",
      hook: ["Never stuck", "on words", "again"],
      description: "Draft replies in your email and chat apps using past conversations and connected documents.",
      features: [
        { title: "The right reply starts with context", desc: "ToneBird understands your relationships, what you've already said, and where you left off." },
        { title: "Keep your voice intact", desc: "Draft replies that still sound like you, in every app you write in." },
        { title: "From reply to follow-up", desc: "Use past conversations and connected documents to move every thread forward." }
      ],
      stats: [{ value: "3", label: "apps, one assistant" }],
      cta: "Write with ToneBird",
      colors: ["#3a6fe0", "#f4a6b8", "#141414"],
      category: "AI assistant"
    }
  },
  {
    style: "kinetic",
    motionVariation: "mv003",
    note: "Design tools",
    aspect: "16:9",
    direction: {
      concept: "Idea to launch as one unbroken push; the camera never cuts back, it keeps moving into the canvas.",
      structure: ["depthReveal", "split", "coldopen", "flyin", "matchcut", "featureStack", "screen", "scroll", "endcard"],
      camera: "match",
      opening: "depthReveal",
      hero: false,
      beat: 21,
      holds: ["scroll"]
    },
    scenes: [
      { type: "depthReveal", text: "Design with an agent", shot: 0 },
      { type: "split", text: "The design agent for every step from idea to", shot: 1 },
      { type: "coldopen", word: "Framer" },
      { type: "flyin", shot: 2, caption: "Run your CMS with an agent" },
      { type: "matchcut", text: "Run your CMS with an agent", from: 0, to: 1 },
      { type: "featureStack", items: ["Run your CMS with an agent","Code with an agent","Design with an agent"] },
      { type: "screen", shot: 0, caption: "Run your CMS with an agent" },
      { type: "scroll", shot: 1, caption: "The design agent for every step" },
      { type: "endcard", text: "Go from idea to launch with an agent that designs and" }
    ],
    brief: {
      name: "Framer",
      domain: "framer.com",
      headline: "The design agent for every step from idea to launch",
      hook: ["From idea", "to launch", "with an agent"],
      description: "Go from idea to launch with an agent that designs and builds on the canvas. Every change stays editable.",
      features: [
        { title: "Design with an agent", desc: "An agent that designs and builds on the canvas, with every change still editable." },
        { title: "Run your CMS with an agent", desc: "Publish and keep content moving without leaving the canvas." },
        { title: "Code with an agent", desc: "Hosting, security and infrastructure handled from the first idea." }
      ],
      stats: [{ value: "20", label: "designs on the canvas" }, { value: "1", label: "place from idea to launch" }],
      cta: "Start designing",
      colors: ["#00ccff", "#00dd66", "#ffbb00"],
      category: "design tool"
    }
  },
  {
    style: "pop",
    motionVariation: "mv005",
    note: "Collaboration",
    aspect: "16:9",
    direction: {
      concept: "A room you can hear; voice notes become agent actions while the camera drifts across the review table.",
      structure: ["flyin", "featureStack", "depthReveal", "matchcut", "split", "feature", "coldopen", "endcard"],
      camera: "static",
      opening: "flyin",
      hero: false,
      beat: 17,
      holds: ["flyin"]
    },
    scenes: [
      { type: "flyin", shot: 0, caption: "Present at studio quality" },
      { type: "featureStack", items: ["Present at studio quality","Voice comments in. Agents act, live.","Real-time translation, no barriers"] },
      { type: "depthReveal", text: "Present at studio quality", shot: 1 },
      { type: "matchcut", text: "Voice comments in. Agents", from: 2, to: 0 },
      { type: "split", text: "The room where creative teams meet and AI takes", shot: 2 },
      { type: "feature", title: "Voice comments in. Agents act, live.", sub: "Review together in any language, with every note understood." },
      { type: "coldopen", word: "Pactto" },
      { type: "endcard", text: "Persistent collaboration rooms where creative teams present" }
    ],
    brief: {
      name: "Pactto",
      domain: "pactto.com",
      headline: "The room where creative teams meet and AI takes action",
      hook: ["Meet", "align", "act"],
      description: "Persistent collaboration rooms where creative teams present at studio quality and review with an AI agent.",
      features: [
        { title: "Present at studio quality", desc: "Bring your assets, present at the highest quality, review together, and decide." },
        { title: "Voice comments in. Agents act, live.", desc: "Speak your notes and watch AI agents apply them across the room in real time." },
        { title: "Real-time translation, no barriers", desc: "Review together in any language, with every note understood." }
      ],
      stats: [{ value: "1", label: "room for every review" }],
      cta: "Open a room",
      colors: ["#3c4dff", "#f0b45b", "#141414"],
      category: "creative collaboration"
    }
  },
  {
    style: "kinetic",
    motionVariation: "mv007",
    note: "AI agents",
    aspect: "16:9",
    direction: {
      concept: "Hand it a job and walk away; follow one task picked up, run, and checked with no human in frame.",
      structure: ["matchcut", "track", "flyin", "stat", "scroll", "quote", "depthReveal", "hook", "endcard"],
      camera: "push",
      opening: "matchcut",
      hero: false,
      beat: 19,
      holds: ["flyin"]
    },
    scenes: [
      { type: "matchcut", text: "Hand over the job. Get the", from: 0, to: 1 },
      { type: "track", shot: 0, caption: "Hand over the job. Get the result." },
      { type: "flyin", shot: 1, caption: "Setup and troubleshooting included" },
      { type: "stat", value: "24/7", label: "agents on the job" },
      { type: "scroll", shot: 2, caption: "Agents with their own computers," },
      { type: "quote", text: "They connect to any tool the job needs, build what's missing, and check the result.", author: "Solid" },
      { type: "depthReveal", text: "Setup and troubleshooting", shot: 0 },
      { type: "hook", words: ["Give them","a job","they finish it"] },
      { type: "endcard", text: "Give an agent a job and it connects to the tools it needs," }
    ],
    brief: {
      name: "Solid",
      domain: "solid.tech",
      headline: "Agents with their own computers, accounts, and budgets",
      hook: ["Give them", "a job", "they finish it"],
      description: "Give an agent a job and it connects to the tools it needs, builds what's missing, and checks the result.",
      features: [
        { title: "Hand over the job. Get the result.", desc: "They connect to any tool the job needs, build what's missing, and check the result." },
        { title: "Setup and troubleshooting included", desc: "They choose the tools and handle the setup, even for software you've never used." },
        { title: "Deploy always-on agents", desc: "Give them a job and they keep working, within boundaries you control." }
      ],
      stats: [{ value: "24/7", label: "agents on the job" }, { value: "0", label: "setup required" }],
      cta: "Ship an agent",
      colors: ["#7c5cff", "#35d0ff", "#141414"],
      category: "AI agents"
    }
  },
  {
    style: "neon",
    motionVariation: "mv001",
    note: "Link infrastructure",
    aspect: "16:9",
    direction: {
      concept: "A click travels through the stack and comes out as revenue; one shape morphs the whole way down.",
      structure: ["depthReveal", "scroll", "split", "flashword", "logos", "hook", "stat", "statement", "endcard"],
      camera: "match",
      opening: "depthReveal",
      hero: false,
      beat: 21,
      holds: ["split"]
    },
    scenes: [
      { type: "depthReveal", text: "Built to scale", shot: 0 },
      { type: "scroll", shot: 1, caption: "Turn clicks into revenue" },
      { type: "split", text: "Turn clicks into revenue", shot: 2 },
      { type: "flashword", word: "Dub" },
      { type: "logos", kicker: "Trusted by teams", names: ["Acme","Northwind","Globex"] },
      { type: "hook", words: ["Turn clicks","into","revenue"] },
      { type: "stat", value: "12.5K", label: "leads tracked" },
      { type: "statement", text: "The modern link attribution platform for short links, conversion tracking and affiliate programs.", kicker: "link infrastructure" },
      { type: "endcard", text: "The modern link attribution platform for short links," }
    ],
    brief: {
      name: "Dub",
      domain: "dub.co",
      headline: "Turn clicks into revenue",
      hook: ["Turn clicks", "into", "revenue"],
      description: "The modern link attribution platform for short links, conversion tracking and affiliate programs.",
      features: [
        { title: "Built to scale", desc: "Manage short links at scale with folders and role-based access control." },
        { title: "Measure what matters", desc: "Conversion tracking and analytics that go far beyond vanity metrics." },
        { title: "Grow with partnerships", desc: "Program marketplace, affiliate revenue and payouts in one place." }
      ],
      stats: [{ value: "12.5K", label: "leads tracked" }, { value: "450M", label: "payouts processed" }],
      cta: "Start for free",
      colors: ["#00d5be", "#ffba00", "#ff6467"],
      category: "link infrastructure"
    }
  },
  {
    style: "mono",
    motionVariation: "mv002",
    note: "Developer tools",
    aspect: "16:9",
    direction: {
      concept: "Email built like code; the editor is the hero and the camera tracks one line of it like reading a diff.",
      structure: ["flashword", "track", "logos", "depthReveal", "coldopen", "scroll", "featureStack", "endcard"],
      camera: "track",
      opening: "flashword",
      hero: false,
      beat: 16,
      holds: ["featureStack"]
    },
    scenes: [
      { type: "flashword", word: "Resend" },
      { type: "track", shot: 0, caption: "Develop emails using React" },
      { type: "logos", kicker: "Trusted by teams", names: ["Acme","Northwind","Globex"] },
      { type: "depthReveal", text: "Broadcast analytics", shot: 1 },
      { type: "coldopen", word: "Resend" },
      { type: "scroll", shot: 2, caption: "Email for developers" },
      { type: "featureStack", items: ["First-class developer experience","Develop emails using React","Broadcast analytics"] },
      { type: "endcard", text: "The best way to reach humans instead of spam folders." }
    ],
    brief: {
      name: "Resend",
      domain: "resend.com",
      headline: "Email for developers",
      hook: ["Email", "for", "developers"],
      description: "The best way to reach humans instead of spam folders. Deliver transactional and marketing email with ease.",
      features: [
        { title: "Develop emails using React", desc: "Build and test emails with the tools you already use to ship software." },
        { title: "Broadcast analytics", desc: "Group and control your contacts in a simple, intuitive way." },
        { title: "First-class developer experience", desc: "The best way to reach humans instead of spam folders." }
      ],
      stats: [{ value: "2", label: "hours saved per launch" }],
      cta: "Start sending",
      colors: ["#00a3ff", "#9b7cff", "#62ffb3"],
      category: "developer tool"
    }
  },
  {
    style: "neon",
    motionVariation: "mv010",
    note: "Cloud platform",
    aspect: "16:9",
    direction: {
      concept: "Infrastructure that thinks like the agents on it; the camera orbits the deploy surface, never cutting away.",
      structure: ["hook", "flashword", "screen", "split", "quote", "featureStack", "track", "depthReveal", "endcard"],
      camera: "orbit",
      opening: "hook",
      hero: false,
      beat: 24,
      holds: ["depthReveal"]
    },
    scenes: [
      { type: "hook", words: ["Agents on","infrastructure","built for agents"] },
      { type: "flashword", word: "Vercel" },
      { type: "screen", shot: 0, caption: "Host platforms that serve every" },
      { type: "split", text: "Build agents on infrastructure that thinks like", shot: 1 },
      { type: "quote", text: "Zapier serves over 100 million monthly website visits on Vercel.", author: "Vercel" },
      { type: "featureStack", items: ["Built by you, or your agents","Agent Stack","Host platforms that serve every customer"] },
      { type: "track", shot: 2, caption: "Built by you, or your agents" },
      { type: "depthReveal", text: "Agent Stack", shot: 0 },
      { type: "endcard", text: "The autonomous stack for every app and agent, from your" }
    ],
    brief: {
      name: "Vercel",
      domain: "vercel.com",
      headline: "Build agents on infrastructure that thinks like them",
      hook: ["Agents on", "infrastructure", "built for agents"],
      description: "The autonomous stack for every app and agent, from your first deploy to global scale.",
      features: [
        { title: "Host platforms that serve every customer", desc: "Zapier serves over 100 million monthly website visits on Vercel." },
        { title: "Built by you, or your agents", desc: "Ship apps and agents, with infrastructure automated by agents." },
        { title: "Agent Stack", desc: "The autonomous stack for every app and agent." }
      ],
      stats: [{ value: "100M", label: "monthly visits served" }],
      cta: "Deploy now",
      colors: ["#ffb224", "#0070f3", "#ff975c"],
      category: "cloud platform"
    }
  },
  {
    style: "kinetic",
    motionVariation: "mv011",
    note: "Product planning",
    aspect: "9:16",
    direction: {
      concept: "Build, review, ship as three vertical stations; the camera flies from one to the next.",
      structure: ["track", "stat", "logos", "feature", "split", "depthReveal", "screen", "endcard"],
      camera: "match",
      opening: "track",
      hero: false,
      beat: 18,
      holds: ["track"]
    },
    scenes: [
      { type: "track", shot: 0, caption: "Planning and monitoring" },
      { type: "stat", value: "1", label: "place for every cycle" },
      { type: "logos", kicker: "Trusted by teams", names: ["Acme","Northwind","Globex"] },
      { type: "feature", title: "Intake and integrations", sub: "Keep every cycle short, legible and on track." },
      { type: "split", text: "Build, review, and ship", shot: 1 },
      { type: "depthReveal", text: "Faster app launch", shot: 2 },
      { type: "screen", shot: 0, caption: "Planning and monitoring" },
      { type: "endcard", text: "Purpose-built for planning and building products with AI" }
    ],
    brief: {
      name: "Linear",
      domain: "linear.app",
      headline: "Build, review, and ship",
      hook: ["Build", "review", "ship"],
      description: "Purpose-built for planning and building products with AI agents.",
      features: [
        { title: "Planning and monitoring", desc: "Purpose-built for planning and building products with AI agents." },
        { title: "Intake and integrations", desc: "Plan and navigate from idea to launch without losing the thread." },
        { title: "Faster app launch", desc: "Keep every cycle short, legible and on track." }
      ],
      stats: [{ value: "1", label: "place for every cycle" }],
      cta: "Start building",
      colors: ["#d4a600", "#8fa6ff", "#ffc47c"],
      category: "product planning"
    }
  },
  {
    style: "mono",
    motionVariation: "mv012",
    note: "Support desk",
    aspect: "9:16",
    direction: {
      concept: "Warmth at speed; start on a real reply being written, then track across the shared inbox as it calms.",
      structure: ["flyin", "scroll", "matchcut", "statement", "split", "stat", "feature", "flashword", "endcard"],
      camera: "static",
      opening: "flyin",
      hero: false,
      beat: 17,
      holds: ["flyin"]
    },
    scenes: [
      { type: "flyin", shot: 0, caption: "The right answer, sooner" },
      { type: "scroll", shot: 1, caption: "Support that feels human" },
      { type: "matchcut", text: "The right answer, sooner", from: 2, to: 0 },
      { type: "statement", text: "A modern support desk for teams that want every reply to feel like a good one.", kicker: "customer support" },
      { type: "split", text: "Support that feels human", shot: 2 },
      { type: "stat", value: "41%", label: "faster first reply" },
      { type: "feature", title: "The right answer, sooner", sub: "Let the team help without stepping on each other." },
      { type: "flashword", word: "Kindling" },
      { type: "endcard", text: "A modern support desk for teams that want every reply to" }
    ],
    brief: {
      name: "Kindling",
      domain: "kindling.support",
      headline: "Support that feels human",
      hook: ["Answer faster", "stay human", "keep trust"],
      description: "A modern support desk for teams that want every reply to feel like a good one.",
      features: [
        { title: "The right answer, sooner", desc: "Bring context into every conversation before it starts." },
        { title: "A shared calm inbox", desc: "Let the team help without stepping on each other." },
        { title: "Support worth remembering", desc: "Turn a solved problem into a stronger relationship." }
      ],
      stats: [{ value: "41%", label: "faster first reply" }],
      cta: "Make support feel good",
      colors: ["#e85d75", "#fde68a", "#1f2937"],
      category: "customer support"
    }
  }
];
