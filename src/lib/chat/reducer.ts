import { deriveTitle } from './conversation';
import type { AssistantTurn, Conversation, GenerationStats, UserTurn } from './types';

export interface ChatState {
  conversation: Conversation;
  /** Bumped whenever the conversation reaches a state worth persisting. */
  revision: number;
}

export type ChatAction =
  | { type: 'open'; conversation: Conversation }
  | { type: 'submit'; user: UserTurn; assistant: AssistantTurn }
  | { type: 'regenerate'; assistant: AssistantTurn }
  | { type: 'delta'; id: string; text: string; thought: string; now: number }
  | {
      type: 'finish';
      id: string;
      status: 'done' | 'cancelled' | 'error';
      stats?: GenerationStats;
      error?: string;
      now: number;
    };

function updateAssistant(state: ChatState, id: string, update: (turn: AssistantTurn) => AssistantTurn): Conversation {
  return {
    ...state.conversation,
    messages: state.conversation.messages.map((m) => (m.role === 'assistant' && m.id === id ? update(m) : m)),
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'open':
      return { conversation: action.conversation, revision: state.revision };

    case 'submit': {
      const isFirst = !state.conversation.messages.some((m) => m.role === 'user');
      return {
        ...state,
        conversation: {
          ...state.conversation,
          title: isFirst ? deriveTitle(action.user) : state.conversation.title,
          updatedAt: action.user.createdAt,
          messages: [...state.conversation.messages, action.user, action.assistant],
        },
      };
    }

    case 'regenerate': {
      const messages = [...state.conversation.messages];
      if (messages[messages.length - 1]?.role === 'assistant') messages.pop();
      return { ...state, conversation: { ...state.conversation, messages: [...messages, action.assistant] } };
    }

    case 'delta':
      return {
        ...state,
        conversation: updateAssistant(state, action.id, (turn) => {
          const thought = turn.thought + action.thought;
          const answerStarts = action.text.length > 0 && turn.text.length === 0;
          return {
            ...turn,
            text: turn.text + action.text,
            thought,
            thoughtMs: answerStarts && thought && turn.thoughtMs === undefined ? action.now - turn.createdAt : turn.thoughtMs,
          };
        }),
      };

    case 'finish':
      return {
        revision: state.revision + 1,
        conversation: {
          ...updateAssistant(state, action.id, (turn) => ({
            ...turn,
            status: action.status,
            stats: action.stats ?? turn.stats,
            error: action.error,
            thoughtMs: turn.thoughtMs ?? (turn.thought ? action.now - turn.createdAt : undefined),
          })),
          updatedAt: action.now,
        },
      };
  }
}
