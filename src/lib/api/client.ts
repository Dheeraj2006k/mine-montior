export type Envelope<T> = {
  data: T;
  meta: { generated_at: string; source: "live" | "mock" | "cached" };
};

export async function apiGet<T>(path: string): Promise<Envelope<T>> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request to ${path} failed with ${res.status}`);
  }
  return res.json();
}
