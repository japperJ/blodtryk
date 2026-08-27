const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "glm-ocr";

const SCAN_PROMPT = `What numbers do you see on this blood pressure monitor? Reply with ONLY a JSON object like {"systolic": X, "diastolic": X, "pulse": X}`;

// Stable error codes (#60): the queue and the UI translate these via i18n
// instead of showing raw network errors like "fetch failed".
export type OllamaWaitReason = "ollamaOffline" | "ollamaModelMissing";

export interface OllamaHealth {
  ready: boolean;
  reason?: OllamaWaitReason;
  models?: string[];
}

const HEALTH_TIMEOUT_MS = 5000;
// OCR can be slow on CPU — but a hanging request must not block the queue forever
const SCAN_TIMEOUT_MS = 10 * 60 * 1000;

/** Check that Ollama answers and the configured model exists (#60). */
export async function checkOllama(): Promise<OllamaHealth> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { ready: false, reason: "ollamaOffline" };
    const data = (await res.json()) as { models?: { name?: string }[] };
    const models = Array.isArray(data.models)
      ? data.models.map((m) => m?.name ?? "").filter(Boolean)
      : [];
    // Names may carry a tag suffix, e.g. "glm-ocr:latest"
    const hasModel = models.some(
      (n) => n === OLLAMA_MODEL || n.split(":")[0] === OLLAMA_MODEL
    );
    return hasModel
      ? { ready: true, models }
      : { ready: false, reason: "ollamaModelMissing", models };
  } catch {
    // Server does not answer at all (not running / wrong port)
    return { ready: false, reason: "ollamaOffline" };
  }
}

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
  let response: Response;
  try {
    response = await fetch(`${OLLAMA_HOST}/api/chat`, {
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
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    });
  } catch (error) {
    // Network failure (Ollama not running, timeout) — stable code instead of
    // raw "fetch failed" so the queue can wait and the UI can translate it (#60)
    console.error(
      "Ollama unreachable:",
      error instanceof Error ? error.message : error
    );
    return { error: "ollamaOffline" };
  }

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

    // Ollama models may return numbers as strings (e.g. "145" instead of 145).
    // Coerce before validating so both forms are accepted.
    const systolic = Number(parsed.systolic);
    const diastolic = Number(parsed.diastolic);
    const pulse = Number(parsed.pulse);

    if (
      typeof parsed.systolic === "undefined" ||
      typeof parsed.diastolic === "undefined" ||
      typeof parsed.pulse === "undefined" ||
      Number.isNaN(systolic) ||
      Number.isNaN(diastolic) ||
      Number.isNaN(pulse)
    ) {
      return { error: "scanInvalidFormat" };
    }

    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      pulse: Math.round(pulse),
    };
  } catch {
    return { error: "scanParseFailed" };
  }
}
