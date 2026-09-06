import { redirect } from "next/navigation";
import { WalletAdapter } from "@/components/wallet-adapter/WalletAdapter";
import { getSession } from "@/lib/auth/session";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app");
  return <WalletAdapter />;
}
