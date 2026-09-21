"""Thin Supabase REST (PostgREST) client for the InSAR grid importer.

Writes go through the same access layer every other write path in this
application already uses - the service-role key via Supabase's REST API -
rather than opening a raw Postgres connection with a new secret. This
script never touches Supabase directly with anything other than the
service-role key it's explicitly given (never the anon key), and never
prints that key.
"""

import os
from pathlib import Path
from typing import Optional

import requests


class SupabaseConfigError(RuntimeError):
    pass


def _load_dotenv_if_present(env_path: Path) -> None:
    """Minimal .env loader (no python-dotenv dependency). Only fills in a
    variable that isn't already set in the real process environment - real
    env vars always win over the file."""
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


class SupabaseClient:
    def __init__(self, url: Optional[str] = None, service_role_key: Optional[str] = None):
        # Convenience default: mine-monitor/.env.local, two directories up
        # from this file (tools/insar-importer/supabase_client.py ->
        # tools/insar-importer -> tools -> mine-monitor). Matches this
        # project's actual layout; never required, only a fallback.
        _load_dotenv_if_present(Path(__file__).resolve().parents[2] / ".env.local")

        self.url = (url or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")).rstrip("/")
        self.service_role_key = service_role_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not self.url:
            raise SupabaseConfigError(
                "NEXT_PUBLIC_SUPABASE_URL not set (checked environment and mine-monitor/.env.local)"
            )
        if not self.service_role_key:
            raise SupabaseConfigError(
                "SUPABASE_SERVICE_ROLE_KEY not set (checked environment and mine-monitor/.env.local)"
            )

    def _headers(self, prefer: Optional[str] = None) -> dict:
        headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def site_exists(self, site_id: str) -> bool:
        resp = requests.get(
            f"{self.url}/rest/v1/sites",
            headers=self._headers(),
            params={"site_id": f"eq.{site_id}", "select": "site_id"},
            timeout=15,
        )
        resp.raise_for_status()
        return len(resp.json()) > 0

    def import_batch_transactional(self, site_id: str, cells: list[dict], observations: list[dict]) -> dict:
        """Atomic Phase B write (STEP 4A hardening): both tables written by
        a single Postgres function call (migration 0008,
        import_insar_grid_batch), inside one transaction. Either the
        complete import commits or the complete import rolls back - there
        is no partial-cells-no-observations state possible, unlike two
        separate REST requests. Requires migration 0008 to be applied
        (returns a 404-shaped PostgREST error otherwise, surfaced via
        raise_for_status - callers should not swallow that)."""
        resp = requests.post(
            f"{self.url}/rest/v1/rpc/import_insar_grid_batch",
            headers=self._headers(),
            json={"p_site_id": site_id, "p_cells": cells, "p_observations": observations},
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()

    # Lower-level, non-transactional upserts. Not used by Phase B (see
    # import_batch_transactional above) - kept only as a building block for
    # ad hoc/manual debugging against a single table, never call these two
    # for a production import: they have no atomicity across the two
    # tables, which is exactly the gap STEP 4A closes.
    def upsert_cells(self, rows: list[dict], chunk_size: int = 500) -> int:
        return self._upsert("insar_grid_cells", rows, "site_id,grid_id", chunk_size)

    def upsert_observations(self, rows: list[dict], chunk_size: int = 500) -> int:
        return self._upsert("insar_grid_observations", rows, "site_id,grid_id,pair", chunk_size)

    def _upsert(self, table: str, rows: list[dict], on_conflict: str, chunk_size: int) -> int:
        written = 0
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i : i + chunk_size]
            resp = requests.post(
                f"{self.url}/rest/v1/{table}",
                headers=self._headers(prefer="resolution=merge-duplicates,return=minimal"),
                params={"on_conflict": on_conflict},
                json=chunk,
                timeout=60,
            )
            resp.raise_for_status()
            written += len(chunk)
        return written
