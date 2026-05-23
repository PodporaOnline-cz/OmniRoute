-- Proxy Pools table for OmniRoute fork
-- Ported from 9router proxy-pools pattern
-- Each pool is either a standard HTTP/SOCKS proxy or a relay (Cloudflare/Vercel) URL

CREATE TABLE IF NOT EXISTS proxy_pools (
  id TEXT PRIMARY KEY,
  is_active INTEGER DEFAULT 1,
  strict_proxy INTEGER DEFAULT 0,
  test_status TEXT DEFAULT 'unknown',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pp_active ON proxy_pools(is_active);
CREATE INDEX IF NOT EXISTS idx_pp_status ON proxy_pools(test_status);
