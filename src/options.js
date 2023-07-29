// @ts-check
import {
  clearSettings,
  DEFAULT_SETTINGS,
  getDomain, getManifestJson,
  getSettings,
  listToArray,
  numbericOnly,
  rangeInt,
  saveSettings,
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
    const manifest = await getManifestJson();
    return manifest?.version || "";
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
  setChecked("useAdvancedFeatures", settings.useAdvancedFeatures);
  setTextNum("regSkipSeconds", settings.regSkipSeconds);
  setTextNum("longSkipSeconds", settings.longSkipSeconds);
  // setChecked("preportionalSkipTimes", settings.preportionalSkipTimes);
  setChecked("wholeDomainAccess", settings.wholeDomainAccess);
  setChecked("allSitesAccess", settings.allSitesAccess);

  enableAdvanceFeaturesOptions();

  // list of no-zoom sites
  {
    /* Used to build list */
    const LI_START  = `<li class="list-group-item container"><div class="container"><div class="row is-center">`;
    const LI_START2 = LI_START + `<div class="col-1 is-left domain">`;
    const LI_END    = `</div><div class="col-10 is-right"><button name="removeBtn" class="delete-button">Remove</button></div></div></div></li>`;
    const listarr   = listToArray(settings.zoomExclusionListStr);
    // noinspection UnnecessaryLocalVariableJS
    const list      = LI_START2 + listarr.join(LI_END + LI_START2) + LI_END;

    document.getElementById("nozoomlist").innerHTML = list;
    setTimeout(() => {
      const buttons = document.getElementsByName("removeBtn");
      for (const eachButton of buttons) {
        eachButton.addEventListener("click", (e) => {
          const parentLi = e?.currentTarget?.closest("li");
          const domain   = parentLi?.querySelector(`div[class*="domain"]`)?.innerText || "";
          parentLi.classList.add("fade-out");
          // remove domain from list and save.
          g_settings.zoomExclusionListStr = g_settings.zoomExclusionListStr.replace(`,${domain}`,
            "");
          (async () => await saveSettings(g_settings))();
        });
      }
    }, 0);
  }
};

/**
 * @param settings {SettingsType}
 * @return {SettingsType}
 */
const saveFieldsIntoSettings = (settings) => {
  try {
    settings.useAdvancedFeatures = getChecked("useAdvancedFeatures");
    settings.regSkipSeconds        = getTextNum("regSkipSeconds");
    settings.longSkipSeconds       = getTextNum("longSkipSeconds");
    // settings.preportionalSkipTimes = getChecked("preportionalSkipTimes");
    settings.allSitesAccess        = getChecked("allSitesAccess");
    settings.wholeDomainAccess     = getChecked("wholeDomainAccess");
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

const enableAdvanceFeaturesOptions = () => {
  const useAdvancedFeatures = getChecked("useAdvancedFeatures");
  const disableFields         = document.getElementsByClassName("diableForSimpleFeatures");
  for (const eachField of disableFields) {
    if (useAdvancedFeatures) {
      eachField.classList.remove("is-disabled");
    } else {
      eachField.classList.add("is-disabled");
    }
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    g_settings = await getSettings();
    loadSettingsIntoFields(g_settings);

    // show debug info
    const settingStr      = JSON.stringify(g_settings, null, 2);
    const manifestVersion = await getManifestVersion() || "[missing manifest version]";
    // noinspection JSUnresolvedReference
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

    document.getElementById("useAdvancedFeatures")
      .addEventListener("click", async (_e) => {
        enableAdvanceFeaturesOptions();
        setTimeout(() => {
          if (!getChecked("useAdvancedFeatures")) {
            alert(`
This will remove the speed controls.

To access this Option page in the future, RIGHT-CLICK on the extension's icon in toolbar and select "options"`);
          }
        }, 250);
      });

    document.getElementById("allSitesAccess")
      .addEventListener("click", async (_e) => {
        setTimeout(() => {
          if (getChecked("allSitesAccess")) {
            alert(`
Enabling this feature will prompt you ONE last time to grant this extension FULL ACCESS.

You may need to REFRESH the video page before it takes effect.`);
          }
        }, 250);
      });

    document.getElementById("addpathblacklist")
      .addEventListener("click", async (e) => {
        const newDomainStr = prompt("New domain name to exclude from zooming:");
        if (newDomainStr?.length) {
          const domain                    = getDomain(newDomainStr);
          g_settings.zoomExclusionListStr = `${g_settings.zoomExclusionListStr},${domain}`;
          await save();
          // scroll to bottom
          const objDiv     = document.getElementById("nozoomlist");
          objDiv.scrollTop = objDiv.scrollHeight;
        }
        e.stopPropagation();
        return false;
      });

    document.getElementById("reset")
      .addEventListener("click", async (_e) => {
        await clearSettings();
        loadSettingsIntoFields(DEFAULT_SETTINGS);
      });

    document.getElementById("save")
      .addEventListener("click", (_e) => {
        window.close();
      });

  } catch (err) {
    console.error(err);
  }
});
