"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { hasRole, type AppRole } from "./permissions";

export type CurrentUserResponse = {
  user_id: string | null;
  role: AppRole;
  status: "active" | "inactive";
  full_name: string | null;
  assigned_site_id: string | null;
};

// Client-side counterpart to src/lib/auth/roles.ts - reads the same /api/me
// endpoint the app shell already uses, but exposed as a reusable hook so
// every page that needs to disable/hide an operator-or-admin action (rather
// than just nav visibility) shares one source of truth instead of each
// component re-fetching and re-deriving its own role check.
export function useCurrentUser() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<CurrentUserResponse>("/api/me"),
    staleTime: 60_000,
  });

  const role = query.data?.data?.role ?? null;

  return {
    ...query,
    role,
    userId: query.data?.data?.user_id ?? null,
    status: query.data?.data?.status ?? null,
    can: (min: AppRole) => hasRole(role, min),
  };
}
