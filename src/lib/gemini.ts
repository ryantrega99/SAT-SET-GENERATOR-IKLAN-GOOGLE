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
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessInfo, userApiKey })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate campaign');
  }

  return response.json();
}
