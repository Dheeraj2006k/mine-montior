// Single-site prototype: this build has no multi-tenant/site-selector UI,
// so every server route that needs a site_id used to redefine its own
// `const SITE_ID = "SIH-DEMO-01"` literal independently (8 copies).
// Centralized here instead, so the one seeded demo site has one source of
// truth - NOT an attempt to add real multi-site support (there is still
// exactly one site id; DEMO_SITE_ID just lets a deployment point at a
// different already-seeded site without editing code).
export const DEMO_SITE_ID = process.env.DEMO_SITE_ID?.trim() || "SIH-DEMO-01";
