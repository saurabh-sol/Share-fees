import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { aiModels } from "@/lib/db/schema";
import { listAllModels, setModelEnabled, upsertModel } from "./models";

describe("ai model admin", () => {
  it("upserts and toggles models", async () => {
    const db = await createTestDb();

    const created = await upsertModel(
      {
        id: "test-model",
        category: "image",
        modelSlug: "owner/test-model",
        displayName: "Test Model",
        enabled: true,
        maxCostCents: 25,
        inputSchema: { prompt: { type: "string", required: true, maxLength: 100 } },
        asyncRequired: false,
        sortOrder: 99,
      },
      db,
    );
    expect(created.created).toBe(true);

    const updated = await upsertModel(
      {
        id: "test-model",
        category: "image",
        modelSlug: "owner/test-model",
        displayName: "Test Model v2",
        enabled: true,
        maxCostCents: 30,
        inputSchema: { prompt: { type: "string", required: true, maxLength: 100 } },
        asyncRequired: false,
      },
      db,
    );
    expect(updated.created).toBe(false);

    const all = await listAllModels(db);
    expect(all.some((row) => row.id === "test-model" && row.displayName === "Test Model v2")).toBe(true);

    await setModelEnabled("test-model", false, db);
    const [row] = await db.select().from(aiModels).where(eq(aiModels.id, "test-model"));
    expect(row?.enabled).toBe(0);
  });
});
