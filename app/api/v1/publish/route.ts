import { userFromRequest } from '@/lib/auth';
import { errorResponse, json, readJson, unauthorized } from '@/lib/http';
import { publish } from '@/lib/publish';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return unauthorized();
    return json(await publish(user, await readJson(req)));
  } catch (e) {
    return errorResponse(e);
  }
}
