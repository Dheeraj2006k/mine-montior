import { loadEnv, adminClient } from "./simulator/lib.mjs";

// Creates (or upgrades) the local/demo bootstrap administrator using
// Supabase Auth's admin API - never writes a password into any application
// table (the whole point of using auth.admin.createUser rather than a raw
// SQL insert). Idempotent: safe to re-run, and NEVER recreates the account
// if it already exists with a different password - it only ensures the
// profiles row for that user is role=admin/status=active.
//
// Credentials: IRIS_ADMIN_EMAIL / IRIS_ADMIN_PASSWORD env vars, defaulting
// to the documented local/demo values (admin@iris.local / test123) only
// when unset - see docs/DEMO_GUIDE.md. Production deployments MUST set
// both env vars to real, unique credentials before running this script;
// this file has no production-specific branch because there is nothing
// unsafe about it to guard against - it just never runs unless invoked.

async function main() {
  const env = loadEnv();
  const admin = adminClient(env);

  const email = process.env.IRIS_ADMIN_EMAIL?.trim() || env.IRIS_ADMIN_EMAIL?.trim() || "admin@iris.local";
  const password = process.env.IRIS_ADMIN_PASSWORD?.trim() || env.IRIS_ADMIN_PASSWORD?.trim() || "test123";

  if (email === "admin@iris.local") {
    console.warn("Using the default LOCAL/DEMO admin email - set IRIS_ADMIN_EMAIL for a real deployment.");
  }
  if (password === "test123") {
    console.warn("Using the default LOCAL/DEMO admin password - set IRIS_ADMIN_PASSWORD for a real deployment.");
  }

  let userId;
  const { data: existingPage, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) {
    console.error("Failed to list existing users:", listError.message);
    process.exit(1);
  }
  const existing = existingPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    userId = existing.id;
    console.log(`Admin user already exists (${email}) - leaving password untouched, syncing role only.`);
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "IRIS Admin" },
    });
    if (createError || !created.user) {
      console.error("Failed to create admin user:", createError?.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`Created admin user: ${email}`);
  }

  // Overrides whatever the on_auth_user_created trigger (migration 0009)
  // just inserted (role='viewer') - this is the one account meant to start
  // as admin, set explicitly rather than via a fragile "first user" rule.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { user_id: userId, role: "admin", status: "active", full_name: "IRIS Admin", updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (profileError) {
    console.error("Failed to upsert admin profile:", profileError.message);
    process.exit(1);
  }

  console.log(`Admin profile ready: ${email} -> role=admin, status=active`);
}

main().catch((err) => {
  console.error("seed-admin failed:", err.message);
  process.exit(1);
});
