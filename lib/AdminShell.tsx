"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import "@/app/admin/admin.css";

const sections = [
  { href: "/admin", label: "Overview", icon: "◫", detail: "Traffic & activity" },
  { href: "/admin/readers", label: "Readers", icon: "◎", detail: "Waitlist & questionnaire" },
  { href: "/admin/messages", label: "Messages", icon: "✉", detail: "Contact & privacy inbox" },
  { href: "/admin/email", label: "Email", icon: "↗", detail: "Delivery & queues" },
] as const;

export default function AdminShell({ children, active, title, description }: { children: ReactNode; active: string; title: string; description: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMode, setMobileMode] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasMobileOpen = useRef(false);
  const closeMobile = () => setMobileOpen(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width:900px)");
    const resize = () => { setMobileMode(media.matches); if (!media.matches) setMobileOpen(false); };
    resize(); media.addEventListener("change", resize);
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && mobileOpen) closeMobile(); };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); media.removeEventListener("change", resize); };
  }, [mobileOpen]);
  useEffect(() => {
    if (mobileOpen) closeButton.current?.focus();
    else if (wasMobileOpen.current) menuButton.current?.focus();
    wasMobileOpen.current = mobileOpen;
  }, [mobileOpen]);
  return <div className={`admin-app${mobileOpen ? " mobile-open" : ""}${collapsed ? " is-collapsed" : ""}`}>
    <a className="admin-skip" href="#admin-main">Skip to dashboard content</a>
    <button type="button" className="admin-backdrop" aria-label="Close navigation" onClick={closeMobile} tabIndex={mobileOpen ? 0 : -1} />
    <aside className="admin-side" id="admin-navigation" inert={mobileMode ? !mobileOpen : collapsed} aria-hidden={mobileMode ? !mobileOpen : collapsed}>
      <a className="admin-brand" href="/admin">SatinLore<span>.</span></a><p className="admin-side-label">Founder workspace</p>
      <button type="button" className="admin-mobile-close" ref={closeButton} onClick={closeMobile}>Close navigation <span aria-hidden="true">×</span></button>
      <nav aria-label="Admin sections">{sections.map(section => <a key={section.href} href={section.href} aria-current={active === section.href ? "page" : undefined} onClick={() => setMobileOpen(false)}><span className="admin-nav-icon" aria-hidden="true">{section.icon}</span><span><strong>{section.label}</strong><small>{section.detail}</small></span></a>)}</nav>
      <div className="admin-side-bottom"><span className="admin-private-dot" /> Founder access only<a href="/">View website <span aria-hidden="true">↗</span></a><a href="/privacy">Privacy notice</a></div>
    </aside>
    <div className="admin-workspace" inert={mobileMode && mobileOpen}>
      <header className="admin-topbar"><div><button type="button" className="admin-nav-toggle admin-desktop-toggle" aria-expanded={!collapsed} aria-controls="admin-navigation" onClick={() => setCollapsed(!collapsed)}>{collapsed ? "Show navigation" : "Hide navigation"}</button><button type="button" className="admin-nav-toggle admin-mobile-toggle" ref={menuButton} aria-expanded={mobileOpen} aria-controls="admin-navigation" onClick={() => setMobileOpen(!mobileOpen)}>☰ <span>Menu</span></button><span className="admin-breadcrumb">SatinLore <span aria-hidden="true">/</span> {sections.find(section => section.href === active)?.label || "Admin"}</span></div><a href="/">View website <span aria-hidden="true">↗</span></a></header>
      <main id="admin-main" className="admin-main"><div className="admin-page-heading"><p className="admin-eyebrow">Founder workspace</p><h1>{title}</h1><p>{description}</p></div>{children}</main>
      <footer className="admin-footer"><span>© {new Date().getFullYear()} SatinLore</span><span>Private workspace · Europe/London</span></footer>
    </div>
  </div>;
}
