'use client';

import { useMemo } from 'react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { chatIdentity, type ChatIdentity } from '@/lib/hub/themeChat';
import { deviceSeed } from '@/lib/live/shortsPass';
import { UNITAS_MAIL_METADATA_KEY } from '@/lib/auth/unitasHandle';

/**
 * REV-29 MISSION 4 -- who the visitor is inside the UNITAS hub: the account's
 * mail handle, else the profile name, else the local guest number, else a
 * stable nomad tag from the device seed. Shared by the exchange ticker and
 * the theme chat rooms so one visitor is one name everywhere in the hub.
 */
export function useHubIdentity(): ChatIdentity {
  const { session, profile, guest } = useWallet();
  return useMemo(() => {
    const meta = (session?.user.user_metadata ?? null) as Record<string, unknown> | null;
    const raw = meta?.[UNITAS_MAIL_METADATA_KEY];
    const handle = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    return chatIdentity({
      handle,
      fullName: profile?.full_name ?? null,
      userId: session?.user.id ?? null,
      guestId: guest?.id ?? null,
      guestVirtualId: guest?.virtualId ?? null,
      deviceSeed: deviceSeed(),
    });
  }, [session, profile, guest]);
}
