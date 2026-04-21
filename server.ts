import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { OAuth2Client } from "google-auth-library";
import cookieParser from "cookie-parser";
import axios from "axios";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/google/callback`
);

// API Routes
app.get("/api/auth/google/url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    return res.status(400).json({ 
      error: "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_URL in environment variables." 
    });
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/adwords",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    prompt: "consent",
  });
  res.json({ url });
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    
    // In a real app, you'd store this in a database
    // For this demo, we'll send it back via a secure cookie
    res.cookie("google_ads_tokens", JSON.stringify(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/dashboard';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/auth/status", (req, res) => {
  const tokens = req.cookies.google_ads_tokens;
  res.json({ connected: !!tokens });
});

app.post("/api/pro/activate", (req, res) => {
  const { code } = req.body;
  const secretCode = process.env.PRO_ACTIVATION_CODE || "RYANTKAYARAYA";
  
  if (code === secretCode) {
    res.json({ success: true, message: "PRO activated successfully" });
  } else {
    res.status(400).json({ success: false, message: "Invalid activation code" });
  }
});

app.post("/api/generate", async (req, res) => {
  const { businessInfo, userApiKey } = req.body;
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("Gemini API Key missing");
    return res.status(401).json({ error: "Gemini API Key missing. Please set GEMINI_API_KEY in environment variables." });
  }

  try {
    console.log("Initializing Gemini AI with model gemini-1.5-flash...");
    
    // Attempt multiple initialization patterns for resilience
    let genAI;
    try {
      genAI = new GoogleGenAI(apiKey);
    } catch (e) {
      console.log("Standard initialization failed, trying alternate...");
      genAI = new (GoogleGenAI as any)({ apiKey });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: "Anda adalah Senior Performance Copywriter Indonesia yang ahli dalam psikologi pembeli. Gaya bahasa Anda santai, persuasif, 'to the point', dan SANGAT MANUSIAWI. Anda benci bahasa formal yang kaku dan klise AI. Anda selalu mematuhi batasan karakter Google Ads (Headline 30, Deskripsi 90).",
    });

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
      - HEADLINE: MAKSIMAL 30 KARAKTER. Fokus pada "Pain Point" atau "Instant Benefit".
      - DESKRIPSI: MAKSIMAL 90 KARAKTER. Gunakan gaya bahasa bercerita atau testimoni singkat.
      - KEYWORDS: Cari yang "High Intent".
      - SITELINKS: Buat 4 sitelinks yang relevan dengan judul menarik (max 25 char) and deskripsi (max 35 char).

      Format output harus JSON sesuai schema.
    `;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.text();
    console.log("Gemini response generated successfully");
    res.json(JSON.parse(responseText));
  } catch (error: any) {
    console.error("Gemini generation error:", error);
    res.status(500).json({ 
      error: "Gagal memproses AI.", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
});

app.post("/api/google-ads/publish", async (req, res) => {
  const tokensStr = req.cookies.google_ads_tokens;
  if (!tokensStr) {
    return res.status(401).json({ error: "Not connected to Google Ads" });
  }

  const tokens = JSON.parse(tokensStr);
  const { campaignData, customerId } = req.body;

  try {
    oauth2Client.setCredentials(tokens);
    const { token } = await oauth2Client.getAccessToken();

    // Google Ads API endpoint for creating a campaign
    // This is a simplified example of the API call
    // In a real implementation, you'd need to create:
    // 1. Campaign
    // 2. Ad Group
    // 3. Ad Group Ad (the actual ad)
    
    const targetCustomerId = customerId || process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID;
    
    // For demo purposes, we'll simulate the API call structure
    // but include the real headers and endpoint logic
    const response = await axios.post(
      `https://googleads.googleapis.com/v17/customers/${targetCustomerId}/campaigns:mutate`,
      {
        operations: [
          {
            create: {
              name: campaignData.name || `AI Generated - ${new Date().toLocaleDateString()}`,
              status: "PAUSED", // Create as draft/paused
              advertising_channel_type: "SEARCH",
              // ... other campaign settings
            }
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          "login-customer-id": process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,
        }
      }
    );

    res.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error("Error publishing to Google Ads:", error.response?.data || error.message);
    res.status(500).json({ 
      error: "Failed to publish to Google Ads", 
      details: error.response?.data || error.message 
    });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "production") {
  startServer();
}

export default app;
