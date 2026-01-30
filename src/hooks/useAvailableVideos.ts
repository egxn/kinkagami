import { useState, useEffect } from "react";

interface VideoFile {
  name: string;
  path: string;
}

export const useAvailableVideos = () => {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVideos = async () => {
      try {
        setLoading(true);
        // Use relative path so Vite proxy handles CORS
        const response = await fetch("/api/videos");
        if (response.ok) {
          const data = await response.json();
          setVideos(data);
          setError(null);
        } else if (response.status === 404) {
          // API endpoint doesn't exist, videos list will be empty
          setVideos([]);
          setError(null);
        } else {
          throw new Error("Failed to load videos");
        }
      } catch {
        // Silently fail - videos can be added manually via URL input
        // This happens when the server-videos.js script is not running
        console.log("Video API server not available. Videos can be added via URL input.");
        setVideos([]);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    loadVideos();
  }, []);

  return { videos, loading, error };
};
