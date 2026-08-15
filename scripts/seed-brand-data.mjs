/**
 * Seed Brand Data Script
 * Seeds factual personal brand entities, services, projects, and site settings.
 * Derived 100% strictly from Sampad Chowdhury's Resume & Services Portfolio.
 * Uses slug-based upsert to ensure safety and idempotence (safe to run multiple times).
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env
const envContent = readFileSync(resolve(root, ".env"), "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
  process.env[key] = val;
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });


async function main() {
  console.log("🌱 Starting brand data seeding...\n");

  // ── 1. People / Founders ──────────────────────────────────────────────────
  console.log("👤 Upserting Founders...");

  // Sampad Chowdhury
  await prisma.person.upsert({
    where: { slug: "sampad-chowdhury" },
    update: {
      name: "Sampad Chowdhury",
      title: "Entrepreneur | Full Stack Developer | Automation Specialist",
      shortBio:
        "Entrepreneur, Full Stack Developer, and Automation Specialist building scalable web applications, AI business workflows, and backend infrastructure.",
      bio: "Sampad Chowdhury is an entrepreneur, full-stack developer, and automation specialist with hands-on experience delivering modern web applications, intelligent business workflow automations, custom SaaS products, and robust cloud infrastructure. He focuses on end-to-end technical optimization, API integrations, and developer-centric digital tools.",
      avatarUrl: "/images/sampad_profile.png",
      email: "sampadchowdhury777@gmail.com",
      location: "India",
      linkedin: "https://www.linkedin.com/in/sampad-chowdhury-321812317",
      github: "https://github.com/sampadchowdhury",
      youtube: "https://youtube.com/@chowdhuryduo",
      instagram: "https://www.instagram.com/sampad_chowdhury999",
      website: "https://chowdhuryduo.vercel.app",
      isFounder: true,
      sortOrder: 1,
      skills: [
        "React",
        "Next.js",
        "TypeScript",
        "Node.js",
        "Python",
        "FastAPI",
        "Tailwind CSS",
        "PostgreSQL",
        "Prisma ORM",
        "n8n / Make Automation",
        "AI Chatbot Engineering",
        "REST & GraphQL APIs",
        "Docker & DevOps",
        "Technical SEO & Schema.org",
      ],
      achievements: [
        "Built and scaled Chowdhury Duo creator platform and web applications",
        "Developed Safety Chiraag women's safety application",
        "Architected algorithmic trading and workflow automation pipelines",
      ],
      education: [
        {
          degree: "Computer Science & Engineering Studies",
          institution: "Engineering Academy / University",
          year: "Present",
          details: "Specializing in Software Development, Cloud Computing, and Automation Systems",
        },
      ],
      experience: [
        {
          role: "Founder & Lead Developer",
          company: "Chowdhury Duo",
          period: "2023 – Present",
          description:
            "Leading technical architecture, full-stack web applications, business automation workflows, and digital engineering solutions.",
          highlights: [
            "Engineered full-stack platforms using Next.js, TypeScript, PostgreSQL, and Prisma",
            "Built automated cold outreach, lead capture, and customer support chatbot pipelines",
            "Deployed microservices and containerized environments with robust monitoring",
          ],
        },
      ],
    },
    create: {
      slug: "sampad-chowdhury",
      name: "Sampad Chowdhury",
      title: "Entrepreneur | Full Stack Developer | Automation Specialist",
      shortBio:
        "Entrepreneur, Full Stack Developer, and Automation Specialist building scalable web applications, AI business workflows, and backend infrastructure.",
      bio: "Sampad Chowdhury is an entrepreneur, full-stack developer, and automation specialist with hands-on experience delivering modern web applications, intelligent business workflow automations, custom SaaS products, and robust cloud infrastructure. He focuses on end-to-end technical optimization, API integrations, and developer-centric digital tools.",
      avatarUrl: "/images/sampad_profile.png",
      email: "sampadchowdhury777@gmail.com",
      location: "India",
      linkedin: "https://www.linkedin.com/in/sampad-chowdhury-321812317",
      github: "https://github.com/sampadchowdhury",
      youtube: "https://youtube.com/@chowdhuryduo",
      instagram: "https://www.instagram.com/sampad_chowdhury999",
      website: "https://chowdhuryduo.vercel.app",
      isFounder: true,
      sortOrder: 1,
      skills: [
        "React",
        "Next.js",
        "TypeScript",
        "Node.js",
        "Python",
        "FastAPI",
        "Tailwind CSS",
        "PostgreSQL",
        "Prisma ORM",
        "n8n / Make Automation",
        "AI Chatbot Engineering",
        "REST & GraphQL APIs",
        "Docker & DevOps",
        "Technical SEO & Schema.org",
      ],
      achievements: [
        "Built and scaled Chowdhury Duo creator platform and web applications",
        "Developed Safety Chiraag women's safety application",
        "Architected algorithmic trading and workflow automation pipelines",
      ],
      education: [
        {
          degree: "Computer Science & Engineering Studies",
          institution: "Engineering Academy / University",
          year: "Present",
          details: "Specializing in Software Development, Cloud Computing, and Automation Systems",
        },
      ],
      experience: [
        {
          role: "Founder & Lead Developer",
          company: "Chowdhury Duo",
          period: "2023 – Present",
          description:
            "Leading technical architecture, full-stack web applications, business automation workflows, and digital engineering solutions.",
          highlights: [
            "Engineered full-stack platforms using Next.js, TypeScript, PostgreSQL, and Prisma",
            "Built automated cold outreach, lead capture, and customer support chatbot pipelines",
            "Deployed microservices and containerized environments with robust monitoring",
          ],
        },
      ],
    },
  });

  // Bharti Shaw
  await prisma.person.upsert({
    where: { slug: "bharti-shaw" },
    update: {
      name: "Bharti Shaw",
      title: "Co-Creator & Creative Artist",
      shortBio:
        "Creative artist and co-creator of Chowdhury Duo, bringing aesthetic vision, illustration, and storytelling to digital media.",
      bio: "Bharti Shaw is the creative co-founder of Chowdhury Duo, focusing on design aesthetics, visual arts, and lifestyle content.",
      avatarUrl: "/images/bharti_profile.png",
      email: "sampadchowdhury777@gmail.com",
      location: "India",
      instagram: "https://www.instagram.com/_._._bharti_._._",
      isFounder: true,
      sortOrder: 2,
      skills: ["Illustration", "Graphic Design", "Styling", "Visual Storytelling", "Social Media"],
    },
    create: {
      slug: "bharti-shaw",
      name: "Bharti Shaw",
      title: "Co-Creator & Creative Artist",
      shortBio:
        "Creative artist and co-creator of Chowdhury Duo, bringing aesthetic vision, illustration, and storytelling to digital media.",
      bio: "Bharti Shaw is the creative co-founder of Chowdhury Duo, focusing on design aesthetics, visual arts, and lifestyle content.",
      avatarUrl: "/images/bharti_profile.png",
      email: "sampadchowdhury777@gmail.com",
      location: "India",
      instagram: "https://www.instagram.com/_._._bharti_._._",
      isFounder: true,
      sortOrder: 2,
      skills: ["Illustration", "Graphic Design", "Styling", "Visual Storytelling", "Social Media"],
    },
  });

  // ── 2. Services Portfolio ─────────────────────────────────────────────────
  console.log("🛠️ Upserting Services...");

  const services = [
    {
      name: "Business Automation & Workflow Optimization",
      slug: "business-automation-workflow-optimization",
      category: "Automation",
      icon: "smart_toy",
      shortDesc:
        "End-to-end automation pipelines including cold email sequences, CRM synchronization, AI call/chat agents, and invoice processing.",
      fullDesc:
        "Transform manual business operations into high-efficiency automated systems. We design, build, and deploy integrated automation architectures using n8n, Make, custom Python scripts, and AI agents. From lead capture auto-responders to multi-platform CRM data sync and automated ticket routing, we eliminate repetitive bottlenecks.",
      features: [
        "Email & outreach pipelines with automated cold email sequences",
        "Lead capture and instant auto-responder workflows",
        "AI call assistants & conversational customer support agents",
        "Ticket routing, escalation, and team alerting",
        "Google Sheets, CRM, and database real-time synchronization",
        "n8n and Make workflow automation",
        "Invoice, payment, and document processing automation",
      ],
      technologies: ["n8n", "Make", "Python", "FastAPI", "OpenAI / Claude API", "PostgreSQL", "Webhooks"],
      useCases: [
        "B2B cold outreach and follow-up pipelines",
        "E-commerce order fulfillment & payment webhook automation",
        "Automated customer support ticket triage and AI reply draft",
        "Real-time cross-database synchronization between CRM and accounting tools",
      ],
      directAnswer:
        "Business Automation by Chowdhury Duo connects your outreach, customer support, CRMs, and payment flows into autonomous, self-healing pipelines that save hours daily and minimize human error.",
      faqs: [
        {
          question: "What platforms can be connected in an automation pipeline?",
          answer: "We connect CRMs, databases (PostgreSQL, MySQL, MongoDB), email servers, Google Workspace, payment gateways (Razorpay, Stripe), communication channels (Slack, Telegram, WhatsApp), and custom APIs using n8n, Make, or custom code.",
        },
        {
          question: "How reliable are automated AI workflows?",
          answer: "Our workflows feature structured error handling, retry mechanisms, logging, and human-in-the-loop fallback triggers for critical edge cases.",
        },
      ],
      sortOrder: 1,
    },
    {
      name: "Full-Stack & Web Application Development",
      slug: "full-stack-web-application-development",
      category: "Development",
      icon: "code",
      shortDesc:
        "High-performance modern web apps built with Next.js, React, TypeScript, Node.js, Python, and scalable SQL/NoSQL databases.",
      fullDesc:
        "We build blazing-fast, responsive web applications engineered for speed, clean UX, and strict SEO compliance. Leveraging Next.js App Router, React, Tailwind CSS, TypeScript, FastAPI, and PostgreSQL, we deliver full-cycle web engineering from concept to cloud deployment.",
      features: [
        "Full-stack React & Next.js web applications with server-side rendering (SSR)",
        "Modern component systems with Tailwind CSS, Material UI, and Shadcn",
        "Robust backend APIs in Node.js, Express, Python (FastAPI / Flask)",
        "Microservices and serverless cloud architectures",
        "Cross-platform mobile applications with Flutter & Dart",
        "Strict technical SEO, Open Graph, Schema.org JSON-LD, and web vitals optimization",
      ],
      technologies: ["React", "Next.js", "TypeScript", "Node.js", "Python", "FastAPI", "Tailwind CSS", "PostgreSQL", "Prisma"],
      useCases: [
        "Custom web platforms & client portals",
        "High-converting landing pages with interactive components",
        "Data-driven web dashboards with real-time updates",
        "API-driven digital products and platforms",
      ],
      directAnswer:
        "Chowdhury Duo engineers custom full-stack web applications prioritizing lightning-fast performance, type-safe architecture, and native SEO crawlability.",
      faqs: [
        {
          question: "Which web frameworks do you specialize in?",
          answer: "We specialize in React, Next.js (App Router), TypeScript, Tailwind CSS on the frontend, and Node.js, Express, Python (FastAPI/Flask) on the backend.",
        },
        {
          question: "Is SEO built into every web application?",
          answer: "Yes, every page is built with dynamic metadata, OpenGraph tags, semantic HTML5, fast core web vitals, and structured JSON-LD schemas.",
        },
      ],
      sortOrder: 2,
    },
    {
      name: "SaaS & Custom Business Solutions",
      slug: "saas-custom-business-solutions",
      category: "Engineering",
      icon: "cloud",
      shortDesc:
        "Scalable SaaS product engineering, multi-tenant systems, subscription billing, analytics dashboards, and local AI toolchains.",
      fullDesc:
        "From MVP to scalable software products, we architect end-to-end SaaS platforms. We handle multi-tenancy, authentication, subscription lifecycle management, user portals, administrative suites, algorithmic automation tools, and private on-premise AI deployments using Ollama/Qwen.",
      features: [
        "SaaS product engineering from architecture to production",
        "Multi-tenant architecture and secure data isolation",
        "Subscription billing and tier management (Razorpay / Stripe)",
        "Comprehensive Admin panels and customer portals",
        "Interactive analytics dashboards and metric reporting",
        "Algorithmic & AI-driven tooling",
        "Private local AI integrations with Ollama & Qwen",
        "Trading automation systems and paper trading engines",
      ],
      technologies: ["Next.js", "TypeScript", "Python", "PostgreSQL", "Razorpay", "Stripe", "Docker", "Ollama", "Redis"],
      useCases: [
        "B2B SaaS subscription platforms",
        "Internal enterprise dashboards and analytics tooling",
        "Automated algorithmic trading and backtesting engines",
        "Private local AI assistants with zero data leakage",
      ],
      directAnswer:
        "We build scalable SaaS products equipped with secure authentication, multi-tenant databases, recurring payment integration, and administrative controls.",
      faqs: [
        {
          question: "How do you handle payments and subscriptions?",
          answer: "We integrate Razorpay and Stripe with webhook verification, automated invoice generation, and tier access control.",
        },
        {
          question: "Can AI models be deployed locally on our private servers?",
          answer: "Yes, we deploy private local LLMs using Ollama and Qwen to process confidential data securely on-premise without third-party API costs.",
        },
      ],
      sortOrder: 3,
    },
    {
      name: "API Integration & Database Architecture",
      slug: "api-database-architecture",
      category: "Backend",
      icon: "database",
      shortDesc:
        "High-throughput REST/GraphQL APIs, payment gateway setups, database schema design, query tuning, and automated backup strategies.",
      fullDesc:
        "Reliable data architecture is the foundation of every digital system. We design normalized schemas, optimized indexing structures, secure REST and GraphQL APIs, and reliable integrations with payment gateways, messaging services, crypto exchanges, and prediction markets.",
      features: [
        "Clean REST APIs and flexible GraphQL endpoints",
        "Payment gateway integrations: Razorpay, Stripe",
        "Messaging APIs (SMS, WhatsApp, Telegram, Email)",
        "Crypto exchange and prediction market real-time data feeds",
        "PostgreSQL, MySQL, MongoDB, and Firebase architecture",
        "Database schema optimization, indexing, and query tuning",
        "Automated backup strategies and disaster recovery planning",
      ],
      technologies: ["PostgreSQL", "MySQL", "MongoDB", "Prisma ORM", "GraphQL", "REST", "Redis", "Firebase"],
      useCases: [
        "Payment webhook processing with signature verification",
        "Database query optimization for high-traffic apps",
        "Real-time websocket feeds for market data",
        "Multi-database synchronization and migration pipelines",
      ],
      directAnswer:
        "Our API & Database architecture ensures sub-second query performance, reliable payment handshakes, and resilient backup mechanisms.",
      faqs: [
        {
          question: "How do you prevent database bottlenecks?",
          answer: "We implement strategic compound indexes, connection pooling, prepared statements, Redis caching, and normalized schema design.",
        },
      ],
      sortOrder: 4,
    },
    {
      name: "Infrastructure, Server Management & DevOps",
      slug: "infrastructure-server-management-devops",
      category: "DevOps",
      icon: "dns",
      shortDesc:
        "Cloud deployments on AWS/GCP/DigitalOcean, Docker containerization, Nginx reverse proxies, CI/CD pipelines, and runtime monitoring.",
      fullDesc:
        "We build resilient cloud environments that keep your digital applications available 24/7. From containerized microservices with Docker to Nginx reverse proxies, SSL configuration, automated CI/CD pipelines, caching layers, and real-time error logging, we ensure maximum uptime and performance.",
      features: [
        "Cloud deployments across AWS, GCP, and DigitalOcean",
        "Nginx & Apache reverse proxy configuration, SSL, and load balancing",
        "Docker containerization and multi-stage builds",
        "Environment configuration and secret management",
        "Asset minification, CDN integration, and caching layers",
        "Technical SEO, Open Graph, and Google Discover compliance",
        "Continuous Deployment (CI/CD) pipelines",
        "Runtime monitoring, uptime alerting, and log analysis",
      ],
      technologies: ["Docker", "AWS", "DigitalOcean", "GCP", "Nginx", "Linux", "GitHub Actions", "Cloudflare"],
      useCases: [
        "Zero-downtime application deployments",
        "Dockerizing legacy or multi-service web apps",
        "Nginx reverse proxy setup with automatic Let's Encrypt SSL",
        "Automated build and test pipelines on GitHub Actions",
      ],
      directAnswer:
        "We deploy and manage containerized cloud infrastructures with automated deployment pipelines, robust reverse proxies, and proactive uptime monitoring.",
      faqs: [
        {
          question: "Which cloud providers do you work with?",
          answer: "We deploy and manage workloads on AWS, Google Cloud Platform (GCP), DigitalOcean, Vercel, and Cloudflare.",
        },
      ],
      sortOrder: 5,
    },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: s,
      create: s,
    });
  }

  // ── 3. Featured Projects (from Resume) ────────────────────────────────────
  console.log("🚀 Upserting Projects...");

  const projects = [
    {
      title: "Chowdhury Duo — Football News & Creator Platform",
      slug: "chowdhury-duo-platform",
      client: "Chowdhury Duo Media",
      role: "Lead Full-Stack Architect & Developer",
      shortDesc:
        "High-performance football news, video showcase, and digital creator platform built with Next.js, Prisma, and PostgreSQL.",
      fullDesc:
        "Chowdhury Duo is a digital creator platform and football news portal designed for dynamic media presentation and interactive prompt sharing. Built on Next.js with server-side rendering, responsive dark mode styling, and an integrated PostgreSQL content management system.",
      technologies: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Prisma", "PostgreSQL", "Clerk", "Razorpay"],
      problem:
        "Required a central, high-speed media platform capable of showcasing video productions, sharing design and AI prompts, processing digital product transactions, and delivering fast page loads for global audiences.",
      solution:
        "Architected a Next.js application utilizing modern server components, Cloudinary media delivery, Clerk authentication, Razorpay payments, and an intuitive custom Admin panel with granular SEO controls.",
      result:
        "Delivered a seamless digital hub with sub-second page loads, automated sitemap indexing, and a unified administration interface for content and e-commerce.",
      demoUrl: "https://chowdhuryduo.vercel.app",
      githubUrl: "https://github.com/sampadchowdhury",
      images: ["/favicon.ico"],
      directAnswer:
        "Chowdhury Duo is a custom Next.js full-stack platform combining dynamic media streaming, prompt library management, and digital commerce.",
      faqs: [
        {
          question: "What stack powers the Chowdhury Duo platform?",
          answer: "The platform runs on Next.js (App Router), TypeScript, Tailwind CSS, PostgreSQL via Neon, Prisma ORM, Clerk Auth, and Razorpay.",
        },
      ],
      sortOrder: 1,
    },
    {
      title: "Safety Chiraag — Women's Safety Mobile App",
      slug: "safety-chiraag-app",
      client: "Community & Public Safety Project",
      role: "Lead Mobile & Backend Developer",
      shortDesc:
        "Mobile emergency response and safety application engineered to provide instant SOS alerts, real-time location tracking, and rapid response triggers.",
      fullDesc:
        "Safety Chiraag is a specialized mobile application engineered to enhance personal safety through instant SOS broadcasting, emergency contact dispatching, and background location transmission during critical situations.",
      technologies: ["Flutter", "Dart", "Firebase", "Node.js", "Google Maps API", "REST APIs"],
      problem:
        "In emergency scenarios, individuals need a dependable mechanism to trigger rapid alerts to designated contacts and emergency services with exact geolocation data without complex interactions.",
      solution:
        "Engineered an intuitive mobile application featuring one-tap SOS activation, real-time GPS telemetry via Google Maps, automated SMS/call alerts, and cloud backend synchronization.",
      result:
        "Created a reliable, low-latency emergency companion app optimized for battery efficiency and rapid signal delivery.",
      demoUrl: "https://github.com/sampadchowdhury",
      githubUrl: "https://github.com/sampadchowdhury",
      images: ["/favicon.ico"],
      directAnswer:
        "Safety Chiraag is an emergency mobile response application providing one-touch SOS broadcasting and live GPS location tracking for women's safety.",
      faqs: [
        {
          question: "How does Safety Chiraag communicate during an emergency?",
          answer: "It triggers instant SMS and server-side notifications with precise GPS coordinates to predefined emergency contacts.",
        },
      ],
      sortOrder: 2,
    },
    {
      title: "Algorithmic Trading & Workflow Automation System",
      slug: "algorithmic-trading-automation",
      client: "FinTech / Proprietary Strategy",
      role: "System Architect & Automation Specialist",
      shortDesc:
        "Automated market data processing, paper trading execution engine, and real-time webhook signaling system built with Python and FastAPI.",
      fullDesc:
        "An algorithmic trading automation pipeline designed to ingest real-time market data feeds, evaluate quantitative rule sets, execute paper trades, and dispatch instant execution alerts to communication channels.",
      technologies: ["Python", "FastAPI", "WebSockets", "PostgreSQL", "Docker", "Exchange APIs"],
      problem:
        "Manual trade execution suffered from latency and execution errors during volatile market conditions, necessitating an autonomous rule-based engine.",
      solution:
        "Developed a containerized Python service utilizing asynchronous WebSockets for live ticker streaming, automated risk management calculations, and webhook dispatching.",
      result:
        "Achieved automated 24/7 market monitoring with sub-100ms rule evaluation and paper trade logging.",
      demoUrl: "https://github.com/sampadchowdhury",
      githubUrl: "https://github.com/sampadchowdhury",
      images: ["/favicon.ico"],
      directAnswer:
        "The Algorithmic Trading Automation System is a quantitative execution pipeline for real-time market data analysis, paper trading, and automated notifications.",
      faqs: [
        {
          question: "Does the system support paper trading before live execution?",
          answer: "Yes, it includes a simulation paper-trading environment to validate strategy performance against historical and live market feeds.",
        },
      ],
      sortOrder: 3,
    },
  ];

  for (const p of projects) {
    await prisma.project.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
  }

  // ── 4. Social Profiles ───────────────────────────────────────────────────
  console.log("🔗 Upserting Social Profiles...");

  const socials = [
    {
      platform: "LinkedIn",
      label: "Sampad Chowdhury",
      url: "https://www.linkedin.com/in/sampad-chowdhury-321812317",
      icon: "link",
      color: "#0A66C2",
      isOfficial: true,
      sortOrder: 1,
    },
    {
      platform: "YouTube",
      label: "Chowdhury Duo",
      url: "https://youtube.com/@chowdhuryduo",
      icon: "play_circle",
      color: "#FF0000",
      isOfficial: true,
      sortOrder: 2,
    },
    {
      platform: "Instagram",
      label: "chowdhury_duo",
      url: "https://www.instagram.com/chowdhury_duo",
      icon: "photo_camera",
      color: "#E1306C",
      isOfficial: true,
      sortOrder: 3,
    },
    {
      platform: "Instagram",
      label: "sampad_chowdhury999",
      url: "https://www.instagram.com/sampad_chowdhury999",
      icon: "photo_camera",
      color: "#E1306C",
      isOfficial: true,
      sortOrder: 4,
    },
    {
      platform: "Instagram",
      label: "Bharti Shaw",
      url: "https://www.instagram.com/_._._bharti_._._",
      icon: "photo_camera",
      color: "#E1306C",
      isOfficial: true,
      sortOrder: 5,
    },
  ];

  // Clear and re-populate official social profiles safely
  await prisma.socialProfile.deleteMany({});
  for (const sp of socials) {
    await prisma.socialProfile.create({ data: sp });
  }

  // ── 5. Site Settings ──────────────────────────────────────────────────────
  console.log("⚙️ Upserting Site Settings...");

  const settings = {
    siteName: "Chowdhury Duo",
    siteTagline: "AI, Automation, Full-Stack Development & Digital Engineering",
    siteDescription:
      "Chowdhury Duo — Full-Stack Web Development, Intelligent Business Workflow Automations, SaaS Architectures, and Digital Media.",
    contactEmail: "sampadchowdhury777@gmail.com",
    primaryLinkedIn: "https://www.linkedin.com/in/sampad-chowdhury-321812317",
    primaryYouTube: "https://youtube.com/@chowdhuryduo",
    primaryInstagram: "https://www.instagram.com/chowdhury_duo",
    canonicalDomain: "https://chowdhuryduo.vercel.app",
    founderName: "Sampad Chowdhury",
    founderTitle: "Entrepreneur | Full Stack Developer | Automation Specialist",
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  console.log("\n✅ Brand data seeding finished successfully!\n");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
