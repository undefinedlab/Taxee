"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const BLOB_COUNT = 4;

/** Organic path: position, scale, and gradient focal point drift */
function animateBlob(el: HTMLElement, index: number) {
  const duration = 14 + index * 2.5;
  const delay = index * 1.8;

  gsap.set(el, { transformOrigin: "50% 50%", force3D: true });

  const tl = gsap.timeline({
    repeat: -1,
    yoyo: true,
    delay,
    defaults: { ease: "sine.inOut", duration: duration / 3 },
  });

  tl.to(el, {
    x: gsap.utils.random(-16, 20) + "vw",
    y: gsap.utils.random(-12, 16) + "vh",
    scale: gsap.utils.random(0.88, 1.32),
    "--focal-x": gsap.utils.random(32, 68) + "%",
    "--focal-y": gsap.utils.random(30, 70) + "%",
  })
    .to(el, {
      x: gsap.utils.random(-22, 14) + "vw",
      y: gsap.utils.random(-8, 20) + "vh",
      scale: gsap.utils.random(0.78, 1.22),
      "--focal-x": gsap.utils.random(38, 72) + "%",
      "--focal-y": gsap.utils.random(35, 65) + "%",
    })
    .to(el, {
      x: gsap.utils.random(-10, 18) + "vw",
      y: gsap.utils.random(-16, 10) + "vh",
      scale: gsap.utils.random(0.92, 1.4),
      "--focal-x": gsap.utils.random(40, 60) + "%",
      "--focal-y": gsap.utils.random(42, 58) + "%",
    });

  return tl;
}

export function LandingMorphBackground() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;

    const blobs = Array.from(
      root.querySelectorAll<HTMLElement>(".landing-morph-blob"),
    );
    const timelines = blobs.map((blob, i) => animateBlob(blob, i));

    return () => {
      timelines.forEach((tl) => tl.kill());
    };
  }, []);

  return (
    <>
      <div ref={rootRef} className="landing-morph-bg" aria-hidden>
        {Array.from({ length: BLOB_COUNT }, (_, i) => (
          <div
            key={i}
            className={`landing-morph-blob landing-morph-blob-${i + 1}`}
          />
        ))}
      </div>
      <div className="landing-marble-dots" aria-hidden />
    </>
  );
}
