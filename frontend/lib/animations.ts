// Animation utilities and configurations
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Easing functions
export const easings = {
  smooth: "power2.out",
  bounce: "back.out(1.7)",
  elastic: "elastic.out(1, 0.5)",
  snappy: "power3.out",
  gentle: "power1.out",
};

// Duration constants (in seconds)
export const durations = {
  fast: 0.3,
  normal: 0.6,
  slow: 0.8,
  xslow: 1.2,
};

// Stagger configuration
export const staggerConfig = {
  default: {
    each: 0.1,
    from: "start",
  },
  cards: {
    each: 0.15,
    from: "start",
  },
  text: {
    each: 0.05,
    from: "start",
  },
};

// ScrollTrigger defaults
export const scrollTriggerDefaults = {
  start: "top 80%",
  end: "bottom 20%",
  toggleActions: "play none none reverse",
};

// Animation presets
export const animations = {
  // Fade up from below
  fadeUp: (element: string | Element, delay = 0) => ({
    from: { opacity: 0, y: 30 },
    to: { opacity: 1, y: 0, duration: durations.normal, ease: easings.smooth, delay },
  }),

  // Fade in
  fadeIn: (element: string | Element, delay = 0) => ({
    from: { opacity: 0 },
    to: { opacity: 1, duration: durations.fast, ease: easings.gentle, delay },
  }),

  // Scale up
  scaleUp: (element: string | Element, delay = 0) => ({
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1, duration: durations.normal, ease: easings.bounce, delay },
  }),

  // Slide from side
  slideFromRight: (element: string | Element, delay = 0) => ({
    from: { opacity: 0, x: 100 },
    to: { opacity: 1, x: 0, duration: durations.slow, ease: easings.smooth, delay },
  }),

  slideFromLeft: (element: string | Element, delay = 0) => ({
    from: { opacity: 0, x: -100 },
    to: { opacity: 1, x: 0, duration: durations.slow, ease: easings.smooth, delay },
  }),

  // Number counting
  countUp: (element: string | Element, targetValue: number, duration = durations.slow) => ({
    from: { innerText: 0 },
    to: {
      innerText: targetValue,
      duration,
      ease: easings.smooth,
      snap: { innerText: 1 },
    },
  }),

  // Card lift on hover
  cardLift: {
    hover: { y: -8, scale: 1.02, duration: durations.fast, ease: easings.bounce },
    leave: { y: 0, scale: 1, duration: durations.fast, ease: easings.smooth },
  },

  // Timeline fill
  timelineFill: (progress: number) => ({
    height: `${progress}%`,
    duration: durations.fast,
    ease: easings.smooth,
  }),
};

// Horizontal scroll utility
export const createHorizontalScroll = (
  container: HTMLElement,
  track: HTMLElement,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sectionCount: number
) => {
  const totalWidth = track.scrollWidth;
  const containerWidth = container.offsetWidth;

  return gsap.to(track, {
    x: () => -(totalWidth - containerWidth),
    ease: "none",
    scrollTrigger: {
      trigger: container,
      pin: true,
      scrub: 1,
      end: () => `+=${totalWidth}`,
    },
  });
};

// Sticky section utility
export const createStickySection = (
  element: HTMLElement,
  start: string,
  end: string
) => {
  return ScrollTrigger.create({
    trigger: element,
    start,
    end,
    pin: true,
    pinSpacing: true,
  });
};

// Kill all ScrollTriggers (cleanup)
export const cleanupScrollTriggers = () => {
  ScrollTrigger.getAll().forEach(trigger => trigger.kill());
};

// Refresh ScrollTrigger (on resize)
export const refreshScrollTrigger = () => {
  ScrollTrigger.refresh();
};
