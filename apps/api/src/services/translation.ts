import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface TranslationResult {
  title: string;
  summary: string;
}

export async function translateToItalian(
  texts: { title: string; summary: string }[]
): Promise<TranslationResult[]> {
  if (texts.length === 0) return [];

  const prompt = `Translate the following news items from English to Italian. Keep the translation natural and fluent.

Input (JSON array):
${JSON.stringify(texts, null, 2)}

Return ONLY a valid JSON array with the translated items in the same order:
[
  { "title": "translated title", "summary": "translated summary" },
  ...
]

No markdown, no explanation, just the JSON array.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse JSON response
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    const translations = JSON.parse(cleaned);

    if (!Array.isArray(translations) || translations.length !== texts.length) {
      console.error("Translation mismatch, returning originals");
      return texts;
    }

    return translations;
  } catch (error) {
    console.error("Translation failed:", error);
    // Return originals on failure
    return texts;
  }
}
