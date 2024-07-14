// @ts-check

import Point = chrome.system.display.Point;

export const DEV_MODE = true;
export const DEBUG_ENABLED = DEV_MODE && true;
export const TRACE_ENABLED = DEV_MODE && true;
export const ERR_BREAK_ENABLED = DEV_MODE && true;

export const IS_BETA_CHANNEL = false;

export const CSS_FILE = "videomax_inject.css";
export const CSS_STYLE_HEADER_ID = "maximizier-css-inject";
export const PLAYBACK_SPEED_ATTR = "data-videomax-playbackspeed";
export const DEFAULT_SPEED_NUM = 1.0;
export const DEFAULT_SPEED_STR = "1.0";

export function isRunningInIFrame() {
  try {
    return window !== window?.parent;
  } catch (e) {
    return false;
  }
}

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

export function getKeys<T extends object>(obj: T) {
  return Object.keys(obj) as Array<keyof T>;
}

export async function getSettings(): Promise<SettingsType> {
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
}

export async function saveSettings(newSettings: SettingsType) {
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
}

export async function clearSettings() {
  try {
    await chrome?.storage?.local?.remove(Object.keys(DEFAULT_SETTINGS));
  } catch (err) {
    logerr(err);
  }
}

export function numbericOnly(str: string) {
  return str.replace(/[^0-9]+/g, "");
}

export function rangeInt(num: number, lower: number, upper: number) {
  return Math.max(lower, Math.min(upper, num));
}

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
 * Turn a comma list into array of strings
 */
export function listToArray(listStr: string): string[] {
  return (listStr?.split(",") || []).map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Returns true if there are any overlaps between two arrays of strings.
 */
export function intersection(arrA: string[], arrB: string[]) {
  return arrA.filter((x) => arrB.includes(x)).length > 0;
}

export function normalizeDomain(domain: string) {
  // example.co.uk, example.com.au tv.apple.com{
  const elems = domain.split(".");
  if (elems.length <= 1) {
    return `.${elems[0]}.` ?? ".example."; // safe domain, never exists.
  }

  // remove the first work if it's a common prefix.
  if (["www", "web", "ftp"].indexOf(elems[0]) > -1) {
    elems.shift(); // remove it.
  }
  return `.${elems.join(".")}.`;
}

export function isPageExcluded(domain: string, zoomExclusionListStr: string) {
  if (!domain?.length) {
    return false;
  }
  const normalizedDomain = normalizeDomain(domain);
  const excludedList = listToArray(zoomExclusionListStr);
  // tv.apple.com, www.example.co.uk example.co.uk are tricky
  for (const eachExcludedDomain of excludedList) {
    const eachNormalizedExcludedDomain = normalizeDomain(eachExcludedDomain);
    if (normalizedDomain.indexOf(eachNormalizedExcludedDomain) > -1) {
      return true; // match
    }
  }
  return false;
}

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

export function parseTwoPixelsString(value: string) {
  // compStyle?.transformOrigin
  // there's lots of string values for transformOrigin...
  // we're just going to handle "#px #px"
  // the trick is that the float matching can return 2-4 group matches if there's a decimal.
  // [0] the whole string.
  // [1] is always the first number, the 2nd number can be [2] or [3]
  const regex = /([+-]?\d+(\.\d+)?)px\s*,?\s*([+-]?\d+(\.\d+)?)px/;
  const matches = value.match(regex);
  if (matches?.length === 5) {
    return { top: parseFloat(matches[1]), left: parseFloat(matches[3]) };
  }
  return { top: 0, left: 0 };
}

// new() can be slow, so cache.
const g_formatFloat = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatFloat(value: number) {
  return g_formatFloat.format(value);
}

const g_formatInt = new Intl.NumberFormat("en-US", {
  useGrouping: true,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatInt(value: number) {
  return g_formatInt.format(value);
}

/**
 * Rounds a float consistently - WTF javascript?
 */
export function round(value: number): number {
  return parseFloat(formatFloat(value));
}

export function getOverlapCount(arrA: string[], arrB: string[]) {
  return arrA.filter((x) => arrB.includes(x)).length;
}

// split on :// and use what comes after, then trim of cgi params, the split
// into works and filter out empty
// Used to match a video source url to the page url, they are OFTEN very common.
export function splitUrlWords(url: string): string[] {
  if (!url?.length) {
    return [];
  }
  const path = url.split("://")[1] || url;
  const noArgs = path.split("?")[0] || path;
  // filter empty terms.
  const result = [...noArgs.split(/[^A-Z0-9]+/i).filter((s) => s.length > 0)];
  // remove common words that don't give a good signal. these are in the PATH part of the url, too.
  // remove short words that are often very common "to" "a" "the"
  const ignoredWords = [
    "www",
    "web",
    "com",
    "org",
    "net",
    "co",
    "uk",
    "jp",
    "au",
    "html",
    "amp",
    "video",
    "en-US",
    "en",
    "tv",
    "plus",
    "app",
    "the",
    "news",
    "us",
    "media",
    "watch",
    "clip",
  ];
  return result.filter((s) => !ignoredWords.includes(s.toLowerCase())).filter((s) => s.length > 2);
}

export function safeParseInt(str: string): number {
  try {
    const matches = str?.match(/([+-]?\d+)/);
    if (matches?.length !== 2) {
      return 0;
    }
    const result = parseInt(matches[1], 10);
    return Number.isNaN(result) ? 0 : result;
  } catch (_err) {
    return 0;
  }
}

export function safeParseFloat(str: string | undefined | null, defaultVal = 0.0): number {
  const matches = str?.match(/([+-]?\d+(\.\d+)?)/);
  if (matches?.length !== 3) {
    return defaultVal;
  }
  const floatstr = `${matches[1] || "0"}.${matches[2] || ""}`;
  const result = parseFloat(floatstr);
  return Number.isNaN(result) ? defaultVal : result;
}

export function diceCoefficient(str1: string, str2: string) {
  let intersection = 0;
  for (const ch1 of str1) {
    for (const ch2 of str2) {
      if (ch1 === ch2) {
        intersection++;
      }
    }
  }
  const union = str1.length + str2.length - intersection;
  return intersection / union;
}

export function customDiceCoefficient(pageUrl: string, elemUrl: string) {
  const pageParts = splitUrlWords(pageUrl);
  const urlParts = splitUrlWords(elemUrl);
  const overlapCount = getOverlapCount(pageParts, urlParts);
  const count = Math.max(1, pageParts.length);
  const avgCount = (count + count) / 2.0;
  return overlapCount / avgCount;
}

export function getCoords(el: Element) {
  try {
    const { body } = document;
    const docEl = document.documentElement;

    const scrollTop = window.scrollY || docEl.scrollTop || body.scrollTop;
    const scrollLeft = window.scrollX || docEl.scrollLeft || body.scrollLeft;

    const clientTop = docEl.clientTop || body.clientTop || 0;
    const clientLeft = docEl.clientLeft || body.clientLeft || 0;

    const box = el?.getBoundingClientRect();
    const top = Math.round(box.top + scrollTop - clientTop);
    const left = Math.round(box.left + scrollLeft - clientLeft);
    const bottom = top + box.height; // already rounded.
    const right = left + box.width;

    return { top, left, bottom, right, width: box.width, height: box.height };
  } catch (err) {
    logerr(err);
    return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
  }
}

/**
 * Converts element into a string like "<div class='Foo bar' />"
 */
export function PrintNode(elem: Element | Node | string | null): string {
  try {
    if (!elem) {
      return "undefined";
    }
    if (typeof elem === "string") {
      return elem;
    }

    let attrStr = "";
    if (elem instanceof Element && elem.attributes) {
      const attribs = elem?.attributes?.length ? [...elem.attributes] : [];
      for (const attr of attribs) {
        const value = attr.value ? `="${attr.value.substring(0, 2048)}"` : "";
        const { name } = attr;
        attrStr = `${attrStr} ${name}${value}`;
        if (attrStr.length > 1024) {
          attrStr = `${attrStr}...`;
          break;
        }
      }
    }
    const nodeName = elem?.nodeName?.toLowerCase()?.replace("#", "") || "UNKNOWN";
    return `<${nodeName}${attrStr} />`;
  } catch (err) {
    return ` UNKNOWN [${err}]`;
  }
}
// export function getApproxCenterOfWindow() {
//   // we hide scrollbars as part of zoom, so body element should be good enough?
//   try {
//     return {
//       centerX: Math.round(window.innerWidth / 2),
//       centerY: Math.round(window.innerHeight / 2),
//     };
//   } catch (err) {
//     return {
//       centerX: 0,
//       centerY: 0,
//     };
//   }
// }

// @ts-ignore
export function shadowHost(targetNode: Node): Node | null {
  const thisAsShadow: ShadowRoot = targetNode as ShadowRoot;
  if (targetNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && thisAsShadow.host) {
    return thisAsShadow.host;
  }
  return null;
}

export function parentNodeOrShadowHost(targetNode: Node): Node | null {
  if (targetNode.parentNode) {
    return targetNode.parentNode;
  }
  return shadowHost(targetNode);
}

// shadowHosts => shadowRoot
export function shadowRoot(targetNode: Node | null): ShadowRoot | null {
  if (!(targetNode instanceof Element)) {
    return null;
  }
  return targetNode?.shadowRoot ?? null;
}

export function deDupArray(arr: any[]): any[] {
  return [...new Set(...arr).entries()];
}

export function findVideoElementsInShadowRoot(root: ShadowRoot | Document): HTMLVideoElement[] {
  const elements: HTMLVideoElement[] = [];
  // @ts-ignore querySelectorAll("*") includes iFrames... so wtf?
  // querySelectorAll works for iframes and shadow roots, but RETURNS EVERYTHING!
  for (const { shadowRoot, contentDocument } of root.querySelectorAll("*")) {
    if (shadowRoot) {
      // Look for elements in the current root
      elements.push(...shadowRoot.querySelectorAll("video"));
      // Look for more roots in the current root
      const nextLevelResult = findVideoElementsInShadowRoot(shadowRoot);
      elements.push(...nextLevelResult);
    }
    if (contentDocument) {
      try {
        elements.push(...contentDocument.querySelectorAll("video"));
        const nextLevelResult = findVideoElementsInShadowRoot(contentDocument);
        elements.push(...nextLevelResult);
      } catch (err) {}
    }
  }
  return elements;
}

/**
 * @param topElem initially, document.body
 * @param optCenter undefined for root, but when recursing, pass in calc value for optimization.
 */
export function findVideosAtCenter(
  topElem: Element | null | undefined = undefined,
  optCenter?: Point
): HTMLVideoElement[] {
  if (!topElem) {
    return [];
  }

  if (topElem instanceof HTMLVideoElement) {
    return [topElem];
  }
  // only calculate if not passed in. inline function.
  const center: Point = (() => {
    if (optCenter) {
      return optCenter;
    }
    const { top, left, width, height } = getCoords(topElem);
    return { x: Math.round(left + width / 2), y: Math.round(top + height / 2) };
  })(); // declare and call immediately.

  // elementFromPoint returns the topmost, if we get ALL the elements at a point, we can filter down through them.
  const elements = topElem.ownerDocument.elementsFromPoint(center.x, center.y);

  for (const element of elements) {
    if (element instanceof HTMLVideoElement) {
      return [element];
    }
    const { shadowRoot } = element;
    if (shadowRoot) {
      const videos = findVideoElementsInShadowRoot(shadowRoot);
      if (videos.length > 1) {
        return videos; // may be too niave? Maybe actively playing video?
      }
    }
    if (element instanceof HTMLIFrameElement) {
      const { contentDocument } = element;
      if (contentDocument) {
        const videos = findVideoElementsInShadowRoot(contentDocument);
        if (videos.length > 1) {
          return videos; // may be too niave? Maybe actively playing video?
        }
      }
    }
  }
  return [];
}

export function isElemVisable(elem: Element) {
  // chrome has a new method!
  // if (USE_OLD_FAST_IS_VISIBLE_CHECK_IN_WALKER) {
  //   const vis =
  //       !!node?.offsetWidth &&
  //       !!node?.offsetHeight &&
  //       typeof node.getClientRects === "function" &&
  //       !!node?.getClientRects()?.length;
  //   return vis ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
  // }
  return (
    (elem?.checkVisibility &&
      elem?.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      })) ??
    true
  );
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
