// @ts-check

import Point = chrome.system.display.Point;

export const DEV_MODE = import.meta.env.DEV;
export const DEBUG_ENABLED = DEV_MODE && true;
export const TRACE_ENABLED = DEV_MODE && true;
export const ERR_BREAK_ENABLED = DEV_MODE && true;

export const IS_BETA_CHANNEL = false;

export const CSS_FILE = "videomax_inject.css";
export const CSS_STYLE_HEADER_ID = "videomax-css-inject";
export const PLAYBACK_SPEED_DOC_ATTR = "data-videomax-playbackspeed";
export const DEFAULT_SPEED_NUM = 1.0;
export const DEFAULT_SPEED_STR = "1.00";
export const PERMISSIONS_CHECK_DOMAINS_DOC_ATTR = "data-videomax-permissions-domains";

// todo: move into a setting.
export const BLOCKED_SKIPFEATURE_DOMAINS = ["netflix."]; // skipping breaks these sites
export const ALLOW_SMALL_VIDEOS_DOMAINS = ["tiktok", "cnn"];
export const DOOMSCROLL_BOOST_DOMAINS = ["tiktok", "facebook", "imgur", "onlyfans"];

// we use the prop class then flip all the classes at the end.
// The reason for this is that the clientRect can get confused on rezoom if
//     the background page couldn't inject the css as a header.
export const PREFIX_CSS_CLASS = "videomax-ext";
export const PREFIX_CSS_CLASS_PREP = "videomax-ext-prep";
// adding ANY new elements should be added to inject_undo
export const OVERLAP_CSS_CLASS = `${PREFIX_CSS_CLASS_PREP}-overlap`;
export const HIDDEN_CSS_CLASS = `${PREFIX_CSS_CLASS_PREP}-hide`;
export const MAX_CSS_CLASS = `${PREFIX_CSS_CLASS_PREP}-max`;
export const PLAYBACK_CNTLS_CSS_CLASS = `${PREFIX_CSS_CLASS_PREP}-playback-controls`;
export const PLAYBACK_CNTLS_FULL_HEIGHT_CSS_CLASS = `${PLAYBACK_CNTLS_CSS_CLASS}-fullheight`;
export const PLAYBACK_VIDEO_MATCHED_CLASS = `${PREFIX_CSS_CLASS_PREP}-video-matched`;
export const MARKER_COMMON_CONTAINER_CLASS = `${PREFIX_CSS_CLASS}-container-common`;
export const MARKER_TRANSITION_CLASS = `${PREFIX_CSS_CLASS}-trans`;
export const NO_HIDE_CLASS = `${PREFIX_CSS_CLASS}-no-hide`;

// used to save off attributes that are modified on iframes/flash
export const VIDEO_MAX_DATA_PREFIX = "data-videomax";
export const VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX = `${VIDEO_MAX_DATA_PREFIX}-saved`;
// used to find all the VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX easily
export const VIDEO_MAX_DATA_ATTRIB_UNDO_TAG = `${VIDEO_MAX_DATA_PREFIX}-tag-saved`;

// from background script on body
export const VIDEO_MAX_INSTALLED_ATTR = `${VIDEO_MAX_DATA_PREFIX}-running`; // data-videomax-running
export const YOUTUBE_RESTORE_NON_THEATER_ATTR = `${VIDEO_MAX_DATA_PREFIX}-youtube-nontheater-restore`;
export const SAVED_SCROLL_TOP_ATTR = `${VIDEO_MAX_DATA_PREFIX}-scrolltop`;
export const SAVED_SCROLL_LEFT_ATTR = `${VIDEO_MAX_DATA_PREFIX}-scrollleft`;

export const EMBEDED_SCORES = `${VIDEO_MAX_DATA_PREFIX}-scores`;
export const VIDEO_MAX_ATTRIB_FIND = `${VIDEO_MAX_DATA_PREFIX}-target`;
export const VIDEO_MAX_ATTRIB_ID = "zoomed-video";


// some domains are allowed smaller sizes
export const MIN_ALLOWED_VIDEO_WIDTH: number = 320;
export const MIN_ALLOWED_VIDEO_HEIGHT: number = 240;

export const MIN_IFRAME_WIDTH = MIN_ALLOWED_VIDEO_WIDTH;
export const MIN_IFRAME_HEIGHT = MIN_ALLOWED_VIDEO_HEIGHT;


/* DOM Functions should be moved to their own file*/
export function isRunningInIFrame() {
  try {
    return window !== window?.parent;
  } catch (e) {
    return false;
  }
}

export function dbgFrameName() {
  return isRunningInIFrame() ? "iframe" : " main ";
}

function dbgStack(...args: any[]) {
  const err = args.find((arg) => arg instanceof Error);
  const stack = (err?.stack ?? "").split(/\R/) ?? [];
  stack.shift();
  return stack.join("\n");
}

function dbgStackCaller() {
  let stackstr = new Error().stack ?? "";
  const stack = stackstr.split("\n");
  return stack.splice(stack[0].trim() === "Error" ? 2 : 1)[1] ?? "";
}

export function logerr(...args: any[]) {
  if (!DEBUG_ENABLED) {
    return;
  }
  const inIFrame = dbgFrameName();

  // eslint-disable-next-line no-console
  console.error(`📕 VideoMax ${inIFrame} ERROR`, ...args, dbgStack(args));
  if (ERR_BREAK_ENABLED) {
    // eslint-disable-next-line no-debugger
    debugger;
  }
}

export function logwarn(...args: any[]) {
  if (!DEBUG_ENABLED) {
    return;
  }
  const inIFrame = dbgFrameName();
  // eslint-disable-next-line no-console
  console.log(`📙VideoMax ${inIFrame} WARNING`, ...args, dbgStackCaller());
}

export function logtrace(...args: any[]) {
  if (!(DEBUG_ENABLED && TRACE_ENABLED)) {
    return;
  }
  const inIFrame = dbgFrameName();
  // eslint-disable-next-line no-console
  console.log(`📘VideoMax ${inIFrame}`, ...args, dbgStackCaller());
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

/**
 *
 * @param fullUrl {string} "https://www.example.com/foo/bar.html?param=data"
 * @returns {string} "www.example.com"
 */
export function getDomain(fullUrl: string | undefined | null) {
  try {
    if (!fullUrl?.length) {
      return "";
    }
    if (fullUrl === "about:blank") {
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
    return fullUrl ?? "";
  }
}

/**
 * Turn a comma list into array of strings
 */
export function listToArray(listStr: string): string[] {
  return (listStr?.split(",") || []).map((s) => s.trim()).filter((s) => s.length > 0);
}

export function addDomainToList(listStr: string, newDomain: string): string {
  // use Set to dedup
  const resultCrossDomainSet: Set<string> = new Set<string>();
  // add list to Set
  const list = listToArray(listStr);
  for (const eachdomain of list) {
    if (eachdomain.trim().length > 0) {
      resultCrossDomainSet.add(eachdomain);
    }
  }
  // some domains can be really long like "f2bc6a78895d165295fadfe4b6c511b2.safeframe.googlesyndication.com"
  // take last 3 words
  const shortdomain = newDomain.trim().split(".").slice(-3).join(".");
  if (shortdomain.length > 1) {
    resultCrossDomainSet.add(shortdomain);
  }
  return [...resultCrossDomainSet].join(",");
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
    return `.${elems[0] ?? ".example."}.`; // safe domain, never exists.
  }

  // remove the first work if it's a common prefix.
  if (["www", "web", "ftp"].indexOf(elems[0]) > -1) {
    elems.shift(); // remove it.
  }
  return `.${elems.join(".")}.`;
}

export function matchUrlWithWildcard(pattern: string, url: string) {
  // Convert wildcard pattern to a regular expression
  const regexPattern = pattern
    .replace(/\./g, "\\.") // Escape special characters like '.'
    .replace(/\*/g, ".*"); // Replace '*' with '.*' (match any character 0 or more times)

  // Create a RegExp object
  const regex = new RegExp(regexPattern);

  // Test if the URL matches the pattern
  return regex.test(url);
}

/**
 * We gather all the domains used by iFrames, then we need to ask for permissions
 * to them. This function is used to see if there are any domains we haven't already
 * got permission to access in the past.
 * We do this because, if we don't have all the permissions yet, then the zoom or skip
 * won't work.
 *
 * @param allowedWildards permissions we already have in the form of ["https://*.example.com/*",...]
 * @param neededDomains domains we need ["www.domain.com",...]
 */
export function checkPermissions(allowedWildards: string[], neededDomains: string[]) {
  return neededDomains.filter(
    (d) => !allowedWildards.some((pattern) => matchUrlWithWildcard(pattern, `https://${d}/`)),
  );
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
    const { body } = el?.ownerDocument ?? document; // was just document
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

const INSTANCES_OF_ONLY = true;
/**
 * Alternative for instanceof
 * Cross-Origin:
 * In some cases, if the element is from a different origin (e.g., an iframe), instanceof Element might not work.
 * Ugh... so painful. instanceof is NOT reliable for some operations.
 */
export function isHtmlElement(obj: any): obj is HTMLElement {
  if (INSTANCES_OF_ONLY) {
    return obj instanceof HTMLElement;
  }
  // HTML or XML element, such as <p> or <div>.
  // Element_Nodes can have attributes and child nodes of various types, including Element, Text, Comment,
  // ProcessingInstruction, CDATASection, and EntityReference
  return obj instanceof HTMLElement || obj?.nodeType === Node.ELEMENT_NODE;
}

/**
 * Alternative for instanceof: can be affected by cross-frame issues
 * @param obj
 */
export function isDocument(obj: any): obj is Document {
  if (INSTANCES_OF_ONLY) {
    return obj instanceof Document;
  }
  return obj instanceof Document || obj?.nodeType === Node.DOCUMENT_NODE;
}

export function isVideoElement(obj: any): obj is HTMLVideoElement {
  if (INSTANCES_OF_ONLY) {
    return obj instanceof HTMLVideoElement;
  }
  return obj instanceof HTMLVideoElement || obj?.nodeName.toLowerCase() === "video";
}

export function isIFrameElem(obj: any): obj is HTMLIFrameElement {
  try {
    return (
      // obj instanceof HTMLIFrameElement || // may have cross-domain issues
      obj?.tagName === "IFRAME"
      // || obj?.nodeName.toLowerCase() === "iframe"
      // || obj?.contentWindow !== undefined
    );
  } catch (err) {
    logerr("isIFrameElem", err);
    return false;
  }
}

export function isShadowDom(obj: any): obj is ShadowRoot {
  return obj?.shadowRoot;
}

export function isFunction(obj: any): obj is Function {
  return typeof obj === "function";
}

/**
 * Converts element into a string like "<div class='Foo bar' />"
 */
export function printNode(elem: Element | Node | string | null): string {
  try {
    if (!elem) {
      return "undefined";
    }
    if (typeof elem === "string") {
      return elem;
    }

    let attrStr = "";
    if (isHtmlElement(elem) && elem.attributes) {
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

export function printRect(rect: Rect | undefined | null): string {
  if (!rect) {
    return `[empty domrect]`;
  }
  return `[top: ${rect.top} left: ${rect.left} bottom: ${rect.bottom} right: ${rect.right} width: ${rect.width}px height: ${rect.height}px]`;
}

export function DOMRectToRect(domrect: DOMRect): Rect {
  return {
    top: domrect.y,
    left: domrect.x,
    bottom: domrect.bottom,
    right: domrect.right,
    width: domrect.width,
    height: domrect.height,
  };
}

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
  if (!isHtmlElement(targetNode)) {
    return null;
  }
  return targetNode?.shadowRoot ?? null;
}

export function deDupArray(arr: any[]): any[] {
  return [...new Set(...arr).entries()];
}

export function getOwnerDoc(node: Element | Node) {
  if (isDocument(node)) {
    return node;
  }
  return node?.ownerDocument ?? document;
}

export function elementExists(node: Element | Node) {
  const doc = getOwnerDoc(node);
  return doc.contains(node);
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

export function getVideomaxCmd() {
  // @ts-ignore
  try {
    return document.videmax_cmd ?? window.videmax_cmd ?? "";
  } catch (err) {
    return "";
  }
}

export function getAttr(elem: Element, attr: string): string | null {
  try {
    if (!isFunction(elem?.getAttribute)) {
      DEV_MODE && logtrace("element doesn't have getAttribute() function, return null");
      return null;
    }
    return elem.getAttribute(attr);
  } catch (err) {
    return null;
  }
}

export function setAttr(elem: Element | HTMLElement, attr: string, value: string) {
  try {
    elem.setAttribute(attr, value);
  } catch (err) {
    logtrace(err);
  }
}

export const removeAttr = (elem: Element | HTMLElement, attr: string) => {
  try {
    elem.removeAttribute(attr);
  } catch (err) {
    logtrace(err);
  }
};

/**
 * Checks if the zoomed video is still in containing document
 */
export function isVideoStillInDoc(videomaxGlobals: VideomaxGlobalsTypeBase) {
  if (!videomaxGlobals?.isMaximized || !videomaxGlobals?.matchedVideo) {
    return false;
  }
  const videoStillInDocument = elementExists(videomaxGlobals.matchedVideo);
  if (!videoStillInDocument && DEV_MODE) {
    logerr(`Video element NO LONGER in document?`, videomaxGlobals.matchedVideo);
    debugger;
  }
  return videoStillInDocument;
}

export function centerElem(elem: Element) {
  const { top, left, width, height } = getCoords(elem);
  return { x: Math.round(left + width / 2), y: Math.round(top + height / 2) };
}

export function querySelectAllShadowDoms(document: Document) {
  return [...document.getElementsByTagName("*")].filter((e) => isShadowDom(e));
}

/**
 * Trick to try and find the iframe in the main document.
 * @param topElem
 */
export function breakOutOfIFrameShadow(
  topElem: Element | null | undefined = undefined,
): Element | null {
  if (!topElem) {
    return null;
  }
  const center: Point = centerElem(topElem);
  const elements = topElem.ownerDocument.elementsFromPoint(center.x, center.y);
  // top .document
  const iframeShadowDoms = [
    ...querySelectAllShadowDoms(document),
    ...document.querySelectorAll("iframe"),
  ];
  // loop down until we find the iFrame or shadow element in the list
  // parent element will be one before it.
  for (const element of elements) {
    const contained = iframeShadowDoms.find((qs_items) => element.contains(qs_items));
    if (contained && !element.isSameNode(contained)) {
      debugger;
      return contained;
    }
  }
  return null;
}

/**
 * @param topElem initially, document.body
 * @param optCenter undefined for root, but when recursing, pass in calc value for optimization.
 */
export function findVideosIFramesAtCenter(
  topElem: Element | null | undefined = undefined,
  optCenter?: Point,
): Element[] {
  if (!topElem) {
    return [];
  }

  // only calculate if not passed in. inline function.
  const center: Point = optCenter ? optCenter : centerElem(topElem);

  // elementFromPoint returns the topmost, if we get ALL the elements at a point, we can filter down through them.
  const elements = topElem.ownerDocument.elementsFromPoint(center.x, center.y);
  let results: Element[] = [];
  for (const element of elements) {
    if (element.nodeName === "VIDEO") {
      results.push(element);
      continue;
    }
    const { shadowRoot } = element;
    if (shadowRoot) {
      const videos = findVideoElementsInShadowRoot(shadowRoot);
      results = [...results, ...videos]; // may be too naive? Maybe actively playing video?
    }
    if (isIFrameElem(element)) {
      const { contentDocument } = element as HTMLIFrameElement;
      if (contentDocument) {
        const videos = findVideoElementsInShadowRoot(contentDocument);
        results = [...results, ...videos]; // may be too naive? Maybe actively playing video?
      } else {
        results = [...results, element];
      }
    }
  }
  return results;
}

export function findVideosAtCenter(
  topElem: Element | null | undefined = undefined,
  optCenter?: Point,
): HTMLVideoElement[] {
  const result = findVideosIFramesAtCenter(topElem, optCenter);
  return result.filter((e) => isVideoElement(e));
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
    elem?.checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
    }) ?? true
  );
}

export function pointIsInRect(point: Point, rect: Rect): boolean {
  return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
}

/**
 * Finds the intersection point between
 *     * the rectangle
 *       with parallel sides to the x and y axes
 *     * the half-line pointing towards (x,y)
 *       originating from the middle of the rectangle
 *
 * Note: the function works given min[XY] <= max[XY],
 *       even though min.y may not be the "top" of the rectangle
 *       because the coordinate system is flipped.
 * Note: if the input is inside the rectangle,
 *       the line segment wouldn't have an intersection with the rectangle,
 *       but the projected half-line does.
 * Warning: passing in the middle of the rectangle will return the midpoint itself
 *          there are infinitely many half-lines projected in all directions,
 *          so let's just shortcut to midpoint (GIGO).
 *
 * @param point {Point} Point to build the half-line from
 * @param rect {Rect} bounding rect
 * @return an object with x and y members for the intersection
 * @throws if validate == true and (x,y) is inside the rectangle
 * @author TWiStErRob
 * @licence Dual CC0/WTFPL/Unlicence, whatever floats your boat
 * @see <a href="http://stackoverflow.com/a/31254199/253468">source</a>
 * @see <a href="http://stackoverflow.com/a/18292964/253468">based on</a>
 */
export function pointOnRect(point: Point, rect: Rect): Point {
  const { x, y } = point;
  const min = { x: rect.left, y: rect.top };
  const max = { x: rect.right, y: rect.bottom };

  const midX = (min.x + max.x) / 2;
  const midY = (min.y + max.y) / 2;
  // if (midX - x == 0) -> m == ±Inf -> minYx/maxYx == x (because value / ±Inf = ±0)
  const m = (midY - y) / (midX - x);

  if (x <= midX) {
    // check "left" side
    const minXy = m * (min.x - x) + y;
    if (min.y <= minXy && minXy <= max.y) {
      return { x: min.x, y: minXy };
    }
  }

  if (x >= midX) {
    // check "right" side
    const maxXy = m * (max.x - x) + y;
    if (min.y <= maxXy && maxXy <= max.y) {
      return { x: max.x, y: maxXy };
    }
  }

  if (y <= midY) {
    // check "top" side
    const minYx = (min.y - y) / m + x;
    if (min.x <= minYx && minYx <= max.x) {
      return { x: minYx, y: min.y };
    }
  }

  if (y >= midY) {
    // check "bottom" side
    const maxYx = (max.y - y) / m + x;
    if (min.x <= maxYx && maxYx <= max.x) {
      return { x: maxYx, y: max.y };
    }
  }

  // edge case when finding midpoint intersection: m = 0/0 = NaN
  if (x === midX && y === midY) {
    return { x: x, y: y };
  }

  // Should never happen :) If it does, please tell me!
  throw (
    "Cannot find intersection for " +
    [x, y] +
    " inside rectangle " +
    [min.x, min.y] +
    " - " +
    [max.x, max.y] +
    "."
  );
}

export function distance(point1: Point, point2: Point): number {
  // x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
}

export function centerDomRect(rect: Rect): Point {
  const { top, left, width, height } = rect;
  return { x: Math.round(left + width / 2), y: Math.round(top + height / 2) };
}

/**
 *
 * @param x between 0.0 - 1.0
 * @param curve between 0.0 - 1.0
 * @return 0.0 - 1.0
 */
export function normlizedSigmoid(x: number, curve: number = 0.5): number {
  // see https://dinodini.wordpress.com/2010/04/05/normalized-tunable-sigmoid-functions/
  return (x - curve * x) / (curve - 2 * curve * Math.abs(x) + 1);
}

export function getVideoRatioWeight(width: number, height: number) {
  // common video sizes
  // 320x180, 320x240, 640x480, 640x360, 640x480, 640x360, 768x576,
  // 720x405, 720x576
  // the most common ratios. The closer a video is to these, the higher the
  // score.
  const VIDEO_RATIOS = {
    21_9: 21 / 9,
    16_9: 16.0 / 9.0,
    4_3: 4.0 / 3.0,
    3_2: 3.0 / 2.0,
    240: 2.4 / 1.0, // portrait ( < 1)
    // 4_5:  (4 / 5),
    // 9_16: (9 / 16),
  };

  const ratio = width / height;
  // which ever is smaller is better (closer to one of the magic ratios)
  const distances = Object.values(VIDEO_RATIOS).map((v) => Math.abs(v - ratio));
  const bestRatioComp = Math.min(...distances) + 0.001; // +0.001;

  // inverse distance
  return round(1.0 / bestRatioComp ** 1.15); // was 1.25
}

declare global {
  interface Document {
    _VideoMaxExt: VideomaxGlobalsTypeBase | undefined;
    videmax_cmd: string;
  }

  interface Window {
    _VideoMaxExt: VideomaxGlobalsTypeBase | undefined;
    videmax_cmd: string;
    _VideoMaxExtEscapeUnzoom: boolean | undefined;
    _videomax_permissionCheckDomains: string[] | undefined;
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function sleepAnimationFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame((timestamp) => {
      resolve(timestamp);
    });
  });
}
