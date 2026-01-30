import { useRef } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { PoseProvider } from "./context/PoseContextProvider";
import { RoutineProvider } from "./context/RoutineContext";

import Error from "./views/Error";
import Canvas from "./views/Canvas";
import Menu from "./views/Menu";
import Pause from "./views/Pause";
import Score from "./views/Score";
import Settings from "./views/Settings";
import Splash from "./views/Splash";
import Summary from "./views/Summary";
import DebugPage from "./views/DebugPage";
import Create from "./views/Create";
import Player from "./views/Player";

import "./App.css";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <PoseProvider videoRef={videoRef}>
      <RoutineProvider>
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            backgroundColor: "#000",
          }}
        >
          {/* Video background layer */}
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
              opacity: 0.5,
            }}
          />

          {/* Routes overlay layer */}
          <div
            style={{
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
                <Route path="/" element={<Navigate to="/splash" replace />} />
                <Route path="/splash" element={<Splash />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/canvas" element={<Canvas />} />
                <Route path="/score" element={<Score />} />
                <Route path="/summary" element={<Summary />} />
                <Route path="/pause" element={<Pause />} />
                <Route path="/error" element={<Error />} />
                <Route path="/debug/fsm" element={<DebugPage />} />
                <Route path="/create" element={<Create />} />
                <Route path="/player" element={<Player />} />
              </Routes>
            </HashRouter>
          </div>
        </div>
      </RoutineProvider>
    </PoseProvider>
  );
}

export default App;
