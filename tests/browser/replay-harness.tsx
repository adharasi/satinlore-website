import React from "react";
import {createRoot} from "react-dom/client";
import VisualReplay from "../../lib/VisualReplay";
import type {VisualRecording} from "../../lib/visual-replay-view";
import "../../lib/admin-experience.css";

// This fixture is compiled only by the isolated browser check. It is not a
// production route or asset, and has no credentials or authentication bypass.
const recording = await fetch("/fixture-recording.json").then(response => response.json()) as VisualRecording;
createRoot(document.getElementById("root")!).render(<VisualReplay
  recording={recording} viewport={{w: 1360, h: 940}} clicks={[]} />);
