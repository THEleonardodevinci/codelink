'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';

const TEXT_EXT = /\.(html?|css|scss|sass|less|m?jsx?|cjs|tsx?|json|md|mdx|txt|svg|xml|ya?ml|toml|vue|svelte|astro|csv|map|gitignore|npmrc|nvmrc|editorconfig|prettierrc|eslintrc)$/i;
const SKIP = /(^|\/)(node_modules|\.git|\.next|\.vercel|__MACOSX)\/|(^|\/)\.DS_Store$/;

type Project = { project_id: string; name: string };

export function ZipPublish({ projects, disabled }: { projects: Project[]; disabled: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState('new');
  const [name, setName] = useState('');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; id?: string } | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setResult(null);
    if (!name) setName(f.name.replace(/\.zip$/i, ''));
  }

  async function publish() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter((e) => !e.dir && !SKIP.test(e.name));
      // If everything sits in one top-level folder (common for zipped folders), strip it.
      const tops = new Set(entries.map((e) => e.name.split('/')[0]));
      const strip = tops.size === 1 && entries.every((e) => e.name.includes('/')) ? `${[...tops][0]}/` : '';
      const files = await Promise.all(
        entries.map(async (e) => {
          const path = e.name.slice(strip.length);
          const text = TEXT_EXT.test(path) || !/\.[^/]+$/.test(path);
          return text
            ? { path, content: await e.async('string') }
            : { path, content: await e.async('base64'), encoding: 'base64' };
        }),
      );
      const res = await fetch('/api/v1/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          ...(target === 'new' ? { name } : { project_id: target }),
          message: `Upload ${file.name}`,
        }),
      });
      const body = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
      if (!res.ok) setResult({ ok: false, text: body.error || 'Publish failed' });
      else {
        setResult({ ok: true, text: `Published ${body.files_published} files as ${body.project_id}. Building now.`, id: body.project_id });
        setFile(null);
        router.refresh();
      }
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Could not read that zip file' });
    }
    setBusy(false);
  }

  return (
    <div className="stack-sm">
      <div
        className={`dropzone${over ? ' over' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
      >
        {file ? <strong>{file.name}</strong> : <span>Drop a .zip of your project here, or <u>choose a file</u></span>}
        <input ref={input} type="file" accept=".zip" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <label>
          Publish to
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="new">New project</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>{p.name} ({p.project_id})</option>
            ))}
          </select>
        </label>
        {target === 'new' && (
          <label>
            Project name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-site" />
          </label>
        )}
      </div>
      <div className="row">
        <button className="btn small" onClick={publish} disabled={!file || busy || disabled} type="button">
          {busy ? 'Publishing…' : 'Publish'}
        </button>
        {disabled && <span className="muted small">Connect Vercel first.</span>}
      </div>
      {result && (
        <p className={result.ok ? 'ok-msg' : 'error-msg'} role="status">
          {result.text} {result.id && <a href={`/dashboard/projects/${result.id}`}>View project</a>}
        </p>
      )}
    </div>
  );
}
