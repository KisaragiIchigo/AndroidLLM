import { useState } from 'react';
import { Notice } from '../../components/ui/Notice';
import { Llm } from '../../lib/native';
import { displayName, type Settings } from '../../lib/settings';
import type { EngineHandle } from '../boot/useEngine';
import { HistorySheet } from '../history/HistorySheet';
import { useAccessibilityWarning } from '../security/useAccessibilityWarning';
import { SettingsSheet } from '../settings/SettingsSheet';
import { AttachSheet, type AttachAction } from './components/AttachSheet';
import { Composer } from './components/Composer';
import { MessageList } from './components/MessageList';
import { MetaRow } from './components/MetaRow';
import { RecorderSheet } from './components/RecorderSheet';
import { useAttachments } from './hooks/useAttachments';
import { useChatSession } from './hooks/useChatSession';

type Panel = 'attach' | 'record' | 'history' | 'settings' | null;

interface ChatScreenProps {
  engine: EngineHandle;
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
}

export function ChatScreen({ engine, settings, onSettingsChange }: ChatScreenProps) {
  const ready = engine.state.phase === 'ready';
  const session = useChatSession({ ready, epoch: engine.epoch, settings });
  const attachments = useAttachments(settings.maxTokens);
  const [panel, setPanel] = useState<Panel>(null);
  const accessibility = useAccessibilityWarning();

  const { messages } = session.conversation;
  const last = messages[messages.length - 1];
  const lastStats = [...messages].reverse().find((m) => m.role === 'assistant' && m.stats);
  const tokensPerSecond = lastStats?.role === 'assistant' && lastStats.stats ? lastStats.stats.tokensPerSecond : null;

  const send = async (text: string) => {
    const staged = attachments.take();
    const ok = await session.send(text, staged);
    if (!ok) attachments.restore(staged);
    return ok;
  };

  const onAttach = (action: AttachAction) => {
    if (action === 'record') {
      setPanel('record');
      return;
    }
    setPanel(null);
    if (action === 'camera') void attachments.capture();
    else void attachments.pick(action);
  };

  const notice =
    engine.state.phase === 'error' ? (
      <Notice tone="danger">
        モデルを読み込めませんでした: {engine.state.message}
        <button type="button" onClick={engine.reload} className="ml-2 underline underline-offset-2">
          再試行
        </button>
      </Notice>
    ) : session.error ? (
      <Notice tone="danger" onDismiss={session.clearError}>
        {session.error}
      </Notice>
    ) : attachments.notice ? (
      <Notice tone="warning" onDismiss={attachments.clearNotice}>
        {attachments.notice}
      </Notice>
    ) : accessibility.services.length > 0 ? (
      <Notice tone="warning" onDismiss={accessibility.dismiss}>
        「{accessibility.services.join('」「')}」が画面の内容を読み取れる状態です。心当たりがない場合は、端末の設定から無効にしてください。
      </Notice>
    ) : null;

  return (
    <div className="flex h-full flex-col">
      <MessageList
        messages={messages}
        conversationId={session.conversation.id}
        assistantName={displayName(settings.persona)}
        canRegenerate={ready && !session.streaming && last?.role === 'assistant'}
        onRegenerate={() => void session.regenerate()}
      />
      <Composer
        meta={
          <MetaRow
            engine={engine.state}
            tokensPerSecond={tokensPerSecond}
            onNewChat={() => void session.newChat()}
            onHistory={() => setPanel('history')}
            onSettings={() => setPanel('settings')}
          />
        }
        notice={notice}
        staged={attachments.staged}
        processing={attachments.processing}
        think={settings.think}
        streaming={session.streaming}
        ready={ready}
        onToggleThink={() => onSettingsChange({ think: !settings.think })}
        onOpenAttach={() => setPanel('attach')}
        onRemoveAttachment={attachments.remove}
        onSend={send}
        onStop={session.cancel}
      />

      <AttachSheet open={panel === 'attach'} onOpenChange={(open) => setPanel(open ? 'attach' : null)} onAction={onAttach} />
      <RecorderSheet open={panel === 'record'} onClose={() => setPanel(null)} onRecorded={attachments.accept} />
      <HistorySheet
        open={panel === 'history'}
        onOpenChange={(open) => setPanel(open ? 'history' : null)}
        currentId={session.conversation.id}
        ephemeral={settings.ephemeral}
        onOpenConversation={session.open}
        onDelete={session.remove}
        onDeleteAll={session.removeAll}
      />
      <SettingsSheet
        open={panel === 'settings'}
        onOpenChange={(open) => setPanel(open ? 'settings' : null)}
        settings={settings}
        onChange={onSettingsChange}
        engine={engine.state}
        onDeleteModel={async () => {
          await session.newChat();
          await Llm.deleteModel();
          setPanel(null);
          engine.reload();
        }}
        onDeleteAllConversations={async () => {
          if (await session.removeAll()) setPanel(null);
        }}
      />
    </div>
  );
}
