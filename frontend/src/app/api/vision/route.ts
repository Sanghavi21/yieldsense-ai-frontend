import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VisionResult = {
  crop: string;
  condition:
    | "healthy"
    | "possible stress"
    | "possible disease"
    | "uncertain";
  possibleDisease: string;
  confidence: number;
  severity: "none" | "mild" | "moderate" | "severe" | "uncertain";
  visibleSymptoms: string[];
  recommendedActions: string[];
  expertRequired: boolean;
};

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/*
 * Gemini 3.5 Flash-Lite is currently available for multimodal/image input.
 * We keep Gemini 3.5 Flash as a fallback.
 *
 * IMPORTANT:
 * Do not put your API key in page.tsx.
 * It must remain in .env.local.
 */
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
];

function clampConfidence(value: unknown): number {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(0, Math.min(1, n));
}

function cleanString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeCondition(value: unknown): VisionResult["condition"] {
  const condition = cleanString(value).toLowerCase();

  if (condition === "healthy") {
    return "healthy";
  }

  if (
    condition === "possible stress" ||
    condition === "stress" ||
    condition === "possible_stress"
  ) {
    return "possible stress";
  }

  if (
    condition === "possible disease" ||
    condition === "disease" ||
    condition === "possible_disease"
  ) {
    return "possible disease";
  }

  return "uncertain";
}

function normalizeSeverity(value: unknown): VisionResult["severity"] {
  const severity = cleanString(value).toLowerCase();

  if (severity === "none") return "none";
  if (severity === "mild") return "mild";
  if (severity === "moderate") return "moderate";
  if (severity === "severe") return "severe";

  return "uncertain";
}

function normalizeVisionResult(raw: any): VisionResult {
  const condition = normalizeCondition(raw?.condition);
  const confidence = clampConfidence(raw?.confidence);

  /*
   * Never allow the model to claim a confirmed disease
   * when confidence is too low.
   */
  const uncertain = confidence < 0.5 || condition === "uncertain";

  let possibleDisease = cleanString(
    raw?.possibleDisease,
    "No confirmed disease identified."
  );

  let recommendedActions = cleanStringArray(
    raw?.recommendedActions
  );

  const visibleSymptoms = cleanStringArray(
    raw?.visibleSymptoms
  );

  if (uncertain) {
    possibleDisease = "Unable to confidently identify the issue.";

    recommendedActions = [
      "Do not apply crop-protection chemicals based only on this image.",
      "Take another clear image showing the affected leaf or plant.",
      "Check multiple plants in the same field for similar symptoms.",
      "Consult an agricultural expert if the symptoms continue or spread.",
    ];
  }

  return {
    crop: cleanString(raw?.crop, "Unknown"),
    condition,
    possibleDisease,
    confidence,
    severity: normalizeSeverity(raw?.severity),
    visibleSymptoms,
    recommendedActions,
    expertRequired:
      uncertain || raw?.expertRequired === true,
  };
}

function extractJson(text: string): any {
  let cleaned = text.trim();

  /*
   * Remove markdown code fences if Gemini happens to return them.
   */
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  /*
   * Sometimes a model may return a small amount of text
   * before/after the JSON. Try to isolate the object.
   */
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

async function callGemini(
  model: string,
  apiKey: string,
  mimeType: string,
  base64Image: string
) {
  const prompt = `
You are an agricultural plant-health vision assistant.

Analyze the ACTUAL IMAGE provided to you.

Do NOT assume that every image has the same disease.
Do NOT reuse a previous diagnosis.
Do NOT return a generic "Foliar Condition" diagnosis for every image.

You must independently inspect the image.

IMPORTANT:
- Determine whether the image actually contains a crop, plant, leaf, fruit, stem, flower, or agricultural field.
- If it is not an agricultural plant image, return condition "uncertain".
- Identify the crop only when visually reasonable.
- Identify visible symptoms only when they are actually visible.
- Do not invent a disease.
- Do not claim certainty when the image is unclear.
- If multiple diseases are possible, explain uncertainty through the condition/confidence.
- Confidence must be between 0 and 1.
- Do not use confidence to pretend laboratory-level certainty.
- Image-based diagnosis is an initial visual assessment, not a laboratory diagnosis.

SAFETY:
Do not prescribe dangerous pesticide quantities or chemical dosages from an image alone.
Do not provide exact ml/L, g/L, kg/acre, or similar chemical dosage instructions.
If treatment is uncertain, tell the farmer to verify with an agronomist and the local product label.

Return ONLY valid JSON.

Required JSON structure:

{
  "crop": "detected crop or Unknown",
  "condition": "healthy | possible stress | possible disease | uncertain",
  "possibleDisease": "specific issue if visually supported, otherwise Unable to confidently identify the issue.",
  "confidence": 0.0,
  "severity": "none | mild | moderate | severe | uncertain",
  "visibleSymptoms": [
    "symptom 1",
    "symptom 2"
  ],
  "recommendedActions": [
    "action 1",
    "action 2"
  ],
  "expertRequired": false
}

Before answering, carefully inspect:
1. Leaf/plant shape
2. Color changes
3. Spots
4. Lesions
5. Necrosis
6. Yellowing
7. Wilting
8. Curling
9. Holes or insect damage
10. Fungal-looking structures
11. Mottling or mosaic patterns
12. Overall plant condition

If the image is too blurry, too distant, heavily obstructed, or otherwise insufficient for a reliable visual assessment:
- condition = "uncertain"
- confidence < 0.5
- possibleDisease = "Unable to confidently identify the issue."
`;

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 45000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens: 1500,

          responseMimeType: "application/json",

          responseSchema: {
            type: "OBJECT",
            properties: {
              crop: {
                type: "STRING",
              },

              condition: {
                type: "STRING",
                enum: [
                  "healthy",
                  "possible stress",
                  "possible disease",
                  "uncertain",
                ],
              },

              possibleDisease: {
                type: "STRING",
              },

              confidence: {
                type: "NUMBER",
              },

              severity: {
                type: "STRING",
                enum: [
                  "none",
                  "mild",
                  "moderate",
                  "severe",
                  "uncertain",
                ],
              },

              visibleSymptoms: {
                type: "ARRAY",
                items: {
                  type: "STRING",
                },
              },

              recommendedActions: {
                type: "ARRAY",
                items: {
                  type: "STRING",
                },
              },

              expertRequired: {
                type: "BOOLEAN",
              },
            },

            required: [
              "crop",
              "condition",
              "possibleDisease",
              "confidence",
              "severity",
              "visibleSymptoms",
              "recommendedActions",
              "expertRequired",
            ],
          },
        },
      }),

      signal: controller.signal,
    });

    const responseText = await response.text();

    let responseJson: any = null;

    try {
      responseJson = responseText
        ? JSON.parse(responseText)
        : null;
    } catch {
      responseJson = null;
    }

    if (!response.ok) {
      const message =
        responseJson?.error?.message ||
        responseJson?.error ||
        `Gemini returned HTTP ${response.status}.`;

      const error = new Error(message);
      (error as any).status = response.status;

      throw error;
    }

    const modelText =
      responseJson?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text || "")
        .join("")
        .trim();

    if (!modelText) {
      throw new Error(
        "Gemini returned an empty vision response."
      );
    }

    return {
      model,
      raw: extractJson(modelText),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "No image file was provided.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid image type. Please upload JPEG, PNG, or WEBP.",
        },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        {
          error: "The uploaded image is empty.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "Image must be 10 MB or smaller.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        "GEMINI_API_KEY is missing from the server environment."
      );

      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured on the server. Add GEMINI_API_KEY to frontend/.env.local and restart Next.js.",
        },
        { status: 500 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const base64Image =
      Buffer.from(arrayBuffer).toString("base64");

    let lastError: unknown = null;

    /*
     * Try the current model first.
     * If it fails, try the second supported model.
     */
    for (const model of MODELS) {
      try {
        console.log(
          `[Vision] Sending image to Gemini model: ${model}`
        );

        const result = await callGemini(
          model,
          apiKey,
          file.type,
          base64Image
        );

        const normalized =
          normalizeVisionResult(result.raw);

        console.log(
          `[Vision] Gemini analysis completed using ${model}`
        );

        return NextResponse.json(
          {
            crop: normalized.crop,

            disease: normalized.possibleDisease,

            condition: normalized.condition,

            confidence: normalized.confidence,

            severity: normalized.severity,

            uncertain:
              normalized.condition === "uncertain" ||
              normalized.confidence < 0.5,

            visible_symptoms:
              normalized.visibleSymptoms.join(", "),

            visibleSymptoms:
              normalized.visibleSymptoms,

            recommendation:
              normalized.recommendedActions.join(" "),

            recommendedActions:
              normalized.recommendedActions,

            next_action:
              normalized.expertRequired
                ? "Please consult an agricultural expert before applying crop-protection chemicals."
                : "Continue monitoring the crop and compare symptoms across multiple plants.",

            expertRequired:
              normalized.expertRequired,

            model: result.model,

            success: true,
          },
          {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
            },
          }
        );
      } catch (error: any) {
        lastError = error;

        console.error(
          `[Vision] Gemini model ${model} failed:`,
          error?.message || error
        );

        /*
         * Try the next model.
         */
        continue;
      }
    }

    const message =
      lastError instanceof Error
        ? lastError.message
        : "Gemini Vision analysis failed.";

    return NextResponse.json(
      {
        success: false,
        error:
          `Gemini Vision analysis failed. ${message}`,
        details:
          "The image reached the server, but Gemini could not analyze it with the configured models.",
      },
      { status: 502 }
    );
  } catch (error: any) {
    console.error(
      "[Vision] Unexpected server error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unexpected Vision Diagnostics server error.",
      },
      { status: 500 }
    );
  }
}