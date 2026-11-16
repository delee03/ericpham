// Content for the zoom-out journey: one entry per scale level, in scroll order.
// `log` is log10 of the scene scale in metres; scroll position maps onto it.
export const journeyLevels = [
    {
        id: "hero",
        name: "You",
        exp: "10⁰ m",
        unit: "1 m",
        log: 0,
        hint: "Scroll to zoom out",
        caption: null,
    },
    {
        id: "about",
        name: "Saigon",
        exp: "10⁴ m",
        unit: "10 km",
        log: 4,
        hint: "Keep going",
        caption: "One city of millions. I'm one small light in it.",
    },
    {
        id: "experience",
        name: "Earth",
        exp: "10⁷ m",
        unit: "12,742 km",
        log: 7,
        hint: "Faster now",
        caption: "Every job I've had happened on this one surface.",
    },
    {
        id: "projects",
        name: "The planets",
        exp: "10¹² m",
        unit: "~9 AU",
        log: 12,
        hint: "Keep going",
        caption: "Things I built, passing by at the speed of a scroll.",
    },
    {
        id: "pause",
        name: "Pale Blue Dot",
        exp: "~10¹³ m",
        unit: "6 billion km",
        log: 13,
        hint: "Look closely",
        caption: "That pixel is everyone who has ever lived.",
    },
    {
        id: "skills",
        name: "Milky Way",
        exp: "10²¹ m",
        unit: "100,000 ly",
        log: 21,
        hint: "Further",
        caption: "Hundreds of billions of stars. Ours is one of them.",
    },
    {
        id: "message",
        name: "Cosmic web",
        exp: "10²⁶ m",
        unit: "93 billion ly",
        log: 26,
        hint: "Hold here",
        caption: "Next to the universe, we are nothing.",
    },
    {
        id: "contact",
        name: "Back to you",
        exp: "10⁰ m",
        unit: "1 m",
        log: 0,
        hint: "Back home",
        caption: "Small as we are, we still get to build things. Say hi.",
    },
];

export const heroCopy = {
    coordinates: "HO CHI MINH CITY · 10.78° N, 106.70° E",
    tagline:
        "Cloud Solutions Architect and AI engineer. I design cloud systems and build multi-agent AI.",
};

// Short About copy for the journey; the long form lives in personal-data.js.
export const aboutShort = [
    "I'm a software engineer who builds AI-native systems. In about six months I went from entry level to shipping multi-agent architectures on AWS, including a 67% cut in inference cost.",
    "Next: scene understanding for autonomous driving and efficient deep learning at the edge.",
];

// Project highlights for the planet flyby, most recent first, in the order the
// planets are passed.
// `projectId` refers to utils/data/projects-data.js; the remaining projects
// appear in the "More" drawer and on the plain page.
export const flybyProjects = [
    {
        planet: "Moon",
        projectId: 1,
        title: "Katalon AI Platform",
        blurb: "Multi-agent orchestration, RAG and LLM test automation: FastAPI services over A2A and MCP.",
    },
    {
        planet: "Mars",
        projectId: 2,
        title: "PhD.Hub",
        blurb: "Tech leader for a non-profit study-abroad community of about 140K members.",
    },
    {
        planet: "Jupiter",
        projectId: 3,
        title: "Scout",
        blurb: "An AI-native testing app for apps made with AI builders. 20+ production releases through GitOps.",
    },
    {
        planet: "Saturn",
        projectId: 4,
        title: "Auto Audit by AI",
        blurb: "PCI DSS and ISO 27001 audit automation. VPBank Hackathon 2025 finalist.",
    },
];

// Third-party imagery used by the scenes; shown in the footer credits.
export const imageCredits = [
    {
        label: "Planet textures: Solar System Scope (CC BY 4.0)",
        href: "https://www.solarsystemscope.com/textures/",
    },
    {
        label: "Map data © OpenStreetMap contributors",
        href: "https://www.openstreetmap.org/copyright",
    },
];
