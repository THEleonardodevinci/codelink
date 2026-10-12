import { UserError } from './http';

export type CleanFile = { path: string; content: string; encoding: 'utf-8' | 'base64' };
export type SkippedFile = { path: string; reason: string };

export const LIMITS = { maxFiles: 500, maxBytes: 4_000_000 };

const BLOCKED: [RegExp, string][] = [
  [/(^|\/)\.env(\.(?!example$|sample$)[^/]*)?$/, 'Secrets file. Use set_env for secrets instead of committing them.'],
  [/(^|\/)node_modules\//, 'Dependencies are installed during the build.'],
  [/(^|\/)\.git\//, 'Git internals are managed by CodeLink.'],
  [/(^|\/)\.vercel\//, 'Local Vercel config is managed by CodeLink.'],
  [/(^|\/)\.next\//, 'Build output is generated during the build.'],
  [/(^|\/)\.DS_Store$/, 'OS metadata file.'],
];

function normalizePath(raw: string): string {
  const p = raw.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
  if (!p || p.endsWith('/')) throw new UserError(`Invalid file path "${raw}"`);
  if (p.split('/').some((seg) => seg === '..' || seg === '')) throw new UserError(`Invalid file path "${raw}"`);
  if (p.length > 400) throw new UserError(`File path too long: "${p.slice(0, 60)}..."`);
  return p;
}

export function cleanFiles(raw: unknown): { files: CleanFile[]; skipped: SkippedFile[] } {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new UserError('files must be a non-empty array of { path, content, encoding? } objects');
  }
  const byPath = new Map<string, CleanFile>();
  const skipped: SkippedFile[] = [];
  let bytes = 0;

  for (const f of raw) {
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') {
      throw new UserError('Every file needs a string "path" and a string "content"');
    }
    const encoding = f.encoding === 'base64' ? 'base64' : 'utf-8';
    if (f.encoding && f.encoding !== 'base64' && f.encoding !== 'utf-8') {
      throw new UserError(`Unsupported encoding "${f.encoding}" for ${f.path}. Use "utf-8" or "base64".`);
    }
    const path = normalizePath(f.path);
    const block = BLOCKED.find(([re]) => re.test(path));
    if (block) {
      skipped.push({ path, reason: block[1] });
      continue;
    }
    byPath.set(path, { path, content: f.content, encoding });
  }

  const files = Array.from(byPath.values());
  for (const f of files) {
    bytes += f.encoding === 'base64' ? Math.floor((f.content.length * 3) / 4) : Buffer.byteLength(f.content);
  }
  if (files.length === 0) throw new UserError('No publishable files left after skipping blocked paths.');
  if (files.length > LIMITS.maxFiles) throw new UserError(`Too many files (${files.length}). The limit is ${LIMITS.maxFiles}.`);
  if (bytes > LIMITS.maxBytes) {
    throw new UserError(`Project is ${(bytes / 1e6).toFixed(1)} MB. The limit is ${LIMITS.maxBytes / 1e6} MB. Leave out build output and large media.`);
  }
  return { files, skipped };
}

/** Pick Vercel's framework preset from the root package.json. null = static / "Other". */
export function detectFramework(files: CleanFile[]): string | null {
  const pkgFile = files.find((f) => f.path === 'package.json');
  if (!pkgFile) return null;
  let pkg: any;
  try {
    pkg = JSON.parse(pkgFile.encoding === 'base64' ? Buffer.from(pkgFile.content, 'base64').toString() : pkgFile.content);
  } catch {
    throw new UserError('package.json is not valid JSON');
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const checks: [string, string][] = [
    ['next', 'nextjs'],
    ['astro', 'astro'],
    ['@sveltejs/kit', 'sveltekit-1'],
    ['nuxt', 'nuxtjs'],
    ['@remix-run/dev', 'remix'],
    ['gatsby', 'gatsby'],
    ['react-scripts', 'create-react-app'],
    ['vite', 'vite'],
  ];
  return checks.find(([dep]) => dep in deps)?.[1] ?? null;
}
