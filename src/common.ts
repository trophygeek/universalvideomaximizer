// @ts-check

export const DEV_MODE = true;
export const DEBUG_ENABLED = DEV_MODE && true;
export const TRACE_ENABLED = DEV_MODE && true;
export const ERR_BREAK_ENABLED = DEV_MODE && true;

export const IS_BETA_CHANNEL = false;

export const CSS_FILE = "videomax_inject.css";
export const CSS_STYLE_HEADER_ID = "maximizier-css-inject";

export const DEFAULT_SPEED = "1.0";

/*@__NO_SIDE_EFFECTS__*/
export function isRunningInIFrame() {try { return window !== window?.parent; } catch (e) {return false; }};

/*@__NO_SIDE_EFFECTS__*/
export function logerr(...args: any[]) {
  if (!DEV_MODE) {
    return;
  }
  const inIFrame = isRunningInIFrame() ? "iframe" : "main";
  // eslint-disable-next-line no-console
  console.trace(
      `%c VideoMax ${inIFrame} ERROR`,
      "color: white; font-weight: bold; background-color: red",
      ...args
  );
  if (ERR_BREAK_ENABLED) {
    // eslint-disable-next-line no-debugger
    debugger;
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function logwarn(...args: any[]) {
  if (!DEV_MODE) {
    return;
  }
  const inIFrame = isRunningInIFrame() ? "iframe" : "main";
  // eslint-disable-next-line no-console
  console.warn(
      `%c VideoMax ${inIFrame} WARNING`,
      "color: white; font-weight: bold; background-color: coral",
      ...args
  );
}

/*@__NO_SIDE_EFFECTS__*/
export function logtrace(...args: any[]) {
  if (!(DEV_MODE && TRACE_ENABLED)) {
    return;
  }
  const iframe = isRunningInIFrame() ? "iFrame" : "Main";
  // blue color , no break
  // eslint-disable-next-line no-console
  console.log(
      `%c VideoMax ${iframe}`,
      `color: white; font-weight: bold; background-color: blue`,
      ...args
  );
}

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

/*@__NO_SIDE_EFFECTS__*/
export function getKeys<T extends object>(obj: T) {
  return Object.keys(obj) as Array<keyof T>;
}

/*@__NO_SIDE_EFFECTS__*/
export async function getSettings(): Promise<SettingsType> {
  try {
    const result = await chrome?.storage?.local?.get();
    if (!result[SETTINGS_STORAGE_KEY]?.length) {
      return {...DEFAULT_SETTINGS}; // make a copy
    }
    /** @type SettingsType * */
    const savedSetting: SettingsType = JSON.parse(result[SETTINGS_STORAGE_KEY]);
    return {...DEFAULT_SETTINGS, ...savedSetting};
  } catch (err) {
    logerr(err);
    return {...DEFAULT_SETTINGS}; // make a copy
  }
}

export async function saveSettings(newSettings: SettingsType) {
  try {
    const settings = {...DEFAULT_SETTINGS, ...newSettings};
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
    await chrome?.storage?.local?.set({[SETTINGS_STORAGE_KEY]: jsonStr});
  } catch (err) {
    logerr(err);
  }
}

export async function clearSettings() {
  try {
    await chrome?.storage?.local?.remove(Object.keys(DEFAULT_SETTINGS));
  } catch (err) {
    logerr(err);
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function numbericOnly(str: string) {
  return str.replace(/[^0-9]+/g, "");
}

/*@__NO_SIDE_EFFECTS__*/
export function rangeInt(num: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, num));
}

/*@__NO_SIDE_EFFECTS__*/
export function getDomain(fullUrl: string | undefined | null) {
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
}

/**
 * @__NO_SIDE_EFFECTS__
 * Turn a comma list into array of strings
 */
export function listToArray(listStr: string): string[] {
  return (listStr?.split(",") || []).map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * @__NO_SIDE_EFFECTS__
 * Returns true if there are any overlaps between two arrays of strings.
 */
export function intersection(arrA: string[], arrB: string[]) {
  return arrA.filter((x) => arrB.includes(x)).length > 0;
}

/**
 * @__NO_SIDE_EFFECTS__
 */
export function isPageExcluded(domain: string, zoomExclusionListStr: string) {
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
}

/**
 * @__NO_SIDE_EFFECTS__
 */
export function domainToSiteWildcard(domain: string, wholeDomainAccess: boolean): string {
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
}

/*
 * @__NO_SIDE_EFFECTS__
 */
export async function getManifestJson() {
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
}

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
