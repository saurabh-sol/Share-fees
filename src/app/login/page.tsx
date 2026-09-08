import { redirect } from "next/navigation";
import { PrivyLogin } from "@/components/privy/PrivyLogin";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app");
  return <PrivyLogin />;
}
