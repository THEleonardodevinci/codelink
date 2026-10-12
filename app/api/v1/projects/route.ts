import { userFromRequest } from '@/lib/auth';
import { errorResponse, json, unauthorized } from '@/lib/http';
import { listProjects } from '@/lib/publish';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await userFromRequest(req);
    if (!user) return unauthorized();
    return json({ projects: await listProjects(user) });
  } catch (e) {
    return errorResponse(e);
  }
}
