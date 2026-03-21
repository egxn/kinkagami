import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { logger } from "../../utils/logger";
import usePoseContext from "../../context/usePoseContext";
import { useCameraSource } from "../../hooks";

function Splash() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cameraError, cameraReady, streamReady, videoRef } = usePoseContext();
  const cameraSource = useCameraSource();
  const isStream = cameraSource.flow === "streamUrl";
  const waiting = isStream && !cameraReady;

  useEffect(() => {
    logger.log(
      "Splash",
      `Camera - Ready: ${cameraReady}, Error: ${cameraError}, Stream: ${isStream}`,
    );

    if (cameraError) {
      logger.error("Splash", "Error detected, navigating to /error");
      navigate("/error");
      return;
    }
  }, [cameraReady, cameraError, navigate, isStream]);

  const handleAction = () => {
    logger.log("Splash", "Start action confirmed");
    navigate("/stack/routines");
  };

  const handleDiscard = () => {
    logger.log("Splash", "Start action discarded");
  };

  if (waiting) {
    return (
      <div className="splash-screen">
        <h1> 🦝 🪞 </h1>
        <div className="splash-loading">
          <div className="splash-loading__spinner" />
          <p className="splash-loading__text">
            {t("splash.waiting_camera")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="splash-screen">
      <h1> 🦝 🪞 </h1>
      <Button
        videoRef={videoRef}
        streamReady={streamReady}
        onAction={handleAction}
        onDiscard={handleDiscard}
        alignX="center"
      >
        <div>{t("splash.start")}</div>
      </Button>
    </div>
  );
}

export default Splash;
