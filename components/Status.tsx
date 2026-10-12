export function Status({ value }: { value: string }) {
  const v = value.toUpperCase();
  const cls = v === 'READY' ? 'ready' : v === 'ERROR' || v === 'CANCELED' ? 'error' : v === 'NO_DEPLOYMENTS' ? '' : 'building';
  const text = v === 'READY' ? 'Live' : v === 'ERROR' ? 'Failed' : v === 'CANCELED' ? 'Canceled' : v === 'NO_DEPLOYMENTS' ? 'Not published' : 'Building';
  return <span className={`status ${cls}`}>{text}</span>;
}
