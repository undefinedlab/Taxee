"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadAgent } from "@/lib/agent-store";
import { landingNavLinks } from "@/components/landing/nav-links";

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="14"
      viewBox="0 0 18 14"
      fill="currentColor"
      aria-hidden
    >
      <rect width="18" height="2" rx="1" />
      <rect y="6" width="18" height="2" rx="1" />
      <rect y="12" width="18" height="2" rx="1" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <circle cx="10" cy="7" r="3.5" fill="currentColor" />
      <path
        d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HeroProfileMenu() {
  const [open, setOpen] = useState(false);
  const [hasAgent, setHasAgent] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [initials, setInitials] = useState("?");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const agent = loadAgent();
    if (agent) {
      setHasAgent(true);
      setAgentId(agent.id);
      const addr = agent.wallets[0]?.address;
      setInitials(addr ? addr.slice(2, 4).toUpperCase() : "TX");
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const showProfile = open || hasAgent;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`hero-menu-profile-btn relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden transition-all duration-300 ease-out ${
          showProfile
            ? "rounded-full bg-gradient-to-br from-landing-active to-landing-active-deep ring-2 ring-white shadow-md"
            : "landing-glass-btn"
        }`}
        aria-label={open ? "Close profile menu" : "Open menu"}
        aria-expanded={open}
      >
        <span
          className={`absolute inset-0 flex items-center justify-center text-[#111827] transition-all duration-300 dark:text-[#f9fafb] ${
            showProfile
              ? "scale-75 opacity-0 rotate-90"
              : "scale-100 opacity-100 rotate-0"
          }`}
        >
          <MenuIcon />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            showProfile
              ? "scale-100 opacity-100 rotate-0"
              : "scale-75 opacity-0 -rotate-90"
          }`}
        >
          {hasAgent ? (
            <span className="font-landing text-[11px] font-bold text-white">
              {initials}
            </span>
          ) : (
            <ProfileIcon className="text-white" />
          )}
        </span>
      </button>

      {open && (
        <div className="landing-glass-menu absolute right-0 top-[calc(100%+8px)] z-50 w-56">
          <div className="landing-glass-menu-divider border-b px-4 py-3">
            {hasAgent ? (
              <>
                <p className="font-landing text-xs font-semibold text-black">
                  Signed in
                </p>
                <p className="mt-0.5 font-landing text-[10px] text-[#9ca3af]">
                  Agent active
                </p>
              </>
            ) : (
              <>
                <p className="font-landing text-xs font-semibold text-black">
                  Account
                </p>
                <p className="mt-0.5 font-landing text-[10px] text-[#9ca3af]">
                  Log in or register your agent
                </p>
              </>
            )}
          </div>
          <div className="p-2">
            {hasAgent ? (
              <Link
                href={agentId ? `/dashboard/${agentId}` : "/dashboard"}
                className="landing-glass-menu-item block rounded-md px-3 py-2 font-landing text-sm text-black dark:text-[#f9fafb]"
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/onboarding"
                  className="landing-glass-menu-item block rounded-md px-3 py-2 font-landing text-sm font-medium text-black dark:text-[#f9fafb]"
                  onClick={() => setOpen(false)}
                >
                  Log in / Register
                </Link>
                <Link
                  href="/dashboard"
                  className="landing-glass-menu-item block rounded-md px-3 py-2 font-landing text-sm text-[#4b5563] dark:text-[#9ca3af]"
                  onClick={() => setOpen(false)}
                >
                  Demo dashboard
                </Link>
              </>
            )}
          </div>
          <div className="landing-glass-menu-divider border-t p-2">
            {landingNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="landing-glass-menu-item block rounded-md px-3 py-2 font-landing text-sm text-[#4b5563] dark:text-[#9ca3af]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
