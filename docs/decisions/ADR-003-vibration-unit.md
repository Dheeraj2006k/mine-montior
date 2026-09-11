# ADR-003 — Vibration unit

**Status:** Still blocked on the firmware team, as the PRD anticipates.

**Decision so far:** Every `vibration.unit` field sent through the simulator and rendered in the UI is the literal string `"TBD"` — never invented as "g" or "m/s²". The Zod schema (`src/lib/schemas/ingest.ts`) only requires a non-empty string, so `"TBD"` validates cleanly without asserting a real unit.

**Action still needed:** Ask the firmware team specifically: RMS over what window? Peak amplitude? Raw ADC counts? Until answered, no fuzzy threshold should be tuned against this field, and the UI must keep rendering `unit: TBD` rather than guessing.
