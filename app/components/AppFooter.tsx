"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RadioTower } from "lucide-react";
import type { Route } from "next";

const footerLinks: Array<{ href: Route; label: string }> = [
  { href: "/generation", label: "Generation" },
  { href: "/leaderboard", label: "Leaderboard" }
];

export function AppFooter() {
  const pathname = usePathname();

  if (pathname === "/generation" || pathname.startsWith("/generation/")) {
    return null;
  }

  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-brand-panel">
          <Link className="footer-brand" href="/generation">
            <span>ia</span>
            <strong>imagent</strong>
          </Link>
          <p>Image generation arena and miner leaderboard made by Gittensor subnet 74.</p>
        </div>

        <nav className="footer-links" aria-label="Footer navigation">
          {footerLinks.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>

        <div className="footer-bottom">
          <span><RadioTower size={13} /> Gittensor subnet 74</span>
          <span>generation · benchmark · merged PR proof</span>
        </div>
      </div>
    </footer>
  );
}
