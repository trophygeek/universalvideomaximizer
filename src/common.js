// @ts-check

const FULL_DEBUG = true;
const DEBUG_ENABLED = FULL_DEBUG;
const TRACE_ENABLED = FULL_DEBUG;
const ERR_BREAK_ENABLED = FULL_DEBUG;

export const DEFAULT_SPEED = "1.0";

export const CSS_FILE = "videomax_inject.css";
export const CSS_STYLE_HEADER_ID = "maximizier-css-inject";
export const DEAULT_SPEED = "1.0";

export const logerr = (...args) => {
  if (DEBUG_ENABLED === false) {
    return;
  }
  // eslint-disable-next-line no-console
  console.trace(`%c VideoMax ERROR`, `color: white; font-weight: bold; background-color: red`,
                ...args);
  if (ERR_BREAK_ENABLED) {
    // eslint-disable-next-line no-debugger
    debugger;
  }
};

export const trace = (...args) => {
  if (TRACE_ENABLED) {
    // blue color , no break
    // eslint-disable-next-line no-console
    console.log(`%c VideoMax `, `color: white; font-weight: bold; background-color: blue`, ...args);
  }
};

/**
 * @type {SettingStorageKeyConstType}
 */
export const SETTINGS_STORAGE_KEY = "settingsJson";

// bumping this will cause the notification to show again. keep it pinned unless some major feature
export const BETA_UPDATE_NOTIFICATION_VERISON = "85"; // will get out of sync. bump to show
                                                      // notification


/* these are sites that are already zoomed, but playback speed is kind of nice */
export const DEFAULT_ZOOM_EXCLUSION_LIST = "amazon," + "hbomax," + "play.max," + "disneyplus," +
                                           "hulu," + "netflix," + "tv.youtube," + "youku," +
                                           "bet," + "tv.apple," + "play.google," + "peacocktv,";

/**
 * @type {SettingsType}
 */
export const DEFAULT_SETTINGS = {
  lastBetaVersion: "0", // number as string used to show initial "help" (also for major
                        // releases)
  useAdvancedFeatures:       false,
  spacebarTogglesPlayback:   true,
  regSkipSeconds:            5,
  longSkipSeconds:           20,
  preportionalSkipTimes:     true,
  wholeDomainAccess:         true, // "all example.com sites" vs "on www.example.com"
  allSitesAccess:            false,
  allSitesAccessNeedsRevoke: false,
  firstUseShown:             false, // set to true once first_use picks a mode.
  zoomExclusionListStr:      DEFAULT_ZOOM_EXCLUSION_LIST,
};

/**
 * @return {Promise<SettingsType>}
 */
export const getSettings = async () => {
  try {
    const result = await chrome?.storage?.local?.get();
    if (!result[SETTINGS_STORAGE_KEY]?.length) {
      return { ...DEFAULT_SETTINGS }; // make a copy
    }
    /** @type SettingsType * */
    const savedSetting = JSON.parse(result[SETTINGS_STORAGE_KEY]);
    return { ...DEFAULT_SETTINGS, ...savedSetting };
  } catch (err) {
    logerr(err);
    return { ...DEFAULT_SETTINGS }; // make a copy
  }
};

/**
 *
 * @param newSettings SettingsType
 * @returns {Promise<void>}
 */
export const saveSettings = async (newSettings /** @type Promise<SettingsType> */) => {
  try {
    const settings = { ...DEFAULT_SETTINGS, ...newSettings };
    // remove an settings that are default and don't save them.
    // if a user is using the "default" then the extension should be able to
    // change it in code in a future version.
    const keys = Object.keys(DEFAULT_SETTINGS);
    for (const key of keys) {
      try {
        if (settings[key] === DEFAULT_SETTINGS[key]) {
          delete settings[key];
        }
      } catch (err) {
        logerr(err);
      }
    }
    const jsonStr = JSON.stringify(settings);
    await chrome?.storage?.local?.set({ [SETTINGS_STORAGE_KEY]: jsonStr });
  } catch (err) {
    logerr(err);
  }
};

export const clearSettings = async () => {
  try {
    await chrome?.storage?.local?.remove(Object.keys(DEFAULT_SETTINGS));
  } catch (err) {
    logerr(err);
  }
};

/**
 * @param str {string}
 * @returns {string}
 */
export const numbericOnly = (str) => str.replace(/[^0-9]+/g, "");

/**
 * @param num {number}
 * @param lower {number}
 * @param upper {number}
 * @returns {number}
 */
export const rangeInt = (num, lower, upper) => Math.max(lower, Math.min(upper, num));

/**
 *
 * @param fullUrl {string}
 * @return {string}
 */
export const getDomain = (fullUrl) => {
  try {
    let url = fullUrl;
    if (!url.length) {
      return url; // undefined and ""
    }
    if (url.startsWith(`blob:https://`)) {
      // seen blob:https://example.com for iframe
      url = url.substring("blob:".length);
    }
    if (!url.startsWith(`https://`)) {
      url = `https://${url}`;
    }
    return (new URL(url)).host.toLowerCase();
  } catch (err) {
    return fullUrl;
  }
};

/**
 * Turn a comma list into array of strings
 * @param listStr {string}
 * @return {string[]}
 */
export const listToArray = (listStr) => (listStr?.split(",") || [])
  .map(s => s.trim())
  .filter(s => s.length > 0);

/**
 * Returns true if there are any overlaps between two arrays of strings.
 * @param arrA {string[]}
 * @param arrB {string[]}
 * @return {boolean}
 */
export const intersection = (arrA, arrB) => arrA.filter(x => arrB.includes(x)).length > 0;

/**
 * @param domain {string}
 * @param zoomExclusionListStr {string}
 * @return {boolean}
 */
export const isPageExcluded = (domain, zoomExclusionListStr) => {
  if (!domain?.length) {
    return false;
  }
  const excludedList = listToArray(zoomExclusionListStr);
  // tv.apple.com is the tricky part
  for (const eachExcludedDomain of excludedList) {
    // if it doesn't have a trailing . or .com then append a "."
    const each = eachExcludedDomain.endsWith(".com") || eachExcludedDomain.endsWith(".") ?
                 eachExcludedDomain :
                 `${eachExcludedDomain}.`;
    if (domain.includes(each)) {
      return true;
    }
  }
  return false;
};

/**
 *
 * @param domain {string}
 * @param wholeDomainAccess {boolean}
 * @return {string}
 */
export const domainToSiteWildcard = (domain, wholeDomainAccess) => {
  let domainStr = domain;
  if (!domainStr?.length) {
    return "";
  }
  if (domainStr.startsWith("file:")) {
    return domainStr;
  }
  if (domainStr.startsWith("chrome:")) {
    return "";
  }
  if (domainStr.startsWith("https://") || domainStr.startsWith("blog:")) {
    domainStr = getDomain(domainStr);
  }
  if (!wholeDomainAccess) {
    return `https://${domainStr}/`;
  }
  if (domainStr.startsWith("www.") || domainStr.startsWith("web.")) {
    domainStr = domainStr.substring("www.".length); // trim off 4 chars from front
  }
  return `https://*.${domainStr}/`;
};

/*
 * @returns {Promise<Object>}
 */
export const getManifestJson = async () => {
  try {
    const cssFilePath = chrome?.runtime?.getURL("manifest.json");
    if (cssFilePath !== "") {
      // this fetch is to load a file internal to the chrome extension (our manifest) as data
      const response = await fetch(cssFilePath);
      const json = await response.json();
      return json || {};
    }
  } catch (err) {
    logerr(err);
  }
  return {};
};

/** used by unit tests * */
// const sleep = (ms) => new Promise(r => setTimeout(r, ms));
