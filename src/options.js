// @ts-check
import {
  clearSettings, DEFAULT_SETTINGS, getSettings, numbericOnly, rangeInt, saveSettings,
} from "./common.js";

/**
 * @typedef {import("./common.js")}
 */

// NOTE: debugging localStorage for extensions STILL isn't nativity supported,
//  so use this 3rd party extension:
//  https://chrome.google.com/webstore/detail/storage-area-explorer/ocfjjjjhkpapocigimmppepjgfdecjkb

let g_settings = { ...DEFAULT_SETTINGS };

/**
 *
 * @returns {Promise<String>}
 */
const getManifestVersion = async () => {
  try {
    const cssFilePath = chrome?.runtime?.getURL("manifest.json");
    if (cssFilePath !== "") {
      // this fetch is to load a file internal to the chrome extension (our manifest) as data
      const response = await fetch(cssFilePath);
      const json     = await response.json();
      return json?.version || "";
    }
  } catch (err) {
    console.error(err);
  }
  return "";
};


/**
 *
 * @param elementId {SettingsKeyType}
 * @param isChecked {boolean}
 */
const setChecked = (elementId, isChecked) => {
  const htmlElement = /** @type {HTMLInputElement} */ document.getElementById(elementId);
  if (htmlElement?.type === "checkbox") {
    htmlElement.checked = isChecked;
  } else {
    console.error(`element "${elementId}" not checkbox`);
  }
};

/**
 *
 * @param elementId {SettingsKeyType}
 * @returns {boolean}
 */
const getChecked = (elementId) => {
  const htmlElement = /** @type {HTMLInputElement} */ document.getElementById(elementId);
  if (htmlElement?.type === "checkbox") {
    return htmlElement?.checked || false;
  } else {
    console.error(`element "${elementId}" not checkbox?`);
    return false;
  }
};


/**
 * @param elementId {SettingsKeyType}
 * @param value {number}
 */
const setTextNum = (elementId, value) => {
  const htmlElement = /** @type {HTMLInputElement} */ document.getElementById(elementId);
  htmlElement.value = String(value);
};


/**
 *
 * @param elementId {SettingsKeyType}
 * @returns {number}
 */
const getTextNum = (elementId) /** @type number */ => {
  const htmlElement = /** @type {HTMLInputElement} */ document.getElementById(elementId);
  const valStr      = numbericOnly(htmlElement.value) || "1";
  const valInt      = Math.abs(parseInt(valStr));
  return rangeInt(valInt, 1, 900);
};

/**
 * @param settings {SettingsType}
 */
const loadSettingsIntoFields = (settings) => {
  // load settings into page
  setChecked("useToggleZoomBehavior", settings.useToggleZoomBehavior);
  setTextNum("regSkipSeconds", settings.regSkipSeconds);
  setTextNum("longSkipSeconds", settings.longSkipSeconds);
  // setChecked("preportionalSkipTimes", settings.preportionalSkipTimes);
  setChecked("allSitesAccess", settings.allSitesAccess);

  // list of no-zoom sites
  {
    /* Used to build list */
    const LI_START  = "<li class=\"list-group-item\">";
    const LI_START2 = LI_START + "<div class=\"li-value\">";
    const LI_END    = "</div><di class=\"button-span\"><button class=\"delete-button\">Remove</button></di></li>";

    const listarr                                   = (settings.zoomExclusionListStr?.split(",") ||
                                                       []).filter(s => s?.length);
    const list                                      = LI_START2 + listarr.join(LI_END + LI_START2) +
                                                      LI_END + LI_START +
                                                      "<button id=\"addpathblacklist\" class=\"add-button\"> + Add New ...</button>" +
                                                      "</li>";
    document.getElementById("nozoomlist").innerHTML = list;
  }
};

/**
 * @param settings {SettingsType}
 * @return {SettingsType}
 */
const saveFieldsIntoSettings = (settings) => {
  try {
    settings.useToggleZoomBehavior = getChecked("useToggleZoomBehavior");
    settings.regSkipSeconds        = getTextNum("regSkipSeconds");
    settings.longSkipSeconds       = getTextNum("longSkipSeconds");
    // settings.preportionalSkipTimes = getChecked("preportionalSkipTimes");
    settings.allSitesAccess        = getChecked("allSitesAccess");
  } catch (err) {
    console.error(err);
  }
  return settings;
};

const save = async () => {
  try {
    g_settings = saveFieldsIntoSettings(g_settings);
    loadSettingsIntoFields(g_settings);
    await saveSettings(g_settings);
  } catch (err) {
    console.error(err);
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    g_settings = await getSettings();
    loadSettingsIntoFields(g_settings);

    // show debug info
    const settingStr      = JSON.stringify(g_settings, null, 2);
    const manifestVersion = await getManifestVersion() || "[missing manifest version]";
    const userAgent       = JSON.stringify(navigator?.userAgentData, null, 2);

    document.getElementById("version").innerHTML = `
<pre>
Extension Version: v${manifestVersion}
Extension Settings:
${settingStr}
Browser Version:
${userAgent}

</pre>`;

    document.getElementById("mainForm")
      .addEventListener("change", async (_e) => {
        await save();
      });

    document.getElementById("allSitesAccess").addEventListener("click", async (_e) => {
      setTimeout(() => {
        if (getChecked("allSitesAccess")) {
          alert("\nEnabling this feature will prompt you to grant this extension full access.\n\nYou will need to REFRESH the video page before it takes effect.");
        }
      }, 250);
    });

    document.getElementById("reset")
      .addEventListener("click", async (_e) => {
        await clearSettings();
        loadSettingsIntoFields(DEFAULT_SETTINGS);
      });

  } catch (err) {
    console.error(err);
  }
});
