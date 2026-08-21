import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;

    // Sikkerhedstjek: tillad kun bogstaver, tal, bindestreger og punktummer
    if (!/^[\w\-\.]+$/.test(filename)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const scanDir = join(process.cwd(), "scan-captures");
    const filepath = join(scanDir, filename);

    // Læs filen
    const buffer = await readFile(filepath);

    // Bestem content-type baseret på filtypen
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };

    const contentType = contentTypes[ext || ''] || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error("Image serve error:", error);
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
