#!/usr/bin/env node
/**
 * Engangs-migration (issue #15): flytter målingsbilleder ud af SQLite og over
 * på disken i scan-captures/.
 *
 * - Finder alle rækker hvor Reading.image starter med "data:"
 * - Afkoder base64-payloaden og skriver den til scan-captures/migrated-<id>.jpg
 *   (eksisterer filen allerede, springes skrivningen over — idempotent)
 * - Opdaterer rækken så image kun indeholder filnavnet
 *
 * Scriptet kan køres flere gange uden at lave dubletter. Køres med:
 *   node scripts/migrate-images.mjs
 */
import { readFile, writeFile, mkdir, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// DATABASE_URL hentes fra miljøet; er den ikke sat, parses .env manuelt
// (simpelt, uden dotenv-afhængighed).
if (!process.env.DATABASE_URL) {
  try {
    const envFile = await readFile(join(projectRoot, ".env"), "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/);
      if (match) {
        let value = match[1];
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env.DATABASE_URL = value;
        break;
      }
    }
  } catch {
    // Ingen .env-fil — Prisma giver selv en tydelig fejl herunder
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL er ikke sat (hverken i miljøet eller i .env)");
  process.exit(1);
}

const prisma = new PrismaClient();

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const scanDir = join(projectRoot, "scan-captures");
  await mkdir(scanDir, { recursive: true });

  const rows = await prisma.reading.findMany({
    where: { image: { startsWith: "data:" } },
    select: { id: true, image: true },
  });

  console.log(`Fandt ${rows.length} måling(er) med indlejret billede`);

  let converted = 0;
  let skipped = 0;

  for (const row of rows) {
    const filename = `migrated-${row.id}.jpg`;
    const filepath = join(scanDir, filename);

    try {
      // Idempotens: filen findes allerede → genbrug den, skriv ikke igen
      if (!(await fileExists(filepath))) {
        const commaIndex = row.image.indexOf(",");
        const base64Data = commaIndex === -1 ? "" : row.image.slice(commaIndex + 1);
        const buffer = Buffer.from(base64Data, "base64");
        await writeFile(filepath, buffer);
      }

      await prisma.reading.update({
        where: { id: row.id },
        data: { image: filename },
      });
      converted++;
      console.log(`  Konverteret: reading ${row.id} -> ${filename}`);
    } catch (error) {
      skipped++;
      console.error(`  Sprunget over: reading ${row.id}:`, error?.message ?? error);
    }
  }

  console.log(`Migration færdig: ${converted} konverteret, ${skipped} sprunget over`);
}

main()
  .catch((error) => {
    console.error("Migration fejlede:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
