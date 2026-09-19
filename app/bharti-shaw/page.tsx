import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bharti Shaw | Portfolio",
  description:
    "Bharti Shaw — Creative Artist and co-creator of Chowdhury Duo.",
};

const skills = [
  {
    category: "Art & Design",
    items: [
      { name: "Illustration", pct: 88 },
      { name: "Graphic Design", pct: 85 },
      { name: "Styling", pct: 90 },
    ],
  },
  {
    category: "Content Creation",
    items: [
      { name: "Storytelling", pct: 92 },
      { name: "Photography", pct: 86 },
      { name: "Social Media", pct: 88 },
    ],
  },
];

const stats = [
  { value: "50K+", label: "FOLLOWERS" },
  { value: "400+", label: "POSTS" },
  { value: "1M+", label: "LIKES" },
  { value: "3+", label: "YEARS" },
];

const tags = ["ART", "DESIGN", "LIFESTYLE", "CREATOR"];

export default function BhartiShawPage() {
  return (
    <div
      style={{
        background: "#0d0b12",
        color: "#e5e2e1",
        fontFamily: "Inter, sans-serif",
        overflowX: "hidden",
        margin: 0,
        minHeight: "100vh",
      }}
    >
      {/* Back nav */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(13,11,18,0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#bf7fff",
            textDecoration: "none",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
            letterSpacing: "0.12em",
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "18px" }}
          >
            arrow_back
          </span>
          CHOWDHURY DUO
        </Link>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.15em",
          }}
        >
          PORTFOLIO
        </span>
      </nav>

      {/* Hero */}
      <section
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(167,91,255,0.14) 0%, transparent 65%)",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "120px 24px 80px",
          textAlign: "center",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            overflow: "hidden",
            margin: "0 auto 24px",
            border: "3px solid rgba(167,91,255,0.55)",
            boxShadow: "0 0 40px rgba(167,91,255,0.35)",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg,#4b007e,#a75bff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Sora, sans-serif",
              fontSize: "52px",
              fontWeight: 800,
              color: "white",
            }}
          >
            B
          </div>
        </div>

        <span
          style={{
            display: "inline-block",
            padding: "4px 14px",
            borderRadius: "999px",
            border: "1px solid rgba(167,91,255,0.45)",
            color: "#bf7fff",
            fontSize: "11px",
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.12em",
            marginBottom: "16px",
          }}
        >
          CREATIVE ARTIST
        </span>

        <h1
          style={{
            fontFamily: "Sora, sans-serif",
            fontSize: "clamp(48px, 8vw, 96px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            margin: "0 0 8px",
            background: "linear-gradient(135deg,#a75bff,#dfb7ff,#ffffff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1.05,
          }}
        >
          Bharti
          <br />
          Shaw
        </h1>

        <p
          style={{
            fontSize: "18px",
            color: "rgba(255,255,255,0.5)",
            maxWidth: "560px",
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          Creative artist &amp; co-creator of Chowdhury Duo. Bringing colour,
          design, and heart to every frame and story.
        </p>

        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="https://www.instagram.com/chowdhury_duo"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "14px 28px",
              background: "linear-gradient(135deg,#4b007e,#a75bff)",
              color: "white",
              fontWeight: 700,
              borderRadius: "999px",
              textDecoration: "none",
              fontSize: "13px",
              letterSpacing: "0.05em",
            }}
          >
            FOLLOW ON INSTAGRAM
          </a>
          <a
            href="https://www.youtube.com/@ChowdhuryDuo"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "14px 28px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              fontWeight: 700,
              borderRadius: "999px",
              textDecoration: "none",
              fontSize: "13px",
              letterSpacing: "0.05em",
            }}
          >
            YOUTUBE CHANNEL
          </a>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "80px 24px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "20px" }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "20px",
                padding: "32px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "42px", fontWeight: 800, fontFamily: "Sora, sans-serif", color: "#bf7fff" }}>
                {s.value}
              </div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em", marginTop: "6px" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section style={{ padding: "40px 24px 80px", maxWidth: "1100px", margin: "0 auto" }}>
        <h2 style={{ fontFamily: "Sora, sans-serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, marginBottom: "48px" }}>
          Creative <span style={{ color: "#bf7fff" }}>Skills</span>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "32px" }}>
          {skills.map((group) => (
            <div
              key={group.category}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "32px" }}
            >
              <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: "18px", fontWeight: 600, marginBottom: "24px" }}>
                {group.category}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {group.items.map((skill) => (
                  <div key={skill.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                      <span>{skill.name}</span>
                      <span>{skill.pct}%</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "999px", height: "4px" }}>
                      <div style={{ background: "linear-gradient(90deg, #a75bff, #dfb7ff)", borderRadius: "999px", height: "4px", width: `${skill.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section style={{ padding: "40px 24px 120px", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "48px" }}>
          <span style={{ display: "inline-block", marginBottom: "20px", padding: "4px 14px", borderRadius: "999px", border: "1px solid rgba(167,91,255,0.45)", color: "#bf7fff", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.12em" }}>
            ABOUT ME
          </span>
          <p style={{ fontSize: "18px", lineHeight: 1.8, color: "rgba(255,255,255,0.65)", marginTop: "16px" }}>
            I&apos;m Bharti Shaw — a creative artist who brings warmth, art, and vision to everything I do. Together with Sampad Chowdhury, I&apos;m one half of{" "}
            <strong style={{ color: "#bf7fff" }}>Chowdhury Duo</strong>, where we blend lifestyle, creativity, and authentic storytelling into compelling digital content.
          </p>
          <div style={{ marginTop: "32px", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            {tags.map((tag) => (
              <span key={tag} style={{ display: "inline-block", padding: "4px 14px", borderRadius: "999px", border: "1px solid rgba(167,91,255,0.45)", color: "#bf7fff", fontSize: "11px", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.12em" }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em" }}>
          © 2024 BHARTI SHAW · CHOWDHURY DUO
        </p>
      </footer>
    </div>
  );
}
