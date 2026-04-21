import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AdCampaign {
  keywords: {
    broad: string[];
    phrase: string[];
    exact: string[];
  };
  headlines: string[];
  descriptions: string[];
  sitelinks: { title: string; description: string }[];
}

export async function generateAdCampaign(
  businessInfo: {
    name: string;
    description: string;
    audience: string;
    url?: string;
    tone?: string;
  },
  userApiKey?: string
): Promise<AdCampaign> {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessInfo, userApiKey })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Gagal melakukan generasi AI di server");
    }

    return await res.json();
  } catch (error: any) {
    console.error("Gemini generation error:", error);
    throw new Error(error.message || "Terjadi kesalahan saat memproses permintaan AI.");
  }
}
