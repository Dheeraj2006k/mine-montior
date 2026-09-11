import twilio from "twilio";

export function isVoiceDemoMode(): boolean {
  return (
    process.env.DEMO_MODE === "true" ||
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_NUMBER ||
    !process.env.PUBLIC_BASE_URL
  );
}

// Severity-aware script template, plan §8.2. Deliberately deterministic
// string interpolation from stored values — no LLM in the voice control
// path (plan §8.3: "the AI is in script generation [elsewhere], not the
// control flow" — this path has none at all, by design, for reliability).
export function buildCallScript(params: {
  severity: string;
  nodeLabel: string;
  panelLabel: string | null;
  occurredAtIso: string;
  trend?: string;
  ttThresholdLowDays?: number | null;
  ttThresholdHighDays?: number | null;
}): string {
  const time = new Date(params.occurredAtIso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
  const panel = params.panelLabel ? `, ${params.panelLabel}` : "";
  const trendLine =
    params.trend && params.ttThresholdLowDays != null && params.ttThresholdHighDays != null
      ? ` Trend is ${params.trend}. Estimated time to threshold is ${params.ttThresholdLowDays} to ${params.ttThresholdHighDays} days.`
      : "";

  return (
    `This is the Mine Subsidence Monitoring System. A ${params.severity} severity event has been detected ` +
    `at ${params.nodeLabel}${panel}, at ${time} IST.${trendLine} ` +
    `Press 1 to confirm this is a genuine incident. ` +
    `Press 2 if this corresponds to a planned blast or a known disturbance. ` +
    `Press 3 if you are uncertain. Press 9 to repeat this message.`
  );
}

export function buildTwiml(scriptText: string, gatherActionUrl: string): string {
  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    numDigits: 1,
    timeout: 7,
    action: gatherActionUrl,
    method: "POST",
  });
  gather.say(scriptText);
  twiml.say("No response received. Goodbye.");
  return twiml.toString();
}

export type InitiateCallResult = {
  ok: boolean;
  providerCallId: string | null;
  error: string | null;
  demo: boolean;
};

export async function initiateCall(params: {
  to: string;
  twimlUrl: string;
}): Promise<InitiateCallResult> {
  if (isVoiceDemoMode()) {
    console.log(`[DEMO_MODE voice] would call ${params.to}, TwiML at ${params.twimlUrl}`);
    return { ok: true, providerCallId: `demo-call-${Date.now()}`, error: null, demo: true };
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const call = await client.calls.create({
      to: params.to,
      from: process.env.TWILIO_FROM_NUMBER!,
      url: params.twimlUrl,
    });
    return { ok: true, providerCallId: call.sid, error: null, demo: false };
  } catch (err) {
    return {
      ok: false,
      providerCallId: null,
      error: err instanceof Error ? err.message : String(err),
      demo: false,
    };
  }
}

export function verifyTwilioSignature(params: {
  signature: string | null;
  url: string;
  body: Record<string, string>;
}): boolean {
  if (isVoiceDemoMode()) return true; // no real provider signing in demo mode
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken || !params.signature) return false;
  return twilio.validateRequest(authToken, params.signature, params.url, params.body);
}
