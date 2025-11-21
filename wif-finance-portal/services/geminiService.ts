import { GoogleGenAI } from "@google/genai";

export const fetchDailyWisdom = async (): Promise<string> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.warn("Gemini API Key not found. Returning default wisdom.");
    return "Consistency is the foundation of prosperity.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Generate a very short, single-sentence Japanese-inspired philosophical quote about finance, stability, or trust. Do not use quotation marks. Keep it under 15 words.",
    });
    
    return response.text || "Consistency is the foundation of prosperity.";
  } catch (error) {
    console.error("Failed to fetch wisdom:", error);
    return "Consistency is the foundation of prosperity.";
  }
};