"use client";

import { useEffect, useRef, useState } from "react";
import WaitlistForm from "@/lib/WaitlistForm";
import SiteMetrics from "@/lib/SiteMetrics";
import "./landing.css";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [atForm, setAtForm] = useState(false);
  const formCard = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const card = formCard.current;
    if (!card) return;
    const observer = new IntersectionObserver(entries => setAtForm(entries[0].isIntersecting), { threshold: .05 });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return <div className="landing-page"><SiteMetrics />

<a className="skip-link" href="#main">Skip to content</a>

<header className="header"><div className="shell header-inner">
<a className="wordmark" href="#top" aria-label="SatinLore home">SatinLore<span>.</span></a>
<nav id="nav" aria-label="Main navigation" className={menuOpen ? "is-open" : undefined} onClick={() => setMenuOpen(false)}><a href="#experience">The experience</a><a href="#beta">Beta programme</a><a href="#questions">FAQs</a></nav>
<a className="button header-cta" data-metric-cta="header" href="#waitlist">Get paid as a beta tester <span aria-hidden="true">↗</span></a>
<button type="button" className="menu-toggle" aria-expanded={menuOpen} aria-controls="nav" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen(!menuOpen)}><span></span><span></span></button>
</div></header>
<main id="main">
<section className="hero shell" id="top">
<div className="hero-copy"><p className="eyebrow"><span className="dot"></span> Erotica reader + connected sex toys</p>
<h1>Read the story.<br />Feel <em>every turn.</em></h1>
<p className="hero-body">Upload your story. SatinLore analyses it automatically, then changes the intensity and rhythm of your compatible sex toy as you read.</p>
<div className="status-line"><span>Coming soon</span><span>Adults 18+</span></div>
<div className="cta-pair"><a data-metric-cta="hero" className="button" href="#waitlist">Get paid as a beta tester <span aria-hidden="true">↗</span></a><a className="secondary-link" data-metric-cta="hero" href="#waitlist">Or get free early access <span aria-hidden="true">→</span></a></div>
<p className="qualification">Join the waitlist. Selected readers may receive free early access or earn <strong>up to US$500 in total</strong> for agreed test tasks.</p>
<a className="see-link" href="#experience"><span className="play-mark" aria-hidden="true">↓</span> See how your story becomes a feeling</a>
</div>
<figure className="hero-art panel-figure"><img src="/images/landing/analysis.webp?v=20261101" alt="A story on a phone with highlighted passages linked to different vibration patterns beneath a plum connected device." width="1122" height="1402" fetchPriority="high" /></figure>
</section>
<section className="steps-band" aria-label="How SatinLore works"><div className="shell steps">
<article><span>01</span><div><h2>Upload your story.</h2><p>Automatic analysis prepares the changing intensity and rhythm for you.</p></div></article>
<article><span>02</span><div><h2>Connect your toy.</h2><p>Connect a compatible device and confirm the experience you want.</p></div></article>
<article><span>03</span><div><h2>Read. Feel it follow.</h2><p>The pattern changes with the scene and your reading pace.</p></div></article>
</div></section>
<section id="experience" className="story-section shell rhythm-section">
<figure className="panel-figure"><img loading="lazy" src="/images/landing/rhythms.webp?v=20261101" alt="A reading scene and device illustrated with sharp bursts, a flat pause, low pulses and a fresh surge." width="1122" height="1402" /></figure>
<div className="story-copy"><p className="eyebrow">Scene-aware experiences</p><h2>Feel every turn<br />in the <em>scene.</em></h2>
<p>SatinLore reads the mood, pacing and shifts within each scene, weaving sustained intensity, sharp peaks and sudden drops into a changing experience that feels part of the story.</p>
<div className="feature-inset"><p className="mini-label">Rhythm with real variety</p><h3>Spikes. Stillness.<br />A new rhythm.</h3><p>Rapid pulses break into flatlines. Low, lingering rhythms give way to fresh bursts. Even an intense scene can change pace, using interruptions and contrast to make the next surge feel different.</p></div>
</div></section>
<section className="reading-band"><div className="story-section shell reverse">
<div className="story-copy"><p className="eyebrow">Sync that reads with you</p><h2>In step with<br /><em>every passage.</em></h2>
<p>Your pace, scrolls and time on the page help SatinLore follow your place within the text. Linger over a passage or read without scrolling: the feeling keeps pace.</p>
<div className="reading-cues" aria-label="Reading cues"><span>Your pace</span><span>Your scrolling</span><span>Time on the page</span></div>
<p className="small-copy">Your story sets the scene. The way you read sets the timing.</p>
</div>
<figure className="panel-figure"><img loading="lazy" src="/images/landing/reading.webp?v=20261101" alt="Two reading views, including a still page, paired with a device and a changing response line." width="1122" height="1402" /></figure>
</div></section>
<section className="story-section shell control-section">
<figure className="panel-figure"><img loading="lazy" src="/images/landing/controls.webp?v=20261101" alt="A reading phone and device with illustrative intensity, pause and stop controls and two different rhythm patterns." width="1122" height="1402" /></figure>
<div className="story-copy"><p className="eyebrow">Your story. Your experience.</p><h2>Make the feeling<br /><em>your own.</em></h2>
<p>Feel the build-up, the sudden shifts and the next surge as if you were in the scene. Shape the intensity to suit you while the story keeps the rhythm moving.</p>
<div className="control-tags"><span>Intensity</span><span>Rhythm</span><span>Maximum strength</span><span>Pause & stop</span></div>
<a className="text-cta" data-metric-cta="controls" href="#waitlist">Help us shape the experience <span aria-hidden="true">→</span></a>
</div></section>
<section id="beta" className="beta-section"><div className="shell beta-inner">
<div className="beta-copy"><p className="eyebrow">Refined through beta testing</p><h2>Fine-tuned for<br /><em>maximum pleasure.</em></h2>
<p className="beta-intro">Hundreds to thousands of beta testers will help refine intensity, rhythm and interruptions through real reading sessions, shaping an experience built around what feels best.</p>
<div className="opportunities"><article><span className="opportunity-number">01</span><h3>Get paid to test.</h3><p>Selected testers can earn up to <strong>US$500 in total</strong> for agreed test tasks they complete.</p></article><article><span className="opportunity-number">02</span><h3>Try it early, free.</h3><p>Selected readers may get free early access and help shape what comes next.</p></article></div>
<a className="button light-button" data-metric-cta="beta" href="#waitlist">Get paid as a beta tester <span aria-hidden="true">↗</span></a>
<p className="beta-fineprint">Free to join. Selection is limited. Payment is for completed tasks and honest feedback.</p>
</div>
<a className="invitation-art panel-figure" data-metric-cta="beta" href="#waitlist" aria-label="Join the waitlist for paid testing or free early access"><img loading="lazy" src="/images/landing/beta.webp?v=20261101" alt="A reader, a phone and a device, with an invitation to help shape the experience and apply for paid beta testing." width="1122" height="1402" /></a>
</div></section>

<section className="signup-section" id="waitlist"><span id="early-access" className="legacy-anchor" aria-hidden="true"></span><div className="shell signup-inner"><div className="signup-copy"><p className="eyebrow">Your invitation to the beta</p><h2>Be one of the<br /><em>first to feel it.</em></h2><p>Get a chance to test SatinLore, earn cash and help shape how the story feels.</p>
<div className="signup-rewards"><article><p className="reward-label">For selected beta testers</p><h3>Up to <strong>US$500</strong></h3><p>Earn up to US$500 in total for agreed test tasks you complete. Selected readers may also get free early access.</p></article><article><p className="reward-label">For joining + the questionnaire</p><h3>A chance to win <strong>US$50</strong></h3><p>Join the waitlist, confirm your email and complete the questionnaire to enter the draw for one of ten US$50 cash prizes.</p><p className="reward-note">One entry per valid entrant. Story and toy questions are optional. Skipping them does not change your odds.</p></article></div>
<ol className="next-steps"><li><span>01</span>Join the waitlist.</li><li><span>02</span>Confirm your email.</li><li><span>03</span>Complete the questionnaire and choose to enter.</li></ol><p className="selection-note">Joining is free. Test places, payment, free access and draw prizes are not guaranteed. Paid testing rewards your time and honest feedback.</p></div>
<div id="beta-form" className="signup-card" ref={formCard}><p className="form-kicker">Paid testing / Free early access / Cash draw</p><h3>Join the beta waitlist</h3><p className="form-intro">Free to join. No card needed.</p><WaitlistForm /></div></div></section><section className="faq-section shell" id="questions"><div className="faq-heading"><p className="eyebrow">Before you join</p><h2>A few good<br /><em>questions.</em></h2><p>What it does, how it follows your reading, and what beta testing involves.</p></div><div className="faq-list">
<details open><summary>What does SatinLore do?</summary><p>SatinLore is an adult reading app that syncs a compatible sex toy with romance and erotica. Upload or paste your story: automatic analysis turns its mood, pacing and scene changes into shifting intensity and rhythms that follow your reading.</p></details>
<details><summary>Do I have to set up every vibration?</summary><p>No. SatinLore analyses your story and prepares its changing intensity and rhythms automatically. Keep your stories saved, confirm your settings and start reading. You can tailor the experience without programming every scene.</p></details>
<details><summary>How much does the rhythm change?</summary><p>Sharp bursts can give way to flatlines, low pulses and renewed spikes — all within one intense scene. Sustained rhythms, interruptions and changes in pace create contrast, so the experience has more variety than a simple rise and fall in strength.</p></details>
<details><summary>Does it work when I stop scrolling?</summary><p>SatinLore uses your pace, scrolling and time on the page to estimate which passage you are reading. It can follow your progress down a still page and account for time spent lingering. Beta testing will help fine-tune how closely the timing matches your reading.</p></details>
<details><summary>Which sex toys will work?</summary><p>The synced experience needs a compatible connected sex toy. We will share the tested device list before beta sessions. You can join the waitlist with any toy, or without one yet.</p></details>
<details><summary>How much can I personalise?</summary><p>Make the experience feel right for you. Turn the strength up or down while the rhythms follow the scene, from slow builds to sudden peaks and pauses. You can also set a ceiling, pause or stop at any time.</p></details>
<details><summary>How will beta testers shape it?</summary><p>Our beta programme will involve hundreds to thousands of testers refining intensity, timing, rhythmic interruptions and transitions through real reading sessions. Their feedback will guide what we keep and improve, making the experience as pleasurable as possible for launch.</p></details>
<details><summary>What happens after I join the waitlist?</summary><p>Confirm your email, then complete the questionnaire to tell us about your reading and setup. You can opt into the draw for one of ten US$50 cash prizes. Selected readers may get free early access or earn up to US$500 in total for agreed test tasks they complete. Joining is free. Story and toy questions are optional; skipping them does not change your draw odds.</p></details>
</div></section>
</main>
<footer className="footer shell"><a className="wordmark" href="#top">SatinLore<span>.</span></a><p>Feel the story unfold.</p><nav aria-label="Footer"><a href="/privacy">Privacy</a><a href="/contact">Contact</a><span>18+</span></nav><a className="measurement-link" href="/privacy#measurement-choices">Privacy choices</a><small>© {new Date().getFullYear()} SatinLore. Coming soon.</small></footer>
<div className={`mobile-cta${atForm ? " is-at-form" : ""}`}><a data-metric-cta="mobile" className="button" href="#waitlist">Get paid as a beta tester <span aria-hidden="true">↗</span></a></div>


</div>;
}
