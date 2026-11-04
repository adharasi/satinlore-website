import type { Metadata } from "next";
import PageFrame from "@/lib/PageFrame";
import "./docs.css";

const title = "SatinLore Guides";
const description = "Get started with the SatinLore reader, try a practice story, connect through Lovense Remote, and tell us what to improve.";
const canonical = "https://satinlore.com/docs";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: { title, description, url: canonical, type: "website" },
};

const sections = [
  ["account", "Sign in"],
  ["practice", "Try a practice story"],
  ["connect", "Connect a toy"],
  ["models", "Choose a story model"],
  ["privacy", "Keep a story"],
  ["feedback", "Send feedback"],
] as const;

export default function Guides() {
  return <PageFrame title={title}>
    <div className="reader-guides">
      <p>Try the reader with a simulator, or connect a compatible Lovense toy and read a story of your own. Adults 18+.</p>
      <a className="button" href="https://app.satinlore.com/">Open the reader <span aria-hidden="true">↗</span></a>
      <nav aria-label="On this page">
        {sections.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>

      <section aria-labelledby="account">
        <h2 id="account">Sign in</h2>
        <p>Email sign-in is rolling out. You may see an invite screen while the reader is in preview.</p>
        <ol>
          <li>When email sign-in is available, open the reader and choose <strong>Sign in</strong>. Enter your email, confirm you are 18 or older, and choose <strong>Email me a code</strong>.</li>
          <li>Enter the six-digit code from the SatinLore email in the same tab. This creates your account or signs you back in.</li>
        </ol>
        <p>If your code does not arrive, check your spam folder and confirm the address. Choose <strong>Send a new code</strong> and use the latest email. If you’re stuck, <a href="/contact">contact us</a>.</p>
      </section>

      <section aria-labelledby="practice">
        <h2 id="practice">Try a practice story</h2>
        <ol>
          <li>Open <strong>Reading controls</strong> and choose <strong>Try a practice story</strong>. Choose a story and open it.</li>
          <li>Choose <strong>Connect simulator</strong>. Set a maximum you want to try, then choose <strong>Start</strong> and confirm it.</li>
          <li>Scroll through the story and watch the simulator change. Use <strong>−</strong> or <strong>+</strong> to change the current level by one.</li>
          <li>Choose <strong>Stop</strong> when done. Your story stays open. To go again, choose <strong>Start</strong> and confirm.</li>
        </ol>
        <p>If <strong>Start</strong> is unavailable, read the message beside it. You may need to open a story, connect again or stop a session in another tab.</p>
      </section>

      <section aria-labelledby="connect">
        <h2 id="connect">Connect a toy</h2>
        <ol>
          <li>Turn on your toy and your phone’s Bluetooth. Pair the toy in <strong>Lovense Remote</strong> on your phone.</li>
          <li>In the reader, choose <strong>Set up a toy</strong>, pick your model, then choose <strong>Connect my toy</strong>.</li>
          <li>Follow the QR instructions on screen. Use the reader on a second screen if you need your phone free to scan the code.</li>
          <li>Select your connected toy. Test each movement you want to use, starting at level 1, and check that it starts and stops. Apply your settings and try a practice read.</li>
        </ol>
        <p>If the toy does not appear, check that Lovense Remote can control it, then request a fresh QR code in SatinLore. See <a href="https://www.lovense.com/faq">Lovense setup help</a>.</p>
        <p>Available movements depend on the model. Physical pairing is still being tested across models. Keep your toy’s controls and Lovense Remote within reach. If movement continues after you choose <strong>Stop</strong>, stop it in Lovense Remote or turn off the toy.</p>
      </section>

      <section aria-labelledby="models">
        <h2 id="models">Choose a story model</h2>
        <p><strong>Loom</strong> makes a first pass on this device. <strong>Nocturne</strong> can add different simulator rhythms in some sections. To try it, open a model comparison story or your own story and look for <strong>Story model</strong> in <strong>Reading controls</strong>.</p>
        <p>Some practice stories use fixed levels so you can focus on the controls. If the model menu is locked there, choose <strong>Open a model practice story</strong> or open your own story.</p>
        <p>When you choose <strong>Send cues and analyse</strong>, Nocturne sends short, structured cues to OpenAI. Your story text stays in the reader. If Nocturne is unavailable, you can keep reading with Loom.</p>
      </section>

      <section aria-labelledby="privacy">
        <h2 id="privacy">Keep a story</h2>
        <p>Paste a story into the editor or choose <strong>Import file</strong> in the library, then open it to read. Choose <strong>Save on this browser</strong> if you want to return to the story later. Saved stories stay in this browser. Use a private browser profile if you share a device.</p>
      </section>

      <section aria-labelledby="feedback">
        <h2 id="feedback">Send feedback</h2>
        <p>Tell us what felt easy, what got in the way and what you expected to happen. We use your feedback to decide what to fix next. If you hit a connection problem, include your toy model and the step where it happened. Leave out private story text and sign-in codes.</p>
        <p><a href="https://app.satinlore.com/support">Send reader feedback</a>. If you cannot sign in, <a href="/contact">contact us</a>.</p>
      </section>
    </div>
  </PageFrame>;
}
