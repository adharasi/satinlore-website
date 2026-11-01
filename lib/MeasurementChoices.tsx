"use client";

import { useEffect, useState } from "react";
import { measurementDisabled } from "@/lib/SiteMetrics";

export default function MeasurementChoices() {
  const [off,setOff] = useState(false);
  const [browserOff,setBrowserOff] = useState(false);
  const [ready,setReady] = useState(false);
  useEffect(() => {
    setOff(measurementDisabled());
    setBrowserOff(navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true);
    setReady(true);
  }, []);
  function change() {
    const next = !off;
    document.cookie = `satinlore_measurement=${next ? "off" : "on"}; Path=/; SameSite=Lax; Max-Age=15552000${location.protocol === "https:" ? "; Secure" : ""}`;
    const applied = document.cookie.split(";").some(item => item.trim() === `satinlore_measurement=${next ? "off" : "on"}`);
    if (applied) setOff(next);
    else setMessage("Your browser could not save this choice. You can also enable Do Not Track or Global Privacy Control in your browser.");
  }
  const [message,setMessage] = useState("");
  return <aside id="measurement-choices" className="measurement-choices" aria-label="Website measurement choices">
    <p role="status">{!ready ? "Loading your measurement choice…" : browserOff ? "Website measurement is off because your browser sends a privacy signal." : off ? "Website measurement is off in this browser." : "Aggregate website measurement is on in this browser."}</p>
    {!browserOff && <button className="button" type="button" onClick={change} disabled={!ready}>{off ? "Allow aggregate measurement" : "Turn off website measurement"}</button>}
    <p className="form-hint">This choice applies to this browser. A preference cookie remembers it for 180 days; it contains no visitor ID. Turning measurement off stops new counts from this browser. Protected daily codes expire just after UTC midnight; the daily totals already counted remain.</p>
    {message && <p role="alert">{message}</p>}
  </aside>;
}
