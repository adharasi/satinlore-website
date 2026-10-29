import type { ReactNode } from "react";
export default function PageFrame({ children, title }: { children: ReactNode; title: string }) {
  return <div style={{ minHeight:"100vh", background:"#f7f3ec", color:"#35242b" }}>
    <header style={{maxWidth:1120,margin:"auto",padding:"26px 24px",display:"flex",justifyContent:"space-between",borderBottom:"1px solid #ddd0c6"}}>
      <a href="/" style={{fontFamily:"Georgia,serif",fontSize:30,textDecoration:"none",color:"inherit"}}>satinlore<span style={{color:"#9c6f55"}}>.</span></a>
      <a href="/#early-access" style={{alignSelf:"center",color:"#6a3047"}}>Early access ↗</a>
    </header>
    <main className="content-page" style={{maxWidth:820,margin:"auto",padding:"64px 24px 80px",lineHeight:1.7}}>
      <h1 style={{fontFamily:"Georgia,serif",fontWeight:400,fontSize:"clamp(36px,7vw,58px)",lineHeight:1.1,marginBottom:32}}>{title}</h1>{children}
    </main>
    <footer style={{maxWidth:1120,margin:"auto",padding:"24px",borderTop:"1px solid #ddd0c6",display:"flex",gap:24,flexWrap:"wrap",fontSize:13}}>
      <span>© {new Date().getFullYear()} Satinlore · Adults 18+</span><a href="/privacy">Privacy</a><a href="/contact">Contact</a><a href="/">Home</a>
    </footer>
  </div>;
}
