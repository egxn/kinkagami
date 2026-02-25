import { useContext } from "react";
import HandPoseContext from "./HandPoseContext";

const useHandPoseContext = () => {
  const context = useContext(HandPoseContext);
  if (!context) {
    throw new Error("useHandPoseContext must be used within HandPoseProvider");
  }
  return context;
};

export default useHandPoseContext;
