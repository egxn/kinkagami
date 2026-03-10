import { useTranslation } from "react-i18next";

export default function Settings() {
  const { t } = useTranslation();

  return (
    <div className="settings-screen">
      <h1>{t("settings.title")}</h1>
      <p>{t("settings.description")}</p>
    </div>
  );
}
