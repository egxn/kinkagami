import { useState } from "react";
import { useAvailableVideos } from "../hooks/useAvailableVideos";
import { useTranslation } from "react-i18next";
import "./VideoSelector.scss";

interface VideoSelectorProps {
  onSelect: (videoUrl: string) => void;
  currentUrl: string;
}

export default function VideoSelector({ onSelect, currentUrl }: VideoSelectorProps) {
  const { t } = useTranslation();
  const { videos, loading } = useAvailableVideos();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectVideo = (videoPath: string) => {
    onSelect(videoPath);
    setIsOpen(false);
  };

  // Don't show if no videos available
  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="video-selector">
      <div className="selector-header">
        <button
          className="selector-toggle"
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
        >
          {loading ? t("create.loading_videos") : t("create.available_videos")} ({videos.length})
        </button>
      </div>

      {isOpen && (
        <div className="videos-list">
          {videos.map((video) => (
            <div
              key={video.path}
              className={`video-item ${currentUrl === video.path ? "selected" : ""}`}
              onClick={() => handleSelectVideo(video.path)}
            >
              <span className="video-name">{video.name}</span>
              <span className="video-path">{video.path}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
