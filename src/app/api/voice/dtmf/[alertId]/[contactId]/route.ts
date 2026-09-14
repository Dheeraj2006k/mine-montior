import { NextResponse } from "next/server";
import { verifyTwilioSignature } from "@/lib/adapters/voice-adapter";
import { handleDtmfResponse } from "@/lib/domain/notification-engine";

// PRD §13.4: an unauthenticated DTMF webhook means anyone on the internet
// can mark alerts "blast - ignore." Signature verification is mandatory
// outside DEMO_MODE (verifyTwilioSignature auto-passes only in demo mode).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ alertId: string; contactId: string }> },
) {
  const { alertId, contactId } = await params;
  const bodyText = await request.text();
  const formData = new URLSearchParams(bodyText);
  const bodyObj = Object.fromEntries(formData.entries());

  const signature = request.headers.get("x-twilio-signature");
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/api/voice/dtmf/${alertId}/${contactId}`;

  if (!verifyTwilioSignature({ signature, url, body: bodyObj })) {
    return new NextResponse("<Response><Say>Unauthorized.</Say></Response>", {
      status: 403,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const digit = bodyObj.Digits ?? "";
  const { verdict } = await handleDtmfResponse({
    alertId: Number(alertId),
    contactId: Number(contactId),
    digit,
  });

  const responseText = verdict
    ? "Thank you. Your response has been recorded."
    : "No valid response recorded. Goodbye.";

  return new NextResponse(`<Response><Say>${responseText}</Say></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
