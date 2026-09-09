import { listStockInventory } from "@/lib/redeem/stock-inventory";

export async function GET() {
  try {
    const stocks = await listStockInventory();
    return Response.json({ stocks });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "stocks_failed" },
      { status: 500 },
    );
  }
}
