/** An error whose message is safe and useful to show the caller (usually an AI agent). */
export class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export class UpstreamError extends Error {
  constructor(public service: 'GitHub' | 'Vercel', public status: number, message: string) {
    super(`${service} error (${status}): ${message}`);
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export function errorResponse(e: unknown) {
  if (e instanceof UserError) return json({ error: e.message }, e.status);
  if (e instanceof UpstreamError) return json({ error: e.message }, 502);
  console.error(e);
  return json({ error: 'Internal error' }, 500);
}

export const unauthorized = () =>
  json({ error: 'Missing or invalid API key. Create one in the CodeLink dashboard.' }, 401);

export async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new UserError('Request body must be valid JSON');
  }
}
