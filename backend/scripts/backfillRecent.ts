import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function makeCityKey(city: string, country: string | null) {
  return `${city.trim().toLowerCase()}|${(country ?? "").trim().toLowerCase()}`;
}

async function main() {
  const rows = await prisma.recentSearch.findMany();
  for (const r of rows) {
    const cityKey = makeCityKey(r.city, r.country ?? null);
    await prisma.recentSearch.update({
      where: { id: r.id },
      data: {
        cityKey,
        updatedAt: r.updatedAt ?? r.createdAt, // give it something sane
      },
    });
  }

  // Dedupe any collisions (keep most recent)
  // If you had duplicates like Seoul,KR multiple times, they now share the same cityKey.
  const all = await prisma.recentSearch.findMany({ orderBy: { createdAt: "desc" } });
  const seen = new Set<string>();
  const toDelete: number[] = [];

  for (const r of all) {
    const key = r.cityKey!;
    if (seen.has(key)) toDelete.push(r.id);
    else seen.add(key);
  }

  if (toDelete.length) {
    await prisma.recentSearch.deleteMany({ where: { id: { in: toDelete } } });
  }

  console.log(`Backfilled ${rows.length} rows. Deleted duplicates: ${toDelete.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
