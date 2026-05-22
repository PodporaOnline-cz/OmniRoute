# OpenCode Free implementation plan

## Phase 1: Syntetická DB connection pro no-auth providery
- [x] Research hotový
- [ ] Create helper `ensureNoAuthProviderConnection(providerId)`
- [ ] Update `auth.ts` → `noauth:${providerId}` místo "noauth"
- [ ] Update provider detail page → zobrazit connection

## Phase 2: Proxy picker v NoAuthProviderCard
- [ ] Port 9router pattern → ProxyConfigModal s level="provider"
- [ ] Přidat props: providerId, providerName, onProxySaved

## Phase 3: Vyčištění starých modelů z DB
- [ ] Vyčistit modely pod starým "noauth" ID

## Phase 4: Proxy pools + CF relay (následně)
