// @ts-check

const FULL_DEBUG        = true;
const DEBUG_ENABLED     = FULL_DEBUG;
const TRACE_ENABLED     = FULL_DEBUG;
const ERR_BREAK_ENABLED = FULL_DEBUG;

export const DEFAULT_SPEED = "1.0";

export const CSS_FILE            = "inject.css";
export const CSS_STYLE_HEADER_ID = "maximizier-css-inject";
export const DEAULT_SPEED        = "1.0";

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
export const BETA_UPDATE_NOTIFICATION_VERISON = "74";


/* these are sites that are already zoomed, but playback speed is kind of nice */
const DEFAULT_ZOOM_EXCLUSION_LIST = "amazon," + "hbomax," + "play.max," + "disneyplus," + "hulu," +
                                    "netflix," + "tv.youtube," + "youku," + "bet," + "tv.apple," +
                                    "play.google," + "peacocktv,";

/**
 * @type {SettingsType}
 */
export const DEFAULT_SETTINGS = {
  lastBetaVersion:           "",
  useToggleZoomBehavior:     false, // true
  spacebarTogglesPlayback:   true,
  regSkipSeconds:            5,
  longSkipSeconds:           20,
  preportionalSkipTimes:     true,
  allSitesAccess:            false,
  allSitesAccessNeedsRevoke: false,
  zoomExclusionListStr:      DEFAULT_ZOOM_EXCLUSION_LIST,
};

/**
 * @return {Promise<SettingsType>}
 */
export const getSettings = async () => {
  try {
    const result = await chrome?.storage?.local?.get();
    if (!result[SETTINGS_STORAGE_KEY]?.length > 0) {
      return { ...DEFAULT_SETTINGS }; // make a copy
    }
    /** @type SettingsType **/
    const savedSetting = JSON.parse(result[SETTINGS_STORAGE_KEY]);
    return { ...DEFAULT_SETTINGS, ...savedSetting };
  } catch (err) {
    console.error(err);
    return { ...DEFAULT_SETTINGS }; // make a copy
  }
};

/**
 *
 * @param newSettings SettingsType
 * @returns {Promise<void>}
 */
export const saveSettings = async (newSettings /** @type Promise<SettingsType>*/) => {
  try {
    const settings = { ...DEFAULT_SETTINGS, ...newSettings };
    // remove an settings that are default and don't save them.
    // if a user is using the "default" then the extension should be able to
    // change it in code in a future version.
    const keys = Object.keys(DEFAULT_SETTINGS);
    for (let key of keys) {
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
    console.error(err);
  }
};

export const clearSettings = async () => {
  try {
    await chrome?.storage?.local?.remove(Object.keys(DEFAULT_SETTINGS));
  } catch (err) {
    console.error(err);
  }
};

/**
 * @param str {string}
 * @returns {string}
 */
export const numbericOnly = (str) => str.replace(/\n+/g, "");

/**
 * @param num {number}
 * @param lower {number}
 * @param upper {number}
 * @returns {number}
 */
export const rangeInt = (num, lower, upper) => Math.max(lower, Math.min(upper, num));

/**
 *
 * @param url {string}
 * @return {string}
 */
export const getDomain = (url) => {
  if (url.indexOf(`://`) > 0) {
    return (new URL(url)).host.toLowerCase();
  } else {
    return url;
  }
};

/**
 *
 * @param listStr {string}
 * @return {string[]}
 */
export const listToArray = (listStr) => (listStr?.split(",") || []).filter(s => s?.length);

/**
 * Returns true if there are any overlaps between two arrays of strings.
 * @param arrA {string[]}
 * @param arrB {string[]}
 * @return {boolean}
 */
export const intersection = (arrA, arrB) => arrA.filter(x => arrB.includes(x)).length > 0;

/**
 *
 * @param url {string | undefined}
 * @returns {boolean}
 */
export const alwaysExcluded = (url) => {
  // there will be sites that request this extension NOT work with them.
  // still building out this feature, but this is used for testing
  const NOPE_DOMAINS_LIST = ["rt.com", "kremlin.ru", "prageru.com", "prage.ru"];
  const NOPE_URL_LIST     = ["prageru"];  // maybe block all .ru propaganda related domains?

  if (!url?.length) {
    return false;
  }
  const urlParts = new URL(url);
  const domain   = urlParts.host.toLowerCase();
  const path     = urlParts.pathname.toLowerCase();
  for (let elem of NOPE_DOMAINS_LIST) {
    if (domain.indexOf(elem) >= 0) { // substring so www. prefix matches
      logerr(`NOPE_DOMAINS_LIST match for "${url}"`);
      return true;
    }
  }
  // this wants to match against paths too.
  const parts = path.split(/[^A-Za-z]/);
  if (intersection(parts, NOPE_URL_LIST)) {
    logerr(`NOPE_URL_LIST match for "${url}"`);
    return true;
  }
  return false;
};

/**
 * @param domain {string}
 * @param zoomExclusionListStr {string}
 * @return {boolean}
 */
export const isPageExcluded = (domain, zoomExclusionListStr) => {
  if (!domain?.length) {
    // we don't have access to the url, check our current state
    trace("isPageExcluded url is EMPTY");
    return false;
  }
  // we want "hulu" to match "www.hulu.com" or "hulu.co.uk" but not "shulu.org"
  // we flip the comparison around. but both are lowercase.
  const domainParts  = domain.split(".");
  const excludedList = listToArray(zoomExclusionListStr);
  if (intersection(domainParts, excludedList)) {
    trace(`Excluded from zooming ${g_domain}`);
    return true;
  }
  return false;
};

/** used by unit tests **/
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
