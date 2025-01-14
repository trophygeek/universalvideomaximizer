/*
 Video Maximizer
 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.
 Copyright (C) 2023 trophygeek@gmail.com
 www.videomaximizer.com
 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/
 */

/* we really want imports injected INSIDE of the try {} block this allows for double
 injections without hitting duplicate names and keeps everything scoped nicely.
 We do this with a rollup plugin.
 */
import {
  DEV_MODE,
  ALLOW_SMALL_VIDEOS_DOMAINS,
  logerr,
  logtrace,
  logwarn,
  CSS_STYLE_HEADER_ID,
  customDiceCoefficient,
  DEFAULT_SPEED_STR,
  diceCoefficient,
  DOOMSCROLL_BOOST_DOMAINS,
  elementExists,
  EMBEDED_SCORES,
  findVideoElementsInShadowRoot,
  formatFloat,
  formatInt,
  getAttr,
  getCoords,
  getKeys,
  getOverlapCount,
  getOwnerDoc,
  getVideomaxCmd,
  HIDDEN_CSS_CLASS,
  isElemVisable,
  isRunningInIFrame,
  isVideoStillInDoc,
  MARKER_COMMON_CONTAINER_CLASS,
  MARKER_TRANSITION_CLASS,
  MAX_CSS_CLASS,
  NO_HIDE_CLASS,
  OVERLAP_CSS_CLASS,
  parentNodeOrShadowHost,
  parseTwoPixelsString,
  PLAYBACK_CNTLS_CSS_CLASS,
  PLAYBACK_CNTLS_FULL_HEIGHT_CSS_CLASS,
  PLAYBACK_SPEED_DOC_ATTR,
  PLAYBACK_VIDEO_MATCHED_CLASS,
  PREFIX_CSS_CLASS,
  PREFIX_CSS_CLASS_PREP,
  printNode,
  removeAttr,
  round,
  safeParseFloat,
  safeParseInt,
  SAVED_SCROLL_LEFT_ATTR,
  SAVED_SCROLL_TOP_ATTR,
  setAttr,
  shadowRoot,
  splitUrlWords,
  VIDEO_MAX_ATTRIB_FIND,
  VIDEO_MAX_ATTRIB_ID,
  VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX,
  VIDEO_MAX_DATA_ATTRIB_UNDO_TAG,
  VIDEO_MAX_INSTALLED_ATTR,
  YOUTUBE_RESTORE_NON_THEATER_ATTR,
  pointOnRect,
  pointIsInRect,
  distance,
  centerDomRect,
  DEBUG_ENABLED,
  dbgFrameName,
  findVideosIFramesAtCenter,
  isHtmlElement,
  isDocument,
  isIFrameElem,
  isVideoElement,
  breakOutOfIFrameShadow,
  getDomain,
  PERMISSIONS_CHECK_DOMAINS_DOC_ATTR,
  addDomainToList,
  printRect,
  isFunction,
  DOMRectToRect,
  normlizedSigmoid,
  matchUrlWithWildcard,
  getVideoRatioWeight, MIN_IFRAME_WIDTH, MIN_ALLOWED_VIDEO_WIDTH, MIN_ALLOWED_VIDEO_HEIGHT,
} from "./common.js";

const BREAK_ON_BEST_MATCH = DEV_MODE && false;

// These are noisy and can be enabled when debugging areas. FULL_DEBUG must
// also be true
const EMBED_SCORES = DEV_MODE && true;
const COMMON_PARENT_SCORES = DEV_MODE && true;
const DEBUG_HIDENODE = DEV_MODE && false;
const DEBUG_MUTATION_OBSERVER = DEV_MODE && false;

// Recent changes - keep these flags to quickly regression check various
// fixes across sites What fixes one site often breaks another. Eventually,
// these can go away as we verify no adverse interactions.
const IFRAME_PARENT_NODE_WORKS: boolean = true;
const USE_MUTATION_OBSERVER_ATTR: boolean = true;
const INCLUDE_TRANSITION_WEIGHT_FOR_COMMON_SCORE: boolean = false;
const SAVE_STYLE_FOR_OVERLAPs: boolean = true; // now site specific
const DO_HIDE_EXCEPTION_CHECK: boolean = true;
const ALWAYS_BACK_UP_STYLES: boolean = true;
const LAST_DITCH_HIDE: boolean = true;
const REAPPLY_PLAYBACKSPEED: boolean = true;
const MUTATION_OBSERVER_WATCH_ALL_MAX: boolean = true;
// const MUTATION_OBSERVER_WATCH_VIDEO_DELETE: boolean = true; // 5May2024
// const USE_OLD_FAST_IS_VISIBLE_CHECK_IN_WALKER: boolean = false; // new code => false
const FIND_CONTROLS_ON_MAIN_THREAD_FOR_IFRAME_MATCH: boolean = true;
const USE_WHOLE_WINDOW_TO_SEARCH_FOR_CONTROLS: boolean = true;
const IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE: boolean = true; // jasmine has some hidden
// div in path.
const NOHIDENODE_REAPPLY: boolean = true;
const USE_BOOST_SCORES_FIND_COMMON: boolean = true;
const USE_NERF_SCORES_FIND_COMMON: boolean = true;
const FIX_UP_BODY_CLASS_TO_SITE_SPECIFIC_CSS_MATCH: boolean = true;
const OVERLAPS_REQUIRE_TRANSITION_EFFECTS: boolean = false;
const REMOVE_STYLE_FROM_ELEMS: boolean = true;
const OVERLAPS_REQUIRE_TRANSITION_EFFECTS_RECURSIVE: boolean = true;
const NO_SEARCHING_IGNORED_NODES_COMMON: boolean = true;
const USE_BOOST_SCORES_REGEX_FIND_COMMON: boolean = true;
const SCROLL_INTO_VIEW: boolean = false; // scroll on match - needed for doomscrollers
// that mess with dom
const CANCEL_SCROLL_EVENTS: boolean = true; // scrolls while we're resizing cause some
// pages to re-layout
const RESTORE_SCROLL_POS: boolean = true; // if video is in scrolling list then it can
// get annoying
const EXCEPTIONTORULE_FIXUP_FOR_WHOLE_DOC: boolean = false;
const FINDIFRAMEINDOCUMENT2: boolean = true;
const FINDIFRAMEINDOCUMENT3: boolean = false;
const NEW_ISELEMINIFRAME: boolean = false;

const MIN_VIDEO_WIDTH: number = 50;
const MIN_VIDEO_HEIGHT: number = 50;

// when walking dom how many levels up to check when looking for controls?
// too low and we miss some playback position controls (vimeo)
// too high an we find non-controls like ads
const CHECK_PARENTS_LEVELS_UP_MAX: number = 8; // was 6

const START_WEIGHT: number = 1000;
const RATIO_WEIGHT: number = 0.01; // these are now used by IN_VIEW_WEIGHT, so reduce
const SIZE_WEIGHT: number = 0.01;
const ORDER_WEIGHT: number = -0.5; // was -10
const TAB_INDEX_WEIGHT: number = 0; // was -6.0
const HIDDEN_VIDEO_WEIGHT: number = -10; // downgrades
const ZINDEX_WEIGHT: number = 0; // disabled
const VIDEO_OVER_IFRAME_WEIGHT: number = 0; // video gets VIDEO_PLAYING_WEIGHT,
// VIDEO_DURATION_WEIGHT,
// VIDEO_LOOPS_WEIGHT, etc
const MAIN_FRAME_WEIGHT: number = 5.0;
const VIDEO_PLAYING_WEIGHT: number = 100.0;
const VIDEO_DURATION_WEIGHT: number = 1.0; // was 0.5
const MAX_DURATION_SECS = 60 * 60 * 2; // 2hrs max - live videos skew results
const VIDEO_LOOPS_WEIGHT: number = -10.0;
const VIDEO_HAS_SOUND_WEIGHT: number = 15.0;
const URL_OVERLAP_WEIGHT: number = 100.0;
const TITLE_OVERLAP_WEIGHT: number = 100;
const IN_VIEW_WEIGHT: number = 0.05; // was .25, NEAR_CENTER_WEIGHT is preferred. Zero turns off NEAR_CENTER_WEIGHT
const ALLOW_FULLSCREEN_WEIGHT: number = 20.0;
const ADVERTISE_WEIGHT: number = -200.0; // don't hide ads, but don't want them as primary video
const NEAR_CENTER_WEIGHT: number = 200; // max value (zero disables and disables STACKING_ORDER_WEIGHT)
const STACKING_ORDER_WEIGHT: number = 0; // ads overlapping video SHOULD be maximized

// main videos
const DOOMSCROLL_PLAYING_BOOST_FACTOR: number = 50.0;
const DOOMSCROLL_UNMUTED_BOOST_FACTOR: number = 25.0;

const ALWAYS_HIDE_NODES: HtmlElementTypes = [
  "footer",
  "header", // maybe remove?
  "nav",
  "figcaption", // Dec 2024
]; // "aside"?

const IGNORE_NODES: HtmlElementTypes = [
  "noscript",
  "script",
  "head",
  "link",
  "style",
  "hmtl" as keyof HTMLElementTagNameMap,
];

const IGNORE_CNTL_NODES: HtmlElementTypes = [
  ...IGNORE_NODES,
  ...ALWAYS_HIDE_NODES,
  "head",
  "body",
  "html",
  "iframe",
];

const STOP_NODES_COMMON_CONTAINER: HtmlElementTypes = [
  ...IGNORE_CNTL_NODES,
  "main",
  "section",
  "article",
];
const IGNORE_COMMON_CONTAINER_COUNT_NODES = [
  ...ALWAYS_HIDE_NODES,
  "head",
  "header",
  "html",
  "iframe",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
];
const SKIPPED_NODE_NAMES = [
  // "#document", // iframe top element
  "svg",
  "xml",
  "script",
  "link",
  "circle",
  "path",
  "noscript",
  "img",
  "meta",
  "head",
  // "header", // some sites put videos in the header, wtf?
  "footer",
  // "figure", // secsports puts it under a <figure> seriously?
  // "caption",
  "area",
  "br",
  "button",
  "code",
  "cite",
  "data",
  "del",
  "fieldset",
  // "figcaption",
  "form",
  "hgroup",
  "input",
  "canvas", // added Dec2024 (mgp_videoBlackBox on pornhub, watch out for CC being removed issues)
];
const SKIPPED_NODE_NAMES_FOR_PLAYBACK_CTRLS = [
  ...IGNORE_NODES,
  ...SKIPPED_NODE_NAMES,
  ...IGNORE_COMMON_CONTAINER_COUNT_NODES,
];

const REMOVE_ATTR_LIST = [
  PLAYBACK_SPEED_DOC_ATTR,
  VIDEO_MAX_ATTRIB_FIND,
  EMBEDED_SCORES,
  // old videomax for comparison. remove them too
  `data-videomax-weights`,
  `videomax-ext-prep-scores`,
];

const SCALESTRING_WIDTH = "100%"; // "calc(100vw)";
const SCALESTRING_HEIGHT = "100%"; // "calc(100vh)";
const SCALESTRING = "100%";

/** we don't hide ads but we don't make them the primary zoomed "video" (iframe) */
const DO_NOT_MATCH_IFRAME_SRC = [
  /\.facebook\.com/i,
  /javascript:/i,
  /platform\.tumblr\.com/i,
  /imasdk\.googleapis\.com/i,
  /\.afcdn\.net/i,
  /\.adsninja\.ca/i,
  /\.extremereach\.io/i,
  /\.gvt1\.com/i,
  /\.googletagmanager\./i,
  /\.google\./i, // reCAPTCHA
];

/** these are "normalized" so country doesn't matter */
const YOUTUBE_TLD_NAMES = [/\.youtube\./i, /\.youtu\.be/i];

/** These are sites that NEED to have their styles restored or they don't undo
 * This is not universal because some sites like youtube don't need this done.
 * ***If an unzoom fails for a site, try adding the domain here first.*** */
const RESTORE_STYLE_SITES = [/\.crunchyroll\./i];

const EMPTY_DOC_RECT: Rect = {
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  width: 0,
  height: 0,
};

// so add and remove stay in sync.
const CANCEL_EVT_OPTIONS = {
  capture: true,
  passive: false,
};

type VideomaxGlobalsType = VideomaxGlobalsTypeBase & {
  injectedCss: boolean;
  cssToInject: string;
  matchCounter: number;
  elementMatcher: ElemMatcherClass | null;
  mutationObserverAttr: MutationObserver | null;
  mutationObserverVideoDelete: MutationObserver | null;
  findVideoRetryTimer: RetryTimeoutClass | null;
  hideEverythingTimer: RetryTimeoutClass | null;
};

// per doc globals (e.g. inside iframes from background inject gets it's own)
let g_videomaxGlobals: VideomaxGlobalsType = {
  matchedVideo: null,
  matchVideoRect: new DOMRect(),
  matchedVideoSrc: "",
  matchedCommonCntl: null,
  processInFrame: false,
  isMaximized: false,
  tagonly: false,
  unzooming: false,
  ads: new Set(),

  matchCounter: 0,
  injectedCss: false,
  cssToInject: "",
  elementMatcher: null,
  mutationObserverAttr: null,
  mutationObserverVideoDelete: null,
  findVideoRetryTimer: null,
  hideEverythingTimer: null,
};

// move these into the global
let g_walker: TreeWalker | null = null;
let g_cachedDomainName = "";
let g_cachedSaveStyleOverlapsSiteResult: boolean | null = null;
// cache to avoid hard-coding "all 0s ease 0s"
let g_cachedDefaultTransitionString = "";
let g_containDbgMsg = "";

function SANITY_CHECK_MATCH_NOT_DELETED() {
  if (!DEV_MODE || !g_videomaxGlobals.matchedVideo) {
    return;
  }
  const stillInDoc = elementExists(g_videomaxGlobals.matchedVideo);
  if (!stillInDoc) {
    logerr("THE MATCHED VIDEO IS NO LONGER IN THE DOCUMENT");
  }
}

const g_isRunningInIFrame = isRunningInIFrame();

if (!g_isRunningInIFrame) {
  // @ts-ignore
  if (window?._VideoMaxExt) {
    logtrace("globals: Found globals, restoring");
    // @ts-ignore
    g_videomaxGlobals = { ...window._VideoMaxExt };
  } else {
    logtrace("globals: New globals");
    // @ts-ignore
    window._VideoMaxExt = g_videomaxGlobals;
    document._VideoMaxExt = g_videomaxGlobals;
  }
} else {
  // running in iFrame
  // @ts-ignore
  try {
    if (document._VideoMaxExt) {
      logtrace("globals: IFRAME Initializing document globals");
      // @ts-ignore
      g_videomaxGlobals = { ...document._VideoMaxExt };
    } else {
      // @ts-ignore
      logtrace("globals: New globals");
      document._VideoMaxExt = g_videomaxGlobals;
    }
  } catch (err) {
    debugger;
  }
}

function isMaximized() {
  if (!g_videomaxGlobals) {
    logtrace("isMaximized: videomaxGlobals missing?");
  }
  if (!g_videomaxGlobals?.isMaximized) {
    return false;
  }
  if (getVideomaxCmd() === "unzoom" || g_videomaxGlobals.unzooming) {
    logtrace(
      `isMaximized: document.videmax_cmd: "${
        getVideomaxCmd() || ""
      }" || videomaxGlobals.unzooming === ${g_videomaxGlobals.unzooming}`,
    );
    return false;
  }
  return isVideoStillInDoc(g_videomaxGlobals);
}

/**
 * @return {string}
 */
function getPageUrl(): string {
  try {
    return g_isRunningInIFrame ? document.referrer : document.location.href;
  } catch (err) {
    logerr(err);
    return "";
  }
}

/**
 * Needs unit tests. ATTEMPT to turn "www.foo.com" and "web.foo.net" into
 * just "foo".
 */
function getPageDomainNormalized() {
  if (g_cachedDomainName?.length > 0) {
    return g_cachedDomainName;
  }
  try {
    const urlStr = getPageUrl();
    if (!urlStr.length) {
      return "BLOCKEDURL";
    }
    const url = new URL(urlStr);
    let domainName = url.hostname;

    // normalizing the tld is next to impossible w/out some cookie setting
    // hack so we just remove any prefix like www or web
    const prefixesToRemove = ["www", "web", "static", "video", "tv"];
    for (const prefix of prefixesToRemove) {
      if (domainName.startsWith(`${prefix}.`)) {
        domainName = domainName.substring(prefix.length + 1);
        break; // we found one, stop
      }
    }
    // now we trim off the tld ".com" or ".whatever", it won't work for some
    // countries like 'co.uk", but it's probably good enough for our matching
    // needs. we only use it to match css classes, not security related
    const lastDotOffset = domainName.lastIndexOf(".");
    g_cachedDomainName = domainName.substring(
      0,
      lastDotOffset > 0 ? lastDotOffset : domainName.length,
    );
    return g_cachedDomainName;
  } catch (err) {
    logerr(err);
    return "";
  }
}

function isDomainMatch(domainMatches: string[]) {
  const domainStr = getPageDomainNormalized();
  for (const eachDomain of domainMatches) {
    if (domainStr.includes(eachDomain)) {
      return true;
    }
  }
  return false;
}

function isDoomScrollingSite() {
  return isDomainMatch(DOOMSCROLL_BOOST_DOMAINS);
}

function isAllowSmallVideosSite() {
  return isDomainMatch(ALLOW_SMALL_VIDEOS_DOMAINS);
}

function parseParams(urlformat: string) {
  const pl = /\+/g; // Regex for replacing addition symbol with a space
  const search = /([^&=]+)=?([^&]*)/g;
  const decode = (s: string) => decodeURIComponent(s.replace(pl, " "));
  const query = urlformat;

  const urlParamsResult: KeyValuePair = {};
  let match = search.exec(query);
  while (match) {
    urlParamsResult[decode(match[1])] = decode(match[2]);
    match = search.exec(query);
  }
  return urlParamsResult;
}

/**
 * Returns the document of an IFrame and tries to handle security
 */
function getIFrameDoc(iframe: HTMLIFrameElement | Document | undefined): Document | undefined {
  try {
    if (isDocument(iframe)) {
      return iframe;
    }
    return iframe?.contentDocument || iframe?.contentWindow?.document;
  } catch (_err) {
    // security errors are hard to detect and prevent, just have to catch
    // them.
    return undefined;
  }
}

/**
 * getElemsDocumentView?
 * Walking out of an iFrame. We searh the main window for the iframe
 */
function findIFrameInDocument(
  docElem: Node | HTMLIFrameElement | Document,
): HTMLIFrameElement | undefined {
  try {
    if (!docElem) {
      return undefined;
    }
    const doc: Document | null = isDocument(docElem)
      ? docElem
      : getElemsDocumentView(docElem)?.document || null;
    // elemDoc.parentWindow;
    const frames = doc?.getElementsByTagName("iframe") || [];
    for (const eachFrame of frames) {
      try {
        const d = getIFrameDoc(eachFrame);
        if (d === docElem) {
          return eachFrame;
        }
        if (eachFrame.compareDocumentPosition(docElem)) {
          return eachFrame;
        }
      } catch (e) {}
    }
  } catch (err) {
    logtrace(`findIFrameInDocument err`, err);
  }
  return undefined;
}

/**
 * Walking out of an iFrame. We search the main window for the iframe
 */
function findIFrameInDocument2(
  docElem: Node | HTMLIFrameElement | Document,
): HTMLIFrameElement | undefined {
  try {
    if (!docElem) {
      return undefined;
    }
    const doc: Document | null = isDocument(docElem)
      ? docElem
      : getElemsDocumentView(docElem)?.document || null;
    // elemDoc.parentWindow;
    const frames = doc?.getElementsByTagName("iframe") || [];
    for (const eachFrame of frames) {
      try {
        if (!isIFrameElemMeetsRequirements(eachFrame)) {
          // sanity checks iframe that min size, not about:blank
          continue;
        }
        const frameDoc = getIFrameDoc(eachFrame);
        if (frameDoc === docElem) {
          return eachFrame;
        }
        const docPosResult: number = eachFrame.compareDocumentPosition(docElem);
        // if (DEBUG_ENABLED) {
        //   const MAP = {
        //     [Node.DOCUMENT_POSITION_DISCONNECTED]:
        // 'DOCUMENT_POSITION_DISCONNECTED',
        // [Node.DOCUMENT_POSITION_PRECEDING]: 'DOCUMENT_POSITION_PRECEDING',
        // [Node.DOCUMENT_POSITION_FOLLOWING]: 'DOCUMENT_POSITION_FOLLOWING',
        // [Node.DOCUMENT_POSITION_CONTAINS]: 'DOCUMENT_POSITION_CONTAINS',
        // [Node.DOCUMENT_POSITION_CONTAINED_BY]:
        // 'DOCUMENT_POSITION_CONTAINED_BY',
        // [Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC]:
        // 'DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC', }; // turn bitflags
        // into a string against docPosResult const flagsStr =
        // Object.keys(MAP). filter(m => MAP[(docPosResult & Number(m)]).
        // reduce((acc: string[], curr) => [ ...acc, MAP[curr]], []) // turn
        // to string array .join(','); logtrace( `findIFrameInDocument2:
        // compareDocumentPosition result ${flagsStr}`,
        // `${printNode(eachFrame)}`); }
        if (docPosResult & Node.DOCUMENT_POSITION_CONTAINS) {
          return eachFrame;
        }
      } catch (e) {}
    }
  } catch (err) {
    logerr(`findIFrameInDocument2 err`, err);
  }
  logtrace(`findIFrameInDocument2: returning undefined`);
  return undefined;
}

function isElemInIFrame(elem: Element | Document | null) {
  try {
    if (!elem) {
      return false;
    }
    if (NEW_ISELEMINIFRAME && elem.nodeName === "#document") {
      // trying to check a document itself fails.
      const result = elem.isEqualNode(document);
      logtrace(`Matching #document - New code: result: ${result}`);
      return result; // window?.document???
    }
    return elem.ownerDocument !== document;
  } catch (_err) {}
  return false;
}

/**
 * Checks if <iframe> element and isn't "about:blank" and has a content
 * document
 */
function isIFrameElemMeetsRequirements(elem: Element) {
  try {
    if (!isIFrameElem(elem)) {
      return false;
    }
    // "about:blank"
    // if (!elem?.contentDocument) {
    //   logtrace(`isIFrameElemMeetsRequirements: false (missing
    // contentDocument)`); return false; }

    // this breaks abcnews.go.com
    // if (elem instanceof HTMLIFrameElement && elem?.src === "about:blank") {
    //   logtrace(`isIFrameElemMeetsRequirements: false (about:blank)`);
    //   return false;
    // }

    // width might be "100%" vs pixels
    // if (elem?.width < MIN_IFRAME_WIDTH || elem?.height <
    // MIN_IFRAME_HEIGHT) { logtrace(`isIFrameElemMeetsRequirements: false (too
    // small: ${window.innerWidth} x ${window.innerHeight})`); return false;
    // }
    if (!isVisible(elem)) {
      logtrace(`isIFrameElemMeetsRequirements: false (Not visible)`);
      return false;
    }
  } catch (err) {
    logerr(
      "isIFrameElemMeetsRequirements: true (cross domain iframe issue?) - maybe should return false?!?",
    );
  }
  // we could check the dimensions and ignore very small iframes
  return true;
}

function parentElement(elem: Element | DocumentFragment | null): Element | null {
  try {
    if (!elem) {
      return null;
    }
    const parent1 = parentNodeOrShadowHost(elem);
    if (isHtmlElement(parent1)) {
      return parent1;
    } else if (parent1 instanceof Node && parent1?.parentElement) {
      return parent1.parentElement;
    }
    // no not remove
    if (elem?.parentElement) {
      return elem.parentElement;
    }
    // this next trick will keep walking up out of iframes (when it's on the
    // same domain) Potential problem: is that this frame MAY NOT BE THE BEST
    // match at the top level if multiple iframes
    if (IFRAME_PARENT_NODE_WORKS) {
      if (g_isRunningInIFrame && isIFrameElem(elem)) {
        // not sure this is working.
        const result = findIFrameInDocument(elem);
        logtrace(
          `parentNode: findIFrameInDocument walk up out of iframe ${result ? "SUCCESS" : "FAILED"}`,
        );
        if (result) {
          return result;
        }
      }
    }
    if (FINDIFRAMEINDOCUMENT2 && isIFrameElem(elem) && isElemInIFrame(elem)) {
      const iframeParent = findIFrameInDocument2(elem);
      logtrace(
        `parentNode: findIFrameInDocument2 walk up out of iframe ${
          iframeParent ? "SUCCESS" : "FAILED"
        }`,
      );
      return iframeParent || null; // may be undefined
    }

    if (FINDIFRAMEINDOCUMENT3 && !isRunningInIFrame() && isHtmlElement(elem)) {
      return breakOutOfIFrameShadow(elem);
    }
  } catch (err) {
    // can throw CSP error if crosses an iframe boundry.
    logtrace("parentElement err", err);
  }
  return null;
}

/**
 * We want to SAVE these results somewhere that automated unit tests can e
 * easily extract the scores to measure changes across revisions
 */
function appendUnitTestResultInfo(newStr: string) {
  if (!EMBED_SCORES) {
    return;
  }
  try {
    if (g_isRunningInIFrame) {
      return;
    }

    window.document?.body?.parentNode?.append(
      window.document.createComment(`
      ${newStr}

      `),
    );
  } catch (err) {
    logtrace(err);
  }
}

function appendSelectorItemsToResultInfo(strMessage: string, strSelector: string) {
  const results = [strMessage];
  const matches = document.querySelectorAll(strSelector);
  for (const match of matches) {
    results.push(printNode(match));
  }
  const combinedResults = results.join(`\n`);
  appendUnitTestResultInfo(`${combinedResults}\n`);
}

function documentLoaded() {
  return ["complete", "interactive"].includes(document.readyState);
}

function getTopElemNode() {
  return window.document.body.parentElement ?? window.document.body;
}

/**
 * Returns true if any css classname starts with our prefix.
 */
function hasAnyVideoMaxClass(node: Element) {
  try {
    // node.className for an svg element is an array not a string.
    const className = getAttr(node, "class");
    return (
      className !== null && className.toString().toLowerCase().indexOf(PREFIX_CSS_CLASS) !== -1
    ); // "videomax-ext"
  } catch (err) {
    logerr(err);
  }
  return false;
}

/**
 * walk up parents and if any matches that are under invalid "paths"
 */
function querySelectorAllFiltered(
  elem: Element | Document,
  selector: string,
  filter: (e: Element) => boolean,
): Element[] {
  if (!elem) {
    return [];
  }
  const matches = [...elem.querySelectorAll(selector)] as Element[];
  const filterPath = (checkElem: Element) => {
    let walkElem: Element | null = checkElem;
    while (walkElem && !walkElem.isSameNode(elem)) {
      if (!filter(walkElem)) {
        return false;
      }
      walkElem = walkElem.parentElement || parentElement(walkElem);
    }
    return true;
  };

  return matches.filter((e) => filterPath(e));
}

const isUnderCommonCntlParentPath = (childElem: Element): boolean =>
  g_videomaxGlobals?.matchedCommonCntl?.contains(childElem) || false;

/**
 * Will copy the existing attribute into a data-videomax-{attr} as a save,
 * then set the attr to the new value. Use cases:
 *  1. Save existing attr (e.g. "style") and replace it with a new value
 *  2. Save existing attr and replace it NOTHING. newValue is "" (remove it
 * but restore later)
 *  3. There's no existing attr to save but add a new one.
 *  4. We go to save an exist attr but there's already something saved. Do
 * NOT overwrite it. (we could merge?)
 *
 *  Undo should handle all cases as well.
 */
function setAttrAndSave(elem: Element | HTMLElement, attrKey: string, newValue: string) {
  backupAttr(elem, attrKey);
  setAttr(elem, attrKey, newValue);
  setAttr(elem, VIDEO_MAX_DATA_ATTRIB_UNDO_TAG, "1");
}

/**
 * for readability, could flip around logic
 */
function backupAttr(elem: Element | HTMLElement, attrKey: string) {
  const orgValue = getAttr(elem, attrKey);
  if (orgValue === null) {
    // anything to save?
    return;
  }
  const backupName = `${VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX}-${attrKey}`;
  const backupValue = getAttr(elem, backupName);
  if (backupValue !== null) {
    if (DEBUG_ENABLED && orgValue !== backupValue) {
      logtrace(`backupAttr: Attempting to resave attribute (not overwriting)?
       ${attrKey}: "${backupValue}"
       Elem: "${printNode(elem)}"`);
    }
  } else {
    setAttr(elem, backupName, orgValue);
    setAttr(elem, VIDEO_MAX_DATA_ATTRIB_UNDO_TAG, "1");
  }
}

function isSaveStyleOverlapsSite(): null | boolean {
  if (g_cachedSaveStyleOverlapsSiteResult === null) {
    g_cachedSaveStyleOverlapsSiteResult = smellsLikeMatch(getPageUrl(), RESTORE_STYLE_SITES);
  }
  return g_cachedSaveStyleOverlapsSiteResult;
}

/**
 * turns 'style' attribute into js object {}
 */
function smartParseStyles(inStrParam: string): object {
  const result: KeyValuePair = {};
  let currentStart = 0;
  let inStr = inStrParam.trim();
  // if it doesn't end with a ; delim add it.
  inStr = inStr.endsWith(";") ? inStr : `${inStr};`;
  try {
    while (currentStart < inStr.length) {
      // lame, but indexOf is probably faster than turning string into array
      // of characters? we pretend indexOf() took a set of characters and
      // matched first one.
      const ii = Math.min(
        ...[
          inStr.indexOf(`;`, currentStart),
          inStr.indexOf(`'`, currentStart),
          inStr.indexOf(`"`, currentStart),
        ].filter((n) => n >= 0),
      );
      if (ii === Infinity) {
        // because of filter() above, Math.min(empty) => Infinity
        break;
      }
      const ch = inStr.charAt(ii);
      if (ch === `;`) {
        // got a match. Find the first `:` and use that for split
        const matched = inStr.substring(currentStart, ii);
        const jj = matched.indexOf(`:`);
        const key = matched.substring(0, jj).trim();
        result[key] = matched.substring(jj + 1).trim();
        currentStart = ii + 1; // next match
      } else if (ch === `'`) {
        // we hit a quote, scan forward until we hit end (ignore any ;)
        currentStart = inStr.indexOf(`'`, ii + 1) + 1;
      } else if (ch === `"`) {
        // we hit a dbl quote, scan forward until we hit end (ignore any ;)
        currentStart = inStr.indexOf(`"`, ii + 1) + 1;
      }
    }
  } catch (err) {
    logerr(err);
  }
  return result;
}

/**
 * merge a saved style string w/ the current style
 */
function styleStrToObject(styleStr: string, mergeIntoObj: KeyValuePair): KeyValuePair {
  // we use the json parser because it can handle `key: "value;'fooo'";`
  try {
    const stylesObj = smartParseStyles(styleStr);
    // modern way to merge objects
    return { ...mergeIntoObj, ...stylesObj };
  } catch (err) {
    logerr(
      `styleStrToObject err 
      styleStr=${styleStr}`,
      err,
    );
    return mergeIntoObj;
  }
}

/**
 * find and restore all the saved attributes. If you touch this, verify
 * youtube toggle and crunchyroll
 */
function restoreAllSavedAttr(elem: Element) {
  // filter on `data-videomax-saved-*` attributes
  const attrNames = /** @type string[] */ [...(elem?.getAttributeNames() || [])].filter((attr) =>
    attr.startsWith(VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX),
  ); // clone
  // array
  for (const eachAttrName of attrNames) {
    const savedValue = getAttr(elem, eachAttrName);
    // we need to get the name from the suffix
    const originalAttrName = eachAttrName.substring(VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX.length + 1);
    removeAttr(elem, eachAttrName); // our "save" data attrib
    if (savedValue === null) {
      // nothing to restore
      continue;
    }
    const currentVal = getAttr(elem, originalAttrName);
    if (savedValue === currentVal) {
      // same, do nothing
      continue;
    }
    if (currentVal === null) {
      /// just restore, no merge require
      setAttr(elem, originalAttrName, savedValue); // restore it.
      continue;
    }
    // case where we want to remove values we set?  removeAttr(elem,
    // originalAttrName);
    if (originalAttrName === "style") {
      // we add our changes back but if there are new changes, we append.
      /** @type {{[key: string]: string}} */
      const currentStyleParts: {
        [key: string]: string;
      } = styleStrToObject(savedValue, styleStrToObject(currentVal, {}));

      let mergedValue = Object.keys(currentStyleParts)
        .map((key) => `${key}: ${currentStyleParts[key]}`)
        .join("; ");
      if (mergedValue.length > 0 && !mergedValue.endsWith(";")) {
        // we want a trailing ; for our opacity check below
        mergedValue = `${mergedValue};`;
      }

      // if you zoom during starting pre-video commercials,
      // then some sites have the main video hidden (cruchyroll).
      // special case to make sure the style doesn't have "opacity: 0;"
      // maybe need to extend to other types of "hidden" approaches?
      mergedValue = mergedValue.replace(`opacity: 0;`, "");
      setAttr(elem, originalAttrName, mergedValue); // restore it.
    }
  }
  // we're all done restoring, remove our marker tag
  removeAttr(elem, VIDEO_MAX_DATA_ATTRIB_UNDO_TAG);
}

function isStopNodeForCommonContainer(node: Node): boolean {
  const nodename = (node?.nodeName?.toLowerCase() || "") as HtmlElementType;
  return STOP_NODES_COMMON_CONTAINER.includes(nodename);
}

function isAlwaysHideElem(node: Node): boolean {
  const nodename = (node?.nodeName?.toLowerCase() || "") as HtmlElementType;
  return ALWAYS_HIDE_NODES.includes(nodename);
}

/// / finding video logic. this code is a bit of a mess.
function findLargestVideoNew(topElem: Element) {
  try {
    if (!g_videomaxGlobals.elementMatcher) {
      logerr(`elementMatcher should NOT be null`);
      return false;
    }

    // todo: should this always be doc versus document?!?
    {
      const allvideos = topElem.querySelectorAll("video");
      for (const eachvido of allvideos) {
        g_videomaxGlobals.elementMatcher.checkIfBest(eachvido);
      }
    }
    // now go into frames from the main frame.
    // this can cause problems trying to walk back up out of frame later when
    // we're maximizing path
    {
      const frames = topElem.querySelectorAll("iframe");
      for (const frame of frames) {
        try {
          g_videomaxGlobals.elementMatcher.checkIfBest(frame);

          if (!isFunction(frame?.contentWindow?.document?.querySelectorAll)) {
            continue;
          }
          const allvideos = frame.contentWindow.document.querySelectorAll("video");
          for (const eachvideo of allvideos) {
            g_videomaxGlobals.elementMatcher.checkIfBest(eachvideo);
          }
        } catch (err) {
          if (String(err).toLowerCase().indexOf("blocked a frame") !== -1) {
            logtrace("iframe security blocked cross domain - expected");
          } else {
            logerr(err);
          }
        }
      }
    }

    // The shadowDom is a lot like an iframe. The outer container is probably the only thing that
    // needs to be maximized. What's inside the shadowDom probably resizes to the container correctly.
    const shadowDoms = findShadowDomsUnderElem(topElem);
    for (const eachShadowDoms of shadowDoms) {
      g_videomaxGlobals.elementMatcher.checkIfBest(eachShadowDoms);
    }
    return g_videomaxGlobals?.elementMatcher?.getMatchCount() > 0;
  } catch (err) {
    logtrace(err);
    return false;
  }
}

// shadowHosts => shadowRoot
function findShadowDomsUnderElem(elem: Element): Element[] {
  let matched: Element[] = [];
  const shadowDomWalker = elem.ownerDocument.createTreeWalker(
    elem,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_DOCUMENT | NodeFilter.SHOW_DOCUMENT_FRAGMENT,
    isVisibleWalkerElem,
  );
  shadowDomWalker.nextNode(); // skip elem

  while (shadowDomWalker.nextNode()) {
    if (
      shadowDomWalker.currentNode &&
      shadowRoot(shadowDomWalker.currentNode) &&
      isHtmlElement(shadowDomWalker.currentNode)
    ) {
      matched.push(shadowDomWalker.currentNode);
    }
  }

  const results: Element[] = [];
  // we need to filter out shadowdoms without videos, other shadowdoms or iframes.
  // CNN's bottom ads match when page width is narrow.
  for (const eachmatched of matched) {
    if (!eachmatched.shadowRoot) {
      continue;
    }
    const subelements = findVideoElementsInShadowRoot(eachmatched.shadowRoot);
    if (subelements.length > 1) {
      results.push(eachmatched);
    }
  }
  return results;
}

function getVideoSource(videoElem: HTMLVideoElement | Element | HTMLIFrameElement): string {
  if (isVideoElement(videoElem)) {
    // see if we can get this video's source.
    if (videoElem.src?.length) {
      return videoElem.src;
    }
    // sometimes there's a <video><source src=""></video> approach.
    // this is used when there might be different data formatting available
    // for the same video (e.g. one for video/mp4 and another for
    // video/webm). if a site is going through this much work, it's probably
    // NOT an ad.
    const matchedSources = videoElem.getElementsByTagName("source");
    if (matchedSources.length > 0) {
      // there may be multiple, but they are likely very similar, probably
      // just different codex's
      // @ts-ignore currentSource is likely wrong, but need to verify
      return matchedSources[0]?.src || matchedSources[0]?.currentSrc || "";
    }
  }
  logtrace(`getVideoSource for ${printNode(videoElem)} failed to find source url`);
  return ""; // failed
}

function getElemsDocumentView(node: Node): Window | null {
  return getOwnerDoc(node)?.defaultView ?? null;
}

/**
 * This is kind of an expensive op, maybe cache. The CSSStyleDeclaration is
 * massive.
 */
function getElemComputedStyle(node: Element) {
  // 1/2024 - this was using document which was always failing.
  try {
    if (isIFrameElem(node) && isFunction(node?.contentWindow?.getComputedStyle)) {
      return node.contentWindow.getComputedStyle(node, null);
    }
  } catch (err) {} // can throw if cross iframe boundary
  try {
    return window?.getComputedStyle(node, null) ?? ({} as CSSStyleDeclaration);
  } catch (err) {} // can throw if cross iframe boundary
  return {} as CSSStyleDeclaration;
}

function isEmptyRect(rect: Rect) {
  return rect.width < 2 || rect.height < 2;
}

function isIgnoredNode(elem: Node): boolean {
  const nodename = (elem?.nodeName?.toLowerCase() || "") as HtmlElementType;
  return IGNORE_NODES.includes(nodename);
}

/**
 * when we're trying to find the common container, don't count these
 */
function isIgnoreCommonContainerNode(elem: Node): boolean {
  const nodename = (elem?.nodeName?.toLowerCase() || "") as HtmlElementType;
  return IGNORE_COMMON_CONTAINER_COUNT_NODES.includes(nodename);
}

function isNotIgnoreCommonContainerNode(elem: Node) {
  return !isIgnoreCommonContainerNode(elem);
}

function getTopDocumentForIFrameBreakOut(elem: Node): {
  document: Document;
  element: Node | null;
} {
  const localdoc = getOwnerDoc(elem);
  try {
    // break out of iframe. this is build into parentElement
    const docParentNode = localdoc.parentElement;
    const nextDoc = docParentNode ? getOwnerDoc(docParentNode) : localdoc;
    return {
      document: nextDoc,
      element: docParentNode,
    };
  } catch (err) {
    logerr("getTopDocumentForIFrameBreakOut", err);
  }
  return {
    document: localdoc,
    element: elem,
  };
}

function forceRefresh(elem: Element | Window | null) {
  if (!elem) {
    return;
  }
  if (isDoomScrollingSite()) {
    // triggering a resize will likely cause DOM to rerender and mess up our
    // matched video.
    logtrace("NOT trigging refresh events for doomscroller sites");
    return;
  }
  if (!isFunction(elem?.dispatchEvent)) {
    return;
  }
  // we now need to force the flash to reload by resizing... easy thing is to
  // adjust the body
  setTimeout(() => {
    try {
      elem.dispatchEvent(new Event("resize"));
      elem.dispatchEvent(new Event("visabilitychange"));
    } catch (err) {
      logerr(err);
    }
  }, 10);
}

/**
 * @param compStyleElem {CSSStyleDeclaration}
 */
function hasTransitionEffect(compStyleElem: CSSStyleDeclaration) {
  if (g_cachedDefaultTransitionString.length === 0) {
    const bodystyle = getElemComputedStyle(document.body);
    g_cachedDefaultTransitionString = bodystyle.transition;
    logtrace(`g_cachedDefaultTransitionString: "${g_cachedDefaultTransitionString}"`);
  }
  return compStyleElem?.transition !== g_cachedDefaultTransitionString;
}

/**
 * Will load computed style and work down dom as long as there's only ONE
 * child element at each level. If the caller has compStyleElem, then first
 * call hasTransitionEffect
 */
function hasTransitionEffectRecursive(elem: Element, skipParent = false) {
  if (!skipParent) {
    if (hasTransitionEffect(getElemComputedStyle(elem))) {
      return true;
    }
  }
  if (!OVERLAPS_REQUIRE_TRANSITION_EFFECTS_RECURSIVE) {
    return false;
  }
  if (!elem) {
    return false;
  }

  let currentElem: Element | null = elem;
  do {
    if (hasTransitionEffect(getElemComputedStyle(currentElem))) {
      return true;
    }
    // filter out nodes like <script>
    const siblings = getSiblings(currentElem, isSkippedNonDiv);
    for (const sibling of siblings) {
      if (hasTransitionEffect(getElemComputedStyle(sibling))) {
        return true;
      }
    }
    if (siblings.length > 2) {
      return false;
    }
    // we get here if there are no siblings, we keep drilling down.
    currentElem = currentElem.firstElementChild;
  } while (currentElem);
  return false;
}

/**
 * we going to work our way up looking for some element that has a bunch of
 * children but few siblings. We're only going to search up
 * (CHECK_PARENTS_LEVELS_UP_MAX) elements, then give up. For <video>
 * matching, the playback controls are "position: absolute" under a common
 * div "position: relative".
 */
function findCommonContainerFromMatched(
  matchedElem: Element | HTMLIFrameElement,
  doc: Document = document,
): Element | Node | null {
  if (DEV_MODE) {
    const matches = doc.querySelectorAll(`.${MARKER_COMMON_CONTAINER_CLASS}`);
    if (matches?.length) {
      // https://www.nbcnews.com/now  iframe that we can drill down into. it
      // finds a -common in the iframe but the actual controls are in the
      // parent document.
      logwarn(
        `Already found common container, shouldn't match two. IFrame seeing outside frame issue? Cont.`,
        matches,
      );
    }
  }
  if (!isVideoElement(matchedElem)) {
    return matchedElem?.parentElement || (matchedElem?.parentNode as Node);
  }

  // exceptions
  const EXCEPTIONS = {
    "pluto.tv/": "video-player-layout",
    "youtube.com/shorts": "player-container",
  };
  for (const [eachException, eachClassName] of Object.entries(EXCEPTIONS)) {
    if (doc.location?.href?.includes(eachException)) {
      // finding the common parent is a special case for this strange layout.
      const commonMatches = doc?.getElementsByClassName(eachClassName);
      for (const eachCommonMatch of commonMatches) {
        if (eachCommonMatch.contains(matchedElem)) {
          g_videomaxGlobals.matchedCommonCntl = eachCommonMatch;
          eachCommonMatch?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
          return eachCommonMatch;
        }
      }
      break; // got a match and only one possible match
    }
    // if it doesn't match, then site maybe changed, just fallback to regular
    // matching
  }

  const videoElem = matchedElem;
  const videoRect = g_videomaxGlobals.matchVideoRect;

  const countChildren = (e: Element, recurseFirst = true, runningCount = 0) => {
    let count = runningCount;
    if (NO_SEARCHING_IGNORED_NODES_COMMON && isIgnoreCommonContainerNode(e)) {
      if (COMMON_PARENT_SCORES) {
        g_containDbgMsg += `\n     -> isIgnoreCommonContainerNode ${printNode(e)}`;
      }
      return runningCount;
    }
    if (recurseFirst) {
      // instanceof Element required because querySelectorAll
      if (USE_BOOST_SCORES_FIND_COMMON && isHtmlElement(e)) {
        const boostMatches = NO_SEARCHING_IGNORED_NODES_COMMON
          ? querySelectorAllFiltered(e, `[role="slider"]`, isNotIgnoreCommonContainerNode)
          : e.querySelectorAll(`[role="slider"]`);
        // ...e.querySelectorAll(`[role="presentation"]`)]; // player puts
        // this on every preview video on the page
        count += boostMatches.length * 2; // 2x points if there's a slider
        // under this element.
        if (COMMON_PARENT_SCORES) {
          g_containDbgMsg += `\n Slider count: BOOST +${boostMatches.length}*2 result:${count}`;
        }

        if (USE_BOOST_SCORES_REGEX_FIND_COMMON && smellsLikeMatch(e, [/control/i])) {
          count++;
          if (COMMON_PARENT_SCORES) {
            g_containDbgMsg += `\n Slider count: BOOST REGEX +1 result:${count}`;
          }
        }
      }

      if (USE_NERF_SCORES_FIND_COMMON) {
        const nerfMatches = NO_SEARCHING_IGNORED_NODES_COMMON
          ? [
              ...querySelectorAllFiltered(e, `[role="toolbar"]`, isNotIgnoreCommonContainerNode),
              ...querySelectorAllFiltered(e, `[role="navigation"]`, isNotIgnoreCommonContainerNode),
            ]
          : [...e.querySelectorAll(`[role="toolbar"]`), e.querySelectorAll(`[role="navigation"]`)];

        count -= nerfMatches.length * 2; // -2x points if there's a
        // navigation components under this
        // element.
        if (COMMON_PARENT_SCORES) {
          g_containDbgMsg += `\n Slider count: NERF -${nerfMatches.length}*2 result:${count}`;
        }
      }

      // Tubi is horrible about 508 accessibility. It just uses <svg> for all
      // controls. It also removes the elements when they aren't active, so
      // they are impossible to find. example how to select if they weren't
      // hidden const volSgvCount   = [...e.querySelectorAll(`svg >
      // title`)].filter( (e) =>
      // e?.innerHTML?.toLowerCase().includes("volume")).length;
    }
    const checkChildren = [...e.children].filter((el) => isNotIgnoreCommonContainerNode(el));
    let index = 0; // used for debugging only.
    for (const eachChild of checkChildren) {
      try {
        index++;
        const compStyleElem = getElemComputedStyle(eachChild); // $$$
        const rect = getCoords(eachChild);
        if (isBoundedRect(videoRect, rect)) {
          count++;
          if (COMMON_PARENT_SCORES) {
            g_containDbgMsg += `\n ${
              recurseFirst ? "" : "\t"
            } #${index}\t isBoundedRect: \t +1 result: \t ${count}`;
          }
        }
        if (compStyleElem?.position === "absolute") {
          count++;
          if (COMMON_PARENT_SCORES) {
            g_containDbgMsg += `\n ${
              recurseFirst ? "" : "\t"
            } #${index}\t absPosition:   \t +1 result: \t ${count}`;
          }
        }
        if (INCLUDE_TRANSITION_WEIGHT_FOR_COMMON_SCORE && hasTransitionEffect(compStyleElem)) {
          // tag it so we don't have to call getElemComputedStyle again later.
          eachChild.classList?.add(MARKER_TRANSITION_CLASS);
          count++;
          if (COMMON_PARENT_SCORES) {
            g_containDbgMsg += `\n  ${
              recurseFirst ? "" : "\t"
            } #${index}\t transition:   \t +1 result: \t ${count} "${
              compStyleElem?.transitionTimingFunction
            }"`;
          }
        }
        ///
        if (recurseFirst) {
          // we recurse ONCE. Youtube and plutoTV put controls one level down.
          count = countChildren(eachChild, false, count);
        }
      } catch (err) {
        logerr(err);
      }
    }
    if (COMMON_PARENT_SCORES && !recurseFirst) {
      logtrace(
        `\tChild Common Score \n\t${printNode(
          e,
        )}\n${g_containDbgMsg}\n\tTotals: before ${runningCount} \t after: ${count}`,
      );
      g_containDbgMsg = "";
    }
    return count;
  };

  if (!g_walker || !videoElem) {
    logerr("g_walker or videoElem is null. failing");
    return null;
  }
  const savedWalkerCurrentNode = g_walker.currentNode; // restore at end
  g_walker.currentNode = videoElem as Node;
  let bestMatchCommonParent: Element = videoElem;
  let bestMatchWeight = 1;

  let checkParents = CHECK_PARENTS_LEVELS_UP_MAX;
  while (g_walker.parentNode() && checkParents > 0) {
    try {
      if (!isHtmlElement(g_walker.currentNode)) {
        continue;
      }
      const currentElem = g_walker.currentNode as HTMLElement;

      // these could be part of while condition, but we may want to
      // debug/logtrace on them.
      checkParents--; // counting down to zero.
      if (isStopNodeForCommonContainer(currentElem)) {
        logtrace(`  findCommonContainerFromElem stopped because hit stopping node`, currentElem);
        break;
      }
      const weight = countChildren(currentElem);
      logtrace(
        `findCommonContainerFromMatched ${
          weight > bestMatchWeight ? "NEW BEST" : ""
        } \n\t weight:${weight} \n\t ${printNode(g_walker.currentNode)} \n\t`,
      );
      if (weight > bestMatchWeight) {
        bestMatchWeight = weight;
        bestMatchCommonParent = currentElem; // we've already moved to
        // parentElement()
      }
    } catch (err) {
      logerr(err);
    }
  }

  // done, restore
  g_walker.currentNode = savedWalkerCurrentNode;

  // tubi is an exception since they use non-508 friendly playback controls.
  if (
    doc.location?.host?.includes("tubitv.") &&
    bestMatchCommonParent?.parentNode &&
    isHtmlElement(bestMatchCommonParent.parentNode)
  ) {
    logtrace("findCommonContainerFromElem: tubi specialcase using parent.");
    bestMatchCommonParent = bestMatchCommonParent.parentElement as HTMLElement;
  }

  // exception, never match the playback video itself, go to it's parent
  if (bestMatchCommonParent.nodeName.toLowerCase() === "video") {
    logtrace("findCommonContainerFromElem matched video. Using parent");
    bestMatchCommonParent = bestMatchCommonParent.parentElement as HTMLElement;
  }
  g_videomaxGlobals.matchedCommonCntl = bestMatchCommonParent;

  bestMatchCommonParent?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
  return bestMatchCommonParent;
}

function exceptionToRuleFixup(doc: Document | null, videoElem: Element | Node | null) {
  if (!doc || !isVideoElement(videoElem)) {
    return;
  }
  // some sites have the playback controls completely cover the video, if we
  // don't adjust the height, then they are at the top or middle of the
  // screen.
  const existingPlaybacks = doc.querySelectorAll(`.${PLAYBACK_CNTLS_CSS_CLASS}`);
  if (existingPlaybacks?.length) {
    const videoElemHeight = getOuterBoundingRect(videoElem).height || 1;
    for (const eachPlaybackCntl of existingPlaybacks) {
      const height = getOuterBoundingRect(eachPlaybackCntl).height || 1;
      const ratio = height / videoElemHeight;
      if (height > 10 && ratio > 0.8) {
        logtrace(`=====\n\tADJUST_PLAYBACK_CNTL_HEIGHT seems like it should be full height\n=====`);
        eachPlaybackCntl.classList.add(PLAYBACK_CNTLS_FULL_HEIGHT_CSS_CLASS);
      }
    }
  }
}

/**
 * Some cases where videos are hidden in iframes or nested iframes cause us
 * to miss hiding some simblings
 * @param doc {Document}
 */
function lastDitchHide(doc: Document) {
  if (LAST_DITCH_HIDE) {
    const matches = [
      ...doc.getElementsByClassName(MAX_CSS_CLASS),
      ...doc.getElementsByClassName(`${PREFIX_CSS_CLASS}-max`),
    ];
    for (const eachElem of matches) {
      try {
        const siblings = getSiblings(eachElem);
        for (const eachSibling of siblings) {
          if (hasAnyVideoMaxClass(eachSibling)) {
            continue;
          }
          const underCommonCntl = isUnderCommonCntlParentPath(eachSibling);

          if (underCommonCntl && hasTransitionEffectRecursive(eachSibling)) {
            if (DEBUG_HIDENODE) {
              logtrace(
                `lastDitchHide hasTransitionEffectRecursive=true not hiding. ${printNode(
                  eachSibling,
                )}`,
              );
            }
            if (NOHIDENODE_REAPPLY) {
              noHideElement(eachSibling);
              continue;
            }
          }
          if (underCommonCntl && getAllElementsThatSmellsLikeControls(eachSibling).length) {
            if (DEBUG_HIDENODE) {
              logtrace(
                `lastDitchHide Smells like Controls. ${printNode(eachSibling)}`,
                getAllElementsThatSmellsLikeControls(eachSibling),
              );
            }
            if (NOHIDENODE_REAPPLY) {
              noHideElement(eachSibling);
              continue;
            }
          }
          if (DEBUG_HIDENODE) {
            logtrace(`lastDitchHide Hiding. ${printNode(eachSibling)}`);
          }
          hideNode(eachSibling);
        }
      } catch (err) {
        logerr(err);
      }
    }
  }
}

function isSkippedNode(el: Element): boolean {
  return SKIPPED_NODE_NAMES.includes(el?.nodeName.toLowerCase());
}

function isSkippedNodeForCntl(el: Element): boolean {
  return SKIPPED_NODE_NAMES_FOR_PLAYBACK_CTRLS.includes(el?.nodeName.toLowerCase());
}

function isSkippedNonDiv(el: Element) {
  return !["div", "section"].includes(el.nodeName.toLowerCase());
}

function isVisibleWalkerElem(node: Node): number {
  try {
    if (!isHtmlElement(node) && !isIFrameElem(node)) {
      return NodeFilter.FILTER_SKIP;
    }
    if (isSkippedNode(node)) {
      return NodeFilter.FILTER_SKIP;
    }
    return isElemVisable(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
  } catch (err) {
    logerr(err, node);
    return NodeFilter.FILTER_SKIP;
  }
}

function ReApplyUpFromElem(
  elem: Element | null,
  className: string,
  optStopElem: Element | null = null,
  force: boolean = false,
) {
  if (!elem) {
    logerr("elem is null");
    return;
  }

  let currentElem: Element | null = elem;
  let isSameNode = false;
  do {
    if (hasAnyVideoMaxClass(currentElem)) {
      if (!force) {
        continue;
      }
      // remove any existing classes before adding the new one.
      if (!isHtmlElement(currentElem)) {
        continue;
      }
      // remove any video-max css classes UNLESS they are the one being applied
      // (or special case, the debugging "matched" class)
      const remove = [...currentElem.classList]
        .filter((c) => c.startsWith(PREFIX_CSS_CLASS) || c.startsWith(PREFIX_CSS_CLASS))
        .filter((c) => c !== className && c !== PLAYBACK_VIDEO_MATCHED_CLASS);
      if (remove.length > 0) {
        currentElem.classList.remove(...remove);
      }
    }

    // so maximize shows the class, but if the class is currently hidden,
    // then we add the "no hide" class to it. This is common when ads are playing.
    // the main video can get hidden.
    if (
      IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE &&
      className === MAX_CSS_CLASS &&
      !isVisible(currentElem)
    ) {
      if (DEBUG_HIDENODE) {
        logtrace(
          "ReApplyUpFromElem IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE. Elem is not visible, so don't maximize, just set to no_hide",
        );
      }
      currentElem.classList.add(NO_HIDE_CLASS);
    } else {
      currentElem.classList.add(className);
    }
    if (ALWAYS_BACK_UP_STYLES) {
      backupAttr(currentElem, "style");
    }

    currentElem = parentElement(currentElem);
    isSameNode = currentElem !== null && (optStopElem?.isSameNode(currentElem) ?? false);
  } while (currentElem && !isSameNode);
}

/**
 * Adds the maximized class to all elements from matched video up.
 * It often gets cleared after ads play because classLists are reset after
 * they play
 */
function maximizeUpFromVideo(
  matchedVideo: HTMLVideoElement | HTMLVideoElement | Element,
  cssClass: string = MAX_CSS_CLASS,
) {
  ReApplyUpFromElem(matchedVideo, cssClass, null, true);
  // special case for when videos are in iframes that are not on a different
  // domain. e.g. dailymotion.com
  debugger;
  if (
    // !g_isRunningInIFrame &&
    isVideoElement(matchedVideo) &&
    isElemInIFrame(matchedVideo)
  ) {
    {
      const items = findVideosIFramesAtCenter(matchedVideo);
      console.log(items);
      debugger;
    }
    // root.nodeName === "#document"
    const root = matchedVideo.getRootNode();
    const iframe = findIFrameInDocument2(root);
    if (iframe) {
      logtrace(`Running special case for accessible iframes`);
      ReApplyUpFromElem(iframe, cssClass);
    } else {
      const iframe2 = findIFrameInDocument(root);
      if (iframe2) {
        logtrace(`Running special case for accessible iframes`);
        ReApplyUpFromElem(iframe2, cssClass);
      }
    }
  }
}

/**
 * @param elem {HTMLElement}
 */
function tagElementAsMatchedVideo(elem: Element | HTMLIFrameElement) {
  // No longer true since video can be in shadowDom
  // if (!(elem instanceof HTMLVideoElement || elem instanceof HTMLIFrameElement)) {
  //   logerr(`tagElementAsMatchedVideo is not a video or iframe. FAILING`, elem);
  //   return;
  // }
  g_videomaxGlobals.matchedVideo = elem;
  g_videomaxGlobals.matchVideoRect = getCoords(elem);
  g_videomaxGlobals.matchedVideoSrc = getVideoSource(elem);
  g_videomaxGlobals.processInFrame = g_isRunningInIFrame; // for debugging
  // set the data-videomax-id = "zoomed" so undo can find it.
  setAttr(elem, `${VIDEO_MAX_ATTRIB_FIND}`, VIDEO_MAX_ATTRIB_ID);
  elem?.classList?.add(PLAYBACK_VIDEO_MATCHED_CLASS, MAX_CSS_CLASS);
}

function fixUpAttribs(node: Node | HTMLElement) {
  if (!isHtmlElement(node)) {
    return node;
  }
  logtrace(`FixUpAttribs for elem type ${node?.nodeName}`, node);

  // tagElementAsMatchedVideo(node);  // 14Jun removed, why here?
  const attribs = node.attributes;

  logtrace(`attrib count = ${attribs.length}`);
  for (const eachattrib of attribs) {
    try {
      const { name } = eachattrib;
      const orgValue = eachattrib.value;
      let newValue = "";

      // skip our own.
      if (name.startsWith(PREFIX_CSS_CLASS)) {
        continue;
      }
      logtrace(`FixUpAttribs found attrib '${name}': '${orgValue}'`);
      switch (name.toLowerCase()) {
        case "width":
          newValue = SCALESTRING_WIDTH; // 'calc(100vw)' works too?
          break;

        case "height":
          newValue = SCALESTRING_HEIGHT; // 'calc(100vh)' works too?
          break;

        case "data-width":
          newValue = "calc(100vw)";
          break;

        case "data-height":
          newValue = "calc(100vh)";
          break;

        case "style":
          newValue = `${orgValue};`; // remove at end. needed for parsing
          newValue = newValue.replace(/width\s*:\s*[^;&]+/i, `width: ${SCALESTRING_WIDTH}`);
          newValue = newValue.replace(/height\s*:\s*[^;&]+/i, `height: ${SCALESTRING_HEIGHT}`);
          newValue = newValue.substring(0, newValue.length - 1); // removing
          // trailing
          // ; we
          // added
          // above
          break;

        case "scale":
          newValue = "showAll";
          break;

        // case 'autoplay':
        //   if (orgValue === '0') {
        //     newValue = '1';
        //   } else {
        //     newValue = 'true';
        //   }
        //   break;

        // default:
        case "flashlets":
        case "data":
          newValue = grepFlashlets(orgValue);
          break;

        case "controls":
          newValue = "1";
          break;

        case "disablepictureinpicture":
          newValue = "0";
          break;

        default:
          break;
      }

      // replace only if set and not different
      if (newValue !== "" && newValue !== orgValue) {
        logtrace(
          `FixUpAttribs changing attribute: '${name}'
            old: '${orgValue}'
            new: '${newValue}'`,
          node,
        );
        setAttrAndSave(node, name, newValue);
      }
    } catch (ex) {
      logerr("exception in looping over properties: ", ex);
    }
  }

  {
    // collect all changes here, then apply in a single writing loop. more
    // efficient for dom update
    const newParams: KeyValuePair = {};
    for (const eachnode of node.childNodes) {
      try {
        if (!isHtmlElement(eachnode) || eachnode?.nodeName?.toUpperCase() !== "PARAM") {
          continue;
        }
        const attrName = getAttr(eachnode, "name") ?? "";
        const attrValue = getAttr(eachnode, "value") ?? "";

        logtrace(`  FixUpAttribs found param '${attrName}': '${attrValue}'`);
        if (["FLASHLETS", "DATA"].includes(attrName.toUpperCase())) {
          newParams[attrName] = grepFlashlets(attrValue);
        } else {
          // we might override below.
          newParams[attrName] = attrValue;
        }
      } catch (ex) {
        logerr("ERROR reading flash params ex", ex);
      }
    }

    // define all nodes
    newParams.bgcolor = "#000000";
    newParams.scale = "showAll";
    newParams.menu = "true";
    newParams.quality = "high";
    newParams.width = SCALESTRING_WIDTH;
    newParams.height = SCALESTRING_HEIGHT;
    newParams.quality = "high";
    // newParams.autoplay = "true";

    // edit in place
    for (const eachnode of node.childNodes) {
      if (!isHtmlElement(eachnode) || eachnode?.nodeName?.toUpperCase() !== "PARAM") {
        continue;
      }
      const name = getAttr(eachnode, "name") ?? "";
      const orgValue = getAttr(eachnode, "value") ?? "";

      if (Object.prototype.hasOwnProperty.call(newParams, name)) {
        // is this one we care about?
        logtrace(`FixUpAttribs changing child param '${name}'
            old: '${orgValue}'
            new: '${newParams[name]}'`);

        setAttrAndSave(eachnode, name, newParams[name]);
      }
    }
  }
  forceRefresh(node);
  return node;
}

function grepFlashlets(flashletsval: string) {
  let result = flashletsval;
  if (result !== "" && result?.match(/[=%]/i) !== null) {
    const rejoinedResult = [];
    const params = parseParams(flashletsval);
    if (params) {
      for (const key of getKeys(params)) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          switch (String(key).toLocaleLowerCase()) {
            case "width":
            case "vwidth":
            case "playerwidth":
            case "height":
            case "vheight":
            case "playerheight":
              params[key] = SCALESTRING;
              break;

            case "scale":
              params[key] = "showAll";
              break;

            // case "autoplay":
            //   if (params[key] === "0") {
            //     params[key] = "1";
            //   } else {
            //     params[key] = "true";
            //   }
            //   break;

            case "flashlets":
            case "data":
              {
                const value = params[key];
                if (value?.match(/[=%]/i) !== null) {
                  params[key] = grepFlashlets(value);
                }
              }
              break;
            default:
              break;
          }

          rejoinedResult.push(`${String(key)}=${encodeURIComponent(params[key] || "")}`);
        }
      }

      result = rejoinedResult.join("&");
      if (flashletsval.search(/\?/i) === 0) {
        // startswith
        result = `?${result}`;
      }
    }
    logtrace(`Replaced urls params:\n\tBefore:\t${flashletsval}\r\n\tAfter\t${result}`);
  }
  return result;
}

function noHideElement(elem: Element) {
  try {
    if (hasAnyVideoMaxClass(elem) || isAlwaysHideElem(elem)) {
      return;
    }
    if (DEBUG_HIDENODE) {
      logtrace(`Setting noHideElement for ${printNode(elem)}`);
    }
    elem.classList.add(NO_HIDE_CLASS);
  } catch (err) {
    logtrace(err);
  }
}

// skipPrep: Use the "-prep" style suffix so adding doesn't change it until we're done
function hideNode(elem: Node | Element, skipPrep = false) {
  if (!isHtmlElement(elem)) {
    // we use classnames to hide, so must be Element
    return false;
  }
  const printElem = DEBUG_HIDENODE ? printNode(elem) : "";
  if (isIgnoredNode(elem)) {
    if (DEBUG_HIDENODE) {
      logtrace(`  hideNode: NOT HIDING isIgnoredNode ${printElem}`);
    }
    return false;
  }

  if (hasAnyVideoMaxClass(elem)) {
    // if we hit a "no-hide" then we need to add the overlap!
    if (elem.classList.contains(NO_HIDE_CLASS)) {
      if (DEBUG_HIDENODE) {
        logtrace(`  hideNode: Adding overlap class since it contained NO_HIDE_CLASS! ${printElem}`);
      }
      addOverlapCtrl(elem);
    } else if (DEBUG_HIDENODE) {
      if (DEBUG_HIDENODE) {
        logtrace(`  hideNode: NOT HIDING already contains videomax class ${printElem}`);
      }
    }
    return false;
  }

  // some never hide elements.
  if (isSpecialCaseNeverHide(elem)) {
    if (DEBUG_HIDENODE) {
      logtrace(`  hideNode: NOT HIDING special case ${printElem}`);
    }
    return false;
  }

  if (DEBUG_HIDENODE && isHtmlElement(elem)) {
    logtrace(`  hideNode: HIDING ${printElem}`);
  }
  elem.classList.add(skipPrep ? `${PREFIX_CSS_CLASS}-hide` : HIDDEN_CSS_CLASS); // prep
  return true;
}

function addOverlapCtrl(elem: Node | Element) {
  // we assume we can set attributes
  if (!isHtmlElement(elem) || isIgnoredNode(elem)) {
    if (DEBUG_HIDENODE) {
      logtrace("NOT addOverlapCtrl isIgnoredNode:", IGNORE_NODES, elem);
    }
    return;
  }
  const debugPrintNode = DEBUG_HIDENODE ? printNode(elem) : "";
  if (hasAnyVideoMaxClass(elem)) {
    if (DEBUG_HIDENODE) {
      logtrace(`NOT addOverlapCtrl containsAnyVideoMaxClass: ${debugPrintNode}`);
    }
    return;
  }
  if (isSpecialCaseNeverOverlap(elem)) {
    if (DEBUG_HIDENODE) {
      logtrace(`NOT addOverlapCtrl special case: ${debugPrintNode}`);
    }
    return;
  }
  // the issue: controls overlapping should have a transition effect but
  // their are exceptions: Skip ad buttons... and ads!
  if (
    OVERLAPS_REQUIRE_TRANSITION_EFFECTS &&
    !hasTransitionEffect(getElemComputedStyle(elem)) &&
    !hasTransitionEffectRecursive(elem, true)
  ) {
    // this is risky because some "skip ads" buttons do not disappear.
    if (DEBUG_HIDENODE) {
      logtrace(`NOT addOverlapCtrl !hasTransitionEffect: ${debugPrintNode}`);
    }
    return;
  }
  if (DEBUG_HIDENODE) {
    logtrace(`addOverlapCtrl: ${debugPrintNode}`);
  }
  elem?.classList?.add(OVERLAP_CSS_CLASS);
  if (SAVE_STYLE_FOR_OVERLAPs && isSaveStyleOverlapsSite()) {
    // we don't want a local style to conflict with the class we're adding
    backupAttr(elem, "style");
  }
}

/**
 * All siblings as an array, (but not the node passed)
 */
function getSiblings(elem: Element, skipFunction = isSkippedNode): Element[] {
  try {
    const parent = elem.parentElement || elem.parentNode;
    if (!parent?.children) {
      return [];
    }
    const result = [...parent.children].filter((c) => {
      if (c === elem) {
        return false;
      }
      // if (c.nodeType === Node.ELEMENT_NODE) {
      //   return true;
      // }
      if (c.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }
      // if (c.nodeType === Node.DOCUMENT_NODE) {
      //   // this includes HTML, XML and SVG!
      //   if (!(c.nodeType instanceof HTMLDocument)) {
      //     return false;
      //   }
      // }
      return !skipFunction(c);
    });
    if (DEBUG_HIDENODE) {
      logtrace(`getSiblings`, result);
    }
    return result;
  } catch (err) {
    logerr(err);
    return [];
  }
}

function rehideUpFromVideo() {
  lastDitchHide(document);

  let reHideCount = 0;
  let current: Element | null = g_videomaxGlobals.matchedVideo;
  if (isVideoElement(g_videomaxGlobals.matchedVideo)) {
    // html5 videos often put controls next to the video in the dom
    // (siblings), so we want to go up a level
    current = parentElement(g_videomaxGlobals.matchedVideo);
  }

  let safetyCheck = 200;
  while (current && safetyCheck--) {
    const siblings = getSiblings(current);
    for (const eachNode of siblings) {
      // we don't hide the tree we're walking up, just the siblings
      if (hideNode(eachNode)) {
        // may not actually hide for internal reasons like already has videomax class
        reHideCount++;
      }
    }
    const loopDetect = current;
    current = parentElement(current);
    if (loopDetect === current) {
      // pornhub
      break;
    }
  }
  logtrace(`rehideUpFromVideo hid: ${reHideCount}`);
  return reHideCount;
}

class RetryTimeoutClass {
  private timerid: number;

  readonly delay: number;

  private retrycount: number;

  readonly maxretries: number;

  readonly debugname: string;

  private callback: () => boolean;

  constructor(debugname = "", delay = 250, maxretries = 8) {
    this.timerid = 0;
    this.delay = delay; // + (Math.round((0.5 - Math.random()) * delay) / 10);
    // //  +/-

    this.maxretries = maxretries;
    this.retrycount = 0;
    this.debugname = debugname;
    this.callback = () => false;
  }

  // func() returning true means done
  startTimer = (func: () => boolean) => {
    this.callback = func;
    this.retryFunc.bind(this);
    setTimeout(() => this.retryFunc(), 0);
  };

  retryFunc = () => {
    logtrace(
      `RetryTimeoutClass.retryFunc ${this.debugname} retry: ${this.retrycount}/${this.maxretries}`,
    );
    this.cleartimeout();
    const result = this.callback();

    if (!result) {
      logtrace(`RetryTimeoutClass.retryFunc ${this.debugname}  function returned false. retying`);
      // returns true if we're done
      this.retrycount++;
      if (this.retrycount < this.maxretries) {
        this.timerid = setTimeout(this.retryFunc, this.delay);
      }
    } else {
      logtrace(`RetryTimeoutClass.retryFunc ${this.debugname}  function returned true. stopping`);
    }

    return result;
  };

  cleartimeout = () => {
    let timerid = 0;
    [this.timerid, timerid] = [timerid, this.timerid]; // swap
    if (timerid) {
      clearTimeout(timerid);
    }
  };
}

function hideCSS(id: string) {
  // try {
  if (id) {
    const elem = document.getElementById(id);
    if (elem) {
      setAttrAndSave(elem, "media", "_all");
    }
  }
}

function hasInjectedAlready() {
  const attr = document?.body?.getAttribute(VIDEO_MAX_INSTALLED_ATTR) ?? "";
  const thinksInstalled = attr?.length > 0;
  if (!thinksInstalled) {
    return false;
  }
  const videoStillInDoc = isVideoStillInDoc(g_videomaxGlobals);
  if (!videoStillInDoc) {
    // we are in a partial state, we may need to unzoom? This can happen on multiple-videos in instagram
    logwarn(
      "VIDEO_MAX_INSTALLED_ATTR on body but matched video missing. Background should be attempting rezoom.",
    );
    debugger;
    // we can't find the possible new video while everything is zoomed
    removeClassObserver();
    videoCanPlayRemove();

    flipCssAddPrep(document);

    setTimeout(() => {
      mainZoom();
    }, 100);

    return false;
  }
  return true;
}

/**
 * Returns whole numbers for bounding box instead of floats.
 * @param rectC {Rect}
 * @return {Rect}
 */
function wholeClientRect(rectC: Rect): Rect {
  return {
    top: Math.round(rectC.top),
    left: Math.round(rectC.left),
    bottom: Math.round(rectC.bottom),
    right: Math.round(rectC.right),
    width: Math.round(rectC.width),
    height: Math.round(rectC.height),
  };
}

/**
 * Gets the window.visualViewport as our Rect
 * @return {Rect}
 */
function getViewportRect(): Rect {
  const vp = window.visualViewport; // readability
  if (!vp) {
    return EMPTY_DOC_RECT;
  }
  const top = Math.round(vp.pageTop + vp.offsetTop);
  const left = Math.round(vp.pageLeft + vp.offsetLeft);
  const width = Math.round(vp.width);
  const height = Math.round(vp.height);
  const bottom = top + height;
  const right = left + width;

  return {
    top,
    left,
    bottom,
    right,
    width,
    height,
  };
}

/**
 * If the innerDomRect exactly matches the outerDomRect then the result is
 * {outerPercent: 1.0, innerPercent 1.0}
 * If the inner is completely contained by the outer but only fills up half
 * then
 * {outerPercent: 0.5, innerPercent 1.0}
 * If theres some overlap (e.g. where the inner is bleeding outside the outer
 * by half) then
 * {outerPercent: 0.5, innerPercent 5.0}
 * @param outerDomRect {Rect}
 * @param innerDomRect {Rect}
 * @return {{outerPercent: number, innerPercent: number}}
 */
function getOverlapPercent(
  outerDomRect: Rect,
  innerDomRect: Rect,
): {
  outerPercent: number;
  innerPercent: number;
} {
  function calculateOverlapArea(rect1: Rect, rect2: Rect) {
    // Check for no overlap
    if (
      rect1.right < rect2.left ||
      rect2.right < rect1.left ||
      rect1.bottom < rect2.top ||
      rect2.bottom < rect1.top
    ) {
      return 0;
    }

    // Calculate the overlapping region
    const xOverlap = Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left);
    const yOverlap = Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top);

    return xOverlap * yOverlap;
  }

  // Calculate the area of each rectangle.
  const areaOverlap = calculateOverlapArea(innerDomRect, outerDomRect);
  const areaOuter = outerDomRect.width * outerDomRect.height;
  const areaInner = innerDomRect.width * innerDomRect.height;

  const outerPercent = areaOverlap ? (areaOuter * 100) / areaOverlap : 0;
  const innerPercent = areaOverlap ? (areaInner * 100) / areaOverlap : 0;

  return {
    outerPercent,
    innerPercent,
  };
}

function isBoundedRect(outer: Rect, inner: Rect): boolean {
  const inRange = (num: number, lower: number, upper: number) => num >= lower && num <= upper;
  if (isEmptyRect(outer) || isEmptyRect(inner)) {
    return false;
  }
  return (
    inRange(inner.top, outer.top, outer.bottom) &&
    inRange(inner.bottom, outer.top, outer.bottom) &&
    inRange(inner.left, outer.left, outer.right) &&
    inRange(inner.right, outer.left, outer.right)
  );
}

/**
 * This includes margin and padding.
 */
function getOuterBoundingRect(elem: Element) {
  try {
    return wholeClientRect(elem.getBoundingClientRect());
  } catch (_err) {
    return EMPTY_DOC_RECT;
  }
}

/**
 * This includes margin and padding.
 */
function cumulativePositionRect(elemIn: Element, compStyle: CSSStyleDeclaration | null = null) {
  const result = getOuterBoundingRect(elemIn);
  // if (!isHtmlElement(elemIn)) {
  //   // MLB.com: if video is in iframe, then the <video> element doesn't test as an HTMLElement?!
  //   logerr(
  //       "cumulativePositionRect on Element that's not an HTMLElement",
  //       printNode(elemIn),
  //       elemIn,
  //   );
  //   return result;
  // }

  // always use initial position
  let top = 0;
  let left = 0;
  let eachElem = elemIn as HTMLElement; // see `elemIn instanceof HTMLElement` for iframe comment above
  do {
    const compStyleElem = getElemComputedStyle(eachElem); // $$$
    if (compStyleElem.position !== "absolute") {
      top += eachElem.offsetTop;
      left += eachElem.offsetLeft;
    }
    top += eachElem.scrollTop;
    left += eachElem.scrollLeft;
    eachElem = (eachElem.offsetParent ?? eachElem.parentElement) as HTMLElement;
  } while (isHtmlElement(eachElem));

  // transformOrigin special case. (WHY is getting the ACTUAL viewports
  // coordinates SO HARD?!?) transformOrigin is for pluto's tv guide section.
  // there's still "transform: translate()" not handled.
  if (compStyle?.transformOrigin) {
    const transform = parseTwoPixelsString(compStyle.transformOrigin);
    top += transform.top;
    left += transform.left;
    logtrace(
      `Detected transform-origin: "${compStyle.transformOrigin}" translated to {top: ${transform.top}, left: ${transform.left}}`,
    );
  }
  if (compStyle?.transform) {
    // "translate(100.1px, 202.202px) ..."
    const translate = parseTwoPixelsString(compStyle.transform);
    top += translate.top;
    left += translate.left;
    logtrace(
      `Detected transform: "${compStyle.transform}" translated to {top: ${translate.top}, left: ${translate.left}}`,
    );
  }
  if (compStyle?.translate) {
    // "translate(100.1px, 202.202px) ..."
    const translate = parseTwoPixelsString(compStyle.translate);
    top += translate.top;
    left += translate.left;
    logtrace(
      `Detected translate: "${compStyle.translate}" translated to {top: ${translate.top}, left: ${translate.left}}`,
    );
  }

  // result.height, result.width set already
  result.top = round(top);
  result.left = round(left);
  result.bottom = round(top + result.height);
  result.right = round(left + result.width);
  return result;
}

function smellsLikeMatch(elem: HTMLElement | Node | string, matches: RegExp[]) {
  try {
    const elementAttribsStr = printNode(elem).toLowerCase();
    if (elementAttribsStr?.length) {
      for (const eachMatch of matches) {
        if (eachMatch.test(elementAttribsStr)) {
          logtrace(`smellsLikeMatch true for "${elementAttribsStr}"`, eachMatch);
          return true;
        }
      }
    }
  } catch (err) {
    logtrace(`smellsLikeMatch err`, err);
  }
  return false;
}

const NEVERHIDEMATCHES = [
  /ytp-ad-module/i, // youtube "skip ad"
  /caption/i, // youtube cc
  /subtitles/i, // nbc cc
  /ccContainer/i, // pornhub cc
  /web-player-icon-resize/i, // tubi's non-508 playback
  /recaptcha\/api/i,
];

function isSpecialCaseNeverHide(elem: Node): boolean {
  return smellsLikeMatch(elem, NEVERHIDEMATCHES);
}

/**
 * @param _elem {Node}
 * @return {boolean}
 */
const isSpecialCaseNeverOverlap = (_elem: Node): boolean => false; // in theory more logic can go here.

/** optimization since the matches are called often - todo: move common an unit test */
const AdverRegex = /(?:^|\W|-)adver/gi;
const AdRegex = /[^a-zA-Z]ad[^a-zA-Z]|[^A-Z]Ad[^a-z]|^ad[^a-z]/g;
const BrandingRegex = /(?:^|\W|-)branding/gi;
const AdDomains = /[^a-zA-Z]adtng|tsyndicate|trafficjunky[^a-zA-Z]|googleapis/gi; // todo: move into editable list UX

// todo: move to common and add unittests
/**
 * Does NOT block ads.
 * Some specific rules where ads overlap videos and when we zoom them and
 * they permanently hide the main video.
 * Most sights do it right, but there some that don't.
 * @param elem {Node}
 */
function smellsLikeAdElem(elem: Node) {
  if (!isHtmlElement(elem)) {
    return false;
  }
  // regex /^(@)(\wadver)/ig)) <- means start of word
  const arialabel = getAttr(elem, "aria-label");
  if (arialabel?.match(AdverRegex)) {
    logtrace(`smellsLikeAdElem: matched aria-label for "adver" '${arialabel}'`);
    return true;
  }
  if (arialabel?.match(AdRegex)) {
    logtrace(`smellsLikeAdElem: matched aria-label for "ad-" '${arialabel}'`);
    return true;
  }
  const className = getAttr(elem, "class");
  if (className?.match(AdverRegex)) {
    logtrace(`smellsLikeAdElem: matched classname for "adver"? '${className}'`);
    return true;
  }
  if (className?.match(BrandingRegex)) {
    logtrace(`smellsLikeAdElem: atched classname for "branding"? '${className}'`);
    return true;
  }
  const title = getAttr(elem, "title");
  if (title?.match(AdverRegex)) {
    logtrace(`smellsLikeAdElem: matched title for "adver" '${title}'`);
    return true;
  }
  if (title?.match(AdRegex)) {
    logtrace(`smellsLikeAdElem: matched title for "ad-" '${title}'`);
    return true;
  }
  const src = getAttr(elem, "src");
  if (src?.match(AdDomains)) {
    logtrace(`smellsLikeAdElem: matched ad domain`);
    return true;
  }
  // some ad networks stick the urls in data- params.
  // watch for over-fitting.
  if (smellsLikeMatch(elem, [AdDomains])) {
    // smellsLikeMatch has a tracelog inside of it.
    return true;
  }
  return false;
}

/**
 * So. many. iframes on some sites (like > 150), early exit if they are too
 * small. Only works when injected into an iframe
 */
function earyExitForSmallIFrame(): boolean {
  if (!g_isRunningInIFrame) {
    return false;
  }
  // Running in iframe means.
  // window !== window?.parent

  if (document.childElementCount === 0) {
    logtrace(`Early exit when running in iframe w/out childElements `);
    return true;
  }

  // if (window.innerWidth < MIN_IFRAME_WIDTH || window.innerHeight < MIN_IFRAME_HEIGHT) {
  // if (window.outerWidth < MIN_IFRAME_WIDTH || window.outerHeight < MIN_IFRAME_HEIGHT) {
  if (
    document.body.scrollWidth < MIN_IFRAME_WIDTH ||
    document.body.scrollHeight < MIN_IFRAME_WIDTH
  ) {
    logtrace(
      `Early exit when running in small iframe 
      inner: ${window.innerWidth} x ${window.innerHeight} 
      outer: ${window.outerWidth} x ${window.outerHeight}
      document.body.scroll: ${document.body.scrollWidth} x ${document.body.scrollHeight}
      document url: "${document.URL}"`,
    );
    return true;
  }

  return false;
}

/**
 * commonContainerElem: pass in undefined to get whole doc
 */
function getAllElementsThatSmellsLikeControls(
  commonContainerElem: Element | Node | undefined | null,
): Element[] {
  if (!isHtmlElement(commonContainerElem)) {
    return [];
  }
  // the volume matcher can be tested on nbcnews.com/now
  // negative case test that matches ads on dailymail
  const topElem = commonContainerElem || window.document;

  try {
    const skipFilter = (el: Element) => !isSkippedNodeForCntl(el) && !smellsLikeAdElem(el);

    const matchesVolume = NO_SEARCHING_IGNORED_NODES_COMMON
      ? [...querySelectorAllFiltered(topElem, `input[type="range"]`, skipFilter)]
      : [...topElem.querySelectorAll(`input[type="range"]`)].filter(
          (e) =>
            !isSkippedNodeForCntl(e) && smellsLikeMatch(e, [/volume/i]) && !smellsLikeAdElem(e),
        );
    const matchesSlider = NO_SEARCHING_IGNORED_NODES_COMMON
      ? [...querySelectorAllFiltered(topElem, `[role="slider"]`, skipFilter)]
      : [...topElem.querySelectorAll(`[role="slider"]`)].filter(
          (e) => !isSkippedNodeForCntl(e) && !smellsLikeAdElem(e),
        );

    if (DEBUG_HIDENODE) {
      logtrace(
        `getAllElementsThatSmellsLikeControls for ${printNode(commonContainerElem)}
        matchesVolume: `,
        matchesVolume,
        `
        matchesSlider: `,
        matchesSlider,
      );
    }
    return [...matchesVolume, ...matchesSlider];
  } catch (err) {
    logtrace(err);
  }
  return [];
}

/**
 * Used when the matched video is a <video> (vs in iframe)
 */
function maximizeVideoDomAndCntrls() {
  if (!g_videomaxGlobals.matchedVideo) {
    return;
  }
  SANITY_CHECK_MATCH_NOT_DELETED();

  {
    // experiment. ANY elements overlapping video and the same ~ size are all maximized.
    // The goal is to zoom overlapping ads.
    if (STACKING_ORDER_WEIGHT && !g_isRunningInIFrame) {
      debugger;
      const visVideos = findVideosIFramesAtCenter(g_videomaxGlobals.matchedVideo);
      for (const eachVisVideo of visVideos) {
        const isAd = smellsLikeAdElem(eachVisVideo);
        maximizeUpFromVideo(eachVisVideo, isAd ? OVERLAP_CSS_CLASS : MAX_CSS_CLASS);
      }
    }
  }
  maximizeUpFromVideo(g_videomaxGlobals.matchedVideo, MAX_CSS_CLASS);
  const commonContainerElem = findCommonContainerFromMatched(g_videomaxGlobals.matchedVideo);

  if (isHtmlElement(commonContainerElem)) {
    // now we try to find playback controls that may have been missed.
    // <input type="range" class="styles_volumeSlider__gCfqY" min="-50" max="0"
    // step="0.5" value="-50" style="--volume: 0%;">
    if (DO_HIDE_EXCEPTION_CHECK) {
      // pass in undefined to get all for whole document.
      const matches = getAllElementsThatSmellsLikeControls(
        USE_WHOLE_WINDOW_TO_SEARCH_FOR_CONTROLS ? undefined : commonContainerElem,
      );
      for (const elem of matches) {
        // walk up to common and make sure we don't hide. We do this by adding
        // an empty videeomax style class (wistia)
        ReApplyUpFromElem(elem, NO_HIDE_CLASS, commonContainerElem);
      }
    }

    for (const eachElem of [...commonContainerElem?.children]) {
      addOverlapCtrl(eachElem); // does additional checks before adding
    }
  }

  // ANY siblings to the <video> should always just be considered overlapping
  // (crunchyroll's CC canvas
  if (
    (FIND_CONTROLS_ON_MAIN_THREAD_FOR_IFRAME_MATCH && !g_isRunningInIFrame) ||
    isVideoElement(g_videomaxGlobals.matchedVideo)
  ) {
    const videoSiblings = getSiblings(g_videomaxGlobals.matchedVideo);
    for (const eachElem of videoSiblings) {
      addOverlapCtrl(eachElem); // does additional checks before adding
    }
  }

  const videoElem = g_videomaxGlobals.matchedVideo; // readability
  exceptionToRuleFixup(getOwnerDoc(videoElem), videoElem);
  if (EXCEPTIONTORULE_FIXUP_FOR_WHOLE_DOC) {
    const { document, element } = getTopDocumentForIFrameBreakOut(videoElem);
    if (element !== videoElem) {
      logtrace("exceptionToRuleFixup followup");
      exceptionToRuleFixup(document, element);
    }
  }

  document.body.classList.add(MAX_CSS_CLASS);
}

class ElemMatcherClass {
  private largestElem: Element | HTMLIFrameElement | undefined = undefined;

  private allElemsSet: Set<Element | HTMLIFrameElement> = new Set();

  private largestScore = 0;

  private matchCount = 0;

  getBestMatch = () => this.largestElem;

  getLargestScore = () => this.largestScore;

  getMatchCount = () => this.matchCount; // should be 1 for most case

  /**
   * @return True means done
   */
  checkIfBest = (elem: Element | HTMLElement | HTMLIFrameElement | undefined) => {
    if (!elem) {
      return false;
    }
    if (this.largestElem && elem.isSameNode(this.largestElem)) {
      logtrace("  Matched element same element");
      return true;
    }
    if (
      this.largestElem &&
      parentElement(this.largestElem) !== null &&
      elem.isSameNode(parentElement(this.largestElem))
    ) {
      logtrace("  Matched element same as parent.");
      return true;
    }
    // if (this.checkedDedup.includes(elem)) {
    //   logtrace("Matched element already checked.");
    //   return false;
    // }
    // this.checkedDedup.push(elem);

    const elemStyle = getElemComputedStyle(elem);
    const score = this.getElemMatchScore(elem, elemStyle);
    if (EMBED_SCORES) {
      setAttr(elem, EMBEDED_SCORES, score.toString());
      logtrace(score.toString());
    }

    if (score === 0) {
      return false;
    }

    // record iframe domains for permissions to inject speed and skipping.
    if (isIFrameElem(elem)) {
      try {
        if (elem.src?.length) {
          if (!window._videomax_permissionCheckDomains) {
            window._videomax_permissionCheckDomains = [];
          }

          const domain = getDomain(elem.src);

          // we stick in in the dom, so the injectCheckPermissions can access.
          const domainliststr =
            document.body.getAttribute(PERMISSIONS_CHECK_DOMAINS_DOC_ATTR) ?? "";
          const resultdomainliststr = addDomainToList(domainliststr, domain);

          if (resultdomainliststr !== domainliststr) {
            document.body.setAttribute(PERMISSIONS_CHECK_DOMAINS_DOC_ATTR, resultdomainliststr);
            logtrace(
              `permissionCheckDomains added "${domain}" \ncurrent list: ${resultdomainliststr}`,
            );
          }
        }
      } catch (err) {} // err might be security related
    }

    if (score > this.largestScore) {
      if (BREAK_ON_BEST_MATCH) {
        // eslint-disable-next-line no-debugger
        debugger;
      }
      // special case when we can dig down through iframes and find videos
      logtrace(`setting new best: score: ${score}, elem: `, elem);
      this.largestScore = score;
      this.largestElem = elem;
      this.matchCount = 1;
      logtrace(
        `Making item best match: \t${elem?.nodeName}\t${elem?.className?.toString()}\t${elem?.id}`,
      );
      return true;
    }

    if (score === this.largestScore) {
      logtrace(
        `same score: ${score}, favoring on that came first. Total count: ${this.matchCount} elem: `,
        elem,
      );
      this.matchCount++;
      return true;
    }
    return false;
  };

  /**
   *   weight for videos that are the right ratios!
   *   16:9 == 1.77_  4:3 == 1.33_  3:2 == 1.50
   */
  private getElemDimensions = (
    elem: Element,
    compStyle: CSSStyleDeclaration,
  ): {
    width: number;
    height: number;
  } => {
    if (!elem) {
      logerr("empty element gets score of zero");
      return {
        width: 0,
        height: 0,
      };
    }
    let width = 0;
    let height = 0;

    if (!compStyle?.width || !compStyle?.height) {
      logerr("Could NOT load computed style for element so score is zero", elem);
      return {
        width,
        height,
      };
    }

    // make sure the ratio is reasonable for a video.
    width = safeParseFloat(compStyle.width);
    height = safeParseFloat(compStyle.height);
    if (!width || !height) {
      logtrace("width or height zero. likely hidden element", elem);
      return {
        width: 0,
        height: 0,
      };
    }

    if (width < 100 || height < 75) {
      logtrace("width or height too small so no score", elem);
      return {
        width: 0,
        height: 0,
      };
    }

    logtrace(`Found width/height for elem. width=${width}px height=${height}px`, elem);
    return {
      width,
      height,
    };
  };

  private getElemMatchScore = (elem: HTMLElement | Element, compStyle: CSSStyleDeclaration) => {
    if (!elem) {
      return 0;
    }

    // element dimensions work for iframes. videoWidth/Height give quality of video (it may be bigger than width/height)
    // but doesn't work if element is buried in an iframe.
    let width = 0,
      height = 0;
    if (isVideoElement(elem)) {
      logtrace(`*Using new way to measure video dimentions. WATCH FOR ISSUE*`);
      width = elem.videoWidth ?? 0;
      height = elem.videoHeight ?? 0;
    }
    if (width === 0 || height === 0) {
      const elemDimensions = this.getElemDimensions(elem, compStyle);
      width = elemDimensions.width;
      height = elemDimensions.height;
    }
    if (width < MIN_VIDEO_WIDTH || height < MIN_VIDEO_HEIGHT) {
      logtrace(
        `getElemMatchScore: fail. Element too small 
        MIN_VIDEO_WIDTH: ${width} < ${MIN_VIDEO_WIDTH} 
        IN_VIDEO_HEIGHT: ${height} < ${MIN_VIDEO_HEIGHT}`,
        elem,
      );
      return 0;
    }

    // videos may be constrained by the iframe or window.
    const doc = getElemsDocumentView(elem);

    const minWidth = isAllowSmallVideosSite() ? MIN_ALLOWED_VIDEO_WIDTH : MIN_VIDEO_WIDTH;
    const minHeight = isAllowSmallVideosSite() ? MIN_ALLOWED_VIDEO_HEIGHT : MIN_VIDEO_HEIGHT;
    if (
      !doc ||
      ((width < minWidth || height < minHeight) && // too small
        doc.outerWidth > minWidth &&
        doc.outerHeight > minHeight)
    ) {
      /// / we allow really small on some sites.
      logtrace(
        `\tWidth or height too small, skipping other checks
        width: ${width} < ${minWidth} (minHeight)
        width: ${height} < ${minHeight} (minWidth)`,
        elem,
      );
      return 0;
    }

    // twitch allows videos to be any random size. If the width & height of
    // the window are too short, then we can't find the video.
    if (elem.id === "live_site_player_flash") {
      logtrace("Matched twitch video. Returning high score.");
      return 3000000;
    }
    const isdoomscrollingsite = isDoomScrollingSite();
    const traceweights = [""]; // start with blankline. turned into logtrace message
    g_videomaxGlobals.matchCounter++;

    // Found an html5 video tag not iframe
    const isVideoElem = isVideoElement(elem);
    const isHtmlElem = isHtmlElement(elem);
    let weight = 0;

    if (EMBED_SCORES) {
      const elemStr = printNode(elem);
      const id = dbgFrameName();
      traceweights.push(`===========================\n${id}\n${elemStr}\n`);
      traceweights.push(`START_WEIGHT: ${START_WEIGHT}`);
      traceweights.push(`\tWidth: ${width}  Height: ${formatInt(height)}`);

      const elemBounds = cumulativePositionRect(elem, compStyle);
      traceweights.push(
        `\t cumulativePositionRect top: ${elemBounds.top}  left: ${elemBounds.left}   bottom: ${elemBounds.bottom}    right:${elemBounds.right}`,
      );
      traceweights.push(
        `\tdoc.outerWidth: ${doc?.outerWidth || 0} ${formatFloat(
          (width * 100) / (doc?.outerWidth || 0.001),
        )}%`,
      );
    }

    {
      const inverseDist = getVideoRatioWeight(width, height);
      const videoSizeWeight = round(Math.log2(width * height));

      weight += START_WEIGHT * inverseDist * RATIO_WEIGHT;
      weight += START_WEIGHT * videoSizeWeight * SIZE_WEIGHT; // bigger is worth
      // more
      if (EMBED_SCORES) {
        traceweights.push(
          `  inverseDist: RATIO_WEIGHT: ${formatInt(
            START_WEIGHT * inverseDist * RATIO_WEIGHT,
          )} \t Weight:${RATIO_WEIGHT}`,
        );
        traceweights.push(
          `  dimensions: SIZE_WEIGHT: ${formatInt(
            START_WEIGHT * videoSizeWeight * SIZE_WEIGHT,
          )} \t Weight:  ${SIZE_WEIGHT}`,
        );
      }

      // this also uses the ratio.
      if (IN_VIEW_WEIGHT !== 0) {
        // const visualViewport = getViewportRect();
        const viewport: Rect = {
          top: 0,
          left: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
          width: window.innerWidth,
          height: window.innerHeight,
        };
        const elemBoundingClientRect = DOMRectToRect(elem.getBoundingClientRect());

        const { outerPercent, innerPercent } = getOverlapPercent(viewport, elemBoundingClientRect);

        if (outerPercent > 0.0) {
          const addWeight =
            START_WEIGHT *
              IN_VIEW_WEIGHT *
              (normlizedSigmoid(outerPercent) * videoSizeWeight * SIZE_WEIGHT) +
            normlizedSigmoid(innerPercent) * videoSizeWeight * SIZE_WEIGHT;

          if (EMBED_SCORES) {
            traceweights.push(
              `IN_VIEW_WEIGHT: ${formatInt(addWeight)} ` +
                `\r\n\t visualViewport: ${printRect(viewport)}` +
                `\r\n\t elemBounds: ${printRect(elemBoundingClientRect)} ` +
                `\r\n\t outerPercent: ${formatFloat(outerPercent)} normlizedSigmoid: ${formatFloat(normlizedSigmoid(outerPercent))}` +
                `\r\n\t innerPercent:${formatFloat(innerPercent)} normlizedSigmoid: ${formatFloat(normlizedSigmoid(innerPercent))}` +
                `\r\n\t in ${g_isRunningInIFrame ? "iFrame (may be 1.0 for iframe)" : "Main"}`,
            );
          }

          weight += addWeight;
        }

        if (NEAR_CENTER_WEIGHT !== 0 && !g_isRunningInIFrame) {
          // "How close" is the center of the screen to the center of the video? (NOT the other way around)
          // Closeness cares about how big the video is.
          // To do this we:
          //   1. Verify the center of the screen is inside the bounds of the video.
          //   2. Draw a line from the center of the video, passing through the center screen until it reaches
          //        the edge of the video.
          //   3. Measure the length of the line from video center to video edge and from video center to screen center
          //   4. The "closeness" is a ratio of these distances.
          const centerViewport = centerDomRect(viewport);
          if (pointIsInRect(centerViewport, elemBoundingClientRect)) {
            const distantPoint = pointOnRect(centerViewport, elemBoundingClientRect);
            const centerElem = centerDomRect(elemBoundingClientRect);
            const d1 = distance(centerElem, centerViewport);
            const d2 = distance(centerElem, distantPoint);
            // centerweith is always 0-1.0. Closer to zero is better.
            const ratio = d1 / d2;
            const centerweight = 1.0 - ratio; // invert closer to zero is better

            if (EMBED_SCORES) {
              traceweights.push(
                `\tNEAR_CENTER_WEIGHT: ` +
                  `${formatInt(centerweight * NEAR_CENTER_WEIGHT * START_WEIGHT)} ` +
                  `\t centerweight: ${formatFloat(centerweight)} ` +
                  `\t inverseDist:${formatFloat(inverseDist)}` +
                  `\t viewportX: ${formatFloat(centerViewport.x)} viewportY: ${formatFloat(centerViewport.y)}`,
                `\t ratio: ${formatFloat(ratio)}` +
                  `\t centerweight: ${formatFloat(centerweight)}` +
                  `\t weight increase: ${Math.round(centerweight * NEAR_CENTER_WEIGHT * START_WEIGHT)}`,
              );
            }
            weight += Math.round(centerweight * NEAR_CENTER_WEIGHT * START_WEIGHT);
          }
        }

        if (STACKING_ORDER_WEIGHT && !g_isRunningInIFrame) {
          // ads are often stacked over the top of main video
          const visVideos = findVideosIFramesAtCenter(
            getOwnerDoc(elem).body,
            centerDomRect(elemBoundingClientRect),
          );
          let stacking_weight = 0;
          // the deeper the better, ads are typically on top
          for (const eachVisVideo of visVideos) {
            stacking_weight += STACKING_ORDER_WEIGHT * START_WEIGHT;
            if (elem.isEqualNode(eachVisVideo)) {
              // ONLY assign if we find the element in the stack.
              if (EMBED_SCORES) {
                traceweights.push(`\tNEAR_CENTER_WEIGHT: ` + `${formatInt(stacking_weight)}`);
              }
              weight += stacking_weight;
            }
          }
        }
      }
    }

    // if (!isdoomscrollingsite) {
    //   if (EMBED_SCORES) {
    //     traceweights.push(
    //         `  ORDER_WEIGHT: ${formatInt(
    //             START_WEIGHT * g_videomaxGlobals.matchCounter * ORDER_WEIGHT,
    //         )} Order: ${g_videomaxGlobals.matchCounter} Weight:${ORDER_WEIGHT}`,
    //     );
    //   }
    //   weight += START_WEIGHT * g_videomaxGlobals.matchCounter * ORDER_WEIGHT;
    // }

    // try to figure out if iframe src looks like a video link.
    // frame shaped like videos?
    if (isIFrameElem(elem)) {
      if (DEV_MODE && !isIFrameElemMeetsRequirements(elem)) {
        logtrace("isIFrameElemMeetsRequirements is false, should skipping! (NEW)", printNode(elem));
        return 0;
      }
      const src = elem.getAttribute("src") ?? "";

      for (const eachMatch of DO_NOT_MATCH_IFRAME_SRC) {
        if (eachMatch.test(src)) {
          logtrace(`DO_NOT_MATCH_IFRAME_SRC true for "${src}" Old weight=${weight}`, eachMatch);
          return 0;
        }
      }
    }

    if (compStyle?.zIndex && ZINDEX_WEIGHT) {
      // espn makes the zindex for ads crazy large and breaks things, cap it.
      const zindex = Math.min(safeParseInt(compStyle?.zIndex), 100);
      if (EMBED_SCORES) {
        traceweights.push(
          `  ZINDEX_WEIGHT: ${formatInt(
            START_WEIGHT * zindex * ZINDEX_WEIGHT,
          )} \t Weight: ${ZINDEX_WEIGHT}`,
        );
      }
      weight += START_WEIGHT * zindex * ZINDEX_WEIGHT; // zindex is tricky,
      // could be "1" or
      // "1000000"
    }

    if (
      isVideoElem &&
      (compStyle?.visibility.toLowerCase() === "hidden" ||
        compStyle?.display.toLowerCase() === "none" ||
        compStyle?.opacity === "0" ||
        elem?.offsetParent === null ||
        safeParseInt(compStyle?.width) === 0 ||
        safeParseInt(compStyle?.height) === 0)
    ) {
      // Vimeo hides video before it starts playing (replacing it with a
      // static image), so we cannot ignore hidden. But UStream's homepage
      // has a large hidden flash that isn't a video.
      if (EMBED_SCORES) {
        traceweights.push(
          `  HIDDEN_VIDEO_WEIGHT: ${formatInt(
            START_WEIGHT * HIDDEN_VIDEO_WEIGHT,
          )} \t Weight:${HIDDEN_VIDEO_WEIGHT}`,
        );
        traceweights.push(
          `\tvisibility: '${compStyle?.visibility}'\n` +
            `\tdisplay: '${compStyle?.display}' \n` +
            `\topacity: '${compStyle?.opacity}'`,
        );
      }
      weight += START_WEIGHT * HIDDEN_VIDEO_WEIGHT;
    }

    if (!isdoomscrollingsite) {
      const tabindex = getAttr(elem, "tabindex");
      if (TAB_INDEX_WEIGHT !== 0.0 && tabindex !== null) {
        // this is a newer thing for accessibility, it's a good indicator
        if (EMBED_SCORES) {
          traceweights.push(
            `  TAB_INDEX_WEIGHT: ${formatInt(
              -1 & (START_WEIGHT * TAB_INDEX_WEIGHT),
            )}\t Weight: ${TAB_INDEX_WEIGHT}`,
          );
        }
        weight += -1 * START_WEIGHT * TAB_INDEX_WEIGHT;
      }
    }

    const allowfullscreenAttr = getAttr(elem, "allowfullscreen");
    if (allowfullscreenAttr !== null) {
      if (EMBED_SCORES) {
        traceweights.push(
          `  ALLOW_FULLSCREEN_WEIGHT: ${formatInt(
            START_WEIGHT * ALLOW_FULLSCREEN_WEIGHT,
          )} \t Weight: ${ALLOW_FULLSCREEN_WEIGHT}`,
        );
      }
      weight += START_WEIGHT * ALLOW_FULLSCREEN_WEIGHT;
    }

    if (smellsLikeAdElem(elem)) {
      // don't hide ads, but we dont' want to match them as main videos
      // ADVERTISE_WEIGHT is Neg
      if (EMBED_SCORES) {
        traceweights.push(
          `  ADVERTISE_WEIGHT: ${formatInt(
            START_WEIGHT * ADVERTISE_WEIGHT,
          )} \t  Weight: ${ADVERTISE_WEIGHT}`,
        );
      }
      g_videomaxGlobals.ads.add(elem);
      weight += START_WEIGHT * ADVERTISE_WEIGHT; // negative weight
    }

    if (isVideoElem) {
      const videoElem: HTMLMediaElement = elem;
      if (EMBED_SCORES) {
        traceweights.push(
          `  VIDEO_OVER_IFRAME_WEIGHT: ${formatInt(
            START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT,
          )} \t  Weight: ${VIDEO_OVER_IFRAME_WEIGHT}`,
        );
      }
      weight += START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT;

      // if a video, lets see if it's actively playing
      if (!videoElem.paused && videoElem?.ended === false) {
        let playingWeight = VIDEO_PLAYING_WEIGHT;
        if (DOOMSCROLL_PLAYING_BOOST_FACTOR > 1.0 && isdoomscrollingsite) {
          playingWeight = VIDEO_PLAYING_WEIGHT * DOOMSCROLL_PLAYING_BOOST_FACTOR;
        }
        if (EMBED_SCORES) {
          traceweights.push(
            `  VIDEO_PLAYING: Weight:${formatInt(
              START_WEIGHT * playingWeight,
            )} \t weight: ${playingWeight} \t Paused:${videoElem.paused} \t Ended: ${
              videoElem.ended
            }`,
          );
        }
        weight += START_WEIGHT * playingWeight;
      }

      // video length, cap at 2hrs
      const duration = Math.min(videoElem?.duration || 0, MAX_DURATION_SECS);
      if (EMBED_SCORES) {
        traceweights.push(
          `  VIDEO_DURATION: ${formatInt(
            START_WEIGHT * VIDEO_DURATION_WEIGHT * duration,
          )} \t Weight: ${VIDEO_DURATION_WEIGHT} \t Duration:${formatInt(duration)}s`,
        );
      }
      weight += START_WEIGHT * VIDEO_DURATION_WEIGHT * duration;

      // looping downgrades
      if (videoElem?.loop) {
        if (EMBED_SCORES) {
          traceweights.push(
            `  VIDEO_NO_LOOP_WEIGHT:${formatInt(
              START_WEIGHT * VIDEO_LOOPS_WEIGHT,
            )} \t weight: ${VIDEO_LOOPS_WEIGHT} \t loop:${videoElem.loop}`,
          );
        }
        weight += START_WEIGHT * VIDEO_LOOPS_WEIGHT;
      }

      // has audio
      if (VIDEO_HAS_SOUND_WEIGHT && !videoElem.muted) {
        let hasSoundWeight = VIDEO_HAS_SOUND_WEIGHT;
        if (DOOMSCROLL_UNMUTED_BOOST_FACTOR > 1.0 && isDoomScrollingSite()) {
          hasSoundWeight = VIDEO_HAS_SOUND_WEIGHT * DOOMSCROLL_UNMUTED_BOOST_FACTOR;
        }

        if (EMBED_SCORES) {
          traceweights.push(
            `  VIDEO_HAS_SOUND_WEIGHT:${formatInt(
              START_WEIGHT * hasSoundWeight,
            )} \t weight: ${hasSoundWeight} \t muted:${videoElem.muted} ` +
              `\t isDoomScrollingSite: ${isDoomScrollingSite() ? "true" : "false"}`,
          );
        }
        weight += START_WEIGHT * hasSoundWeight;
      }
    }

    if (!g_isRunningInIFrame) {
      if (EMBED_SCORES) {
        traceweights.push(
          `  MAIN_FRAME_WEIGHT (running in main) MAIN_FRAME_WEIGHT:${formatInt(
            START_WEIGHT * MAIN_FRAME_WEIGHT,
          )} \t weight: ${MAIN_FRAME_WEIGHT} `,
        );
      }
      weight += START_WEIGHT * MAIN_FRAME_WEIGHT;
    }

    // does the video source url look kinda close to the page url?
    // todo: better string proximity calc is probably needed
    if (!isdoomscrollingsite) {
      try {
        const pageUrl = getPageUrl();
        if (
          isVideoElem &&
          pageUrl?.length &&
          (pageUrl.startsWith("https://") || pageUrl.startsWith("blob:https://"))
        ) {
          // no see if we can get this video's source.
          let elemUrl = elem?.src || "";
          if (elemUrl === "") {
            // sometimes there's a <video><source src=""></video> approach.
            // this is used when there might be different data formatting
            // available for the same video (e.g. one for video/mp4 and another
            // for video/webm). if a site is going through this much work, it's
            // probably NOT an ad.
            const matchedSources = elem.getElementsByTagName("source");
            if (matchedSources.length > 0) {
              // there may be multiple, but they are likely very simailar.
              elemUrl = matchedSources[0].src || "";
            }
          }
          if (
            elemUrl.length &&
            (elemUrl.startsWith("https://") || elemUrl.startsWith("blob:https://"))
          ) {
            const overlapRatio = customDiceCoefficient(pageUrl, elemUrl);

            if (EMBED_SCORES) {
              // maybe a standard algo is better?
              const diceRatio = diceCoefficient(pageUrl, elemUrl);
              traceweights.push(
                `  URL_OVERLAP_WEIGHT: ${formatInt(
                  START_WEIGHT * URL_OVERLAP_WEIGHT * overlapRatio,
                )} ` +
                  `\t Weight: ${URL_OVERLAP_WEIGHT}` +
                  `\t OverlapRatio:${formatFloat(overlapRatio)} ` +
                  `\t Dice distance: ${formatFloat(diceRatio)}`,
              );
            }
            weight += START_WEIGHT * URL_OVERLAP_WEIGHT * overlapRatio;

            const urlParts = splitUrlWords(elemUrl);
            const negOverlapCount = getOverlapCount(["disqus"], urlParts);
            if (EMBED_SCORES && negOverlapCount) {
              traceweights.push(
                `  URL_OVERLAP_WEIGHT - "disqus" (neg): ${formatInt(
                  START_WEIGHT * URL_OVERLAP_WEIGHT * negOverlapCount,
                )} \t Weight: -${URL_OVERLAP_WEIGHT} \t Count:${negOverlapCount}`,
              );
            }
            weight -= START_WEIGHT * URL_OVERLAP_WEIGHT * negOverlapCount;
          }
        }
      } catch (err) {
        // iframes can throw when you try to read their url, just keep going
        // and ignore
        logtrace("URL_OVERLAP_WEIGHT failed because of security block?", err);
      }
    }

    if (isHtmlElem && !isdoomscrollingsite) {
      try {
        const titleELem = (elem?.title ?? elem?.ariaLabel ?? "").toLowerCase();
        const titlePage = window.document?.title.toLowerCase() || "";
        const dice = diceCoefficient(titleELem, titlePage);
        const titleParts = splitUrlWords(window.document?.title.toLowerCase() || "");
        const elemParts = splitUrlWords(printNode(elem).toLowerCase());
        const overlap = getOverlapCount(titleParts, elemParts);
        const overlapRatio = overlap / (titleParts.length || 1);
        if (EMBED_SCORES) {
          traceweights.push(
            `TITLE_OVERLAP_WEIGHT: ` +
              `${formatInt(START_WEIGHT * TITLE_OVERLAP_WEIGHT * overlapRatio)} ` +
              `\t weight: ${TITLE_OVERLAP_WEIGHT} ` +
              `\t Count:${overlap} ` +
              `\t OverlapRatio:${formatFloat(overlapRatio)}` +
              `\t Dice distance: ${formatFloat(dice)}`,
          );
        }
        weight += START_WEIGHT * TITLE_OVERLAP_WEIGHT * overlapRatio;
      } catch (err) {
        logerr(err);
      }
    }

    weight = Math.round(weight);
    if (DEV_MODE) {
      if (Number.isNaN(weight)) {
        logerr("======weight got corrupted======");
      }
    }
    if (EMBED_SCORES) {
      traceweights.push(`FINAL WEIGHT: ${formatInt(weight)}`);
      const result = traceweights.join("\n\t");
      logtrace("*** weight for element***", result, elem);
      appendUnitTestResultInfo(result);
    }
    return weight;
  };
}

/**
 * <header><footer>, etc are always hidden.
 * Some sites (hclips) will force the header back by re-modifying the class
 * @param doc {Document}
 */
function alwaysHideSomeElements(doc: Document = document) {
  if (!isFunction(doc?.getElementsByTagName)) {
    // this might fair if the doc is an iframe across domains
    return;
  }
  logtrace(`alwaysHideSomeElements`);
  for (const eachtag of ALWAYS_HIDE_NODES) {
    const elems = doc.getElementsByTagName(eachtag);
    for (const elem of elems) {
      if (DEBUG_HIDENODE) {
        logtrace(`ALWAYS_HIDE_NODES "${eachtag}"`, elem);
      }
      hideNode(elem);
    }
  }
  const navItems = doc?.querySelectorAll(`:not([class*="${PREFIX_CSS_CLASS}"])[role="navigation"]`);
  const toolbarItems = doc?.querySelectorAll(
    `:not([class*="${PREFIX_CSS_CLASS}"])[role="toolbar"]`,
  );
  for (const eachElem of [...navItems, ...toolbarItems]) {
    if (DEBUG_HIDENODE) {
      logtrace(`ALWAYS_HIDE_NODES [role="navigation"]`, eachElem);
    }
    hideNode(eachElem);
  }
}

function saveAllScrollPositions() {
  if (!g_walker) {
    return;
  }
  const savedWalkerNode = g_walker.currentNode;
  g_walker.currentNode = document;
  let countTop = 0;
  let countLeft = 0;
  try {
    do {
      try {
        // g_walker filters out non HTMLElements.
        const current = g_walker.currentNode as HTMLElement;
        if (current.scrollTop) {
          setAttr(current, SAVED_SCROLL_TOP_ATTR, String(current.scrollTop));
          countTop++;
        }
        if (current.scrollLeft) {
          setAttr(current, SAVED_SCROLL_LEFT_ATTR, String(current.scrollLeft));
          countLeft++;
        }
      } catch (err) {
        // keep going
        logerr("saveAllScrollPositions: inner error:", err);
      }
    } while (g_walker.nextNode());
    logtrace(`saveAllScrollPositions: saved counts top:${countTop} left:${countLeft}`);
  } catch (err) {
    logerr("saveAllScrollPositions: function error", err);
  }
  g_walker.currentNode = savedWalkerNode;
}

function restoreAllSrollPositions() {
  // on scroll events should be stopped
  // need to make this more generic and remove dup code `{top}` vs `{left}`
  // makes tricky
  {
    const topScrolledElems = [...document.querySelectorAll(`[${SAVED_SCROLL_TOP_ATTR}]`)].reverse();
    for (const eachElem of topScrolledElems) {
      const pos = Number(getAttr(eachElem, SAVED_SCROLL_TOP_ATTR) ?? 0);
      removeAttr(eachElem, SAVED_SCROLL_TOP_ATTR);
      if (eachElem?.scrollTo) {
        try {
          eachElem.scrollTo({ top: pos });
          logtrace(`restoreAllSrollPositions top: ${pos} for elem ${printNode(eachElem)}`);
        } catch (err) {}
      }
    }
  }
  {
    const leftScrolledElems = [
      ...document.querySelectorAll(`[${SAVED_SCROLL_LEFT_ATTR}]`),
    ].reverse();
    for (const eachElem of leftScrolledElems) {
      const pos = Number(getAttr(eachElem, SAVED_SCROLL_LEFT_ATTR)) || 0;
      removeAttr(eachElem, SAVED_SCROLL_LEFT_ATTR);
      if (eachElem?.scrollTo) {
        try {
          eachElem.scrollTo({ left: pos });
          logtrace(`restoreAllSrollPositions left: ${pos} for elem ${printNode(eachElem)}`);
        } catch (err) {}
      }
    }
  }
}

/**
 * The LAST step of zooming is ot flip all the "videomax-ext-prep-*" to
 * videomax-ext-*" The reason for this is that if the css is already
 * injected, then trying to measure client rects gets messed up if we're
 * modifying classNames as we go.
 */
function flipCss(
  doc: Document = document,
  cssClassMatch = PREFIX_CSS_CLASS_PREP,
  replaceFrom: string = "-prep-",
  replaceTo: string = "-",
) {
  if (!isFunction(doc?.querySelectorAll)) {
    // security can block
    logtrace(`flipCssRemovePrep: doc?.querySelectorAll) !== "function"`);
    return 0;
  }
  const allElementsToFix = doc.querySelectorAll(`[class*="${cssClassMatch}"]`);
  const count = allElementsToFix.length;
  // that matches PREFIX_CSS_CLASS_PREP
  for (const eachElem of allElementsToFix) {
    try {
      // we are generically mapping "videomax-ext-prep-*" to videomax-ext-*"
      const subFrom = [];
      const subTo = [];
      const allClassNameOnElem = Object.values(eachElem.classList) || [];
      for (const eachClassName of allClassNameOnElem) {
        if (eachClassName.startsWith(cssClassMatch)) {
          // remove '-prep' from the classname, '-prep-' => '-'
          const replacementClassName = eachClassName.replace(replaceFrom, replaceTo);
          // because we're iterating, don't modify until we're done
          subFrom.push(eachClassName);
          subTo.push(replacementClassName);
        }
      }
      // classList supports bulk adding and removing if we expand parameters
      // out.
      if (subFrom.length) {
        eachElem.classList.remove(...subFrom);
        eachElem.classList.add(...subTo);
      }
      // some sites muck with the style
      // Hack: This crazy thing happens on some sites (dailymotion) where
      // our resizing the video triggers scripts to run that muck with the
      // element style, so we're going to save and restore that style so
      // the undo works. We apply when we flip the classNames so we don't
      // zero size things as we're finding playback controls.
      // `cssClassMatch` is checked when this function was made more generic.
      if (cssClassMatch === PREFIX_CSS_CLASS_PREP && subFrom.includes(MAX_CSS_CLASS)) {
        if (REMOVE_STYLE_FROM_ELEMS) {
          // removes after saving off
          backupAttr(eachElem, "style");
        }
      }
    } catch (err) {
      logerr("flipCssRemovePrep", err);
    }
  }
  return count;
}

function flipCssRemovePrep(doc: Document) {
  return flipCss(doc, PREFIX_CSS_CLASS_PREP, "-prep-", "-");
}

function flipCssAddPrep(doc: Document) {
  // prevent '-prep-prep-'
  flipCss(doc, PREFIX_CSS_CLASS_PREP, "-prep-", "-");

  return flipCss(doc, `${PREFIX_CSS_CLASS}-`, `${PREFIX_CSS_CLASS}-`, `${PREFIX_CSS_CLASS_PREP}-`);
}

function recursiveIFrameFlipClassPrep(docOrIFrame: Document | HTMLIFrameElement) {
  try {
    if (getVideomaxCmd() === "unzoom") {
      logtrace("UNZOOMING! skipping recursiveIFrameFlipClassPrep");
      return;
    }
    if (isDocument(docOrIFrame)) {
      flipCssRemovePrep(docOrIFrame);
      return;
    }

    if (!isIFrameElem(docOrIFrame) || !isFunction(docOrIFrame.querySelectorAll)) {
      // security can block
      return;
    }
    const allIFrames = docOrIFrame.querySelectorAll("iframe");
    for (const frame of allIFrames) {
      try {
        const framedoc = frame?.contentDocument;
        if (!framedoc) {
          continue;
        }
        flipCssRemovePrep(framedoc);
        recursiveIFrameFlipClassPrep(framedoc);
      } catch (err) {
        // probably cross-domain frame boundary issue
      }
    }
  } catch (err) {
    // probably cross-domain frame boundry issue
  }
}

/**
 * SPA nav: we might not match videos, so we quickly flip all the videomax classes back to prep
 * This will restore the page's look in case the zoom fails to find a matching video.
 * This case can be tested with tubi.
 *   Start on scrolling page: https://tubitv.com/category/anime
 *   Click video link
 *   Start playing
 *   Zoom
 *   Nav backwards
 *   Result: scrolling list should still scroll
 */
function spaNonMatchFlipClasses() {
  // if we think we're running, then unflip
  const attr = document?.body?.getAttribute(VIDEO_MAX_INSTALLED_ATTR) ?? "";
  const thinksInstalled = attr?.length > 0;
  if (thinksInstalled) {
    flipCssAddPrep(document);
  }
}

function fixUpPageZoom() {
  if (!documentLoaded()) {
    return false;
  }
  if (g_videomaxGlobals.tagonly) {
    return false;
  }
  if (getVideomaxCmd() === "unzoom") {
    logtrace("UNZOOMING?!?");
    return false;
  }

  if (!g_videomaxGlobals.matchedVideo) {
    logerr("maxGlobals.matchedVideo empty");
    return false;
  }

  maximizeVideoDomAndCntrls();

  fixUpAttribs(g_videomaxGlobals.matchedVideo);

  // going to return true, so we redo this since
  // some sites re-show these elements, hide again to be safe
  const doRehideTimeoutLoop = (rehideOneMoreTime = false) => {
    if (getVideomaxCmd() === "unzoom") {
      logtrace("UNZOOMING! - skipping doRehideTimeoutLoop");
      return;
    }
    // nbc shows add on delay, we need at least on more pass.
    let rehideCount = rehideOneMoreTime ? 1 : 0;
    try {
      if (g_videomaxGlobals.matchedVideo) {
        // Loop over all like above using findVideosAtCenter() ???
        maximizeUpFromVideo(g_videomaxGlobals.matchedVideo);
      }
      alwaysHideSomeElements();
      if (g_videomaxGlobals.matchedCommonCntl) {
        g_videomaxGlobals.matchedCommonCntl?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
      }

      rehideCount += rehideUpFromVideo();
      recursiveIFrameFlipClassPrep(document);
      recursiveIFrameFlipClassPrep(getTopElemNode() as HTMLIFrameElement); //dicey AF
    } catch (err) {
      logerr(err);
    }
    if (rehideCount !== 0) {
      logtrace("Retrying rehide until no more matches. 1001ms");
      setTimeout(() => doRehideTimeoutLoop(), 1001);
    }
  };

  doRehideTimeoutLoop(true); // first run, always try 1s later no matter
  // what. (nbc banner ad)
  return true; // stop retrying
}

function postFixUpPageZoom() {
  let useObserver = true;
  // some sites (mba) position a full sized overlay that needs to be centered.
  if (
    // !g_isRunningInIFrame && // NBCNews iframe styles constantly getting
    // updated
    !isVideoElement(g_videomaxGlobals.matchedVideo)
  ) {
    if (DEBUG_MUTATION_OBSERVER) {
      logtrace(`OBSERVER: NOT INSTALLING observer because 
        videomaxGlobals.matchedIsHtml5Video: ${isVideoElement(g_videomaxGlobals.matchedVideo)}`);
    }
    useObserver = false;
  }
  if (!MUTATION_OBSERVER_WATCH_ALL_MAX && !g_videomaxGlobals.matchedCommonCntl) {
    if (DEBUG_MUTATION_OBSERVER) {
      logtrace(`OBSERVER: NOT INSTALLING observer because 
        MUTATION_OBSERVER_WATCH_ALL_MAX = ${MUTATION_OBSERVER_WATCH_ALL_MAX}
        videomaxGlobals.matchedCommonCntl = ${g_videomaxGlobals.matchedCommonCntl}`);
    }
    useObserver = false;
  }

  rehideUpFromVideo(); // one more time before adding observers to keep from
  // triggering a bunch of events (NBC Banner ad)
  if (useObserver) {
    addClassMutationObserver();
  }
  videoCanPlayBufferingInit();
  if (FIX_UP_BODY_CLASS_TO_SITE_SPECIFIC_CSS_MATCH) {
    try {
      // The easiest way to fix site specific layout issues to to do it in
      // CSS. but even matching on class names or ids can be problematic if
      // two sites happen to use the same class name or id. So instead of
      // site specific code, we add a class name to the body that is unique
      // for the site, so the css can select on it!
      let domainName = getPageDomainNormalized();

      // now turn any "." to "-",
      // we do this because css uses "." as a className prefix
      // this could generate confusion for cases like "domain-name.com" vs
      // "domain.name.com" but the consequence is that we may mess up some
      // css layout if this happens.

      domainName = domainName.replace(".", "-");

      document.body.classList.add(`${PREFIX_CSS_CLASS}-${domainName}`);
    } catch (err) {
      logerr(err);
    }
  }
}

function updateEventListeners(elem: Element, removeOnly = false) {
  /** @param event {KeyboardEvent} */
  const _onPress = (event: KeyboardEvent) => {
    try {
      if (event.code === "Escape") {
        // esc key
        logtrace("esc key press detected, unzooming");
        // unzoom here!
        g_videomaxGlobals.isMaximized = false;
        g_videomaxGlobals.unzooming = true;
        removeAttr(document.body, VIDEO_MAX_INSTALLED_ATTR);
        try {
          const allVideos = document.querySelectorAll("video");
          for (const eachVideo of allVideos) {
            if (eachVideo?.playbackRate && eachVideo?.playbackRate !== 1.0) {
              eachVideo.playbackRate = 1.0;
            }
          }
        } catch (err) {}
        UndoZoom.mainUnzoom();
        // the popup and background still think we're zoomed
        // we let them know by setting a global
        window._VideoMaxExtEscapeUnzoom = true;
        logtrace("trying to stop default event handler");
        event.stopPropagation();
        event.preventDefault();
        document.removeEventListener("keydown", _onPress);
      }
    } catch (err) {
      logerr(err);
    }
  };
  /** @param event {Event} */

  try {
    // this will allow "escape key" undo the zoom.
    logtrace("updateEventListeners");
    const doc = elem?.ownerDocument;
    doc?.removeEventListener("keydown", _onPress);
    window?.document?.removeEventListener("keydown", _onPress);
    if (!removeOnly) {
      doc?.addEventListener("keydown", _onPress);
      window?.document?.addEventListener("keydown", _onPress);
    }
  } catch (err) {
    logerr(err);
  }
  return true;
}

function isYoutubeInTheaterMode() {
  if (g_isRunningInIFrame) {
    return false;
  }
  const masthead = document.getElementById("masthead");
  if (!masthead) {
    return false;
  }
  const theaterAttr = getAttr(masthead, "theater");
  return theaterAttr !== null;
}

/**
 * Fixing youtube's progress indicator when it's in small mode is next to
 * impossible to make large-screen friendly. The thumb position is set via
 * javascript that sets a style directly
 * (not very CSP friendly) A more reliable solution is to put page in theater
 * mode and then restore it when we unzoom.
 * @param theaterMode {boolean}
 */
function setYoutubeIntoTheaterMode(theaterMode: boolean) {
  // verify it smells like a youtube domain. But the element check below
  // would probably be enough
  if (!smellsLikeMatch(getPageUrl(), YOUTUBE_TLD_NAMES)) {
    return;
  }
  // check if we're in theater mode we want
  if (isYoutubeInTheaterMode() === theaterMode) {
    logtrace(`youtube already in ${theaterMode ? "theater" : "non-theater"} mode, doing nothing`);
    return;
  }

  if (theaterMode) {
    // if we're putting it into theater mode, we should restore it.
    setAttr(document.body, YOUTUBE_RESTORE_NON_THEATER_ATTR, "1");
  } else {
    removeAttr(document.body, YOUTUBE_RESTORE_NON_THEATER_ATTR);
  }

  const theaterButton = document.getElementsByClassName("ytp-size-button")?.[0];
  if (isHtmlElement(theaterButton)) {
    theaterButton.click?.();
  }
}

/**
 * Called multiple time until it succeeds. Required because some pages just
 * deferred js to load videos.
 *
 * Returning True stops retry
 */
function doZoomPageRetries(): boolean {
  if (getVideomaxCmd() === "unzoom") {
    logtrace("UNZOOMING! - skipping doZoomPage");
    return true;
  }

  // @ts-ignore This .src is correct. https://developer.mozilla.org/en-US/docs/Web/API/Window/frameElement
  // this breaks abcnews.go.com
  // if (window?.frameElement?.src === "about:blank") {
  //   logtrace("Injected into blank iframe, not running");
  //   return true; // stop retrying
  // }

  if (!documentLoaded()) {
    logtrace(`document state not complete: '${document.readyState}'`);
    return false;
  }

  if (isMaximized()) {
    logtrace(`doZoomPage videomaxGlobals.isMaximized=true, NOT running.`);
    return true;
  }

  if (!g_videomaxGlobals.elementMatcher) {
    logerr(`videomaxGlobals.elementMatcher is null`);
    return true;
  }

  const reinstall = hasInjectedAlready();
  logtrace(`doZoomPage readystate = ${document.readyState}  reinstall=${reinstall}`);

  if (DEV_MODE && !isMaximized() && reinstall) {
    logtrace("Something's weird. isMaximized()=false but hasInjectedAlready()=true");
  }

  g_videomaxGlobals.matchCounter = 0;

  const foundVideoNewAlgo = findLargestVideoNew(document.documentElement);

  const getMatchCount = g_videomaxGlobals.elementMatcher?.getMatchCount() || 0;
  if (getMatchCount === 0) {
    logtrace(`No video found, ${g_isRunningInIFrame ? "iFrame" : "Main"}.
        foundVideoNewAlg=${foundVideoNewAlgo}`);
    return false; // keep trying
  }

  const bestMatch = g_videomaxGlobals.elementMatcher.getBestMatch();

  if (!bestMatch) {
    logerr("No video found, should not be running doZoomPageRetries?");
    return true;
  }

  logtrace("video found", bestMatch);
  // mark it with a class.
  tagElementAsMatchedVideo(bestMatch);

  const matchCount = g_videomaxGlobals.elementMatcher.getMatchCount();
  if (matchCount > 1) {
    if (DEV_MODE) {
      logtrace(`FOUND TOO MANY SAME SCORED VIDEOS ON PAGE? #${matchCount}`);
      // eslint-disable-next-line no-debugger
      debugger;
    }
  } else {
    logtrace("Final Best Matched Element: ", bestMatch.nodeName, bestMatch);
  }
  if (isHtmlElement(bestMatch)) {
    updateEventListeners(bestMatch);
  }

  if (EMBED_SCORES) {
    // append the final results of what was discovered.
    appendSelectorItemsToResultInfo("=Main Video=", `.${PREFIX_CSS_CLASS}-video-matched`);
    appendSelectorItemsToResultInfo(
      "=Playback controls=",
      `.${PREFIX_CSS_CLASS}-playback-controls`,
    );
    appendUnitTestResultInfo("==========DONE==========\n\n");
  }

  if (RESTORE_SCROLL_POS) {
    // walk through dom and find all the elements that have a scrolling
    // offset
    // and preserve them in a data-attribute, we'll restore the positions
    // after unzooming.
    saveAllScrollPositions();
  }
  if (SCROLL_INTO_VIEW) {
    bestMatch?.scrollIntoView({
      block: "center",
      inline: "center",
    });
  }

  g_videomaxGlobals.isMaximized = true;

  // this timer will hide everything
  if (g_videomaxGlobals.tagonly) {
    document.body.setAttribute(VIDEO_MAX_INSTALLED_ATTR, "tagonly");
    recursiveIFrameFlipClassPrep(document);
    recursiveIFrameFlipClassPrep(getTopElemNode() as HTMLIFrameElement); // Dicey AF
    logtrace("Tag only is set. Will not modify page to zoom video");
  } else {
    document.body.setAttribute(VIDEO_MAX_INSTALLED_ATTR, "zoomed");
    g_videomaxGlobals.hideEverythingTimer?.startTimer(() => {
      if (!isMaximized()) {
        logtrace("hideEverythingTimer: isMaximized false");
        return true;
      }
      // BBC has some special css with lots of !importants
      hideCSS("screen-css");
      if (!fixUpPageZoom()) {
        return false;
      }

      postFixUpPageZoom();

      // this refresh will cause the scroller js in the page to "update" it's
      // visible list of videos and may remove our primary.
      forceRefresh(g_videomaxGlobals.matchedVideo);
      if (g_videomaxGlobals.matchedVideo) {
        const doc = getOwnerDoc(g_videomaxGlobals.matchedVideo);
        forceRefresh(doc.body);

        const parent = g_videomaxGlobals.matchedVideo.parentElement;
        if (parent) {
          forceRefresh(parent);
        }
      }
      forceRefresh(window);

      g_videomaxGlobals.isMaximized = true;
      document.body.setAttribute(VIDEO_MAX_INSTALLED_ATTR, "running");
      return true; // stop retrying - we kep trying to rehide
    });
  }
  return true;
}

/**
 * Some doom scrolling sites rework the DOM on scroll and resize events.
 * They do this to remove videos scrolled off top of page and add new ones to
 * the bottom. This is required to keep memory pressure down from too many
 * <video> elements. The PROBLEM is that it removes our found maximized
 * video. So, we eat the scroll events while zoomed.
 */
function cancelScrollEvents(evt: Event) {
  try {
    if (!g_videomaxGlobals?.isMaximized) {
      return;
    }
    logtrace("cancelScrollEvent");
    evt.preventDefault();
    evt.stopImmediatePropagation();
  } catch (err) {
    logerr("cancelScrollEvent err", err);
  }
}

function mainZoom(tagonly = false) {
  g_videomaxGlobals.unzooming = false; // clear if we start zooming again.
  // this is set by the escape key unzoom, remove if we're zooming.
  if (window._VideoMaxExtEscapeUnzoom) {
    delete window._VideoMaxExtEscapeUnzoom;
  }
  // needed or retry timers
  if (hasInjectedAlready()) {
    logtrace("detected already injected. something is off?");
    return;
  }
  logtrace("running mainVideoMaxInject");

  const retries = g_isRunningInIFrame ? 2 : 8;

  if (earyExitForSmallIFrame()) {
    return;
  }

  if (CANCEL_SCROLL_EVENTS && !g_isRunningInIFrame) {
    // this is to prevent doomscrollers from completely changing the dom on us
    document.addEventListener("scroll", cancelScrollEvents, CANCEL_EVT_OPTIONS);
  }

  if (!g_walker && document?.body) {
    try {
      g_walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_DOCUMENT | NodeFilter.SHOW_DOCUMENT_FRAGMENT,
        isVisibleWalkerElem,
      );
    } catch (err) {
      logerr("createTreeWalker failed", err);
    }
  }

  if (!g_videomaxGlobals.elementMatcher) {
    g_videomaxGlobals.elementMatcher = new ElemMatcherClass();
  }

  spaNonMatchFlipClasses();

  setYoutubeIntoTheaterMode(true);

  if (!tagonly) {
    g_videomaxGlobals.hideEverythingTimer = new RetryTimeoutClass(
      "hideEverythingTimer",
      750,
      retries,
    );
    // don't start there, do it from doZoomPage()
  }

  g_videomaxGlobals.tagonly = tagonly;
  g_videomaxGlobals.findVideoRetryTimer = new RetryTimeoutClass("doZoomPage", 500, retries);
  g_videomaxGlobals.findVideoRetryTimer.startTimer(doZoomPageRetries);
}

function removeClassObserver() {
  if (g_videomaxGlobals.mutationObserverAttr) {
    logtrace("found mutationObserverAttr removing");
    g_videomaxGlobals.mutationObserverAttr.disconnect();
    g_videomaxGlobals.mutationObserverAttr = null;
  }
  if (g_videomaxGlobals.mutationObserverVideoDelete) {
    logtrace("found mutationObserverVideoDelete removing");
    g_videomaxGlobals.mutationObserverVideoDelete.disconnect();
    g_videomaxGlobals.mutationObserverVideoDelete = null;
  }
}

// MUTATION_OBSERVER_WATCH_VIDEO_DELETE
// function watchElForDeletion(elToWatch, callback, parent = document.querySelector('body')) {
//   const observer = new MutationObserver(function (mutations) {
//
//     // loop through all mutations
//     mutations.forEach(function (mutation) {
//
//       // check for changes to the child list
//       if (mutation.type === 'childList') {
//
//         // check if anything was removed and if the specific element we were looking for was removed
//         if (mutation.removedNodes.length > 0 && mutation.removedNodes[0] === elToWatch) {
//           callback();
//         }
//       }
//     });
//   });
//
//   // start observing the parent - defaults to document body
//   observer.observe(parent, {childList: true});
// }

function startObserving() {
  const OBSERVE_ATTRIB_OPTIONS: MutationObserverInit = {
    attributes: true,
    attributeFilter: ["class"],
    attributeOldValue: true,
    // new approach adds MULTIPLE observed elements and just watches children
    // old way used the `-common` and watched everything under it.
    childList: MUTATION_OBSERVER_WATCH_ALL_MAX,
    subtree: !MUTATION_OBSERVER_WATCH_ALL_MAX,
    characterData: false,
  };

  if (!g_videomaxGlobals?.mutationObserverAttr) {
    logerr("starting observer but videomaxGlobals.mutationObserverAttr is null");
    return;
  }
  if (MUTATION_OBSERVER_WATCH_ALL_MAX) {
    // childList: true
    // subtree: false
    const zoomedElems = [
      ...document.querySelectorAll(`[class*="${PREFIX_CSS_CLASS}"]`),
      ...document.querySelectorAll(`[class*="${PREFIX_CSS_CLASS_PREP}"]`),
    ];
    for (const eachElem of zoomedElems) {
      // can call it multiple times.
      try {
        g_videomaxGlobals.mutationObserverAttr.observe(eachElem, OBSERVE_ATTRIB_OPTIONS);
      } catch (err) {
        logerr(`OBSERVER: error for ${printNode(eachElem)}`);
      }
    }
    if (DEBUG_MUTATION_OBSERVER) {
      logtrace(
        `OBSERVER: installing MUTATION_OBSERVER_WATCH_ALL_MAX on ${zoomedElems.length} elements`,
      );
      logtrace(`OBSERVER: check count using: 
        [...document.querySelectorAll('[class*="${PREFIX_CSS_CLASS}"]'),
        ...document.querySelectorAll('[class*="${PREFIX_CSS_CLASS_PREP}"]')].length
        `);
    }
  } else {
    if (DEBUG_MUTATION_OBSERVER) {
      if (g_videomaxGlobals.matchedCommonCntl) {
        logtrace(
          "OBSERVER: installing observer on matchedCommonCntl",
          g_videomaxGlobals.matchedCommonCntl,
        );
      } else {
        logtrace("OBSERVER: \n\n \t ==== NOT installing no videomaxGlobals.matchedCommonCntl");
      }
    }
    // old approach
    // childList: false
    // subtree: true
    if (g_videomaxGlobals.matchedCommonCntl) {
      g_videomaxGlobals.mutationObserverAttr.observe(
        g_videomaxGlobals.matchedCommonCntl,
        OBSERVE_ATTRIB_OPTIONS,
      );
    }
  }
}

function addClassMutationObserver() {
  if (!USE_MUTATION_OBSERVER_ATTR) {
    return;
  }

  if (g_videomaxGlobals.mutationObserverAttr) {
    if (DEBUG_MUTATION_OBSERVER) {
      logtrace("OBSERVER: \n\n \t ==== RERUNNING observer watching setup ====");
    }
    startObserving();
    return;
  }

  SANITY_CHECK_MATCH_NOT_DELETED();

  g_videomaxGlobals.mutationObserverAttr = new MutationObserver((mutations, _observer) => {
    // called when change happens. first disconnect to avoid recursions
    // observer.disconnect();
    // SANITY_CHECK_MATCH_NOT_DELETED();

    if (!isMaximized()) {
      logerr("mutationObserverAttr - !isMaximized() probably video element deleted");
      removeClassObserver();
      //        UndoZoom.mainUnzoom();
      // todo: warn about why it's failing.
      // alert(
      //   "VideoMaximzer Extension:\n\nStrange page deleted the video when
      // trying to zoom.\nRestoring page");
      return;
    }

    // check to see if things are in the process of going away. They might
    // be.
    if (g_videomaxGlobals.mutationObserverAttr) {
      for (const eachMutation of mutations) {
        if (eachMutation.type !== "attributes") {
          continue;
        }
        // is one of our classnames on the old value?
        if (
          eachMutation?.oldValue?.length &&
          eachMutation?.oldValue?.indexOf(PREFIX_CSS_CLASS) < 0
        ) {
          // not found
          continue;
        }
        if (!isHtmlElement(eachMutation.target)) {
          continue;
        }

        // our classname was there, but it's removed?
        if (hasAnyVideoMaxClass(eachMutation.target)) {
          continue;
        }

        // if we reach here then our classname was removed
        const oldClassNames = eachMutation.oldValue?.split(" ") || "";
        // figure out what classnames were removed and re-add it.
        for (const eachClassname of oldClassNames) {
          if (eachClassname.startsWith(PREFIX_CSS_CLASS)) {
            eachMutation.target?.classList?.add(eachClassname);
          }
        }
        if (oldClassNames.length > 0 && DEBUG_MUTATION_OBSERVER) {
          const newClassName = getAttr(eachMutation.target, "class");
          logtrace(
            `OBSERVER: detected classname changes\n\t before:"${
              eachMutation?.oldValue
            }"\n\t new:"${newClassName}"\n\t fixed:"${getAttr(eachMutation.target, "class")}"`,
          );
        }
      }
    }
  });
  startObserving();
}

function isVisible(elem: Element): boolean {
  return (
    elem?.checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
    }) || false
  );
}

/**
 *
 * @param videoElem {HTMLVideoElement}
 * @return {boolean}
 */
function isTopVisibleVideoElem(videoElem: HTMLVideoElement): boolean {
  if (g_isRunningInIFrame) {
    // this could be tricky as hell... we likely to what's outside our frame
    if (DEV_MODE) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
  }
  // center of the element
  const { top, left, width, height } = getCoords(videoElem);
  const layedElems = document.elementsFromPoint(
    Math.round(left + width / 2),
    Math.round(top + height / 2),
  );

  // we walk down the layers checking to see if it's a video and if it's
  // visible.
  const match = layedElems.find((eachLayer) => {
    if (!["video", "iframe"].includes(eachLayer.nodeName.toLowerCase())) {
      return false;
    }
    return isVisible(eachLayer);
  });

  const result = videoElem.isSameNode(match || null); // undefined->null
  logtrace(
    `isTopVisibleVideoElem is ${result} for ${printNode(videoElem)}
    videoElem: `,
    videoElem,
    `
    match: `,
    match,
    `
    layedElems: `,
    layedElems,
  );
  return result;
}

/**
 * logic to reapply the playback speed after a video leaves buffering state.
 * some sites are watching this event and resetting the speed.
 * we do it on a setTimeout to run after their routines.
 * Triggered on "canplay" event for the main video.
 */
function updateSpeedFromAttr(evt: Event) {
  setTimeout(() => {
    try {
      const videoElem = evt.currentTarget || evt.target;
      if (!isVideoElement(videoElem)) {
        return;
      }
      if (!isVisible(videoElem)) {
        // we only need to do something if it's visible.
        logtrace(
          `updateSpeedFromAttr not running because video isn't visible ${printNode(videoElem)}`,
        );
        return;
      }
      // do we update speed on ALL visible videos or only the one we think it
      // the frontmost? this can happen when ads cover or are behind the main
      // video.
      const speedStr = document.body.getAttribute(PLAYBACK_SPEED_DOC_ATTR) ?? DEFAULT_SPEED_STR;
      const speedFloat = safeParseFloat(speedStr);
      if (
        !videoElem.paused &&
        !videoElem.ended &&
        speedFloat > 0 &&
        videoElem.playbackRate !== speedFloat
      ) {
        const isTopItem = isTopVisibleVideoElem(videoElem);
        logtrace(
          `updateSpeedFromAttr video: isTopVisibleVideoElem:${isTopItem} speedStr:${speedStr} \n\t\t ${printNode(
            videoElem,
          )}`,
        );
        videoElem.playbackRate = Math.abs(speedFloat);
      } else if (videoElem.playbackRate !== speedFloat && speedFloat === 1.0) {
        // we're trying to reset the speed to 1.0
        logtrace(`updateSpeedFromAttr resetting speed to 1.0 \n\t\t ${printNode(videoElem)}`);
        videoElem.playbackRate = 1.0;
      } else {
        logtrace(
          `updateSpeedFromAttr not running because speed is correct. \n\t\tvideoElem.paused:${
            videoElem.paused
          }\n\t\t speedFloat:${speedFloat} \n\t\t videoElem.playbackRate:${
            videoElem.playbackRate
          }\n\t\t ${printNode(videoElem)}`,
        );
      }
    } catch (err) {
      logerr(err);
    }
  }, 1);
}

/** "can play" is a state of the video */
function videoCanPlayRemove() {
  try {
    g_videomaxGlobals?.matchedVideo?.removeEventListener("canplay", updateSpeedFromAttr);
  } catch (_err) {}

  if (!REAPPLY_PLAYBACKSPEED) {
    return;
  }
  const videos = document.getElementsByTagName("video");
  for (const eachVideo of videos) {
    try {
      if (eachVideo.playbackRate !== 1.0) {
        eachVideo.playbackRate = 1.0;
      }
      eachVideo.removeEventListener("canplay", updateSpeedFromAttr);
    } catch (err) {
      logerr(err);
    }
  }
}

function videoCanPlayBufferingInit() {
  if (!REAPPLY_PLAYBACKSPEED) {
    return;
  }
  const videos = document.getElementsByTagName("video");
  for (const eachVideo of videos) {
    try {
      // watch for video to be ready (buffer done and run reapply the speed)
      eachVideo.removeEventListener("canplay", updateSpeedFromAttr);
      eachVideo.addEventListener("canplay", updateSpeedFromAttr);
    } catch (err) {
      logerr(err);
    }
  }
}

// <editor-fold defaultstate="collapsed" desc="UndoZoom">
/**
 * Using a class for better namespacing. Should do the same for zooming logic
 */
class UndoZoom {
  /** @param doc {Document} */
  static recurseIFrameUndoAll(doc: Document) {
    try {
      if (!isFunction(doc?.querySelectorAll)) {
        // security can block
        return;
      }
      const allIFrames = doc.querySelectorAll("iframe");
      for (const frame of allIFrames) {
        try {
          const framedoc = frame?.contentDocument;
          if (!framedoc) {
            continue;
          }
          setTimeout(UndoZoom.undoAll, 0, framedoc);
          UndoZoom.recurseIFrameUndoAll(framedoc);
        } catch (err) {
          // probably iframe boundrey security related
        }
      }
    } catch (err) {
      // probably security related
    }
  }

  /** @param doc {Document} */
  static removeAllClassStyles(doc: Document) {
    if (!isFunction(doc?.querySelectorAll)) {
      // security can block
      return;
    }
    const allElementsToFix = doc.querySelectorAll(`[class*="${PREFIX_CSS_CLASS}"]`);
    for (const elem of allElementsToFix) {
      // build list of each classname that matches prefix
      const remove = [];
      const allClassNameOnElem = Object.values(elem.classList) || [];
      for (const eachClassName of allClassNameOnElem) {
        if (eachClassName.startsWith(PREFIX_CSS_CLASS)) {
          remove.push(eachClassName);
        }
      }
      elem.classList.remove(...remove);
      // only our class names were in attr so just remove
      if (elem.classList.length === 0) {
        removeAttr(elem, "class");
      }
    }

    // remove misc items.
    removeAttr(document.body, PLAYBACK_SPEED_DOC_ATTR);
    removeAttr(document.body, PERMISSIONS_CHECK_DOMAINS_DOC_ATTR);
  }

  /** @param doc {Document} */
  static undoStyleSheetChanges(doc: Document) {
    try {
      if (!isFunction(doc?.getElementsByTagName)) {
        // some iframes block access for security reasons
        return;
      }
      const cssNode = doc.getElementById(CSS_STYLE_HEADER_ID);
      if (parentElement(cssNode) && cssNode?.parentNode?.removeChild) {
        parentElement(cssNode)?.removeChild(cssNode);
      }

      const externcsss = doc.getElementsByTagName("link");
      for (const elem of externcsss) {
        if (elem.getAttribute("media") === "_all") {
          elem.setAttribute("media", "all");
        }
      }
    } catch (ex) {
      logerr(ex);
    }
  }

  /** @param doc {Document} */
  static undoAttribChange(doc: Document) {
    if (!isFunction(doc?.querySelectorAll)) {
      // security can block
      return;
    }
    // we tag all elements that have saved attributes by adding the
    // VIDEO_MAX_DATA_ATTRIB_UNDO_TAG
    const hasAttrTags = doc.querySelectorAll(`[${VIDEO_MAX_DATA_ATTRIB_UNDO_TAG}]`);
    for (const elem of hasAttrTags) {
      try {
        restoreAllSavedAttr(elem);
        //  try and make the element realizes it needs to redraw. Fixes
        // progress bar
        logtrace(
          `undoAttribChange: Generating 'resize' and 'visabilitychange" events to force refresh for ${printNode(
            elem,
          )}`,
        );
        elem.dispatchEvent(new Event("resize"));
        elem.dispatchEvent(new Event("visabilitychange"));
      } catch (err) {
        logerr(err, elem);
      }
    }

    restoreAllSrollPositions();
  }

  /**
   * @param doc {Document}
   */
  static undoAll(doc: Document) {
    if (!doc) {
      return;
    }
    // stop timers that may be attempting to rezoom in the background
    if (g_videomaxGlobals.hideEverythingTimer) {
      g_videomaxGlobals.hideEverythingTimer.cleartimeout();
      g_videomaxGlobals.hideEverythingTimer = null;
    }
    if (g_videomaxGlobals.findVideoRetryTimer) {
      g_videomaxGlobals.findVideoRetryTimer.cleartimeout();
      g_videomaxGlobals.findVideoRetryTimer = null;
    }

    if (!g_isRunningInIFrame) {
      // this is to prevent doomscrollers from completely changing the dom on
      // us
      document.removeEventListener("scroll", cancelScrollEvents, CANCEL_EVT_OPTIONS);
    }

    UndoZoom.undoStyleSheetChanges(doc);
    UndoZoom.removeAllClassStyles(doc);
    UndoZoom.undoAttribChange(doc);
  }

  static touchDocBodyToTriggerUpdate() {
    setAttr(document.body, "width", "99%");
    setTimeout(() => {
      setAttr(document.body, "width", "100%");
    }, 1);
  }

  static unzoomForceRefresh(optionalElem: EventTarget | undefined) {
    // we now need to force the flash to reload by resizing
    setTimeout(() => {
      logtrace(
        `unzoom:forceRefresh: Generating 'resize' and 'visabilitychange" events to force refresh for window`,
      );
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("visabilitychange"));
      if (optionalElem?.dispatchEvent) {
        optionalElem.dispatchEvent(new Event("resize"));
        optionalElem.dispatchEvent(new Event("visabilitychange"));
      } else {
        UndoZoom.touchDocBodyToTriggerUpdate();
      }
    }, 1); // was 50
  }

  static mainUnzoom() {
    try {
      // clear if we have var saved in window/document
      if (!g_isRunningInIFrame && window._VideoMaxExt) {
        logtrace("removing window._VideoMaxExt for main thread");
        delete window._VideoMaxExt;
      } else if (document._VideoMaxExt) {
        logtrace("removing document._VideoMaxExt");
        delete document._VideoMaxExt;
      }
      g_videomaxGlobals.unzooming = true;
      g_videomaxGlobals.isMaximized = false;
      document.body.removeAttribute(VIDEO_MAX_INSTALLED_ATTR);

      if (g_videomaxGlobals.matchedVideo) {
        updateEventListeners(g_videomaxGlobals.matchedVideo, true);
      }

      removeClassObserver();
      videoCanPlayRemove();

      UndoZoom.undoAll(document);

      if (
        g_videomaxGlobals.matchedVideo?.ownerDocument &&
        g_videomaxGlobals.matchedVideo.ownerDocument !== document
      ) {
        UndoZoom.undoAll(g_videomaxGlobals.matchedVideo.ownerDocument);
      }
      UndoZoom.recurseIFrameUndoAll(document);
      UndoZoom.recurseIFrameUndoAll(window.document);

      if (
        !g_isRunningInIFrame &&
        getAttr(document.body, YOUTUBE_RESTORE_NON_THEATER_ATTR) !== null
      ) {
        logtrace("Detected we put youtube in theater mode, undoing it");
        setYoutubeIntoTheaterMode(false);
      }

      // remove the video "data-videomax-" attributes
      const ALL_DOCS = [document, window.document];
      for (const eachAttr of REMOVE_ATTR_LIST) {
        for (const eachDoc of ALL_DOCS) {
          try {
            if (!isFunction(eachDoc?.querySelectorAll)) {
              // security can block
              continue;
            }

            const matchedElems = eachDoc.querySelectorAll(`[${eachAttr}]`);
            for (const eachElem of matchedElems) {
              try {
                eachElem?.removeAttribute(eachAttr);
              } catch (err) {
                logerr(err);
              }
            }
          } catch (err) {
            logerr(err);
          }
        }
      }

      if (DEV_MODE) {
        // fallback - find ALL elements that have a videomax class and
        // remove. PREFIX_CSS_CLASS matches prep, too
        const missedRemoved1 = document.querySelectorAll(`[class*="${PREFIX_CSS_CLASS}"]`);
        if (missedRemoved1.length) {
          // undo didn't remove all "videomax-ext" classes from this doc
          // (maybe iframe) eslint-disable-next-line no-debugger
          debugger;
        }

        if (g_videomaxGlobals.matchedVideo?.ownerDocument) {
          const notRemoved2 =
            g_videomaxGlobals.matchedVideo.ownerDocument.querySelectorAll(
              `[class*="${PREFIX_CSS_CLASS}"]`,
            ) || [];
          if (notRemoved2.length) {
            // undo didn't remove all "videomax-ext" classes from document
            // where video was found eslint-disable-next-line no-debugger
            debugger;
          }
        }
      } // DEV_MODE
      UndoZoom.unzoomForceRefresh(document);
      // UndoZoom.unzoomForceRefresh(savedVideo);

      // clean up globals
      try {
        if (document?._VideoMaxExt) {
          document._VideoMaxExt = undefined;
        }
        if (window._VideoMaxExt) {
          window._VideoMaxExt = undefined;
        }
      } catch (err) {}
    } catch (ex) {
      logerr(ex);
    }
  }
}

// </editor-fold>

const zoomCmd = getVideomaxCmd();

// look at the command set by the first injected file
logtrace(`
    ***
    videmax_cmd: window.videmax_cmd:'${document.videmax_cmd}'  getVideomaxCmd():'${zoomCmd}'
    ***`);
switch (zoomCmd) {
  case "unzoom":
    setTimeout(() => {
      UndoZoom.mainUnzoom();
    }, 1);
    break;

  case "tagonly":
    setTimeout(() => {
      // this is for sites that already zoom correctly, but we'd like to do
      // speed control
      mainZoom(true);
    }, 0);
    break;

  case "zoom":
    setTimeout(() => {
      // this is for sites that already zoom correctly, but we'd like to do
      // speed control
      mainZoom();
    }, 0);
    break;

  default:
    logerr("document.videmax_cmd missing");
    setTimeout(() => {
      mainZoom();
    }, 0);
    break;
}
