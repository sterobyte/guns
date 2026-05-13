(function () {
  const config = window.GUNS_CONFIG?.i18n || {};
  const fallbackLanguage = config.fallbackLanguage || "en";
  const defaultLanguage = config.defaultLanguage || fallbackLanguage;
  const storageKey = config.storageKey || "guns.language";

  const dictionaries = {
    en: {
      "start.aria": "GUNS start screen",
      "start.nickPlaceholder": "PILOT",
      "start.play": "GO",
      "start.versionAria": "Game version",
      "language.aria": "Language",
      "language.ru": "РУССКИЙ",
      "language.en": "ENGLISH",
      "pilot.defaultNick": "PILOT",
      "cannon.free": "FREE",
      "cannon.lock": "LOCK",
      "cannon.wait": "WAIT",
      "hint.cannonRequiresScore": "CANNON REQUIRES {score} SCORE",
      "scoreboard.rank": "#",
      "scoreboard.pilot": "PILOT",
      "scoreboard.score": "SCORE",
      "mode.fly": "FLY MODE"
    },

    ru: {
      "start.aria": "GUNS стартовый экран",
      "start.nickPlaceholder": "ПИЛОТ",
      "start.play": "ПОЕХАЛИ",
      "start.versionAria": "Версия",
      "language.aria": "Язык",
      "language.ru": "РУССКИЙ",
      "language.en": "ENGLISH",
      "pilot.defaultNick": "ПИЛОТ",
      "cannon.free": "СВОБОДНО",
      "cannon.lock": "ЗАКРЫТО",
      "cannon.wait": "ЧИНИТСЯ",
      "hint.cannonRequiresScore": "ТРЕБУЕТСЯ ОЧКОВ: {score}",
      "scoreboard.rank": "#",
      "scoreboard.pilot": "ПИЛОТ",
      "scoreboard.score": "ОЧКИ",
      "mode.fly": "РЕЖИМ ПОЛЁТА"
    }
  };

  let language = normalizeLanguage(localStorage.getItem(storageKey)) || defaultLanguage;

  function normalizeLanguage(value) {
    const shortCode = String(value || "")
      .trim()
      .toLowerCase()
      .split("-")[0];

    return dictionaries[shortCode] ? shortCode : "";
  }

  function format(template, params) {
    return String(template).replace(/\{(\w+)\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(params || {}, key)
        ? String(params[key])
        : match;
    });
  }

  function t(key, params = {}) {
    const activeDictionary = dictionaries[language] || dictionaries[fallbackLanguage] || {};
    const fallbackDictionary = dictionaries[fallbackLanguage] || {};
    const template = activeDictionary[key] || fallbackDictionary[key] || key;
    return format(template, params);
  }

  function apply(root = document) {
    if (document.documentElement) {
      document.documentElement.lang = language;
    }

    root.querySelectorAll("[data-i18n]").forEach(element => {
      element.textContent = t(element.dataset.i18n);
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });

    root.querySelectorAll("[data-i18n-aria]").forEach(element => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
  }

  function setLanguage(nextLanguage) {
    language = normalizeLanguage(nextLanguage) || fallbackLanguage;
    localStorage.setItem(storageKey, language);
    apply();
    window.dispatchEvent(new CustomEvent("guns:languagechange", { detail: { language } }));
    return language;
  }

  window.GUNS_I18N = {
    dictionaries,
    get language() {
      return language;
    },
    setLanguage,
    t,
    apply
  };
})();
