-- Initial schema — reverse-engineered from the live Supabase project via
-- PostgREST OpenAPI introspection (GET /rest/v1/ with Accept: application/openapi+json).
-- This documents the schema AS IT ALREADY EXISTS LIVE; it does not change it.
-- Column comments below are copied from the live schema's own comments where present.

create table if not exists sites (
  site_id     text primary key,
  name        text not null,
  description text,
  timezone    text not null,
  created_at  timestamptz not null default now()
);

create table if not exists nodes (
  node_id        int primary key,
  site_id        text not null references sites(site_id),
  label          text not null,
  mock_latitude  double precision not null,
  mock_longitude double precision not null,
  is_mock        boolean not null default true,
  elevation_m    double precision,
  install_note   text,
  installed_at   timestamptz,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on column nodes.is_mock is
  'PRD §17: node positions are mock/assigned coordinates in this prototype cycle, never real GNSS. UI must render "mock position" next to every coordinate bound to this flag.';

create table if not exists readings (
  id                bigint generated always as identity primary key,
  site_id           text not null references sites(site_id),
  node_id           int  not null references nodes(node_id),
  hop_count         int  not null default 0,
  seq_num           bigint not null,
  logging_mode      text not null check (logging_mode in ('baseline','event')),

  tilt_x_raw        real, tilt_y_raw  real,
  tilt_x_filt       real, tilt_y_filt real,
  vibration_raw     real, vibration_filt real,
  displacement_raw  real, displacement_filt real,
  risk_score        real check (risk_score is null or (risk_score >= 0 and risk_score <= 1)),

  sensor_ok         boolean,
  low_battery       boolean,
  self_test_fail    boolean,
  comm_quality_low  boolean,
  calibration_stale boolean,

  recorded_at       timestamptz not null,
  received_at       timestamptz not null default now(),
  schema_version    int not null default 1,
  created_at        timestamptz not null default now(),

  constraint readings_node_seq_unique unique (node_id, seq_num)
);
create index if not exists readings_node_time_idx on readings (node_id, recorded_at desc);
create index if not exists readings_site_time_idx on readings (site_id, recorded_at desc);
create index if not exists readings_event_idx on readings (recorded_at desc) where logging_mode = 'event';

create table if not exists cluster_events (
  id                 bigint generated always as identity primary key,
  site_id            text not null references sites(site_id),
  triggering_node_id int not null references nodes(node_id),
  evidence_score     real not null check (evidence_score >= 0 and evidence_score <= 1),
  escalate           boolean not null,
  unknown            boolean not null default false,
  reason             text not null
    check (reason in ('strong_single_signal','combined_evidence','sensor_health_unknown')),
  recorded_at        timestamptz not null,
  received_at        timestamptz not null default now(),
  created_at         timestamptz not null default now()
);
comment on column cluster_events.unknown is
  'PRD §8.5: true means sensor health prevented a confident read. Distinct from "confirmed safe" — the UI must never colour an unknown=true row green.';
create index if not exists cluster_events_node_time_idx on cluster_events (triggering_node_id, recorded_at desc);

create table if not exists insar_node_features (
  id                     bigint generated always as identity primary key,
  node_id                int not null references nodes(node_id),
  mock_latitude          double precision not null,
  mock_longitude         double precision not null,
  insar_los_velocity_mm  real,
  insar_coherence        real,
  raster_date            date not null,
  created_at             timestamptz not null default now()
);
comment on column insar_node_features.insar_coherence is
  'Below the coherence threshold (PRD default 0.5, tunable), treat the paired velocity value as NO-DATA in application code — never substitute zero.';

create type alert_severity as enum ('info','warning','high','critical');
create type alert_source   as enum ('cluster_event','prediction','manual','system_health');
create type alert_state    as enum ('new','notified','acknowledged','resolved','dismissed');

create table if not exists predictions (
  id                          bigint generated always as identity primary key,
  site_id                     text not null references sites(site_id),
  model_version               text not null,
  predicted_zone              jsonb not null,
  trend                       text not null,
  time_to_threshold_low_days  real,
  time_to_threshold_high_days real,
  confidence                  real,
  generated_at                timestamptz not null default now()
);

create table if not exists contacts (
  id                  bigint generated always as identity primary key,
  site_id             text not null references sites(site_id),
  full_name           text not null,
  role                text not null,
  phone_e164          text,
  email               text,
  escalation_priority int not null default 1,
  channels            text[] not null default '{email,sms,voice}',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

create table if not exists blast_schedule (
  id            bigint generated always as identity primary key,
  site_id       text not null references sites(site_id),
  panel_label   text,
  planned_start timestamptz not null,
  planned_end   timestamptz not null,
  entered_by    text,
  note          text,
  created_at    timestamptz not null default now(),
  check (planned_end > planned_start)
);
create index if not exists blast_window_idx on blast_schedule (site_id, planned_start, planned_end);

create table if not exists alerts (
  id                    bigint generated always as identity primary key,
  site_id               text not null references sites(site_id),
  node_id               int references nodes(node_id),
  severity              alert_severity not null,
  source                alert_source not null,
  state                 alert_state not null default 'new',

  cluster_event_id      bigint references cluster_events(id),
  prediction_id         bigint references predictions(id),
  evidence_score        real,
  risk_score_snapshot   real,
  reason                text not null,
  summary               text not null,
  evidence              jsonb not null default '{}'::jsonb,

  correlation_key       text not null,
  event_count           int not null default 1,
  first_event_at        timestamptz not null,
  last_event_at         timestamptz not null,

  blast_suspected       boolean not null default false,
  blast_schedule_id     bigint references blast_schedule(id),

  created_at            timestamptz not null default now(),
  notified_at           timestamptz,
  acknowledged_at       timestamptz,
  acknowledged_by       bigint references contacts(id),
  acknowledged_channel  text,
  resolved_at           timestamptz,
  resolution_note       text
);
comment on column alerts.evidence is
  'Freeze tilt/vibration/displacement trend, Fuzzy Risk Index, evidence_score, spatial score, latest InSAR features, and latest prediction at creation time. An alert must be readable and defensible hours later even after live values change.';
create index if not exists alerts_state_idx on alerts (state, created_at desc);

create table if not exists notifications (
  id                  bigint generated always as identity primary key,
  alert_id            bigint not null references alerts(id) on delete cascade,
  contact_id          bigint not null references contacts(id),
  channel             text not null check (channel in ('email','sms','voice','push','dashboard')),
  provider            text,
  provider_message_id text,
  status              text not null default 'queued',
  attempt             int not null default 1,
  error               text,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz not null default now()
);

create table if not exists call_sessions (
  id               bigint generated always as identity primary key,
  alert_id         bigint not null references alerts(id) on delete cascade,
  contact_id       bigint not null references contacts(id),
  provider_call_id text,
  script_text      text,
  started_at       timestamptz,
  answered_at      timestamptz,
  ended_at         timestamptz,
  duration_s       int,
  dtmf_digit       text,
  outcome          text,
  created_at       timestamptz not null default now()
);

create table if not exists alert_feedback (
  id                   bigint generated always as identity primary key,
  alert_id             bigint not null references alerts(id) on delete cascade,
  responder_contact_id bigint references contacts(id),
  verdict              text not null
    check (verdict in ('real_event','blast_or_disturbance','uncertain','sensor_fault')),
  source_channel       text not null,
  notes                text,
  created_at           timestamptz not null default now()
);

create table if not exists pipeline_trace (
  id           bigint generated always as identity primary key,
  trace_id     text not null,
  alert_id     bigint references alerts(id) on delete set null,
  node_id      int references nodes(node_id),
  stage        text not null,
  status       text not null default 'ok',
  occurred_at  timestamptz not null,
  latency_ms   int,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
comment on column pipeline_trace.stage is
  'Canonical stage vocabulary — freeze and share with firmware/ML/InSAR teams if they will POST to /api/trace themselves. Otherwise you infer SENSOR/GATEWAY_FUSION timestamps from packet fields and only write CLOUD_INGEST onward yourself.';
create index if not exists pipeline_trace_trace_idx on pipeline_trace (trace_id, occurred_at);
create index if not exists pipeline_trace_alert_idx on pipeline_trace (alert_id, occurred_at);

create table if not exists audit_log (
  id           bigint generated always as identity primary key,
  actor        text not null,
  action       text not null,
  entity_table text not null,
  entity_id    text not null,
  from_state   text,
  to_state     text,
  channel      text,
  detail       jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);
