import { GetAccountCommand, GetEmailIdentityCommand, SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { FetchHttpHandler } from "@smithy/fetch-http-handler";
import { buildConfirmationEmail, buildFounderAlertEmail, buildWelcomeEmail, emailPublicOrigin, type EmailContent } from "./email-content";
import { buildSurveyEmail } from "./survey-email";

export type EmailSettings = {
  enabled: boolean;
  welcomeEnabled?: boolean;
  founderNotificationEmail?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  fromEmail: string;
  publicOrigin: string;
  configurationSet?: string;
};

function fromAddress(value: string): string | null {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const match = /^(?:[^<>]+<([^<>]+)>|([^<>]+))$/.exec(value.trim());
  const address = (match?.[1] || match?.[2] || "").trim();
  return address.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z]{2,}$/.test(address) ? address : null;
}

export function emailIsReady(settings: EmailSettings): boolean {
  try {
    emailPublicOrigin(settings.publicOrigin);
    return settings.enabled === true && /^[a-z]{2}(?:-[a-z]+)+-\d$/.test(settings.region) &&
      !!settings.accessKeyId.trim() && !!settings.secretAccessKey.trim() && !!fromAddress(settings.fromEmail) &&
      (!settings.configurationSet || /^[a-zA-Z0-9_-]{1,64}$/.test(settings.configurationSet));
  } catch { return false; }
}

function sesClient(settings: EmailSettings): SESv2Client {
  if (!emailIsReady(settings)) throw new Error("Email sending is not set up");
  return new SESv2Client({
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
      ...(settings.sessionToken ? { sessionToken: settings.sessionToken } : {}),
    },
    requestHandler: new FetchHttpHandler({ requestTimeout: 12000 }),
    maxAttempts: 1,
  });
}

function validRecipient(email: string): boolean {
  return typeof email === "string" && email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z]{2,}$/.test(email) && !/[\u0000-\u001f\u007f]/.test(email);
}

async function send(settings: EmailSettings, email: string, content: EmailContent): Promise<string> {
  if (!validRecipient(email)) throw new Error("Invalid email recipient");
  const client = sesClient(settings);
  try {
    const result = await client.send(new SendEmailCommand({
      FromEmailAddress: settings.fromEmail,
      Destination: { ToAddresses: [email] },
      Content: { Simple: {
        Subject: { Data: content.subject, Charset: "UTF-8" },
        Body: { Text: { Data: content.text, Charset: "UTF-8" }, Html: { Data: content.html, Charset: "UTF-8" } },
        Headers: content.headers,
      } },
      ...(settings.configurationSet ? { ConfigurationSetName: settings.configurationSet } : {}),
    }));
    if (!result.MessageId) throw new Error("Email service did not accept the message");
    return result.MessageId;
  } finally { client.destroy(); }
}

export function sendConfirmation(settings: EmailSettings, input: { email: string; firstName: string; confirmToken: string; manageToken: string }): Promise<string> {
  return send(settings, input.email, buildConfirmationEmail({ publicOrigin: settings.publicOrigin, ...input }));
}

export function sendWelcome(settings: EmailSettings, input: { email: string; firstName: string; manageToken: string }): Promise<string> {
  return send(settings, input.email, buildWelcomeEmail({ publicOrigin: settings.publicOrigin, ...input }));
}

export function sendSurveyInvitation(settings: EmailSettings, input: { email: string; manageToken: string }): Promise<string> {
  return send(settings, input.email, buildSurveyEmail({ publicOrigin: settings.publicOrigin, manageToken: input.manageToken }));
}

export function sendFounderAlert(settings: EmailSettings, input: { firstName:string; email:string; createdAt:number }): Promise<string> {
  if (!settings.founderNotificationEmail) throw new Error("Founder inbox is not set");
  return send(settings, settings.founderNotificationEmail, buildFounderAlertEmail({publicOrigin:settings.publicOrigin,...input}));
}

export type EmailSendingStatus = {
  configured: boolean;
  sendingEnabled: boolean;
  productionAccessEnabled: boolean;
  identityVerified: boolean;
};

/** Owner-only callers may use this; it needs SES read permissions in addition to sending. */
export async function getSendingStatus(settings: EmailSettings): Promise<EmailSendingStatus> {
  if (!emailIsReady(settings)) return { configured: false, sendingEnabled: false, productionAccessEnabled: false, identityVerified: false };
  const client = sesClient(settings);
  try {
    const account = await client.send(new GetAccountCommand({}));
    const sender = fromAddress(settings.fromEmail)!;
    let identityVerified = false;
    for (const identity of [sender, sender.split("@")[1]]) {
      try {
        const result = await client.send(new GetEmailIdentityCommand({ EmailIdentity: identity }));
        if (result.VerifiedForSendingStatus === true) { identityVerified = true; break; }
      } catch (error) {
        // An exact address can be covered by a verified domain instead.
        if (!(error instanceof Error) || error.name !== "NotFoundException") throw error;
      }
    }
    return { configured: true, sendingEnabled: account.SendingEnabled === true, productionAccessEnabled: account.ProductionAccessEnabled === true, identityVerified };
  } finally { client.destroy(); }
}
