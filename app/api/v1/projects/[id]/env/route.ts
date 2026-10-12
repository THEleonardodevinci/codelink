import { userFromRequest } from '@/lib/auth';
import { errorResponse, json, readJson, unauthorized } from '@/lib/http';
import { setEnv } from '@/lib/publish';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await userFromRequest(req);
    if (!user) return unauthorized();
    const body = await readJson(req);
    return json(await setEnv(user, params.id, body.key, body.value));
  } catch (e) {
    return errorResponse(e);
  }
}
