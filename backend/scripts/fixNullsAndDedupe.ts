/// <reference types="node" />

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function makeCityKey(city: string, country: string | null) {
  const c = city.trim().toLowerCase().replace(/\s+/g, " ");
  const k = (country ?? "").trim().toLowerCase();
  return `${c}|${k}`;
}

async function main() {
  // 1) Fill NULL cityKey/updatedAt
  const rows = await prisma.recentSearch.findMany();

  for (const r of rows) {
    const cityKey = (r as any).cityKey ?? makeCityKey(r.city, r.country ?? null);
    const updatedAt = (r as any).updatedAt ?? r.createdAt;

    // Only update if missing
    if ((r as any).cityKey == null || (r as any).updatedAt == null) {
      await prisma.recentSearch.update({
        where: { id: r.id },
        data: {
          cityKey,
          updatedAt,
        } as any,
      });
    }
  }

  // 2) Delete duplicates by cityKey (keep most recently updated)
  const all = await prisma.recentSearch.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const seen = new Set<string>();
  const toDelete: number[] = [];

  for (const r of all) {
    const key = (r as any).cityKey as string;
    if (seen.has(key)) toDelete.push(r.id);
    else seen.add(key);
  }

  if (toDelete.length) {
    await prisma.recentSearch.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  console.log(`Fixed NULLs. Deleted duplicates: ${toDelete.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
