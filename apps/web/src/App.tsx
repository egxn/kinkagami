import { BrowserRouter, Route, Routes } from "react-router-dom";
import ModelGate from "./models/ModelGate";
import { useConfig } from "./platform/useConfig";
import Trainer from "./trainer/Trainer";
import Home from "./views/Home";

export default function App() {
  const { config } = useConfig();

  return (
    <ModelGate version={config.models.movenet}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trainer/:routineId" element={<Trainer />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </ModelGate>
  );
}
