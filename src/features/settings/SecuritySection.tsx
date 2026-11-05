import { useEffect, useState } from 'react';
import { Notice } from '../../components/ui/Notice';
import { Switch } from '../../components/ui/Switch';
import { AUTH_CANCELLED, errorCode, errorMessage, Vault, type KeyStorage, type VaultStatus } from '../../lib/native';
import { Row, Section } from './parts';

const STORAGE_LABEL: Record<KeyStorage, string> = {
  strongbox: 'StrongBox（専用セキュリティチップ）',
  tee: 'TEE（端末内の安全領域）',
  software: 'ソフトウェア',
};

export function SecuritySection() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Vault.status()
      .then(setStatus)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await Vault.setHistoryLock({ enabled });
      setStatus((current) => current && { ...current, historyLock: result.historyLock, keyStorage: result.keyStorage });
    } catch (e) {
      if (errorCode(e) !== AUTH_CANCELLED) setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section label="セキュリティ">
      <Row
        title="履歴を開くときに認証"
        description={
          status && !status.lockAvailable
            ? '端末に画面ロックが設定されていないため、利用できません。'
            : '履歴の表示と全削除の前に、生体認証または画面ロックの解除を求めます。会話の保存には認証は不要です。'
        }
        control={
          <Switch
            label="履歴を開くときに認証"
            checked={status?.historyLock ?? false}
            disabled={!status?.lockAvailable || busy}
            onCheckedChange={toggle}
          />
        }
      />
      {status?.historyLock && (
        <div className="px-3.5 py-3">
          <Notice tone="warning">
            端末の画面ロック（PIN・パターン・パスワード）をなしにすると、保存した会話は読めなくなります。指紋や顔の登録を変えても影響はありません。
          </Notice>
        </div>
      )}
      <Row
        title="鍵の保管場所"
        description={status?.keyStorage ? STORAGE_LABEL[status.keyStorage] : '最初の会話を保存したときに作成されます。'}
      />
      {status && status.accessibilityServices.length > 0 && (
        <div className="px-3.5 py-3">
          <Notice tone="warning">
            次のアプリが画面の内容を読み取れる状態です: {status.accessibilityServices.join('、')}。心当たりがない場合は、端末の設定から無効にしてください。
          </Notice>
        </div>
      )}
      {error && (
        <div className="px-3.5 py-3">
          <Notice tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}
    </Section>
  );
}
