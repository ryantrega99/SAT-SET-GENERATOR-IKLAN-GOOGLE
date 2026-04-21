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
    const responseClone = response.clone();
    try {
      const error = await response.json();
      errorMsg = error.error || errorMsg;
    } catch (e) {
      const text = await responseClone.text();
      console.error('Non-JSON error response:', text);
      if (text.includes('504')) errorMsg = 'Server timeout (Vercel). Silakan coba lagi.';
      else if (text.includes('500')) errorMsg = 'Internal Server Error. Silakan cek logs.';
      else errorMsg = 'Terjadi kesalahan sistem. Silakan coba lagi.';
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
