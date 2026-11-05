import { App as CapacitorApp } from '@capacitor/app';
import { useCallback, useEffect, useState } from 'react';
import { Vault } from '../../lib/native';

/** Re-checks screen-reading accessibility services at launch and whenever the app returns to the foreground. */
export function useAccessibilityWarning() {
  const [services, setServices] = useState<string[]>([]);
  const [dismissedKey, setDismissedKey] = useState('');

  const refresh = useCallback(() => {
    Vault.status()
      .then((status) => setServices(status.accessibilityServices))
      .catch(() => setServices([]));
  }, []);

  useEffect(() => {
    refresh();
    const handle = CapacitorApp.addListener('resume', refresh);
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [refresh]);

  const key = services.join('|');
  return {
    services: key && key !== dismissedKey ? services : [],
    dismiss: () => setDismissedKey(key),
  };
}
