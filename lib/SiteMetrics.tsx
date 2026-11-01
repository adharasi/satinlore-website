"use client";

import { useEffect } from "react";

export function measurementDisabled() {
  return navigator.doNotTrack === "1"
    || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
    || document.cookie.split(";").some(item => item.trim() === "satinlore_measurement=off");
}

/** Counts a public waitlist click, without delaying navigation or reading form fields. */
export default function SiteMetrics() {
  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let lastClick = 0;
    const count = (event: MouseEvent) => {
      if (measurementDisabled() || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[data-metric-cta]");
      if (!link || Date.now() - lastClick < 350) return;
      lastClick = Date.now();
      const surface = link.dataset.metricCta;
      const source = new URLSearchParams(window.location.search).get("utm_source") || "direct";
      void fetch("/api/metrics", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", keepalive: true,
        body: JSON.stringify({ event: "cta_click", page: "/", surface, source }),
      }).catch(() => { /* Measurement must never interrupt signup. */ });
    };
    document.addEventListener("click", count);
    return () => document.removeEventListener("click", count);
  }, []);
  return null;
}
