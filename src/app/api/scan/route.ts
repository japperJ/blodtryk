import { NextRequest, NextResponse } from "next/server";
import { checkOllama, scanBloodPressure } from "@/lib/ollama";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const base64Data = (await request.text()).replace(/\s/g, "");
    console.log(`Scan: base64 size: ${base64Data.length} chars`);

    if (!base64Data || base64Data.length < 100) {
      return NextResponse.json({ error: "noImageProvided" }, { status: 400 });
    }

    // Check image quality
    const estimatedBytes = Math.round((base64Data.length * 3) / 4);
    if (estimatedBytes < 37000) { // ~37KB minimum
      return NextResponse.json({
        error: "imageTooSmall"
      }, { status: 422 });
    }

    // AI-serveren skal være klar før vi bruger tid på OCR (#60) — ellers får
    // klienten en forståelig fejlkode i stedet for "fetch failed"
    const health = await checkOllama();
    if (!health.ready) {
      return NextResponse.json({ error: health.reason }, { status: 503 });
    }

    // Save image to disk for debugging and potential later viewing
    const scanDir = join(process.cwd(), "scan-captures");
    await mkdir(scanDir, { recursive: true });
    const filename = `scan-${Date.now()}.jpg`;
    const filepath = join(scanDir, filename);
    const buffer = Buffer.from(base64Data, "base64");
    await writeFile(filepath, buffer);
    console.log(`Scan: saved image to ${filepath} (${buffer.length} bytes)`);

    // Run OCR
    const result = await scanBloodPressure(base64Data);

    if ("error" in result) {
      return NextResponse.json({
        error: result.error,
        savedImage: filename
      }, { status: 422 });
    }

    // Return reading and image filename
    return NextResponse.json({
      reading: result,
      savedImage: filename
    });
  } catch (error) {
    console.error("Scan error:", error);
    const message = error instanceof Error ? error.message : "scanFailed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
