import { randomUUID } from "crypto";
import { getDbInstance } from "./core";

type DbLike = ReturnType<typeof getDbInstance>;

export interface ProxyPool {
  id: string;
  name: string;
  proxyUrl: string;
  noProxy?: string;
  type: "http" | "relay";
  isActive: boolean;
  strictProxy: boolean;
  testStatus: "unknown" | "active" | "error";
  lastTestedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

interface JsonRecord {
  [key: string]: unknown;
}

// Simple in-memory cache for proxy pools
const poolCache = new Map<string, { pools: ProxyPool[]; time: number }>();
const CACHE_TTL = 30_000; // 30 seconds

function invalidatePoolCache(id?: string) {
  poolCache.clear();
}

function toRow(pool: Partial<ProxyPool> & { id: string; createdAt: string; updatedAt: string }) {
  return {
    id: pool.id,
    isActive: pool.isActive === false ? 0 : 1,
    strictProxy: pool.strictProxy === true ? 1 : 0,
    testStatus: pool.testStatus || "unknown",
    data: JSON.stringify({
      name: pool.name || "",
      proxyUrl: pool.proxyUrl || "",
      noProxy: pool.noProxy || "",
      type: pool.type || "http",
      lastTestedAt: pool.lastTestedAt || null,
      lastError: pool.lastError || null,
    }),
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
  };
}

function rowToPool(row: JsonRecord): ProxyPool {
  const extra = JSON.parse((row.data as string) || "{}");
  return {
    id: row.id as string,
    name: extra.name || "",
    proxyUrl: extra.proxyUrl || "",
    noProxy: extra.noProxy || "",
    type: extra.type || "http",
    isActive: !!row.isActive,
    strictProxy: !!row.strictProxy,
    testStatus: (row.testStatus || "unknown") as ProxyPool["testStatus"],
    lastTestedAt: extra.lastTestedAt || undefined,
    lastError: extra.lastError || undefined,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

export function getProxyPools(isActive?: boolean): ProxyPool[] {
  const db = getDbInstance() as unknown as DbLike;
  let sql = "SELECT * FROM proxy_pools";
  const params: unknown[] = [];
  if (isActive !== undefined) {
    sql += " WHERE is_active = ?";
    params.push(isActive ? 1 : 0);
  }
  sql += " ORDER BY created_at DESC";
  const rows = db.prepare(sql).all(...params) as JsonRecord[];
  return rows.map(rowToPool);
}

export function getProxyPoolById(id: string): ProxyPool | null {
  const db = getDbInstance() as unknown as DbLike;
  const row = db.prepare("SELECT * FROM proxy_pools WHERE id = ?").get(id) as JsonRecord | undefined;
  if (!row) return null;
  return rowToPool(row);
}

export function createProxyPool(data: {
  name: string;
  proxyUrl: string;
  noProxy?: string;
  type?: "http" | "relay";
  isActive?: boolean;
  strictProxy?: boolean;
}): ProxyPool {
  const db = getDbInstance() as unknown as DbLike;
  const now = new Date().toISOString();
  const pool = {
    id: randomUUID(),
    name: data.name,
    proxyUrl: data.proxyUrl,
    noProxy: data.noProxy || "",
    type: data.type || "http",
    isActive: data.isActive !== undefined ? data.isActive : true,
    strictProxy: data.strictProxy === true,
    testStatus: "unknown" as const,
    createdAt: now,
    updatedAt: now,
  };
  const row = toRow(pool);
  db.prepare(
    `INSERT INTO proxy_pools (id, is_active, strict_proxy, test_status, data, created_at, updated_at)
     VALUES (@id, @isActive, @strictProxy, @testStatus, @data, @createdAt, @updatedAt)`
  ).run(row);
  invalidatePoolCache(pool.id);
  return getProxyPoolById(pool.id)!;
}

export function updateProxyPool(
  id: string,
  data: Partial<{
    name: string;
    proxyUrl: string;
    noProxy: string;
    type: "http" | "relay";
    isActive: boolean;
    strictProxy: boolean;
    testStatus: "unknown" | "active" | "error";
    lastTestedAt: string;
    lastError: string;
  }>
): ProxyPool {
  const existing = getProxyPoolById(id);
  if (!existing) throw new Error(`Proxy pool ${id} not found`);

  const now = new Date().toISOString();
  const merged = {
    ...existing,
    ...data,
    updatedAt: now,
  };

  const db = getDbInstance() as unknown as DbLike;
  db.prepare(
    `UPDATE proxy_pools SET is_active = @isActive, strict_proxy = @strictProxy, test_status = @testStatus, data = @data, updated_at = @updatedAt
     WHERE id = @id`
  ).run({
    id,
    isActive: merged.isActive ? 1 : 0,
    strictProxy: merged.strictProxy ? 1 : 0,
    testStatus: merged.testStatus,
    data: JSON.stringify({
      name: merged.name,
      proxyUrl: merged.proxyUrl,
      noProxy: merged.noProxy || "",
      type: merged.type,
      lastTestedAt: merged.lastTestedAt || null,
      lastError: merged.lastError || null,
    }),
    updatedAt: now,
  });
  invalidatePoolCache(id);
  return getProxyPoolById(id)!;
}

export function deleteProxyPool(id: string): void {
  const db = getDbInstance() as unknown as DbLike;
  db.prepare("DELETE FROM proxy_pools WHERE id = ?").run(id);
  invalidatePoolCache(id);
}

export async function testProxyPoolUrl(
  proxyUrl: string,
  type: string,
  targetUrl = "https://httpbin.org/get"
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  if (type === "relay") {
    return testRelayProxy(proxyUrl, targetUrl);
  }
  return testStandardProxy(proxyUrl, targetUrl);
}

async function testStandardProxy(
  proxyUrl: string,
  targetUrl: string
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const { ProxyAgent } = await import("undici");
    const dispatcher = new ProxyAgent(proxyUrl);
    const response = await fetch(targetUrl, {
      // @ts-expect-error - undici dispatcher is not in standard RequestInit types
      dispatcher,
      signal: AbortSignal.timeout(10_000),
    });
    const latencyMs = Date.now() - start;
    return { ok: response.ok, latencyMs, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    return { ok: false, latencyMs, error: (err as Error).message };
  }
}

async function testRelayProxy(
  relayUrl: string,
  targetUrl: string
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const parsed = new URL(targetUrl);
    const response = await fetch(relayUrl, {
      method: "GET",
      headers: {
        "x-relay-target": `${parsed.protocol}//${parsed.host}`,
        "x-relay-path": `${parsed.pathname}${parsed.search}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const latencyMs = Date.now() - start;
    return { ok: response.ok, latencyMs, error: response.ok ? undefined : `Relay HTTP ${response.status}` };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    return { ok: false, latencyMs, error: (err as Error).message };
  }
}

/**
 * Resolve proxy config for a proxy pool ID.
 * Returns config suitable for providerSpecificData or direct fetch use.
 */
export function resolvePoolProxyConfig(poolId: string | null | undefined): {
  connectionProxyEnabled: boolean;
  connectionProxyUrl: string;
  connectionNoProxy: string;
  connectionProxyPoolId: string | null;
  relayUrl: string;
  strictProxy: boolean;
} {
  const none = {
    connectionProxyEnabled: false,
    connectionProxyUrl: "",
    connectionNoProxy: "",
    connectionProxyPoolId: null,
    relayUrl: "",
    strictProxy: false,
  };

  if (!poolId || poolId === "__none__") return none;

  const pool = getProxyPoolById(poolId);
  if (!pool || !pool.isActive) return none;

  if (pool.type === "relay") {
    return {
      connectionProxyEnabled: false,
      connectionProxyUrl: "",
      connectionNoProxy: pool.noProxy || "",
      connectionProxyPoolId: pool.id,
      relayUrl: pool.proxyUrl,
      strictProxy: pool.strictProxy,
    };
  }

  return {
    connectionProxyEnabled: true,
    connectionProxyUrl: pool.proxyUrl,
    connectionNoProxy: pool.noProxy || "",
    connectionProxyPoolId: pool.id,
    relayUrl: "",
    strictProxy: pool.strictProxy,
  };
}
