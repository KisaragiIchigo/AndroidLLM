import { useLayoutEffect, useRef } from 'react';
import { proofreadSource } from '../../../lib/chat/conversation';
import type { ChatMessage, UserTurn } from '../../../lib/chat/types';
import { AssistantMessage } from './AssistantMessage';
import { EmptyState } from './EmptyState';
import { UserMessage } from './UserMessage';

interface MessageListProps {
  messages: ChatMessage[];
  conversationId: string;
  assistantName: string;
  canRegenerate: boolean;
  onRegenerate: () => void;
}

const STICK_THRESHOLD_PX = 96;

export function MessageList({ messages, conversationId, assistantName, canRegenerate, onRegenerate }: MessageListProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastCount = useRef(messages.length);
  const lastConversation = useRef(conversationId);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (messages.length !== lastCount.current || conversationId !== lastConversation.current) {
      stick.current = true;
      lastCount.current = messages.length;
      lastConversation.current = conversationId;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, conversationId]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  };

  if (messages.length === 0) return <EmptyState name={assistantName} />;

  return (
    <div ref={scroller} onScroll={onScroll} className="scroll-fade-top min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="flex min-h-full flex-col justify-end gap-4 px-4 pb-3 pt-safe">
        <div className="h-6 shrink-0" />
        {messages.map((message, index) => {
          if (message.role === 'user') return <UserMessage key={message.id} turn={message} />;
          const previous = messages[index - 1];
          return (
            <AssistantMessage
              key={message.id}
              turn={message}
              source={proofreadSource(previous?.role === 'user' ? (previous as UserTurn) : undefined)}
              canRegenerate={canRegenerate && index === messages.length - 1}
              onRegenerate={onRegenerate}
            />
          );
        })}
      </div>
    </div>
  );
}
