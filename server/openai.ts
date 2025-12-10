// Blueprint reference: javascript_openai_ai_integrations
import OpenAI from "openai";
import { AiTranscription, aiTranscriptionSchema } from "@shared/schema";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export async function transcribeReceipt(imageBuffer: Buffer, mimeType: string): Promise<AiTranscription> {
  const prompt = `You are analyzing a gas station receipt image. Extract the following information and return ONLY a valid JSON object with these exact fields:
- date: Transaction date in YYYY-MM-DD format
- stationName: Name of the gas station (seller name)
- sellerStreet: Street address of the gas station if visible
- sellerCity: City of the gas station if visible
- sellerState: Two-letter state abbreviation (e.g., "MO") if visible
- sellerZip: ZIP code if visible
- gallons: Number of gallons purchased (as a number)
- pricePerGallon: Price per gallon (as a number)
- totalAmount: Total amount paid (as a number)

If you cannot find a specific field, make your best estimate based on the receipt. For address fields, only include if visible on the receipt.

Return ONLY the JSON object, no additional text or explanation.`;

  // Convert buffer to base64 data URL
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. However, gpt-4o is better for vision tasks
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  try {
    const parsed = JSON.parse(content);
    return aiTranscriptionSchema.parse(parsed);
  } catch (error) {
    console.error("Failed to parse AI response:", content, error);
    throw new Error("Invalid AI response format");
  }
}
