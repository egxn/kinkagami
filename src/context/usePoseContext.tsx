import { useContext } from "react";
import PoseContext from "./PoseContext";

const usePoseContext = () => {
  const context = useContext(PoseContext);
  if (!context) {
    throw new Error("usePoseContext must be used within PoseProvider");
  }
  return context;
};

export default usePoseContext;
