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
      "start.tutorial": "TUTORIAL",
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
      "mode.fly": "FLY MODE",
      "tutorial.progress": "TUTORIAL {step}/{total}",
      "tutorial.moveToCannon": "Move your pilot to the FREE cannon.",
      "tutorial.driveAndAim": "You are inside. Move the mouse to drive and aim.",
      "tutorial.breakTarget": "Hold the left mouse button and break the target cannon.",
      "tutorial.pickAmmo": "Ammo is marked 30. Drive over it to reload.",
      "tutorial.eject": "Press Z to eject from the cannon.",
      "tutorial.fly": "Now press F. Fly mode lets the pilot cross danger safely.",
      "tutorial.ready": "READY FOR BATTLE"
    },

    ru: {
      "start.aria": "GUNS стартовый экран",
      "start.nickPlaceholder": "ПИЛОТ",
      "start.play": "ПОЕХАЛИ",
      "start.tutorial": "ТУТОРИАЛ",
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
      "mode.fly": "РЕЖИМ ПОЛЁТА",
      "tutorial.progress": "ТУТОРИАЛ {step}/{total}",
      "tutorial.moveToCannon": "Подведи пилота к свободной пушке.",
      "tutorial.driveAndAim": "Ты внутри. Двигай мышью, чтобы ехать и целиться.",
      "tutorial.breakTarget": "Зажми левую кнопку мыши и сломай учебную пушку.",
      "tutorial.pickAmmo": "Патроны отмечены числом 30. Наедь на них для перезарядки.",
      "tutorial.eject": "Нажми Z, чтобы катапультироваться из пушки.",
      "tutorial.fly": "Теперь нажми F. Режим полёта позволяет безопасно пересекать опасные зоны.",
      "tutorial.ready": "ГОТОВ К БОЮ"
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
