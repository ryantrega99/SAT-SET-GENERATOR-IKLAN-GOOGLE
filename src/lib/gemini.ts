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
  const apiKey = userApiKey || process.env.GEMINI_API_KEY || "";
  const customAi = new GoogleGenAI({ apiKey });
  
  const toneInstruction = businessInfo.tone 
    ? `Gunakan gaya bahasa: ${businessInfo.tone}.` 
    : "Gunakan gaya bahasa: Santai dan Persuasif.";

  const prompt = `
    Riset dan buatlah kampanye Google Search Network (GSN) untuk bisnis berikut:
    
    Bisnis: ${businessInfo.name}
    Deskripsi: ${businessInfo.description}
    Target: ${businessInfo.audience}
    ${businessInfo.url ? `URL: ${businessInfo.url}` : ""}
    ${toneInstruction}

    INSTRUKSI KHUSUS UNTUK COPYWRITING (SANGAT PENTING):
    - JANGAN gunakan kata: "Solusi", "Terpercaya", "Tingkatkan", "Potensi", "Inovatif", "Modern".
    - GUNAKAN kata-kata yang biasa dipakai manusia saat ngobrol: "Bikin", "Langsung", "Gak pake lama", "Hemat", "Cek sendiri".
    - HEADLINE: MAKSIMAL 30 KARAKTER. Fokus pada "Pain Point" atau "Instant Benefit". Contoh: "Kopi Enak Gak Harus Mahal" daripada "Nikmati Kopi Berkualitas Tinggi".
    - DESKRIPSI: MAKSIMAL 90 KARAKTER. Gunakan gaya bahasa bercerita atau testimoni singkat. Contoh: "Udah 500+ orang nyobain dan ketagihan. Cek menunya di sini!"
    - KEYWORDS: Cari yang "High Intent" (misal: "beli kopi susu jakarta" bukan "apa itu kopi").
    - SITELINKS: Buat 4 sitelinks yang relevan dengan judul menarik (max 25 char) dan deskripsi (max 35 char).

    Format output harus JSON sesuai schema.
  `;

  const response = await customAi.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: "Anda adalah Senior Performance Copywriter Indonesia yang ahli dalam psikologi pembeli. Gaya bahasa Anda santai, persuasif, 'to the point', dan SANGAT MANUSIAWI. Anda benci bahasa formal yang kaku dan klise AI. Anda selalu mematuhi batasan karakter Google Ads (Headline 30, Deskripsi 90).",
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          keywords: {
            type: Type.OBJECT,
            properties: {
              broad: { type: Type.ARRAY, items: { type: Type.STRING }, description: "10-15 high intent keywords" },
              phrase: { type: Type.ARRAY, items: { type: Type.STRING }, description: "10-15 high intent keywords" },
              exact: { type: Type.ARRAY, items: { type: Type.STRING }, description: "10-15 high intent keywords" },
            },
            required: ["broad", "phrase", "exact"],
          },
          headlines: { type: Type.ARRAY, items: { type: Type.STRING }, description: "15 headlines, max 30 characters each" },
          descriptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 descriptions, max 90 characters each" },
          sitelinks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Max 25 characters" },
                description: { type: Type.STRING, description: "Max 35 characters" },
              },
              required: ["title", "description"],
            },
            description: "Exactly 4 sitelinks",
          },
        },
        required: ["keywords", "headlines", "descriptions", "sitelinks"],
      },
    },
  });

  return JSON.parse(response.text || "{}") as AdCampaign;
}
