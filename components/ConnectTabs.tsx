'use client';
import { useState } from 'react';
import { CopyBlock } from './CopyBlock';

type Tab = { id: string; label: string; intro: string; code: string };

export function ConnectTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const tab = tabs.find((t) => t.id === active)!;
  return (
    <div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === active} onClick={() => setActive(t.id)} type="button">
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="stack-sm">
        <p className="muted small">{tab.intro}</p>
        <CopyBlock code={tab.code} />
      </div>
    </div>
  );
}
