import { Route, Routes } from "react-router-dom";
import Box from "./Box";
import PlayHome from "./Home";

export default function Play() {
  return (
    <Routes>
      <Route index element={<PlayHome />} />
      <Route path="box" element={<Box />} />
    </Routes>
  );
}
