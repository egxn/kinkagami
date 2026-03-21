import { VideoSelector as VideoSelectorUI } from "../ui";
import { useAvailableVideos } from "../hooks/useAvailableVideos";

interface VideoSelectorProps {
  onSelect: (videoUrl: string) => void;
  currentUrl: string;
}

export default function VideoSelector({
  onSelect,
  currentUrl,
}: VideoSelectorProps) {
  const { videos, loading } = useAvailableVideos();

  return (
    <VideoSelectorUI
      videos={videos}
      loading={loading}
      onSelect={onSelect}
      currentUrl={currentUrl}
    />
  );
}
