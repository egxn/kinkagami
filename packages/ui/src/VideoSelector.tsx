import { useState } from "react";
import "./VideoSelector.scss";

export interface VideoFile {
  name: string;
  path: string;
}

export interface VideoSelectorLabels {
  loading?: string;
  available?: string;
}

export interface VideoSelectorProps {
  labels?: VideoSelectorLabels;
  videos: VideoFile[];
  loading?: boolean;
  onSelect: (videoUrl: string) => void;
  currentUrl: string;
}

export default function VideoSelector({
  videos,
  loading = false,
  onSelect,
  currentUrl,
  labels,
}: VideoSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectVideo = (videoPath: string) => {
    onSelect(videoPath);
    setIsOpen(false);
  };

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
          {loading
            ? (labels?.loading ?? "Cargando videos…")
            : (labels?.available ?? "Videos disponibles")}{" "}
          ({videos.length})
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
