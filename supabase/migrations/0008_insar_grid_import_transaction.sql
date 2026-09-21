-- Atomic import path for the production InSAR grid (STEP 4A safety
-- hardening, INSAR_INTEGRATION_DESIGN.md's importer). Additive - does not
-- touch 0001-0007. Depends on 0007 (insar_grid_cells, insar_grid_observations)
-- already being applied.
--
-- NOT YET APPLIED to the live project - same constraint as every prior
-- migration. Apply via the Supabase SQL editor or `supabase db push`.
--
-- Why this exists: tools/insar-importer previously wrote cells and
-- observations as two separate chunked REST requests. A network/API
-- failure partway through could leave cells written but observations
-- missing (or partially written), even though Phase A validation was
-- perfect - there was no atomicity across the whole import. A single
-- PostgREST RPC call runs the underlying Postgres function as one
-- transaction: if anything inside it raises, Postgres rolls back
-- everything the function did, cells and observations together. The
-- importer's Phase B now calls this function exactly once, with the
-- complete validated dataset (both tables' full row sets) in one request -
-- "the complete import commits, or the complete import rolls back",
-- exactly as required, not chunked in a way that would only give
-- per-chunk atomicity.

create or replace function import_insar_grid_batch(
  p_site_id      text,
  p_cells        jsonb,
  p_observations jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_cells_written        int;
  v_observations_written int;
begin
  insert into insar_grid_cells (site_id, grid_id, geometry_4326, imported_at)
  select
    p_site_id,
    (elem->>'grid_id')::int,
    elem->'geometry_4326',
    now()
  from jsonb_array_elements(p_cells) as elem
  on conflict (site_id, grid_id) do update
    set geometry_4326 = excluded.geometry_4326,
        imported_at   = excluded.imported_at;
  get diagnostics v_cells_written = row_count;

  insert into insar_grid_observations (
    site_id, grid_id, pair, reference_date, secondary_date,
    temporal_baseline_days, los_displacement_m, coherence,
    incidence_angle_rad, look_vector_phi_rad, look_vector_theta_rad,
    imported_at
  )
  select
    p_site_id,
    (elem->>'grid_id')::int,
    (elem->>'pair')::int,
    (elem->>'reference_date')::date,
    (elem->>'secondary_date')::date,
    (elem->>'temporal_baseline_days')::int,
    (elem->>'los_displacement_m')::double precision,   -- JSON null -> SQL NULL, preserved
    (elem->>'coherence')::double precision,
    (elem->>'incidence_angle_rad')::double precision,
    (elem->>'look_vector_phi_rad')::double precision,
    (elem->>'look_vector_theta_rad')::double precision,
    now()
  from jsonb_array_elements(p_observations) as elem
  on conflict (site_id, grid_id, pair) do update
    set reference_date         = excluded.reference_date,
        secondary_date         = excluded.secondary_date,
        temporal_baseline_days = excluded.temporal_baseline_days,
        los_displacement_m     = excluded.los_displacement_m,
        coherence              = excluded.coherence,
        incidence_angle_rad    = excluded.incidence_angle_rad,
        look_vector_phi_rad    = excluded.look_vector_phi_rad,
        look_vector_theta_rad  = excluded.look_vector_theta_rad,
        imported_at            = excluded.imported_at;
  get diagnostics v_observations_written = row_count;

  return jsonb_build_object(
    'cells_written', v_cells_written,
    'observations_written', v_observations_written
  );
end;
$$;

comment on function import_insar_grid_batch(text, jsonb, jsonb) is
  'Atomic write path for the production InSAR grid importer (tools/insar-importer). Writes insar_grid_cells and insar_grid_observations in a single transaction - both tables fully commit, or the whole call rolls back on any error (e.g. a check constraint violation Phase A somehow missed). Called via PostgREST RPC using the service-role key only - never anon or authenticated, see grants below.';

-- Only the importer (service-role key, which bypasses RLS/grants anyway,
-- but this makes the intent explicit and would still matter if RLS
-- posture on these tables ever changes) may call this. A normal
-- authenticated dashboard user must never be able to write production
-- InSAR data via RPC.
revoke all on function import_insar_grid_batch(text, jsonb, jsonb) from public;
revoke all on function import_insar_grid_batch(text, jsonb, jsonb) from anon;
revoke all on function import_insar_grid_batch(text, jsonb, jsonb) from authenticated;
grant execute on function import_insar_grid_batch(text, jsonb, jsonb) to service_role;
