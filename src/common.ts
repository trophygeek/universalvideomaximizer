// @ts-check

export const FULL_DEBUG = true;
export const DEBUG_ENABLED: boolean = FULL_DEBUG;
export const TRACE_ENABLED: boolean = FULL_DEBUG;
export const ERR_BREAK_ENABLED: boolean = FULL_DEBUG;

export const IS_BETA_CHANNEL: boolean = false;

export const DEFAULT_SPEED = "1.0";

export const CSS_FILE = "videomax_inject.css";
export const CSS_STYLE_HEADER_ID = "maximizier-css-inject";
export const DEAULT_SPEED = "1.0";

export const isRunningInIFrame = () => window !== window?.parent;

export const logerr = (...args: any[]) => {
  if (!DEBUG_ENABLED) {
    return;
  }
  // eslint-disable-next-line no-console
  console.trace(
    `%c VideoMax ERROR`,
    `color: white; font-weight: bold; background-color: red`,
    ...args
  );
  if (ERR_BREAK_ENABLED) {
    // eslint-disable-next-line no-debugger
    debugger;
  }
};

export const logwarn = (...args: any[]) => {
  if (!DEBUG_ENABLED) {
    return;
  }
  const inIFrame = isRunningInIFrame() ? "iframe" : "main";
  // eslint-disable-next-line no-console
  console.warn(
    `%c VideoMax INJECT ${inIFrame} ERROR`,
    "color: white; font-weight: bold; background-color: orange",
    ...args
  );
};

export const trace = (...args: any[]) => {
  if (TRACE_ENABLED) {
    // blue color , no break
    // eslint-disable-next-line no-console
    console.log(
      `%c VideoMax `,
      `color: white; font-weight: bold; background-color: blue`,
      ...args
    );
  }
};

/**
 * @type {SettingStorageKeyConstType}
 */
export const SETTINGS_STORAGE_KEY: SettingStorageKeyConstType = "settingsJson";

// bumping this will cause the notification to show again. keep it pinned unless some major feature
export const UPDATE_NOTIFICATION_VERISON = "85"; // will get out of sync. bump to show
// notification

/* these are sites that are already zoomed, but playback speed is kind of nice */
export const DEFAULT_ZOOM_EXCLUSION_LIST =
  "amazon," +
  "hbomax," +
  "play.max," +
  "disneyplus," +
  "hulu," +
  "netflix," +
  "tv.youtube," +
  "youku," +
  "bet," +
  "tv.apple," +
  "play.google," +
  "peacocktv,";

export const DEFAULT_SETTINGS: SettingsType = {
  lastBetaVersion: "0", // number as string used to show initial "help" (also for major
  // releases)
  useAdvancedFeatures: true,
  spacebarTogglesPlayback: true,
  regSkipSeconds: 5,
  longSkipSeconds: 20,
  preportionalSkipTimes: true,
  wholeDomainAccess: true, // "all example.com sites" vs "on www.example.com"
  allSitesAccess: false,
  allSitesAccessNeedsRevoke: false,
  zoomExclusionListStr: DEFAULT_ZOOM_EXCLUSION_LIST,
  beta3EndingShown: false,
};

export const getKeys = <T extends object>(obj: T) =>
  Object.keys(obj) as Array<keyof T>;

export const getSettings = async (): Promise<SettingsType> => {
  try {
    const result = await chrome?.storage?.local?.get();
    if (!result[SETTINGS_STORAGE_KEY]?.length) {
      return { ...DEFAULT_SETTINGS }; // make a copy
    }
    /** @type SettingsType * */
    const savedSetting: SettingsType = JSON.parse(result[SETTINGS_STORAGE_KEY]);
    return { ...DEFAULT_SETTINGS, ...savedSetting };
  } catch (err) {
    logerr(err);
    return { ...DEFAULT_SETTINGS }; // make a copy
  }
};

export const saveSettings = async (
  newSettings: SettingsType
): Promise<void> => {
  try {
    const settings = { ...DEFAULT_SETTINGS, ...newSettings };
    // remove an settings that are default and don't save them.
    // if a user is using the "default" then the extension should be able to
    // change it in code in a future version.
    const keys = getKeys(DEFAULT_SETTINGS);
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

export const numbericOnly = (str: string): string =>
  str.replace(/[^0-9]+/g, "");

export const rangeInt = (num: number, lower: number, upper: number): number =>
  Math.max(lower, Math.min(upper, num));

export const getDomain = (fullUrl: string | undefined | null): string => {
  try {
    if (!fullUrl?.length) {
      return "";
    }
    let url = fullUrl;
    if (url.startsWith(`blob:https://`)) {
      // seen blob:https://example.com for iframe
      url = url.substring("blob:".length);
    }
    if (!url.startsWith(`https://`)) {
      url = `https://${url}`;
    }
    return new URL(url).host.toLowerCase();
  } catch (err) {
    logerr(`getDomain err for "${fullUrl}"`, err);
    return fullUrl || "";
  }
};

/**
 * Turn a comma list into array of strings
 */
export const listToArray = (listStr: string): string[] =>
  (listStr?.split(",") || []).map((s) => s.trim()).filter((s) => s.length > 0);

/**
 * Returns true if there are any overlaps between two arrays of strings.
 */
export const intersection = (arrA: string[], arrB: string[]): boolean =>
  arrA.filter((x) => arrB.includes(x)).length > 0;

export const isPageExcluded = (
  domain: string,
  zoomExclusionListStr: string
): boolean => {
  if (!domain?.length) {
    return false;
  }
  const excludedList = listToArray(zoomExclusionListStr);
  // tv.apple.com is the tricky part
  for (const eachExcludedDomain of excludedList) {
    // if it doesn't have a trailing . or .com then append a "."
    const each =
      eachExcludedDomain.endsWith(".com") || eachExcludedDomain.endsWith(".")
        ? eachExcludedDomain
        : `${eachExcludedDomain}.`;
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
export const domainToSiteWildcard = (
  domain: string,
  wholeDomainAccess: boolean
): string => {
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
    domainStr = getDomain(domainStr) || "";
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
    const extManifestFileUri = chrome?.runtime?.getURL("manifest.json");
    if (extManifestFileUri !== "") {
      // this fetch is to load a file internal to the chrome extension (our manifest) as data
      const response = await fetch(extManifestFileUri);
      const json = await response.json();
      return json || {};
    }
  } catch (err) {
    logerr(err);
  }
  return {};
};

declare global {
  interface Document {
    _VideoMaxExt: VideomaxGlobalsTypeBase | undefined;
    videmax_cmd: string;
  }
  interface Window {
    _VideoMaxExt: VideomaxGlobalsTypeBase | undefined;
    videmax_cmd: string;
  }
}

/** used by unit tests * */
// const sleep = (ms) => new Promise(r => setTimeout(r, ms));
