export type EmailContent = {
  subject: string;
  text: string;
  html: string;
  headers: Array<{ Name: string; Value: string }>;
};

export type EmailLinkInput = {
  publicOrigin: string;
  firstName: string;
  manageToken: string;
};

/** Only complete HTTPS origins are accepted; no credentials, paths or query data. */
export function emailPublicOrigin(value: string): string {
  if (typeof value !== "string" || value !== value.trim() || /[\u0000-\u0020\u007f]/.test(value)) throw new Error("Invalid email site origin");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !url.hostname) {
    throw new Error("Invalid email site origin");
  }
  return url.origin;
}

export function emailToken(value: string): string {
  if (typeof value !== "string" || value.length !== 64 || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("Invalid email link token");
  }
  return value;
}

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function nameForEmail(value: string): string {
  if (typeof value !== "string") throw new Error("Invalid first name");
  const name = value.trim();
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error("Invalid first name");
  return name;
}

function htmlMessage(options: {
  firstName: string;
  heading: string;
  paragraphs: string[];
  buttonText: string;
  buttonUrl: string;
  smallPrint: string;
  manageUrl: string;
  contactUrl: string;
}): string {
  const esc = escapeEmailHtml;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Satinlore</title></head>
<body style="margin:0;padding:0;background:#f7f3ec;color:#35242b;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td style="padding:32px 16px;">
<table role="presentation" style="width:100%;max-width:560px;margin:auto;border-collapse:collapse;background:#fffdf9;border:1px solid #e3d8ce;"><tr><td style="padding:36px 28px;">
<p style="margin:0 0 32px;font-family:Georgia,serif;font-size:30px;color:#592b3e;">Satinlore</p>
<p style="font-size:16px;line-height:1.6;">Hi ${esc(options.firstName)},</p>
<h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400;line-height:1.25;">${esc(options.heading)}</h1>
${options.paragraphs.map(text => `<p style="font-size:16px;line-height:1.6;">${esc(text)}</p>`).join("\n")}
<p style="margin:28px 0;"><a href="${esc(options.buttonUrl)}" style="display:inline-block;background:#592b3e;color:#ffffff;padding:15px 22px;border-radius:4px;font-size:16px;text-decoration:none;">${esc(options.buttonText)}</a></p>
<p style="font-size:14px;line-height:1.6;color:#6d5b61;">${esc(options.smallPrint)}</p>
<p style="font-size:14px;line-height:1.6;color:#6d5b61;">If the button does not work, use this link:<br><a href="${esc(options.buttonUrl)}" style="color:#592b3e;word-break:break-all;">${esc(options.buttonUrl)}</a></p>
<hr style="border:0;border-top:1px solid #e3d8ce;margin:30px 0 20px;">
<p style="font-size:13px;line-height:1.7;color:#6d5b61;">For adults 18+.<br><a href="${esc(options.manageUrl)}" style="color:#592b3e;">Change or stop these emails</a> · <a href="${esc(options.contactUrl)}" style="color:#592b3e;">Get in touch</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

export function buildConfirmationEmail(input: EmailLinkInput & { confirmToken: string }): EmailContent {
  const origin = emailPublicOrigin(input.publicOrigin);
  const name = nameForEmail(input.firstName);
  const confirmUrl = `${origin}/confirm#${emailToken(input.confirmToken)}`;
  const manageUrl = `${origin}/manage#${emailToken(input.manageToken)}`;
  const contactUrl = `${origin}/contact`;
  const paragraphs = ["Tap the link below to confirm your email and join the Satinlore list."];
  const smallPrint = "This link works for 24 hours. If you did not ask to join, you can skip this email.";
  return {
    subject: "One more step for Satinlore",
    text: `Hi ${name},\n\nYou're one step away.\n\n${paragraphs.join("\n\n")}\n\nConfirm my email: ${confirmUrl}\n\n${smallPrint}\n\nChange or stop these emails: ${manageUrl}\nGet in touch: ${contactUrl}\n\nSatinlore · For adults 18+.`,
    html: htmlMessage({ firstName: name, heading: "You're one step away.", paragraphs, buttonText: "Confirm my email", buttonUrl: confirmUrl, smallPrint, manageUrl, contactUrl }),
    headers: [{ Name: "Auto-Submitted", Value: "auto-generated" }],
  };
}

export function buildWelcomeEmail(input: EmailLinkInput): EmailContent {
  const origin = emailPublicOrigin(input.publicOrigin);
  const name = nameForEmail(input.firstName);
  const manageUrl = `${origin}/manage#${emailToken(input.manageToken)}`;
  const contactUrl = `${origin}/contact`;
  const paragraphs = [
    "Thanks for joining Satinlore.",
    "We're building a new way to feel your stories. Your toy follows the story as you read. Just read, relax, and enjoy.",
    "We'll email you about early access and the launch. You can change your email choices or leave the list at any time.",
  ];
  const smallPrint = "Thanks for being here. We can't wait to share the next chapter.";
  return {
    subject: "You're on the Satinlore list",
    text: `Hi ${name},\n\nYou're on the list.\n\n${paragraphs.join("\n\n")}\n\nChange or stop these emails: ${manageUrl}\n\n${smallPrint}\n\nGet in touch: ${contactUrl}\n\nSatinlore · For adults 18+.`,
    html: htmlMessage({ firstName: name, heading: "You're on the list.", paragraphs, buttonText: "My email choices", buttonUrl: manageUrl, smallPrint, manageUrl, contactUrl }),
    headers: [{ Name: "Auto-Submitted", Value: "auto-generated" }],
  };
}

export function buildFounderAlertEmail(input:{publicOrigin:string;firstName:string;email:string;createdAt:number}):EmailContent {
  const origin=emailPublicOrigin(input.publicOrigin);
  const name=nameForEmail(input.firstName);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z]{2,}$/.test(input.email) || input.email.length>254 || /[\u0000-\u001f\u007f]/.test(input.email)) throw new Error("Invalid signup email");
  if (!Number.isFinite(input.createdAt) || input.createdAt<=0) throw new Error("Invalid signup date");
  const date=new Date(input.createdAt).toISOString();
  const dashboard=`${origin}/admin`;
  return {
    subject:"New Satinlore waitlist signup",
    text:`A new waitlist form was saved.\n\nFirst name: ${name}\nEmail: ${input.email}\nJoined: ${date}\n\nThis is a form submission. Check the CRM for the current email verification state.\n\nOpen the private CRM: ${dashboard}\n\nNo payment or test place has been promised.`,
    html:`<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#332126;background:#f8f5ee;padding:24px"><h1 style="font-family:Georgia,serif;font-weight:400">A new reader found Satinlore.</h1><p>First name: ${escapeEmailHtml(name)}</p><p>Email: ${escapeEmailHtml(input.email)}</p><p>Joined: ${date}</p><p>This is a form submission. Check the CRM for the current email verification state.</p><p><a href="${dashboard}">Open the private CRM</a></p><p>No payment or test place has been promised.</p></body></html>`,
    headers:[{Name:"Auto-Submitted",Value:"auto-generated"}],
  };
}
