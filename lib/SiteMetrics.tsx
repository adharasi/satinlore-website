"use client";

import { useEffect } from "react";
import {browserPrivacySignalOff, COOKIE_CHOICE_SYNC_EVENT, cookieCategoryAllowed} from "@/lib/cookie-consent.mjs";
import {metricReferrer, metricSource} from "@/lib/site-analytics";
import {PRIVACY_EVENT} from "@/lib/experience-client";

let measurementBlockedForPage = false;
export function setPageAnalyticsAllowed(allowed: boolean) { measurementBlockedForPage = !allowed; }

export function measurementDisabled() {
  return measurementBlockedForPage || browserPrivacySignalOff(navigator) || !cookieCategoryAllowed(document.cookie, "analytics");
}

/** Counts a public waitlist click, without delaying navigation or reading form fields. */
export default function SiteMetrics() {
  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let lastClick = 0;
    // A granted choice on the initial GET is counted by the edge. A first grant
    // on this page needs one post-consent view; never count it again on toggles.
    let viewCounted = cookieCategoryAllowed(document.cookie, "analytics") && !browserPrivacySignalOff(navigator);
    const source = () => metricSource(new URLSearchParams(window.location.search).get("utm_source") || "direct");
    const consentedView = () => {
      if (viewCounted || measurementDisabled() || window.location.pathname !== "/") return;
      viewCounted = true;
      void fetch("/api/metrics", {
        method: "POST", headers: {"Content-Type": "application/json"}, credentials: "same-origin", keepalive: true,
        body: JSON.stringify({event: "consent_page_view", page: "/", source: source(), referrer: metricReferrer(document.referrer || null)}),
      }).catch(() => { /* Optional counts do not retry or delay public use. */ });
    };
    const count = (event: MouseEvent) => {
      if (measurementDisabled() || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[data-metric-cta]");
      if (!link || Date.now() - lastClick < 350) return;
      lastClick = Date.now();
      const surface = link.dataset.metricCta;
      void fetch("/api/metrics", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", keepalive: true,
        body: JSON.stringify({ event: "cta_click", page: "/", surface, source: source() }),
      }).catch(() => { /* Measurement must never interrupt signup. */ });
    };
    document.addEventListener("click", count);
    window.addEventListener(PRIVACY_EVENT, consentedView);
    window.addEventListener(COOKIE_CHOICE_SYNC_EVENT, consentedView);
    return () => { document.removeEventListener("click", count); window.removeEventListener(PRIVACY_EVENT, consentedView); window.removeEventListener(COOKIE_CHOICE_SYNC_EVENT, consentedView); };
  }, []);
  return null;
}
