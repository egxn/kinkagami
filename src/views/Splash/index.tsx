import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "../../utils/logger";
import usePoseContext from "../../context/usePoseContext";

function Splash() {
  const navigate = useNavigate();
  const [loadingText, setLoadingText] = useState("Loading...");
  const { cameraError, cameraReady, modelError, modelLoading } =
    usePoseContext();


  // Animate loading text with cycling dots
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingText((prev) => {
        if (prev === "Loading") return "Loading.";
        if (prev === "Loading.") return "Loading..";
        if (prev === "Loading..") return "Loading...";
        return "Loading";
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    logger.log(
      "Splash",
      `Camera - Ready: ${cameraReady}, Error: ${cameraError}`,
    );
    logger.log(
      "Splash",
      `Model -  Ready: ${!modelLoading}, Error: ${modelError}`,
    );

    // Navigate to error if there are any errors
    if (cameraError || modelError) {
      logger.error("Splash", "Error detected, navigating to /error");
      navigate("/error");
      return;
    }

    // Navigate to main once camera is ready (model can load in background)
    if (cameraReady && !modelLoading) {
      logger.log(
        "Splash",
        "Camera ready, navigating to /canvas (model loading in background)",
      );
      navigate("/stack");
    }
  }, [cameraReady, cameraError, modelError, navigate, modelLoading]);

  return (
    <div className="splash-screen">
      <h1> 🦝 🪞 </h1>
      <p> {loadingText} </p>
    </div>
  );
}

export default Splash;
