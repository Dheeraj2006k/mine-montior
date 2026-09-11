# ADR-002 — Realtime: polling via TanStack Query, not direct Supabase subscription

**Status:** Decided (implemented).

**Decision:** The browser never talks to Supabase directly. It polls the Next.js API routes via TanStack Query (`refetchInterval: 5000`).

**Why:** This is actually the PRD's own literal, non-negotiable rule in §14: "the website never touches Supabase or the Python service directly." The plan's ADR-002 explored a direct-Realtime-subscription exception (Option A), but polling through the API layer preserves the boundary exactly, requires no anon RLS SELECT policies (which are correctly locked to 0 rows for every table), and needed no extra infrastructure to build in this pass.

**Trade-off accepted:** Up to a 5-second delay before the dashboard reflects a new reading/alert, instead of a sub-second push. For a prototype at 1 reading/minute baseline rate, this is invisible in practice — verified live: the simulator's readings and the alert engine's new alerts both showed up on the dashboard well within one poll cycle.

**Revisit if:** a future pass wants true low-latency push (e.g. for the demo's "phone rings within seconds" beat) — at that point, an SSE endpoint (Option B from the original ADR) on the Edge runtime would preserve the same boundary while cutting the delay to near-zero.
