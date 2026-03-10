import i18n from "../i18n";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof window !== "undefined") {
	window.localStorage.setItem("i18nextLng", "es");
}

void i18n.changeLanguage("es");
