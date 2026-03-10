import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { logger } from "../../utils/logger";
import usePoseContext from "../../context/usePoseContext";

function Splash() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cameraError, cameraReady, streamReady, videoRef } = usePoseContext();

  useEffect(() => {
    logger.log(
      "Splash",
      `Camera - Ready: ${cameraReady}, Error: ${cameraError}`,
    );

    if (cameraError) {
      logger.error("Splash", "Error detected, navigating to /error");
      navigate("/error");
      return;
    }
  }, [cameraReady, cameraError, navigate]);

  const handleAction = () => {
    logger.log("Splash", "Start action confirmed");
    navigate("/stack/routines");
  };

  const handleDiscard = () => {
    logger.log("Splash", "Start action discarded");
  };

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
