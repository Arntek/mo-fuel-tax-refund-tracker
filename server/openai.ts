// Blueprint reference: javascript_openai_ai_integrations
import OpenAI from "openai";
import { AiTranscription, aiTranscriptionSchema } from "@shared/schema";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export async function transcribeReceipt(imageBuffer: Buffer, mimeType: string): Promise<AiTranscription> {
  const prompt = `You are analyzing a US gas station receipt image. Extract the following information and return ONLY a valid JSON object with these exact fields:

FIELDS TO EXTRACT:
- date: Transaction date in YYYY-MM-DD format (see DATE PARSING below)
- stationName: Name of the gas station (seller name)
- sellerStreet: Street address of the gas station if visible
- sellerCity: City of the gas station if visible
- sellerState: Two-letter state abbreviation (e.g., "MO") if visible
- sellerZip: ZIP code if visible
- gallons: Number of gallons purchased (as a number with up to 3 decimal places, e.g., 12.345 or 31.23)
- pricePerGallon: Price per gallon (as a number with up to 3 decimal places, e.g., 2.459)
- totalAmount: Total amount paid (as a number with up to 2 decimal places)

DATE PARSING (CRITICAL - these are US receipts):
All receipts are from the United States. Dates on US receipts typically use these formats:
- mm/dd/yy (MOST COMMON, e.g., "12/11/25" = December 11, 2025)
- mm/dd/yyyy (e.g., "12/11/2025" = December 11, 2025)
- mm-dd-yy or mm-dd-yyyy
- Written month (e.g., "Dec 11, 2025" or "December 11 2025")

IMPORTANT: The FIRST number is always the MONTH in US date formats.
- "03/15/25" → 2025-03-15 (March 15, 2025)
- "11/05/24" → 2024-11-05 (November 5, 2024)
- "01/31/25" → 2025-01-31 (January 31, 2025)

Context clues for ambiguous dates:
- If the first number is > 12, something is wrong - re-examine the receipt
- Two-digit years: 00-30 = 2000-2030, 31-99 = 1931-1999
- Look for time stamps near the date for confirmation

Examples of date parsing:
- "12/11/25" on receipt → return "2025-12-11" (December 11, 2025)
- "Mar 5, 2025" on receipt → return "2025-03-05" (March 5, 2025)
- "3-15-24" on receipt → return "2024-03-15" (March 15, 2024)
- Date is illegible or cut off → return null for the date field

CONFIDENCE RULES:
- For the DATE field: If you cannot clearly read the date or are unsure about the format, return null. Do NOT guess.
- For numeric fields (gallons, pricePerGallon, totalAmount): If partially visible, make your best estimate based on what's readable.
- For address fields: Only include if clearly visible on the receipt, otherwise omit or return null.

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
