"use client";

import { useState } from "react";
import Card from "./Card";
import Button from "./Button";
import ProxyConfigModal from "./ProxyConfigModal";

type NoAuthProviderCardProps = {
  providerId: string;
  providerName?: string;
  onProxySaved?: () => void;
};

export default function NoAuthProviderCard({
  providerId,
  providerName,
  onProxySaved,
}: NoAuthProviderCardProps) {
  const [proxyOpen, setProxyOpen] = useState(false);

  return (
    <>
      <Card>
        <div className="flex items-center gap-3">
          <div className="inline-flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-green-500/10 text-green-500">
            <span className="material-symbols-outlined text-[20px]">lock_open</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">No authentication required</p>
            <p className="text-xs text-text-muted">
              This provider is ready to use immediately — no signup or API key needed.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setProxyOpen(true)}
          >
            <span className="material-symbols-outlined text-[14px] mr-1">vpn_lock</span>
            Proxy
          </Button>
        </div>
      </Card>

      <ProxyConfigModal
        isOpen={proxyOpen}
        onClose={() => setProxyOpen(false)}
        level="provider"
        levelId={providerId}
        levelLabel={providerName || providerId}
        onSaved={onProxySaved}
      />
    </>
  );
}
