import { useTranslation } from "react-i18next";
import { VideoSelector as VideoSelectorUI } from "@kgm/ui";
import { useAvailableVideos } from "../hooks/useAvailableVideos";

interface VideoSelectorProps {
  onSelect: (videoUrl: string) => void;
  currentUrl: string;
}

export default function VideoSelector({
  onSelect,
  currentUrl,
}: VideoSelectorProps) {
  const { t } = useTranslation();
  const { videos, loading } = useAvailableVideos();

  return (
    <VideoSelectorUI
      videos={videos}
      loading={loading}
      onSelect={onSelect}
      currentUrl={currentUrl}
      labels={{
        loading: t("create.loading_videos"),
        available: t("create.available_videos"),
      }}
    />
  );
}
