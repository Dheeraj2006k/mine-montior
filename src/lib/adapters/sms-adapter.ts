import twilio from "twilio";

export type SendSmsResult = {
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
  demo: boolean;
};

function isDemoMode(): boolean {
  return (
    process.env.DEMO_MODE === "true" ||
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSms(params: { to: string; body: string }): Promise<SendSmsResult> {
  if (isDemoMode()) {
    console.log(`[DEMO_MODE sms] to=${params.to} body="${params.body}"`);
    return { ok: true, providerMessageId: `demo-${Date.now()}`, error: null, demo: true };
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({
      to: params.to,
      from: process.env.TWILIO_FROM_NUMBER,
      body: params.body,
    });
    return { ok: true, providerMessageId: message.sid, error: null, demo: false };
  } catch (err) {
    return {
      ok: false,
      providerMessageId: null,
      error: err instanceof Error ? err.message : String(err),
      demo: false,
    };
  }
}
