import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { emptyConversation, resumeHistory, summarize } from '../../../lib/chat/conversation';
import { newId } from '../../../lib/chat/ids';
import { chatReducer, type ChatState } from '../../../lib/chat/reducer';
import { buildSystemPrompt, personaKey } from '../../../lib/chat/systemPrompt';
import { effectiveThinkBudget } from '../../../lib/chat/thinkBudget';
import { withProofreadFormat } from '../../../lib/proofread/instruction';
import type { AssistantTurn, AttachmentMeta, ChatMessage, Conversation, UserTurn } from '../../../lib/chat/types';
import { ATTACHMENT_EXPIRED, AUTH_CANCELLED, errorCode, errorMessage, Llm, Media, Vault } from '../../../lib/native';
import { historyCharBudget, type Settings } from '../../../lib/settings';
import { regenerationText } from './regenerationText';

interface Options {
  ready: boolean;
  epoch: number;
  settings: Settings;
}

function initialState(): ChatState {
  return { conversation: emptyConversation(Date.now()), revision: 0 };
}

/** Native memory may still hold payloads for this conversation (the latest turn, or turns that failed). */
function attachmentIds(conversation: Conversation): string[] {
  return conversation.messages.flatMap((m) => (m.role === 'user' ? m.attachments.map((a) => a.id) : []));
}

export function useChatSession({ ready, epoch, settings }: Options) {
  const [state, dispatch] = useReducer(chatReducer, undefined, initialState);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const activeRequest = useRef<string | null>(null);
  const synced = useRef<{ id: string; epoch: number; prompt: string } | null>(null);
  const [streaming, setStreaming] = useState(false);

  const persist = useCallback(async (conversation: Conversation) => {
    if (settingsRef.current.ephemeral || conversation.messages.length === 0) return;
    try {
      await Vault.save({ conversation, summary: summarize(conversation) });
    } catch (e) {
      setError(`会話を保存できませんでした: ${errorMessage(e)}`);
    }
  }, []);

  useEffect(() => {
    if (state.revision > 0) void persist(state.conversation);
  }, [state.revision, persist]);

  useEffect(() => {
    const handle = Llm.addListener('llmEvent', (event) => {
      if (event.requestId !== activeRequest.current) return;
      const now = Date.now();
      switch (event.type) {
        case 'delta':
          dispatch({ type: 'delta', id: event.requestId, text: event.text, thought: event.thought, now });
          return;
        case 'done':
          dispatch({ type: 'finish', id: event.requestId, status: 'done', stats: event.stats, now });
          break;
        case 'cancelled':
          dispatch({ type: 'finish', id: event.requestId, status: 'cancelled', now });
          synced.current = null;
          break;
        case 'error':
          dispatch({ type: 'finish', id: event.requestId, status: 'error', error: event.message, now });
          synced.current = null;
          break;
      }
      activeRequest.current = null;
      setStreaming(false);
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  const syncContext = useCallback(
    async (conversationId: string, history: ChatMessage[], force: boolean) => {
      const current = synced.current;
      const { persona, maxTokens } = settingsRef.current;
      const prompt = personaKey(persona);
      if (!force && current && current.id === conversationId && current.epoch === epoch && current.prompt === prompt) return;
      await Llm.resetConversation({
        systemPrompt: buildSystemPrompt(persona),
        history: resumeHistory(history, historyCharBudget(maxTokens)),
      });
      synced.current = { id: conversationId, epoch, prompt };
    },
    [epoch],
  );

  const start = useCallback(async (assistant: AssistantTurn, user: UserTurn, fallbackText?: string) => {
    activeRequest.current = assistant.id;
    setStreaming(true);
    const { think, thinkBudget, autoThinkBudget } = settingsRef.current;
    const request = (text: string, ids: string[]) =>
      Llm.send({
        requestId: assistant.id,
        text: withProofreadFormat(text, user.text),
        attachmentIds: ids,
        think,
        thinkBudget: effectiveThinkBudget(thinkBudget, autoThinkBudget, user.text, user.attachments),
      });
    try {
      try {
        await request(user.text, user.attachments.map((a) => a.id));
      } catch (e) {
        if (fallbackText === undefined || errorCode(e) !== ATTACHMENT_EXPIRED) throw e;
        await request(fallbackText, []);
      }
    } catch (e) {
      activeRequest.current = null;
      setStreaming(false);
      dispatch({ type: 'finish', id: assistant.id, status: 'error', error: errorMessage(e), now: Date.now() });
    }
  }, []);

  const newAssistant = (now: number): AssistantTurn => ({
    id: newId(),
    role: 'assistant',
    text: '',
    thought: '',
    thinkEnabled: settingsRef.current.think,
    status: 'streaming',
    createdAt: now,
  });

  const send = useCallback(
    async (text: string, attachments: AttachmentMeta[]): Promise<boolean> => {
      if (!ready || activeRequest.current) return false;
      const conversation = stateRef.current.conversation;
      try {
        await syncContext(conversation.id, conversation.messages, false);
      } catch (e) {
        setError(`会話を準備できませんでした: ${errorMessage(e)}`);
        return false;
      }
      const now = Date.now();
      const user: UserTurn = { id: newId(), role: 'user', text, attachments, createdAt: now };
      const assistant = newAssistant(now);
      dispatch({ type: 'submit', user, assistant });
      await start(assistant, user);
      return true;
    },
    [ready, syncContext, start],
  );

  const regenerate = useCallback(async () => {
    if (!ready || activeRequest.current) return;
    const { messages, id } = stateRef.current.conversation;
    const last = messages[messages.length - 1];
    const user = messages[messages.length - 2];
    if (last?.role !== 'assistant' || user?.role !== 'user') return;
    try {
      await syncContext(id, messages.slice(0, -2), true);
    } catch (e) {
      setError(`会話を準備できませんでした: ${errorMessage(e)}`);
      return;
    }
    const assistant = newAssistant(Date.now());
    dispatch({ type: 'regenerate', assistant });
    await start(assistant, user, regenerationText(user));
  }, [ready, syncContext, start]);

  const cancel = useCallback(() => {
    if (activeRequest.current) void Llm.cancel();
  }, []);

  /** Closes the running turn (if any) and stores the conversation before switching away from it. */
  const leaveCurrent = useCallback(async () => {
    let current = stateRef.current;
    const running = activeRequest.current;
    if (running) {
      activeRequest.current = null;
      setStreaming(false);
      await Llm.cancel();
      current = chatReducer(current, { type: 'finish', id: running, status: 'cancelled', now: Date.now() });
      await persist(current.conversation);
    }
    const leftovers = attachmentIds(current.conversation);
    if (leftovers.length) void Media.discard({ ids: leftovers });
  }, [persist]);

  const newChat = useCallback(async () => {
    await leaveCurrent();
    synced.current = null;
    dispatch({ type: 'open', conversation: emptyConversation(Date.now()) });
  }, [leaveCurrent]);

  const open = useCallback(
    async (id: string) => {
      if (id === stateRef.current.conversation.id) return;
      try {
        const { conversation } = await Vault.read({ id });
        await leaveCurrent();
        synced.current = null;
        dispatch({ type: 'open', conversation });
      } catch (e) {
        setError(`会話を開けませんでした: ${errorMessage(e)}`);
      }
    },
    [leaveCurrent],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await Vault.remove({ id });
        if (id === stateRef.current.conversation.id) {
          await leaveCurrent();
          synced.current = null;
          dispatch({ type: 'open', conversation: emptyConversation(Date.now()) });
        }
      } catch (e) {
        setError(`削除できませんでした: ${errorMessage(e)}`);
      }
    },
    [leaveCurrent],
  );

  /** Resolves false when the user dismissed the authentication prompt. */
  const removeAll = useCallback(async (): Promise<boolean> => {
    try {
      await Vault.removeAll();
    } catch (e) {
      if (errorCode(e) !== AUTH_CANCELLED) setError(`削除できませんでした: ${errorMessage(e)}`);
      return false;
    }
    activeRequest.current = null;
    setStreaming(false);
    await Llm.cancel();
    synced.current = null;
    dispatch({ type: 'open', conversation: emptyConversation(Date.now()) });
    return true;
  }, []);

  return {
    conversation: state.conversation,
    streaming,
    error,
    clearError: () => setError(null),
    send,
    regenerate,
    cancel,
    newChat,
    open,
    remove,
    removeAll,
  };
}
