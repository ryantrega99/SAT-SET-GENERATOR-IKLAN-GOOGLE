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
    let errorMsg = 'Failed to generate campaign';
    try {
      const error = await response.json();
      errorMsg = error.error || errorMsg;
    } catch (e) {
      // If response is not JSON, we might get the raw text (like Vercel error pages)
      const text = await response.text();
      console.error('Non-JSON error response:', text);
      if (text.includes('504')) errorMsg = 'Server timeout (Vercel Limit). Silakan coba lagi.';
      else if (text.includes('500')) errorMsg = 'Internal Server Error. Silakan cek logs Vercel.';
      else errorMsg = 'Terjadi kesalahan sistem. Silakan coba lagi.';
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
