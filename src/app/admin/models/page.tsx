import { redirect } from "next/navigation";
import { ModelsDesk } from "@/components/admin/ModelsDesk";
import { listAllModels } from "@/lib/ai-create/models";
import { getAdminSession } from "@/lib/auth/admin";

export default async function AdminModelsPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin");

  const models = await listAllModels();

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">AI Create</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Model catalog</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Allowlisted Replicate models for /app/create. Changes apply immediately; existing generation rows keep their
          model reference.
        </p>
      </div>
      <ModelsDesk models={models} />
    </div>
  );
}
