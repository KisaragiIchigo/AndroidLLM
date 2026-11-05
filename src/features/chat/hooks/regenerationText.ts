import { attachmentLabel } from '../../../lib/chat/conversation';
import type { UserTurn } from '../../../lib/chat/types';

/**
 * Media payloads are released once an answer completes, so a regeneration re-sends
 * document bodies inline and leaves a short note for media that can no longer be replayed.
 */
export function regenerationText(turn: UserTurn): string {
  const parts = turn.attachments.map((a) =>
    a.kind === 'document' && a.text
      ? `【添付文書: ${a.name}】\n${a.text}\n【添付文書ここまで】`
      : `［${attachmentLabel(a)}を添付済み。内容は再送できないため、これまでの会話から判断してください］`,
  );
  return [...parts, turn.text].filter(Boolean).join('\n');
}
