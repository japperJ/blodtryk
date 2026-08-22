const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "glm-ocr";

const SCAN_PROMPT = `What numbers do you see on this blood pressure monitor? Reply with ONLY a JSON object like {"systolic": X, "diastolic": X, "pulse": X}`;

export async function scanBloodPressure(
  imageBase64: string
): Promise<{ systolic: number; diastolic: number; pulse: number } | { error: string }> {
  // Check image quality — reject images that are too small (< 50KB base64 = ~37KB file)
  const estimatedBytes = Math.round((imageBase64.length * 3) / 4);
  if (estimatedBytes < 50000) {
    console.log(`Image too small (${Math.round(estimatedBytes / 1024)}KB) — likely poor quality`);
    return { error: "imageTooSmall" };
  }
  const result = await runScan(imageBase64);
  if ("error" in result) return result;
  return result;
}

async function runScan(
  imageBase64: string
): Promise<{ systolic: number; diastolic: number; pulse: number } | { error: string }> {
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: "user",
          content: SCAN_PROMPT,
          images: [imageBase64],
        },
      ],
      stream: false,
      options: { temperature: 0.3, num_predict: 200 },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Ollama error: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const content = data.message?.content || "";
  console.log("Ollama raw:", content.substring(0, 200));

  const jsonMatch = content.match(/\{[^}]+\}/);
  if (!jsonMatch) return { error: "scanCouldNotParse" };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.error) return { error: parsed.error };

    if (
      typeof parsed.systolic !== "number" ||
      typeof parsed.diastolic !== "number" ||
      typeof parsed.pulse !== "number"
    ) {
      return { error: "scanInvalidFormat" };
    }

    return {
      systolic: Math.round(parsed.systolic),
      diastolic: Math.round(parsed.diastolic),
      pulse: Math.round(parsed.pulse),
    };
  } catch {
    return { error: "scanParseFailed" };
  }
}
