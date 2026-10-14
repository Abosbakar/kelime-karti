import { useState } from 'react';
import { FileImport } from '../add/FileImport';
import { PasteImport } from '../add/PasteImport';
import { SingleAdd } from '../add/SingleAdd';

const TABS = [
  { id: 'single', label: 'Tek tek' },
  { id: 'paste', label: 'Yapıştır' },
  { id: 'file', label: 'Excel / CSV' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AddPage({ today }: { today: string }) {
  const [tab, setTab] = useState<TabId>('single');

  return (
    <>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'single' && <SingleAdd today={today} />}
      {tab === 'paste' && <PasteImport today={today} />}
      {tab === 'file' && <FileImport today={today} />}
    </>
  );
}
