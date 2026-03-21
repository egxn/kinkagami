import i18n from "../i18n";
import testAppConfig from "../config/testAppConfig.json";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof window !== "undefined") {
	window.localStorage.setItem("i18nextLng", "es");
	window.localStorage.setItem("kgm-app-config-v1", JSON.stringify(testAppConfig));
}

void i18n.changeLanguage("es");
