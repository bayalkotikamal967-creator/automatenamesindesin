import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Parse JSON bodies with custom limit to handle high-fidelity images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini Client safely
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    console.log("Gemini API initialized successfully.");
  } else {
    console.warn("GEMINI_API_KEY is not configured or has a placeholder value.");
  }
} catch (error) {
  console.error("Failed to initialize Google GenAI SDK:", error);
}

// API Routes FIRST
app.post("/api/gemini/generate", async (req: Request, res: Response) => {
  if (!ai) {
    res.status(503).json({
      success: false,
      error: "Gemini API integration is unconfigured or unavailable on the server.",
    });
    return;
  }

  try {
    const { guestName } = req.body;
    const prompt = `You are the host of C Cube Cottage - "Chatta Chiya Chat" in Madhutar, Kamalamai-5, Sindhuli, Nepal, which now celebrates delicious foods.
We are celebrating our Grand Opening on 2083/03/10 BS (Bikram Sambat Nepalese calendar) at 3:00 PM.
Generate exactly 4 diverse social media or WhatsApp invitation messages (captions) inviting${guestName ? ` specifically our special guest '${guestName}'` : ' guests'} to the Grand Opening of C Cube Cottage.
The 4 variations should have these specific tones/categories:
- Polite (respectful, formal invitation format centered on culinary delight)
- Friendly (warm, welcoming, conversational invitation featuring tasty treats)
- Casual (cozy, laidback invitation over delicious foods and local delights)
- Elegant (poetic, high-class description of mouthwatering food, friendly chat, and memories)

Format your response as a valid JSON array of objects. Do not wrap it in markdown block tags except possibly standard JSON markers. The JSON structural schema must be exactly:
[
  { "text": "...", "category": "polite" },
  { "text": "...", "category": "friendly" },
  { "text": "...", "category": "casual" },
  { "text": "...", "category": "elegant" }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response from AI model.");
    }

    // Parse output JSON safely
    const parsedData = JSON.parse(textOutput.trim());
    res.json({
      success: true,
      captions: parsedData,
    });
  } catch (error: any) {
    console.error("Error generating captions from Gemini:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred during caption generation.",
    });
  }
});

// App Health Check API
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date() });
});

// Enable global CORS headers to allow cross-origin resource sharing, vital for iframe environments like AI Studio
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve the assets directories statically so we can fetch template assets with clean CORS support
app.use("/assets", express.static(path.join(process.cwd(), "public", "assets"), {
  setHeaders: (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
}));

app.use("/assets", express.static(path.join(process.cwd(), "assets"), {
  setHeaders: (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
}));

// Retrieve template status (whether high-fidelity master card exists in /assets/template.png)
app.get("/api/template-status", (req: Request, res: Response) => {
  const templatePath = path.join(process.cwd(), "assets", "template.png");
  const exists = fs.existsSync(templatePath);
  res.json({
    exists,
    url: exists ? `/assets/template.png?t=${Date.now()}` : null
  });
});

// Upload and store the exact high-fidelity template image inside the project assets folder
app.post("/api/upload-template", (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ success: false, error: "No image data found in request." });
      return;
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const assetsDir = path.join(process.cwd(), "assets");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const templatePath = path.join(assetsDir, "template.png");
    fs.writeFileSync(templatePath, buffer);

    console.log("Template image saved successfully to assets/template.png");
    res.json({
      success: true,
      url: `/assets/template.png?t=${Date.now()}`
    });
  } catch (error: any) {
    console.error("Failed to write template.png to assets folder:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to save file." });
  }
});

// Setup Vite Dev Middleware or Static Web Server for SPA
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    }));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Error starting Viteware/Express server:", err);
});
