import express from "express";
import path from "path";
import { OAuth2Client } from "google-auth-library";
import cookieParser from "cookie-parser";
import axios from "axios";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.get("/api/ping", (req, res) => {
  res.json({ pong: true, env: process.env.NODE_ENV });
});

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
  try {
    const { code } = req.body || {};
    const proCode = process.env.PRO_ACTIVATION_CODE || "RYANTKAYARAYA1";
    const demoCode = "DEMOSAJA";
    
    if (!code) {
      return res.status(400).json({ success: false, message: "Kode harus diisi" });
    }

    if (code === proCode) {
      return res.json({ success: true, type: 'pro', message: "PRO activated successfully" });
    } else if (code === demoCode) {
      return res.json({ success: true, type: 'demo', message: "Demo extended successfully" });
    } else {
      return res.status(400).json({ success: false, message: "Kode tidak valid" });
    }
  } catch (error: any) {
    console.error("Activation API error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
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
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else {
    // In Vercel, static files are handled by vercel.json rewrites
    // but we can still provide a fallback for other environments
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
  }
}

if (process.env.NODE_ENV !== "production") {
  startServer();
}

export default app;
