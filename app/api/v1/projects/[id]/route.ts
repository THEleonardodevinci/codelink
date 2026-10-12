import { userFromRequest } from '@/lib/auth';
import { errorResponse, json, unauthorized } from '@/lib/http';
import { getStatus } from '@/lib/publish';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await userFromRequest(req);
    if (!user) return unauthorized();
    return json(await getStatus(user, params.id));
  } catch (e) {
    return errorResponse(e);
  }
}
