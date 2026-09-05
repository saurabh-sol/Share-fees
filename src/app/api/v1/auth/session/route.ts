import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ user: null }, { status: 401 });
  }
  return Response.json({
    user: {
      id: session.user.id,
      address: session.user.address,
      chainNamespace: session.user.chainNamespace,
      rewardPreference: session.user.rewardPreference,
    },
  });
}
