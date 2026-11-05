export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString('ja-JP');
}

export function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

export function dayBucket(timestamp: number, now: number): string {
  const startOf = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOf(now) - startOf(timestamp)) / 86_400_000);
  if (days <= 0) return '今日';
  if (days === 1) return '昨日';
  if (days < 7) return '今週';
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(timestamp);
}
