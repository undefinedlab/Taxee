import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logoPath = join(process.cwd(), "public", "logo-mark.png");
  const logoBuffer = await readFile(logoPath);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(165deg, #141414 0%, #0a0a0a 45%, #000000 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 64px",
            borderRadius: 32,
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" width={120} height={120} />
          <div
            style={{
              marginTop: 28,
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#f9fafb",
            }}
          >
            {siteConfig.name}
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 28,
              fontWeight: 500,
              color: "rgba(249,250,251,0.72)",
              textAlign: "center",
              maxWidth: 720,
              lineHeight: 1.35,
            }}
          >
            {siteConfig.tagline}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
