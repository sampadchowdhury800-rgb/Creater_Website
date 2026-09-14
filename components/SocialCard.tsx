import ConnectSection from "./ConnectSection";
import Image from "next/image";

export default function SocialCard() {
  const PROFILE_FALLBACK =
    "https://lh3.googleusercontent.com/aida/ADBb0ug8sukTyt6bldpJkTqaCuhiXNt54iNffMuHceD37HnvJjukXwrUCFHDXxPTjs2X46tO6cKaVEMb9NyFG0UplHvrYPIdyhrVVgD3jYGHD02jxPJQcu7Eoa3dqqrGiGFuB5Un2BQEXX5n-oliHyFV9iY8FhnZc1zVyDEn_xLV8EhhmqJ-LadoA0n6JR85E2lEU4GODmK_-YytHZ6NQLtaVmvNwF6Y33zjeJkWIoJmL_LEpN3Ds0sjtFqzvFKWyOlEeV4hCRYTG4om";

  return (
    <section
      id="socials"
      className="py-24 bg-white/50 dark:bg-surface-container-lowest overflow-hidden"
    >
      <div className="max-w-[1440px] mx-auto px-gutter grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Profile card */}
        <div className="relative w-full max-w-md mx-auto">
          <div className="absolute -top-12 -left-12 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />
          <div className="relative bg-white/70 dark:bg-surface/40 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-3xl p-8 shadow-2xl glass-border">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-primary/20 shrink-0">
                <Image
                  alt="Sampad Chowdhury Profile"
                  className="w-full h-full object-cover"
                  src="/sampad_profile.jpg"
                  width={80}
                  height={80}
                />
              </div>
              <div>
                <a
                  className="hover:opacity-80 transition-opacity"
                  href="https://www.instagram.com/chowdhury_duo?igsh=Zm12dTViZ2VyZDNi"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <h4 className="font-headline-md text-[22px] text-on-tertiary-fixed dark:text-on-surface">
                    Sampad Chowdhury
                  </h4>
                  <p className="text-primary-fixed-dim dark:text-primary-fixed font-label-caps text-label-caps">
                    Entrepreneur / AI Automation
                  </p>
                </a>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 border border-black/5 dark:border-white/5">
                <p className="text-sm font-semibold text-on-tertiary-fixed dark:text-on-surface mb-1">
                  21yr old | Entrepreneur &amp; AI Builder
                </p>
                <p className="text-xs text-on-tertiary-fixed-variant dark:text-on-surface-variant">
                  Helping businesses automate workflows, scale faster, and save
                  time with AI
                </p>
              </div>

              <div className="bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 border border-black/5 dark:border-white/5">
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-on-tertiary-fixed-variant dark:text-on-surface-variant">
                  {[
                    "Free value-driven courses",
                    "Building smart digital businesses",
                    "Business automation solutions",
                    "Startup & business ideas",
                    "Finance management guidance",
                    "AI tools & productivity systems",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-1">
                      <span className="text-primary-fixed-dim mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-black/5 dark:bg-white/5 rounded-xl px-4 py-2 border border-black/5 dark:border-white/5">
                <p className="text-xs text-on-tertiary-fixed-variant dark:text-on-surface-variant">
                  📧{" "}
                  <span className="text-primary-fixed-dim">
                    sampadchowdhury777@gmail.com
                  </span>
                </p>
              </div>

              <a
                className="w-full py-3 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center"
                href="https://www.instagram.com/chowdhury_duo"
                target="_blank"
                rel="noopener noreferrer"
              >
                FOLLOW ON INSTAGRAM
              </a>
            </div>
          </div>
        </div>

        <ConnectSection />
      </div>
    </section>
  );
}
