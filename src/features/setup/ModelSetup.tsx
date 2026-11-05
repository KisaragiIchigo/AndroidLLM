import { m } from 'framer-motion';
import { FolderInput, HardDriveDownload, Loader2, PackageOpen } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Notice } from '../../components/ui/Notice';
import { formatBytes } from '../../lib/format';
import { errorMessage, Llm, type ImportProgress, type ModelStatus } from '../../lib/native';

interface ModelSetupProps {
  status: ModelStatus;
  onReady: () => void;
}

type Task = 'bundled' | 'import';

const PRIMARY =
  'mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-lamp-light via-lamp to-lamp-deep text-sm font-medium tracking-wider text-lamp-ink shadow-lamp active:scale-[0.98] disabled:opacity-40';
const SECONDARY =
  'mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-paper/[0.07] bg-ink-raised text-sm font-medium tracking-wider active:scale-[0.98] disabled:opacity-40';

function friendlyPath(path: string): string {
  return path.replace(/^\/storage\/emulated\/0/, '内部ストレージ');
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-paper/[0.07] bg-ink-surface p-4">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-[15px] font-semibold tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Progress({ progress }: { progress: ImportProgress | null }) {
  const ratio = progress && progress.total > 0 ? progress.copied / progress.total : 0;
  return (
    <div className="mt-4">
      <div className="h-[3px] overflow-hidden rounded-full bg-paper/[0.08]">
        <div className="h-full rounded-full bg-gradient-to-r from-lamp-deep to-lamp transition-[width]" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <p className="mt-2 font-mono text-xs text-paper-muted">
        {progress ? `${formatBytes(progress.copied)}${progress.total > 0 ? ` / ${formatBytes(progress.total)}` : ''}` : '準備しています…'}
      </p>
    </div>
  );
}

export function ModelSetup({ status, onReady }: ModelSetupProps) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [running, setRunning] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const bundled = status.bundledSizeBytes !== undefined;

  useEffect(() => {
    const handle = Llm.addListener('importProgress', setProgress);
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  const run = async (task: Task) => {
    setError(null);
    setRunning(task);
    setProgress(null);
    try {
      const result = task === 'bundled' ? await Llm.extractBundledModel() : await Llm.importModel();
      if (result.imported) onReady();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(null);
    }
  };

  const recheck = async () => {
    setError(null);
    const next = await Llm.getModelStatus();
    if (next.present) onReady();
    else setChecked(true);
  };

  const icon = (Icon: typeof HardDriveDownload) => <Icon className="h-5 w-5 text-lamp" strokeWidth={1.8} />;

  return (
    <div className="h-full overflow-y-auto px-5 pb-safe pt-safe">
      <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mx-auto max-w-md py-10">
        <p className="font-display text-[clamp(30px,9vw,40px)] font-bold tracking-tight">
          Hisoka<span className="text-lamp">.</span>
        </p>
        <h1 className="mt-6 text-lg font-semibold tracking-wide">モデルを準備します</h1>
        <p className="mt-2 text-sm leading-relaxed text-paper-muted">
          {bundled
            ? 'このアプリには AI モデル（Gemma 4 E2B）が同梱されています。最初に一度だけ、アプリが読み込める場所へ展開してください。'
            : 'このアプリは通信を行わないため、AI モデル（gemma-4-E2B-it.litertlm、約 2.6GB）を一度だけ端末に置く必要があります。次のどちらかの方法で準備してください。'}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {bundled && (
            <Card icon={icon(PackageOpen)} title="同梱モデルを展開する">
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">
                {formatBytes(status.bundledSizeBytes ?? 0)} を端末内にコピーします。1分ほどかかる場合があります。空き容量が {formatBytes((status.bundledSizeBytes ?? 0) + 512 * 1024 ** 2)} 以上必要です。
              </p>
              {running === 'bundled' && <Progress progress={progress} />}
              <button type="button" onClick={() => run('bundled')} disabled={running !== null} className={PRIMARY}>
                {running === 'bundled' && <Loader2 className="h-4 w-4 animate-spin" />}
                {running === 'bundled' ? '展開中…' : '展開する'}
              </button>
            </Card>
          )}

          {bundled && <p className="mt-2 text-sm leading-relaxed text-paper-muted">別のモデルファイルを使う場合は、次の方法も利用できます。</p>}

          <Card icon={icon(HardDriveDownload)} title="端末内のファイルから取り込む">
            <p className="mt-2 text-sm leading-relaxed text-paper-muted">
              ダウンロード済みの .litertlm ファイルを選ぶと、アプリ内にコピーします。取り込みが終わったら、元のファイルは削除しても問題ありません。
            </p>
            {running === 'import' && <Progress progress={progress} />}
            <button type="button" onClick={() => run('import')} disabled={running !== null} className={bundled ? SECONDARY : PRIMARY}>
              {running === 'import' && <Loader2 className="h-4 w-4 animate-spin" />}
              {running === 'import' ? '取り込み中…' : 'ファイルを選ぶ'}
            </button>
          </Card>

          <Card icon={icon(FolderInput)} title="PC から USB で直接置く">
            <p className="mt-2 text-sm leading-relaxed text-paper-muted">
              端末を PC につなぎ、次のフォルダに .litertlm ファイルをコピーしてから「確認する」を押してください。容量を二重に使わないため、空きが少ない場合におすすめです。
            </p>
            <p className="mt-3 break-all rounded-lg border border-paper/[0.04] bg-black/40 px-3 py-2 font-mono text-xs leading-relaxed text-lamp-hi shadow-inset">
              {friendlyPath(status.externalDir)}
            </p>
            <button type="button" onClick={recheck} disabled={running !== null} className={SECONDARY}>
              確認する
            </button>
            {checked && <p className="mt-2 text-sm text-paper-muted">まだファイルが見つかりません。</p>}
          </Card>

          {error && <Notice tone="danger">{error}</Notice>}

          {!bundled && (
            <p className="mt-2 text-sm leading-relaxed text-paper-muted">
              モデルの入手先は Hugging Face の「litert-community/gemma-4-E2B-it-litert-lm」です。PC などで事前にダウンロードしてください。動作の目安は、RAM 8GB 以上・Android 11 以降の端末です。
            </p>
          )}
        </div>
      </m.div>
    </div>
  );
}
