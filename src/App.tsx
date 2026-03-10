import { useEffect, useRef } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { PoseProvider } from "./context/PoseContextProvider";
import { RoutineProvider } from "./context/RoutineContext";

import Create from "./views/Create";
import Error from "./views/Error";
import Models from "./views/Models";
import Player from "./views/Player";
import Settings from "./views/Settings";
import Stack from "./views/Stack";
import Summary from "./views/Summary";
import Config from "./views/Config";
import DevInfoSnackbar from "./components/DevInfoSnackbar";
import HandCursorOverlay from "./components/HandCursorOverlay";
import { ensureAppConfigInStorage } from "./utils/appConfig";

import "./App.css";

function App() {
  const isDev = import.meta.env.DEV;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    ensureAppConfigInStorage();

    const root = document.documentElement;
    const savedTheme = localStorage.getItem("kgm-theme");

    if (savedTheme) {
      root.setAttribute("data-kgm-theme", savedTheme);
    } else {
      root.setAttribute("data-kgm-theme", "ocean");
    }
  }, []);

  return (
    <PoseProvider videoRef={videoRef}>
      <RoutineProvider>
        <HandCursorOverlay />
        {isDev && <DevInfoSnackbar />}
        <div
          style={{
            height: "100vh",
            left: 0,
            overflow: "hidden",
            position: "fixed",
            top: 0,
            width: "100vw",
            zIndex: 10,
          }}
        >
          {/* Routes overlay layer */}
          <div
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 10,
            }}
          >
            <HashRouter>
              <Routes>
                <Route
                  path="/"
                  element={<Navigate to="/stack/splash" replace />}
                />

                <Route path="/stack/*" element={<Stack />} />

                <Route path="/settings" element={<Settings />} />
                <Route path="/config" element={<Config />} />
                <Route path="/error" element={<Error />} />
                <Route path="/summary" element={<Summary />} />

                {isDev ? (
                  <>
                    <Route path="/models" element={<Models />} />
                    <Route path="/create" element={<Create />} />
                    <Route path="/player" element={<Player />} />
                  </>
                ) : (
                  <>
                    <Route
                      path="/models"
                      element={<Navigate to="/stack/splash" replace />}
                    />
                    <Route
                      path="/create"
                      element={<Navigate to="/stack/splash" replace />}
                    />
                    <Route
                      path="/player"
                      element={<Navigate to="/stack/splash" replace />}
                    />
                  </>
                )}
              </Routes>
            </HashRouter>
          </div>
        </div>
        {/* Video background layer */}
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            backgroundColor: "black",
            height: "100%",
            left: 0,
            objectFit: "cover",
            opacity: 1,
            position: "fixed",
            top: 0,
            transform: "scaleX(-1)",
            width: "100%",
            zIndex: 0,
          }}
        />
      </RoutineProvider>
    </PoseProvider>
  );
}

export default App;
