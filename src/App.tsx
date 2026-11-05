import { App as CapacitorApp } from '@capacitor/app';
import { domAnimation, LazyMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { useEngine } from './features/boot/useEngine';
import { ChatScreen } from './features/chat/ChatScreen';
import { ModelSetup } from './features/setup/ModelSetup';
import { handleBack } from './lib/back/backStack';
import { loadSettings, saveSettings, type Settings } from './lib/settings';

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const engine = useEngine(settings.backend, settings.maxTokens);

  useEffect(() => {
    const handle = CapacitorApp.addListener('backButton', () => {
      if (!handleBack()) void CapacitorApp.minimizeApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return (
    <LazyMotion features={domAnimation} strict>
      {engine.state.phase === 'setup' ? (
        <ModelSetup status={engine.state.status} onReady={engine.reload} />
      ) : engine.state.phase === 'checking' ? (
        <div className="h-full" />
      ) : (
        <ChatScreen engine={engine} settings={settings} onSettingsChange={updateSettings} />
      )}
    </LazyMotion>
  );
}
