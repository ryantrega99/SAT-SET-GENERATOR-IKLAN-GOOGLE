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
  // Use the provided API key or the default one
  const genAI = userApiKey ? new GoogleGenAI({ apiKey: userApiKey }) : ai;

  const toneInstruction = businessInfo.tone 
    ? `Gunakan gaya bahasa: ${businessInfo.tone}.` 
    : "Gunakan gaya bahasa: Santai dan Persuasif.";

  const prompt = `
    Anda adalah Senior Performance Copywriter Indonesia yang ahli dalam psikologi pembeli. Gaya bahasa Anda santai, persuasif, 'to the point', dan SANGAT MANUSIAWI.
    
    Riset dan buatlah kampanye Google Search Network (GSN) untuk bisnis berikut:
    
    Bisnis: ${businessInfo.name}
    Deskripsi: ${businessInfo.description}
    Target: ${businessInfo.audience}
    ${businessInfo.url ? `URL: ${businessInfo.url}` : ""}
    ${toneInstruction}

    INSTRUKSI KHUSUS:
    - JANGAN gunakan kata: "Solusi", "Terpercaya", "Tingkatkan", "Potensi", "Inovatif", "Modern".
    - GUNAKAN kata-kata yang biasa dipakai manusia saat ngobrol: "Bikin", "Langsung", "Gak pake lama", "Hemat", "Cek sendiri".
    - HEADLINE: MAKSIMAL 30 KARAKTER. Fokus pada "Pain Point" atau "Instant Benefit".
    - DESKRIPSI: MAKSIMAL 90 KARAKTER. Gunakan gaya bahasa bercerita atau testimoni singkat.
    - KEYWORDS: Cari yang "High Intent".
    - SITELINKS: Buat 4 sitelinks yang relevan dengan judul menarik (max 25 char) and deskripsi (max 35 char).

    Format output harus JSON.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: {
              type: Type.OBJECT,
              properties: {
                broad: { type: Type.ARRAY, items: { type: Type.STRING } },
                phrase: { type: Type.ARRAY, items: { type: Type.STRING } },
                exact: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["broad", "phrase", "exact"],
            },
            headlines: { type: Type.ARRAY, items: { type: Type.STRING } },
            descriptions: { type: Type.ARRAY, items: { type: Type.STRING } },
            sitelinks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["title", "description"],
              },
            },
          },
          required: ["keywords", "headlines", "descriptions", "sitelinks"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gagal mendapatkan respon dari AI.");
    }

    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini generation error:", error);
    throw new Error(error.message || "Terjadi kesalahan saat memproses permintaan AI.");
  }
}
