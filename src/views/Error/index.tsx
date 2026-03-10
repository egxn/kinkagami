import usePoseContext from "../../context/usePoseContext";
import { useTranslation } from "react-i18next";

export default function Error() {
  const { t } = useTranslation();
  const { cameraError, modelError } = usePoseContext();

  return (
    <div className="error-screen">
      <h1>{t("error_view.title")}</h1>
      <p>{t("error_view.description")}</p>
      {cameraError && (
        <div>
          <p>
            <strong>{t("error_view.camera_error")}:</strong> {cameraError}
          </p>
        </div>
      )}
      {modelError && (
        <div>
          <p>
            <strong>{t("error_view.model_error")}:</strong> {modelError}
          </p>
        </div>
      )}
    </div>
  );
}
