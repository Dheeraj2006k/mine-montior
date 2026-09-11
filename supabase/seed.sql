-- Seed data — matches what is currently live in the Supabase project
-- (verified read-only via supabaseAdmin queries). Idempotent via ON CONFLICT.

insert into sites (site_id, name, description, timezone)
values ('SIH-DEMO-01', 'Demo Mine Site', 'Prototype Cycle 1 demo AOI', 'Asia/Kolkata')
on conflict (site_id) do nothing;

insert into nodes (node_id, site_id, label, mock_latitude, mock_longitude, is_mock, install_note)
values
  (1, 'SIH-DEMO-01', 'Node_01', 23.7957, 86.4304, true, 'Prototype Tier-1 node, mock position'),
  (2, 'SIH-DEMO-01', 'Node_02', 23.7962, 86.4311, true, 'Prototype Tier-1 node, mock position')
on conflict (node_id) do nothing;

-- One seeded contact existed live at introspection time; exact values were not
-- read out (contacts holds PII, deliberately not queried in full during this
-- pass). Insert a placeholder-labelled row only if the table is empty, so this
-- script stays safely re-runnable without overwriting the real contact.
insert into contacts (site_id, full_name, role, escalation_priority, channels)
select 'SIH-DEMO-01', 'Safety Officer (seed placeholder — replace with real contact)', 'Safety Officer', 1, '{email,sms,voice}'
where not exists (select 1 from contacts where site_id = 'SIH-DEMO-01');
