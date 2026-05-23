# Proxy Pools + Cloudflare Relay

## Fáze 1: Proxy pools systém
- Přidat `proxyPools` tabulku (jednoduchá: id, name, type, proxy_url, is_active, strict_proxy, test_status)
- CRUD API: GET/POST /api/proxy-pools, GET/PUT/DELETE /api/proxy-pools/[id], POST /api/proxy-pools/[id]/test
- UI: Proxy Pools dashboard page
- Integrace: provider connection creation/update s proxyPoolId

## Fáze 2: Relay pattern
- Přidat `relay` type do proxy pools
- Upravit `proxyAwareFetch()` na detekci relay proxy → použití x-relay-target/x-relay-path
- Upravit auth.ts na propagaci relayUrl do providerSpecificData

## Fáze 3: Cloudflare Workers deployer
- API route POST /api/proxy-pools/cloudflare-deploy
- Deployne CF Worker s relay logikou
- Worker kód: ~20 řádků, fetch + forward
- Vytvoří proxy pool s type="relay"

## Fáze 4: No-auth integrace
- Zajistit že NoAuthProxyCard (nebo stávající NoAuthProviderCard) umí vybrat proxy pool
- Uložit pool ID do `providerStrategies[providerId].proxyPoolId` (settings)
- auth.ts no-auth větev použije proxy pool
