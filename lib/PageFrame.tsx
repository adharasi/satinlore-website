import type { ReactNode } from "react";

export default function PageFrame({ children, title }: { children: ReactNode; title: string }) {
  return <div className="page-frame">
    <header className="page-frame-header site-shell">
      <a href="/" className="page-frame-brand">satinlore<span>.</span></a>
      <a href="/#early-access" className="page-frame-cta">Early access ↗</a>
    </header>
    <main className="content-page">
      <h1>{title}</h1>{children}
    </main>
    <footer className="page-frame-footer site-shell">
      <span>© {new Date().getFullYear()} Satinlore · Adults 18+</span><a href="/privacy">Privacy</a><a href="/contact">Contact</a><a href="/">Home</a>
    </footer>
  </div>;
}
