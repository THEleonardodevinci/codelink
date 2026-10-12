export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
