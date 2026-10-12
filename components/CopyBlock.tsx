'use client';
import { useState } from 'react';

export function CopyBlock({ code, label = 'Copy' }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copyblock">
      <pre><code>{code}</code></pre>
      <button
        type="button"
        className="copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
      >
        {copied ? 'Copied' : label}
      </button>
    </div>
  );
}
