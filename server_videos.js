import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Serve static files from public folder
const publicPath = path.join(__dirname, "public");

// Middleware to allow CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API endpoint to list available videos
app.get("/api/videos", (req, res) => {
  const videosDir = path.join(publicPath, "videos");

  // Check if directory exists
  if (!fs.existsSync(videosDir)) {
    return res.json([]);
  }

  try {
    const files = fs.readdirSync(videosDir).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".mp4", ".webm", ".mov", ".avi"].includes(ext);
    });

    const videos = files.map((file) => ({
      name: file,
      path: `/videos/${file}`,
    }));

    res.json(videos);
  } catch (error) {
    console.error("Error reading videos directory:", error);
    res.json([]);
  }
});

// Serve videos
app.use("/videos", express.static(path.join(publicPath, "videos")));

app.listen(PORT, () => {
  console.log(`Video server running at http://localhost:${PORT}`);
});
