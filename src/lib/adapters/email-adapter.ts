import { Resend } from "resend";

export type SendEmailResult = {
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
  demo: boolean;
};

// DEMO_MODE per plan §8.6/§12.2: renders the exact same code path and DB
// writes, but never calls a real provider. Falls back automatically if
// RESEND_API_KEY is missing so this works with zero configuration.
function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true" || !process.env.RESEND_API_KEY;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendEmailResult> {
  if (isDemoMode()) {
    console.log(`[DEMO_MODE email] to=${params.to} subject="${params.subject}"`);
    return { ok: true, providerMessageId: `demo-${Date.now()}`, error: null, demo: true };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.ALERT_EMAIL_FROM ?? "alerts@example.com";
    const result = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
    if (result.error) {
      return { ok: false, providerMessageId: null, error: result.error.message, demo: false };
    }
    return { ok: true, providerMessageId: result.data?.id ?? null, error: null, demo: false };
  } catch (err) {
    return {
      ok: false,
      providerMessageId: null,
      error: err instanceof Error ? err.message : String(err),
      demo: false,
    };
  }
}
