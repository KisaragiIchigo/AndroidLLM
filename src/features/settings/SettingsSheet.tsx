import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Notice } from '../../components/ui/Notice';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { Slider } from '../../components/ui/Slider';
import { Switch } from '../../components/ui/Switch';
import { formatBytes } from '../../lib/format';
import { errorMessage, Vault } from '../../lib/native';
import {
  CONTEXT_OPTIONS,
  THINK_BUDGET_MAX,
  THINK_BUDGET_MIN,
  THINK_BUDGET_UNLIMITED,
  type Settings,
} from '../../lib/settings';
import type { EngineState } from '../boot/useEngine';
import { Row, Section } from './parts';
import { PersonaSection } from './PersonaSection';
import { SecuritySection } from './SecuritySection';

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  engine: EngineState;
  onDeleteModel: () => Promise<void>;
  onDeleteAllConversations: () => Promise<void>;
}

const APP_VERSION = '1.3.0';
const BUDGET_STEP = 256;
const UNLIMITED_POSITION = THINK_BUDGET_MAX + BUDGET_STEP;

export function SettingsSheet({ open, onOpenChange, settings, onChange, engine, onDeleteModel, onDeleteAllConversations }: SettingsSheetProps) {
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'model' | 'history' | null>(null);

  useEffect(() => {
    if (!open) return;
    Vault.getSecureScreen()
      .then(({ enabled }) => setSecure(enabled))
      .catch((e) => setError(errorMessage(e)));
  }, [open]);

  const toggleSecure = async (enabled: boolean) => {
    setSecure(enabled);
    try {
      await Vault.setSecureScreen({ enabled });
    } catch (e) {
      setSecure(!enabled);
      setError(errorMessage(e));
    }
  };

  const status = engine.phase === 'checking' ? null : engine.status;
  const busy = engine.phase === 'loading' || engine.phase === 'checking';
  const budgetPosition = settings.thinkBudget === THINK_BUDGET_UNLIMITED ? UNLIMITED_POSITION : settings.thinkBudget;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} title="設定" tall>
        <div className="flex flex-col gap-5">
          <div className="flex gap-3 rounded-2xl border border-sealed/20 bg-sealed/[0.05] p-3.5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sealed" strokeWidth={1.8} />
            <div>
              <p className="text-[15px] font-semibold tracking-wide">この端末から外へは出ません</p>
              <p className="mt-1 text-sm leading-relaxed text-paper-muted">
                このアプリはインターネット権限を持たないため、会話・添付ファイル・モデルの通信は OS によって遮断されています。
              </p>
            </div>
          </div>

          {error && <Notice tone="danger" onDismiss={() => setError(null)}>{error}</Notice>}

          <PersonaSection persona={settings.persona} onChange={(persona) => onChange({ persona })} />

          <Section label="モデル">
            <Row
              title={status?.present ? 'Gemma 4 E2B' : 'モデル未設定'}
              description={[
                status?.fileName ?? null,
                status?.sizeBytes ? formatBytes(status.sizeBytes) : null,
                engine.phase === 'ready' ? `${engine.backend.toUpperCase()} で動作中` : busy ? '読み込み中' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            {engine.phase === 'ready' && engine.gpuError && settings.backend === 'gpu' && (
              <div className="px-3.5 py-3">
                <Notice tone="warning">この端末では GPU を利用できなかったため、CPU で動作しています。</Notice>
              </div>
            )}
            <Row
              title="推論バックエンド"
              description="GPU が使えない端末では、自動的に CPU で動作します。"
              control={
                <Segmented
                  label="推論バックエンド"
                  value={settings.backend}
                  disabled={busy}
                  onChange={(backend) => onChange({ backend })}
                  options={[
                    { value: 'gpu', label: 'GPU' },
                    { value: 'cpu', label: 'CPU' },
                  ]}
                />
              }
            />
            <Row
              title="コンテキスト長"
              description="長くすると長文や長い会話を扱えますが、メモリ使用量が増えます。変更するとモデルを読み込み直します。"
              control={
                <Segmented
                  label="コンテキスト長"
                  value={settings.maxTokens}
                  disabled={busy}
                  onChange={(maxTokens) => onChange({ maxTokens })}
                  options={CONTEXT_OPTIONS.map((v) => ({ value: v, label: `${v / 1024}K` }))}
                />
              }
            />
          </Section>

          <Section label="THINK モード">
            <div className="px-3.5 pb-3 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-[15px]">思考トークンの上限</p>
                <span className="rounded-md bg-lamp/10 px-2 py-0.5 font-mono text-xs text-lamp-hi shadow-lamp">
                  {settings.thinkBudget === THINK_BUDGET_UNLIMITED ? '無制限' : settings.thinkBudget}
                </span>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-paper-muted">Think をオンにしたとき、回答の前に考える量の上限です。</p>
              <Slider
                label="思考トークンの上限"
                value={budgetPosition}
                min={THINK_BUDGET_MIN}
                max={UNLIMITED_POSITION}
                step={BUDGET_STEP}
                onValueChange={(v) => onChange({ thinkBudget: v >= UNLIMITED_POSITION ? THINK_BUDGET_UNLIMITED : v })}
              />
              <div className="flex justify-between font-mono text-xs text-paper-muted">
                <span>{THINK_BUDGET_MIN}</span>
                <span>無制限</span>
              </div>
            </div>
            <Row
              title="思考量の自動調整"
              description="添削の依頼や短いメッセージでは、思考の上限を 512 に抑えて応答を速くします。"
              control={
                <Switch
                  label="思考量の自動調整"
                  checked={settings.autoThinkBudget}
                  onCheckedChange={(autoThinkBudget) => onChange({ autoThinkBudget })}
                />
              }
            />
          </Section>

          <SecuritySection />

          <Section label="プライバシー">
            <Row
              title="揮発モード"
              description="オンにすると会話を保存しません。アプリを閉じると消えます。"
              control={<Switch label="揮発モード" checked={settings.ephemeral} onCheckedChange={(ephemeral) => onChange({ ephemeral })} />}
            />
            <Row
              title="画面の保護"
              description="スクリーンショットと、最近使ったアプリ一覧での表示を防ぎます。"
              control={<Switch label="画面の保護" checked={secure} onCheckedChange={toggleSecure} />}
            />
          </Section>

          <Section label="データ">
            <div className="flex flex-col gap-2 p-3">
              <button
                type="button"
                onClick={() => setConfirm('history')}
                className="h-11 rounded-xl border border-ember/25 bg-ember/10 text-sm font-medium tracking-wider text-ember-text active:scale-[0.97]"
              >
                すべての会話を削除
              </button>
              <button
                type="button"
                onClick={() => setConfirm('model')}
                disabled={busy}
                className="h-11 rounded-xl border border-paper/[0.07] bg-ink-surface text-sm font-medium tracking-wider active:scale-[0.97] disabled:opacity-40"
              >
                モデルを削除して入れ替える
              </button>
            </div>
          </Section>

          <div className="pb-2 text-center">
            <p className="font-mono text-xs text-paper-muted">Hisoka {APP_VERSION} · Gemma 4 E2B · LiteRT-LM</p>
            <p className="mt-1 text-xs leading-relaxed text-paper-muted">Gemma 4 は Google が Apache License 2.0 で公開しているモデルです。</p>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirm === 'history'}
        onOpenChange={(next) => !next && setConfirm(null)}
        title="すべての会話を削除しますか？"
        description="保存されているすべての会話と、その暗号鍵を端末から削除します。元に戻すことはできません。"
        confirmLabel="すべて削除"
        destructive
        onConfirm={async () => {
          setConfirm(null);
          await onDeleteAllConversations();
        }}
      />
      <ConfirmDialog
        open={confirm === 'model'}
        onOpenChange={(next) => !next && setConfirm(null)}
        title="モデルを削除しますか？"
        description="端末内のモデルファイルを削除し、取り込み画面に戻ります。会話の履歴は残ります。"
        confirmLabel="削除する"
        destructive
        onConfirm={async () => {
          setConfirm(null);
          await onDeleteModel();
        }}
      />
    </>
  );
}
