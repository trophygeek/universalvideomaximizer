/*
 Video Maximizer
 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.
 Copyright (C) 2023 trophygeek@gmail.com
 www.videomaximizer.com
 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/
 */

import {DEBUG_ENABLED, DEFAULT_SPEED, ERR_BREAK_ENABLED, FULL_DEBUG, getKeys, TRACE_ENABLED} from "./common";

try {
  const BREAK_ON_BEST_MATCH: boolean = false;
  // scope and prevent errors from leaking out to page.
  // These are noisy and can be enabled when debugging areas. FULL_DEBUG must
  // also be true
  const EMBED_SCORES: boolean = true;
  const COMMON_PARENT_SCORES: boolean = true;
  const DEBUG_HIDENODE: boolean = false;
  const DEBUG_MUTATION_OBSERVER: boolean = true;

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
  const USE_OLD_FAST_IS_VISIBLE_CHECK_IN_WALKER: boolean = false; // new code => false
  const FIND_CONTROLS_ON_MAIN_THREAD_FOR_IFRAME_MATCH: boolean = true;
  const USE_WHOLE_WINDOW_TO_SEARCH_FOR_CONTROLS: boolean = true;
  const IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE: boolean = true;  // jasmine has some hidden
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
  const NEW_ISELEMINIFRAME: boolean = false;

  const MIN_VIDEO_WIDTH: number = 320;
  const MIN_VIDEO_HEIGHT: number = 240;

  const MIN_IFRAME_WIDTH: number = MIN_VIDEO_WIDTH;
  const MIN_IFRAME_HEIGHT: number = MIN_VIDEO_HEIGHT;

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
  const ZINDEX_WEIGHT: number = 0.5;
  const VIDEO_OVER_IFRAME_WEIGHT: number = 0; // video gets VIDEO_PLAYING_WEIGHT,
                                      // VIDEO_DURATION_WEIGHT,
                                      // VIDEO_LOOPS_WEIGHT, etc
  const MAIN_FRAME_WEIGHT: number = 5.0;
  const VIDEO_PLAYING_WEIGHT: number = 100.0; // * 100
  const VIDEO_DURATION_WEIGHT: number = 1.0; // was 0.5
  const MAX_DURATION_SECS: number = 60 * 60 * 2; // 2hrs max - live videos skew results
  const VIDEO_LOOPS_WEIGHT: number = -10.0;
  const VIDEO_HAS_SOUND_WEIGHT: number = 15.0;
  const URL_OVERLAP_WEIGHT: number = 100.0;
  const TITLE_OVERLAP_WEIGHT: number = 100;
  const IN_VIEW_WEIGHT: number = .25;
  const ALLOW_FULLSCREEN_WEIGHT: number = 20.0;
  const ADVERTISE_WEIGHT: number = -100.0; // don't hide ads, but  dont' want them as
                                   // main videos
  const DOOMSCROLL_PLAYING_BOOST_FACTOR:number = 50.0;
  const DOOMSCROLL_UNMUTED_BOOST_FACTOR:number = 25.0;

  const ALLOW_SMALL_VIDEOS_DOMAINS = ['tiktok'];
  const DOOMSCROLL_BOOST_DOMAINS = ['tiktok', 'facebook', 'imgur', 'twitter'];

  const ALWAYS_HIDE_NODES: HtmlElementTypes = [
    'footer',
    'header',  // maybe remove?
    'nav'];  // "aside"?

  // @ts-ignore
  const IGNORE_NODES: HtmlElementTypes = [
    'noscript',
    'script',
    'head',
    'link',
    'style',
    'hmtl' as keyof HTMLElementTagNameMap]; // humm.


  const IGNORE_CNTL_NODES: HtmlElementTypes = [
    ...IGNORE_NODES,
    ...ALWAYS_HIDE_NODES,
    'head',
    'body',
    'html',
    'iframe'];

  const STOP_NODES_COMMON_CONTAINER: HtmlElementTypes = [
    ...IGNORE_CNTL_NODES,
    'main',
    'section',
    'article'];
  const IGNORE_COMMON_CONTAINER_COUNT_NODES = [
    ...ALWAYS_HIDE_NODES,
    'head',
    'header',
    'html',
    'iframe',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'span'];
  const SKIPPED_NODE_NAMES = [
    '#document', // iframe top element
    'svg',
    'xml',
    'script',
    'link',
    'circle',
    'path',
    'noscript',
    'img',
    'meta',
    'head',
    // "header", // some sites put videos in the header, wtf?
    'footer',
    // "figure", // secsports puts it under a <figure> seriously?
    // "caption",
    'area',
    'br',
    'button',
    'code',
    'cite',
    'data',
    'del',
    'fieldset',
    'figcaption',
    'form',
    'hgroup',
    'input'];
  const SKIPPED_NODE_NAMES_FOR_PLAYBACK_CTRLS = [
    ...IGNORE_NODES,
    ...SKIPPED_NODE_NAMES,
    ...IGNORE_COMMON_CONTAINER_COUNT_NODES];

  const CSS_STYLE_HEADER_ID = 'maximizier-css-inject';

  // we use the prop class then flip all the classes at the end.
  // The reason for this is that the clientRect can get confused on rezoom if
  //     the background page couldn't inject the css as a header.
  const PREFIX_CSS_CLASS = 'videomax-ext';
  const PREFIX_CSS_CLASS_PREP = 'videomax-ext-prep';
  // adding ANY new elements should be added to inject_undo
  const OVERLAP_CSS_CLASS = `${PREFIX_CSS_CLASS_PREP}-overlap`;
  const HIDDEN_CSS_CLASS = `${PREFIX_CSS_CLASS_PREP}-hide`;
  const MAX_CSS_CLASS = `${PREFIX_CSS_CLASS_PREP}-max`;
  const PLAYBACK_CNTLS_CSS_CLASS = `${PREFIX_CSS_CLASS_PREP}-playback-controls`;
  const PLAYBACK_CNTLS_FULL_HEIGHT_CSS_CLASS = `${PLAYBACK_CNTLS_CSS_CLASS}-fullheight`;
  const PLAYBACK_VIDEO_MATCHED_CLASS = `${PREFIX_CSS_CLASS_PREP}-video-matched`;
  const MARKER_COMMON_CONTAINER_CLASS = `${PREFIX_CSS_CLASS}-container-common`;
  const MARKER_TRANSITION_CLASS = `${PREFIX_CSS_CLASS}-trans`;
  const NO_HIDE_CLASS = `${PREFIX_CSS_CLASS}-no-hide`;

  // used to save off attributes that are modified on iframes/flash
  const VIDEO_MAX_DATA_PREFIX = 'data-videomax';
  const VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX = `${VIDEO_MAX_DATA_PREFIX}-saved`;
  // used to find all the VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX easily
  const VIDEO_MAX_DATA_ATTRIB_UNDO_TAG = `${VIDEO_MAX_DATA_PREFIX}-tag-saved`;

  // from background script on body
  const PLAYBACK_SPEED_ATTR = `${VIDEO_MAX_DATA_PREFIX}-playbackspeed`;
  const VIDEO_MAX_INSTALLED_ATTR = `${VIDEO_MAX_DATA_PREFIX}-running`; // data-videomax-running
  const YOUTUBE_RESTORE_NON_THEATER_ATTR = `${VIDEO_MAX_DATA_PREFIX}-youtube-nontheater-restore`;
  const SAVED_SCROLL_TOP_ATTR = `${VIDEO_MAX_DATA_PREFIX}-scrolltop`;
  const SAVED_SCROLL_LEFT_ATTR = `${VIDEO_MAX_DATA_PREFIX}-scrollleft`;

  const EMBEDED_SCORES = `${VIDEO_MAX_DATA_PREFIX}-scores`;
  const VIDEO_MAX_ATTRIB_FIND = `${VIDEO_MAX_DATA_PREFIX}-target`;
  const VIDEO_MAX_ATTRIB_ID = 'zoomed-video';

  const REMOVE_ATTR_LIST = [
    PLAYBACK_SPEED_ATTR,
    VIDEO_MAX_ATTRIB_FIND,
    EMBEDED_SCORES,
    // old videomax for comparison. remove them too
    `data-videomax-weights`,
    `videomax-ext-prep-scores`];

  const SCALESTRING_WIDTH = '100%'; // "calc(100vw)";
  const SCALESTRING_HEIGHT = '100%'; // "calc(100vh)";
  const SCALESTRING = '100%';

  /** we don't hide ads but we don't make them the primary zoomed "video" (iframe) */
  const DO_NOT_MATCH_IFRAME_SRC = [
    /\.facebook\.com/i,
    /javascript:/i,
    /platform\.tumblr\.com/i,
    /imasdk\.googleapis\.com/i,
    /\.afcdn\.net/i,
    /\.adsninja\.ca/i,
    /\.extremereach\.io/i,
    /\.gvt1\.com/i];

  /** these are "normalized" so country doesn't matter */
  const YOUTUBE_TLD_NAMES = [
    /\.youtube\./i,
    /\.youtu\.be/i,
  ];

  /** These are sites that NEED to have their styles restored or they don't undo
   * This is not universal because some sites like youtube don't need this done.
   * ***If an unzoom fails for a site, try adding the domain here first.*** */
  const RESTORE_STYLE_SITES = [
    /\.crunchyroll\./i,
  ];

  type VideomaxGlobalsType = VideomaxGlobalsTypeBase & {
    injectedCss: boolean,
    cssToInject: string,
    matchCounter: number,
    elementMatcher: ElemMatcherClass | null;
    mutationObserver: MutationObserver | null,
    findVideoRetryTimer: RetryTimeoutClass | null,
    hideEverythingTimer: RetryTimeoutClass | null,
  };

  // per doc globals (e.g. inside iframes from background inject gets it's own)
  let videomaxGlobals: VideomaxGlobalsType = {
    matchedVideo: null,
    matchVideoRect: new DOMRect(),
    matchedIsHtml5Video: false,
    matchedVideoSrc: '',
    matchedCommonCntl: null,
    processInFrame: false,
    isMaximized: false,
    tagonly: false,
    unzooming: false,

    matchCounter: 0,
    injectedCss: false,
    cssToInject: '',
    elementMatcher: null,
    mutationObserver: null,
    findVideoRetryTimer: null,
    hideEverythingTimer: null,
  };

  let g_walker: TreeWalker | null = null;

  const isRunningInIFrame = () => window !== window?.parent;

  const logerr = (...args: any[]) => {
    if (!DEBUG_ENABLED) {
      return;
    }
    const inIFrame = isRunningInIFrame() ? 'iframe' : 'main';
    // eslint-disable-next-line no-console
    console.trace(`%c VideoMax INJECT ${inIFrame} ERROR`,
                  'color: white; font-weight: bold; background-color: red', ...args);
    if (ERR_BREAK_ENABLED) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
  };

  const logwarn = (...args: any[]) => {
    if (!DEBUG_ENABLED) {
      return;
    }
    const inIFrame = isRunningInIFrame() ? 'iframe' : 'main';
    // eslint-disable-next-line no-console
    console.warn(`%c VideoMax INJECT ${inIFrame} WARNING`,
                 'color: white; font-weight: bold; background-color: coral', ...args);
  };

  const trace = (...args: any[]) => {
    if (!TRACE_ENABLED) {
      return;
    }
    const iframe = isRunningInIFrame() ? 'iFrame' : 'Main';
    // blue color , no break
    // eslint-disable-next-line no-console
    console.log(`%c VideoMax ${iframe}`,
                `color: white; font-weight: bold; background-color: blue`, ...args);
  };

  const SANITY_CHECK_MATCH_NOT_DELETED = () => {
    if (!DEBUG_ENABLED || !videomaxGlobals.matchedVideo) {
      return;
    }
    const doc = getOwnerDoc(videomaxGlobals.matchedVideo);
    if (!doc?.contains(videomaxGlobals.matchedVideo)) {
      logerr('THE MATCHED VIDEO IS NO LONGER IN THE DOCUMENT');
    }
  };

  if (!isRunningInIFrame()) {
    // @ts-ignore
    if (window?._VideoMaxExt) {
      trace('Found globals, restoring');
      // @ts-ignore
      videomaxGlobals = window._VideoMaxExt;
    } else {
      trace('Initializing globals');
      // @ts-ignore
      window._VideoMaxExt = videomaxGlobals;
    }
  } else {
    // running in iFrame
    // @ts-ignore
    if (document._VideoMaxExt) {
      // @ts-ignore
      videomaxGlobals = document._VideoMaxExt;
    } else {
      // @ts-ignore
      document._VideoMaxExt = videomaxGlobals;
    }
  }

  const getVideomaxCmd = (): string => {
    // @ts-ignore
    return document.videmax_cmd || window.videmax_cmd || '';
  };

  /** these should be unit tests - not sure how to do it */
  const getOverlapCount = (arrA: string[], arrB: string[]) => arrA.filter(
      x => arrB.includes(x)).length;

// split on :// and use what comes after, then trim of cgi params, the split
// into works and filter out empty
  const splitUrlWords = (url: string): string[] => {
    if (!url?.length) {
      return [];
    }
    const path = url.split('://')[1] || url;
    const noArgs = path.split('?')[0] || path;
    return [...noArgs.split(/[^A-Z0-9]+/i).filter(s => s.length > 0)];
  };

  function safeParseInt(str: string): number {
    const result = parseInt(str, 10);
    return Number.isNaN(result) ? 0 : result;
  }

  function safeParseFloat(str: string): number {
    const result = parseFloat(str);
    return Number.isNaN(result) ? 0 : result;
  }

  /**
   * Checks if the zoomed video is still in containing document
   */
  const isVideoStillInDoc = (): boolean => {
    if (!videomaxGlobals?.isMaximized || !videomaxGlobals?.matchedVideo) {
      return false;
    }
    const containingDoc = getOwnerDoc(videomaxGlobals.matchedVideo);
    const videoStillInDocument = containingDoc?.contains(
        videomaxGlobals.matchedVideo) || false;
    if (!videoStillInDocument) {
      logerr(`Video element no longer in document?`,
             videomaxGlobals.matchedVideo);
    }
    return videoStillInDocument;
  };

  const isMaximized = (): boolean => {
    if (!videomaxGlobals) {
      trace(`isMaximized: videomaxGlobals missing?`);
      return false;
    }
    if (getVideomaxCmd() === 'unzoom' || videomaxGlobals.unzooming) {
      trace(
          `isMaximized: document.videmax_cmd: "${getVideomaxCmd() ||
                                                 ''}" || videomaxGlobals.unzooming === ${videomaxGlobals.unzooming}`);
      return false;
    }
    return isVideoStillInDoc();
  };

  /**
   * @return {string}
   */
  const getPageUrl = (): string => {
    try {
      return isRunningInIFrame() ?
             document.referrer :
             document.location.href;
    } catch (err) {
      logerr(err);
      return '';
    }
  };

  let g_cachedDomainName = '';
  /**
   * Needs unit tests. ATTEMPT to turn "www.foo.com" and "web.foo.net" into
   * just "foo".
   * @return {string}
   */
  const getPageDomainNormalized = (): string => {
    if (g_cachedDomainName?.length > 0) {
      return g_cachedDomainName;
    }
    try {
      const urlStr = getPageUrl();
      if (!urlStr.length) {
        return 'BLOCKEDURL';
      }
      const url = new URL(urlStr);
      let domainName = url.hostname;

      // normalizing the tld is next to impossible w/out some cookie setting
      // hack so we just remove any prefix like www or web
      const prefixesToRemove = ['www', 'web', 'static', 'video', 'tv'];
      for (const prefix of prefixesToRemove) {
        if (domainName.startsWith(`${prefix}.`)) {
          domainName = domainName.substring(prefix.length + 1);
          break; // we found one, stop
        }
      }
      // now we trim off the tld ".com" or ".whatever", it won't work for some
      // countries like 'co.uk", but it's probably good enough for our matching
      // needs. we only use it to match css classes, not security related
      const lastDotOffset = domainName.lastIndexOf('.');
      g_cachedDomainName = domainName.substring(0, lastDotOffset > 0 ?
                                                   lastDotOffset :
                                                   domainName.length);
      return g_cachedDomainName;
    } catch (err) {
      logerr(err);
      return '';
    }
  };

  const isDomainMatch = (domainMatches: string[]): boolean => {
    const domainStr = getPageDomainNormalized();
    for (const eachDomain of domainMatches) {
      if (domainStr.includes(eachDomain)) {
        return true;
      }
    }
    return false;
  };

  const isDoomScrollingSite = () => isDomainMatch(DOOMSCROLL_BOOST_DOMAINS);

  const isAllowSmallVideosSite = () => isDomainMatch(
      ALLOW_SMALL_VIDEOS_DOMAINS);

  const parseParams = (urlformat: string): KeyValuePair => {
    const pl = /\+/g; // Regex for replacing addition symbol with a space
    const search = /([^&=]+)=?([^&]*)/g;
    const decode = (s: string) => decodeURIComponent(s.replace(pl, ' '));
    const query = urlformat;

    const urlParamsResult: KeyValuePair = {};
    let match = search.exec(query);
    while (match) {
      urlParamsResult[decode(match[1])] = decode(match[2]);
      match = search.exec(query);
    }
    return urlParamsResult;
  };

  /**
   * Returns the document of an IFrame and tries to handle security
   */
  const getIFrameDoc = (iframe: HTMLIFrameElement | Document | undefined):
      Document | undefined => {
    try {
      if (iframe instanceof Document) {
        return iframe;
      }
      return iframe?.contentDocument || iframe?.contentWindow?.document;
    } catch (_err) {
      // security errors are hard to detect and prevent, just have to catch
      // them.
      return undefined;
    }
  };

  /**
   * getElemsDocumentView?
   * Walking out of an iFrame. We searh the main window for the iframe
   */
  const findIFrameInDocument = (docElem: Node | HTMLIFrameElement | Document): HTMLIFrameElement | undefined => {
    try {
      if (!docElem) {
        return undefined;
      }
      const doc: Document | null = (docElem instanceof Document) ? docElem : (getElemsDocumentView(docElem)?.document || null);
      // elemDoc.parentWindow;
      const frames = doc?.getElementsByTagName('iframe') || [];
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
      trace(`findIFrameInDocument err`, err);
    }
    return undefined;
  };

  /**
   * Walking out of an iFrame. We search the main window for the iframe
   */
  const findIFrameInDocument2 = (docElem: HTMLIFrameElement | Document): HTMLIFrameElement | undefined => {
    try {
      if (!docElem) {
        return undefined;
      }
      const doc: Document | null = (docElem instanceof Document) ? docElem : (getElemsDocumentView(docElem)?.document || null);
      // elemDoc.parentWindow;
      const frames = doc?.getElementsByTagName('iframe') || [];
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
          const docPosResult: number = eachFrame.compareDocumentPosition(
              docElem);
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
          // to string array .join(','); trace( `findIFrameInDocument2:
          // compareDocumentPosition result ${flagsStr}`,
          // `${PrintNode(eachFrame)}`); }
          if (docPosResult & Node.DOCUMENT_POSITION_CONTAINS) {
            return eachFrame;
          }
        } catch (e) {}
      }
    } catch (err) {
      logerr(`findIFrameInDocument2 err`, err);
    }
    trace(`findIFrameInDocument2: returning undefined`);
    return undefined;
  };

  const isElemInIFrame = (elem: Element | Document | null): boolean => {
    try {
      if (!elem) {
        return false;
      }
      if (NEW_ISELEMINIFRAME && elem.nodeName === '#document') {
        // trying to check a document itself fails.
        const result = elem.isEqualNode(document);
        trace(`Matching #document - New code: result: ${result}`);
        return (result); // window?.document???
      }
      return (elem.ownerDocument !== document);
    } catch (_err) {
    }
    return false;
  };

  const isIFrameElem = (elem: Element): boolean => elem?.nodeName ===
                                                   'IFRAME' ||
                                                   elem?.nodeName ===
                                                   'FRAME' || false;

  /**
   * Checks if <iframe> element and isn't "about:blank" and has a content
   * document
   */
  const isIFrameElemMeetsRequirements = (elem: Element): boolean => {
    try {
      if (!isIFrameElem(elem)) {
        return false;
      }
      // "about:blank"
      // if (!elem?.contentDocument) {
      //   trace(`isIFrameElemMeetsRequirements: false (missing
      // contentDocument)`); return false; }
      if (elem instanceof HTMLIFrameElement && elem?.src === 'about:blank') {
        trace(`isIFrameElemMeetsRequirements: false (about:blank)`);
        return false;
      }
      // width might be "100%" vs pixels
      // if (elem?.width < MIN_IFRAME_WIDTH || elem?.height <
      // MIN_IFRAME_HEIGHT) { trace(`isIFrameElemMeetsRequirements: false (too
      // small: ${window.innerWidth} x ${window.innerHeight})`); return false;
      // }
      if (!isVisible(elem)) {
        trace(`isIFrameElemMeetsRequirements: false (Not visible)`);
        return false;
      }
    } catch (err) {
      logerr(
          'isIFrameElemMeetsRequirements: true (cross domain iframe issue?) - maybe should return false?!?');
    }
    // we could check the dimensions and ignore very small iframes
    return true;
  };

  const parentElement = (elem: Element | null): Element | null => {
    try {
      if (!elem) {
        return null;
      }
      // no not remove
      if (elem?.parentElement) {return elem.parentElement;}
      // this next trick will keep walking up out of iframes (when it's on the
      // same domain) Potential problem: is that this frame MAY NOT BE THE BEST
      // match at the top level if multiple iframes
      if (IFRAME_PARENT_NODE_WORKS) {
        if (isRunningInIFrame() && (elem instanceof HTMLIFrameElement)) {
          // not sure this is working.
          const result = findIFrameInDocument(elem);
          trace(
              `parentNode: findIFrameInDocument walk up out of iframe ${result ?
                                                                        'SUCCESS' :
                                                                        'FAILED'}`);
          if (result) {
            return result;
          }
        }
      }
      if (FINDIFRAMEINDOCUMENT2 && (elem instanceof HTMLIFrameElement) && isElemInIFrame(elem)) {
        const iframeParent = findIFrameInDocument2(elem);
        trace(
            `parentNode: findIFrameInDocument2 walk up out of iframe ${iframeParent ?
                                                                       'SUCCESS' :
                                                                       'FAILED'}`);
        return iframeParent || null;  // may be undefined
      }
    } catch (err) {
      // can throw CSP error if crosses an iframe boundry.
      trace('parentElement err', err);
    }
    return null;
  };

  /**
   * We want to SAVE these results somewhere that automated unit tests can e
   * easily extract the scores to measure changes across revisions
   */
  const appendUnitTestResultInfo = (newStr: string) => {
    if (!EMBED_SCORES) {
      return;
    }
    try {
      if (isRunningInIFrame()) {
        return;
      }

      window.document?.body?.parentNode?.append(window.document.createComment(`
      ${newStr}

      `));
    } catch (err) {
      trace(err);
    }
  };

  /**
   * Converts element into a string like "<div class='Foo bar' />"
   */
  const PrintNode = (elem: Element | Node | string | null): string => {
    try {
      if (!elem) {
        return 'undefined';
      }
      if (typeof (elem) === 'string') {
        return elem;
      }

      let attrStr = '';
      if (elem instanceof Element && elem.attributes) {
        const attribs = elem?.attributes?.length ? [...elem.attributes] : [];
        for (const attr of attribs) {
          const value = attr.value ? `="${attr.value.substring(0, 2048)}"` : '';
          const {name} = attr;
          attrStr = `${attrStr} ${name}${value}`;
          if (attrStr.length > 1024) {
            attrStr = `${attrStr}...`;
            break;
          }
        }
      }
      const nodeName = elem?.nodeName?.toLowerCase()?.replace('#', '') ||
                       'UNKNOWN';
      return `<${nodeName}${attrStr} />`;
    } catch (err) {
      return ` UNKNOWN [${err}]`;
    }
  };

  // Intl.NumberFormat is slow unless cached like this.
  const fmtInt = new Intl.NumberFormat('en-US', {
    useGrouping: true,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const fmtFlt = new Intl.NumberFormat('en-US', {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  });

  /**
   * Rounds a float consistently - WTF javascript?
   */
  const round = (value: number): number => parseFloat(fmtFlt.format(value));

  const appendSelectorItemsToResultInfo = (
      strMessage: string, strSelector: string) => {
    const results = [strMessage];
    const matches = document.querySelectorAll(strSelector);
    for (const match of matches) {
      results.push(PrintNode(match));
    }
    const combinedResults = results.join(`\n`);
    appendUnitTestResultInfo(`${combinedResults}\n`);
  };

  const documentLoaded = () => ['complete', 'interactive'].includes(
      document.readyState);
  const getTopElemNode = () => window.document.body.parentElement ||
                               window.document.body;

  const getAttr = (elem: Element, attr: string): string | null => {
    try {
      // changed in 3.0.108, was not correctly detecting empty string matches.
      // watch for bugs
      if (typeof (elem?.getAttribute) !== 'function') {
        trace('element doesn\'t have getAttribute() function, return null');
        return null;
      }
      return elem.getAttribute(attr);
    } catch (err) {
      return null;
    }
  };

  const setAttr = (elem: Element | HTMLElement, attr: string, value: string) => {
    try {
      elem.setAttribute(attr, value);
    } catch (err) {
      trace(err);
    }
  };

  const removeAttr = (elem: Element |HTMLElement, attr: string) => {
    try {
      elem.removeAttribute(attr);
    } catch (err) {
      trace(err);
    }
  };

  /**
   * Returns true if any css classname starts with our prefix.
   */
  const hasAnyVideoMaxClass = (node: Element): boolean => {
    try {
      // node.className for an svg element is an array not a string.
      const className = getAttr(node, 'class');
      return (className !== null &&
              className.toString().toLowerCase().indexOf(PREFIX_CSS_CLASS) !==
              -1);  // "videomax-ext"
    } catch (err) {
      logerr(err);
    }
    return false;
  };

  /**
   * walk up parents and if any matches that are under invalid "paths"
   */
  const querySelectorAllFiltered = (
      elem: Element | Document,
      selector: string,
      filter: (e: Element) => boolean): Element[] => {
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
  };

  const isUnderCommonCntlParentPath = (childElem: Element): boolean => videomaxGlobals?.matchedCommonCntl?.contains(childElem) || false;

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
  const setAttrAndSave = (elem: Element | HTMLElement, attrKey: string, newValue: string) => {
    backupAttr(elem, attrKey);
    setAttr(elem, attrKey, newValue);
    setAttr(elem, VIDEO_MAX_DATA_ATTRIB_UNDO_TAG, '1');
  };

  /**
   * for readability, could flip around logic
   */
  const backupAttr = (elem: Element | HTMLElement, attrKey: string) => {
    const orgValue = getAttr(elem, attrKey);
    if (orgValue === null) { // anything to save?
      return;
    }
    const backupName = `${VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX}-${attrKey}`;
    if (getAttr(elem, backupName) !== null) {
      trace(`Attempting to resave attribute (not overwriting)? ${PrintNode(
          elem)}"`);
    } else {
      setAttr(elem, backupName, orgValue);
      setAttr(elem, VIDEO_MAX_DATA_ATTRIB_UNDO_TAG, '1');
    }
  };

  let cachedSaveStyleOverlapsSiteResult: boolean | null = null;

  const isSaveStyleOverlapsSite = (): null | boolean => {
    if (cachedSaveStyleOverlapsSiteResult === null) {
      cachedSaveStyleOverlapsSiteResult = smellsLikeMatch(getPageUrl(),
                                                          RESTORE_STYLE_SITES);
    }
    return cachedSaveStyleOverlapsSiteResult;
  };

  /**
   * turns 'style' attribute into js object {}
   */
  const smartParseStyles = (inStrParam: string): object => {
    const result: KeyValuePair = {};
    let currentStart = 0;
    let inStr = inStrParam.trim();
    // if it doesn't end with a ; delim add it.
    inStr = inStr.endsWith(';') ? inStr : `${inStr};`;
    try {
      while (currentStart < inStr.length) {
        // lame, but indexOf is probably faster than turning string into array
        // of characters? we pretend indexOf() took a set of characters and
        // matched first one.
        const ii = Math.min(...[
          inStr.indexOf(`;`, currentStart),
          inStr.indexOf(`'`, currentStart),
          inStr.indexOf(`"`, currentStart)].filter(n => n >= 0));
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
  };

  /**
   * merge a saved style string w/ the current style
   */
  const styleStrToObject = (
      styleStr: string, mergeIntoObj: KeyValuePair): KeyValuePair => {
    // we use the json parser because it can handle `key: "value;'fooo'";`
    try {
      const stylesObj = smartParseStyles(styleStr);
      // modern way to merge objects
      return {...mergeIntoObj, ...stylesObj};
    } catch (err) {
      logerr(`styleStrToObject err 
      styleStr=${styleStr}`, err);
      return mergeIntoObj;
    }
  };

  /**
   * find and restore all the saved attributes. If you touch this, verify
   * youtube toggle and crunchyroll
   */
  const restoreAllSavedAttr = (elem: Element) => {
    // filter on `data-videomax-saved-*` attributes
    const attrNames = /** @type string[] */ [
      ...(elem?.getAttributeNames() || [])].filter(
        (attr) => attr.startsWith(VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX)); // clone
                                                                       // array
    for (const eachAttrName of attrNames) {
      const savedValue = getAttr(elem, eachAttrName);
      // we need to get the name from the suffix
      const originalAttrName = eachAttrName.substring(
          VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX.length + 1);
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
      if (originalAttrName === 'style') {
        // we add our changes back but if there are new changes, we append.
        /** @type {{[key: string]: string}} */
        const currentStyleParts: {
          [key: string]: string;
        } = styleStrToObject(savedValue,
                             styleStrToObject(currentVal, {}));

        let mergedValue = Object.keys(currentStyleParts).map(
            key => `${key}: ${currentStyleParts[key]}`).join('; ');
        if (mergedValue.length > 0 && !mergedValue.endsWith(';')) {
          // we want a trailing ; for our opacity check below
          mergedValue = `${mergedValue};`;
        }

        // if you zoom during starting pre-video commercials,
        // then some sites have the main video hidden (cruchyroll).
        // special case to make sure the style doesn't have "opacity: 0;"
        // maybe need to extend to other types of "hidden" approaches?
        mergedValue = mergedValue.replace(`opacity: 0;`, '');
        setAttr(elem, originalAttrName, mergedValue); // restore it.
      }
    }
    // we're all done restoring, remove our marker tag
    removeAttr(elem, VIDEO_MAX_DATA_ATTRIB_UNDO_TAG);
  };

  const isStopNodeForCommonContainer = (node: Node): boolean => {
    const nodename = (node?.nodeName?.toLowerCase() || '') as HtmlElementType;
    return STOP_NODES_COMMON_CONTAINER.includes(nodename);
  };

  const isAlwaysHideElem = (node: Node):boolean => {
    const nodename = (node?.nodeName?.toLowerCase() || '') as HtmlElementType;
    return ALWAYS_HIDE_NODES.includes(nodename);
  }

  /// / finding video logic. this code is a bit of a mess.
  const findLargestVideoNew = (doc: Document): boolean => {
    try {
      if (!videomaxGlobals.elementMatcher) {
        logerr(`elementMatcher should NOT be null`);
        return false;
      }
      // todo: should this always be doc versus document?!?
      {
        const allvideos = document.querySelectorAll('video');
        for (const eachvido of allvideos) {
          videomaxGlobals.elementMatcher.checkIfBest(eachvido);
        }
      }
      // now go into frames from the main frame.
      // this can cause problems trying to walk back up out of frame later when
      // we're maximizing path
      if (typeof (doc?.querySelectorAll) === 'function') {
        const frames = doc.querySelectorAll('iframe');
        for (const frame of frames) {
          try {
            videomaxGlobals.elementMatcher.checkIfBest(frame);

            if (typeof (frame?.contentWindow?.document?.querySelectorAll) !==
                'function') {
              continue;
            }
            const allvideos = frame.contentWindow.document.querySelectorAll(
                'video');
            for (const eachvido of allvideos) {
              videomaxGlobals.elementMatcher.checkIfBest(eachvido);
            }
          } catch (err) {
            if (String(err).toLowerCase().indexOf('blocked a frame') !== -1) {
              trace('iframe security blocked cross domain - expected');
            } else {
              logerr(err);
            }
          }
        }
      }
      return (videomaxGlobals?.elementMatcher?.getMatchCount() > 0);
    } catch (err) {
      trace(err);
      return false;
    }
  };

  const getOwnerDoc = (node: Element|Node) => {
    if (node instanceof Document) {
      return node;
    }
    return node?.ownerDocument || document;
  };

  const getVideoSource = (videoElem: HTMLVideoElement | HTMLIFrameElement): string => {
    // see if we can get this video's source.
    if (videoElem?.src?.length) {
      return videoElem.src;
    }
    const isVideo = (videoElem.nodeName.toLowerCase() === 'video');
    if (isVideo) {
      // sometimes there's a <video><source src=""></video> approach.
      // this is used when there might be different data formatting available
      // for the same video (e.g. one for video/mp4 and another for
      // video/webm). if a site is going through this much work, it's probably
      // NOT an ad.
      const matchedSources = videoElem.getElementsByTagName('source');
      if (matchedSources.length > 0) {
        // there may be multiple, but they are likely very similar, probably
        // just different codex's
        // @ts-ignore currentSource is likely wrong, but need to verify
        return matchedSources[0]?.src || matchedSources[0]?.currentSrc || '';
      }
    }
    trace(
        `getVideoSource for ${PrintNode(videoElem)} failed to find source url`);
    return ''; // failed
  };

  const getElemsDocumentView = (node: Node): Window | null => getOwnerDoc(node)?.defaultView || null;

  /**
   * This is kind of an expensive op, maybe cache. The CSSStyleDeclaration is
   * massive.
   */
  const getElemComputedStyle = (node: Element): CSSStyleDeclaration => {
    try {
      const view = getElemsDocumentView(node);
      return view?.getComputedStyle(node, null) || {} as CSSStyleDeclaration;
    } catch (err) {
      // can throw if cross iframe boundary
      logerr(err);
      return {} as CSSStyleDeclaration;
    }
  };


  const isEmptyRect = (rect: DomRect): boolean => (rect.width < 2 || rect.height < 2);

  const isIgnoredNode = (elem: Node): boolean => {
    const nodename = (elem?.nodeName?.toLowerCase() || '') as HtmlElementType;
    return IGNORE_NODES.includes(nodename);
  };

  /**
   * when we're trying to find the common container, don't count these
   */
  const isIgnoreCommonContainerNode = (elem: Node): boolean => {
    const nodename = (elem?.nodeName?.toLowerCase() || '') as HtmlElementType;
    return IGNORE_COMMON_CONTAINER_COUNT_NODES.includes(nodename);
  };

  const isNotIgnoreCommonContainerNode = (elem: Node): boolean => !isIgnoreCommonContainerNode(elem);

  const getTopDocumentForIFrameBreakOut = (elem: Node):
      {
        document: Document,
        element: Node | null;
      } => {
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
      logerr('getTopDocumentForIFrameBreakOut', err);
    }
    return {
      document: localdoc,
      element: elem,
    };
  };

  function forceRefresh(elem: Element | Window | null) {
    if (!elem) {
      return;
    }
    if (isDoomScrollingSite()) {
      // triggering a resize will likely cause DOM to rerender and mess up our
      // matched video.
      trace('NOT trigging refresh events for doomscroller sites');
      return;
    }
    if (typeof (elem?.dispatchEvent) !== 'function') {
      return;
    }
    // we now need to force the flash to reload by resizing... easy thing is to
    // adjust the body
    setTimeout(() => {
      try {
        elem.dispatchEvent(new Event('resize'));
        elem.dispatchEvent(new Event('visabilitychange'));
      } catch (err) {
        logerr(err);
      }
    }, 10);
  }

  // cache this. Trying to avoid hard-coding "all 0s ease 0s"
  let g_cachedDefaultTransitionString = '';
  /**
   * @param compStyleElem {CSSStyleDeclaration}
   * @return {boolean}
   */
  const hasTransitionEffect = (compStyleElem: CSSStyleDeclaration): boolean => {
    if (g_cachedDefaultTransitionString.length === 0) {
      const bodystyle = getElemComputedStyle(document.body);
      g_cachedDefaultTransitionString = bodystyle.transition;
      trace(
          `g_cachedDefaultTransitionString: "${g_cachedDefaultTransitionString}"`);
    }
    return compStyleElem?.transition !== g_cachedDefaultTransitionString;
  };

  /**
   * Will load computed style and work down dom as long as there's only ONE
   * child element at each level. If the caller has compStyleElem, then first
   * call hasTransitionEffect
   */
  const hasTransitionEffectRecursive = (elem: Element, skipParent: boolean = false): boolean => {
    if (!skipParent) {
      if (hasTransitionEffect(getElemComputedStyle(elem))) {
        return true;
      }
    }
    if (!OVERLAPS_REQUIRE_TRANSITION_EFFECTS_RECURSIVE) {
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
  };

  let containDbgMsg = '';

  /**
   * we going to work our way up looking for some element that has a bunch of
   * children but few siblings. We're only going to search up
   * (CHECK_PARENTS_LEVELS_UP_MAX) elements, then give up. For <video>
   * matching, the playback controls are "position: absolute" under a common
   * div "position: relative".
   */
  const findCommonContainerFromMatched = (doc: Document = document): Element | Node | null => {
    if (DEBUG_ENABLED) {
      const matches = doc.querySelectorAll(`.${MARKER_COMMON_CONTAINER_CLASS}`);
      if (matches?.length) {
        // https://www.nbcnews.com/now  iframe that we can drill down into. it
        // finds a -common in the iframe but the actual controls are in the
        // parent document.
        logwarn(
            `Already found common container, shouldn't match two. IFrame seeing outside frame issue? Cont.`,
            matches);
      }
    }
    if (!videomaxGlobals.matchedIsHtml5Video) {
      return videomaxGlobals?.matchedVideo?.parentElement ||
             videomaxGlobals?.matchedVideo?.parentNode as Node;
    }

    // exceptions
    const EXCEPTIONS = {
      'pluto.tv/': 'video-player-layout',
      'youtube.com/shorts': 'player-container',
    };
    for (const [eachException, eachClassName] of Object.entries(EXCEPTIONS)) {
      if (doc.location?.href?.includes(eachException)) {
        // finding the common parent is a special case for this strange layout.
        const commonMatches = doc?.getElementsByClassName(eachClassName);
        for (const eachCommonMatch of commonMatches) {
          if (eachCommonMatch.contains(videomaxGlobals.matchedVideo)) {
            videomaxGlobals.matchedCommonCntl = eachCommonMatch;
            eachCommonMatch?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
            return eachCommonMatch;
          }
        }
        break; // got a match and only one possible match
      }
      // if it doesn't match, then site maybe changed, just fallback to regular
      // matching
    }

    const videoElem = videomaxGlobals.matchedVideo;
    const videoRect = videomaxGlobals.matchVideoRect;

    const countChildren = (e: Element, recurseFirst: boolean = true, runningCount: number = 0): number => {
      let count = runningCount;
      if (NO_SEARCHING_IGNORED_NODES_COMMON && isIgnoreCommonContainerNode(e)) {
        if (COMMON_PARENT_SCORES) {
          containDbgMsg += `\n     -> isIgnoreCommonContainerNode ${PrintNode(
              e)}`;
        }
        return runningCount;
      }
      if (recurseFirst) {
        // instanceof Element required because querySelectorAll
        if (USE_BOOST_SCORES_FIND_COMMON && e instanceof Element) {
          const boostMatches = NO_SEARCHING_IGNORED_NODES_COMMON ?
                               querySelectorAllFiltered(e, `[role="slider"]`,
                                                        isNotIgnoreCommonContainerNode) :
                               e.querySelectorAll(`[role="slider"]`);
          // ...e.querySelectorAll(`[role="presentation"]`)]; // player puts
          // this on every preview video on the page
          count += boostMatches.length * 2;  // 2x points if there's a slider
                                             // under this element.
          if (COMMON_PARENT_SCORES) {
            containDbgMsg += `\n Slider count: BOOST +${boostMatches.length}*2 result:${count}`;
          }

          if (USE_BOOST_SCORES_REGEX_FIND_COMMON &&
              smellsLikeMatch(e, [/control/i])) {
            count++;
            if (COMMON_PARENT_SCORES) {
              containDbgMsg += `\n Slider count: BOOST REGEX +1 result:${count}`;
            }
          }
        }

        if (USE_NERF_SCORES_FIND_COMMON) {
          const nerfMatches = NO_SEARCHING_IGNORED_NODES_COMMON ?
              [
                ...querySelectorAllFiltered(e, `[role="toolbar"]`,
                                            isNotIgnoreCommonContainerNode),
                ...querySelectorAllFiltered(e, `[role="navigation"]`,
                                            isNotIgnoreCommonContainerNode)] :
              [
                ...e.querySelectorAll(`[role="toolbar"]`),
                e.querySelectorAll(`[role="navigation"]`)];

          count -= nerfMatches.length * 2;  // -2x points if there's a
                                            // navigation components under this
                                            // element.
          if (COMMON_PARENT_SCORES) {
            containDbgMsg += `\n Slider count: NERF -${nerfMatches.length}*2 result:${count}`;
          }
        }

        // Tubi is horrible about 508 accessibility. It just uses <svg> for all
        // controls. It also removes the elements when they aren't active, so
        // they are impossible to find. example how to select if they weren't
        // hidden const volSgvCount   = [...e.querySelectorAll(`svg >
        // title`)].filter( (e) =>
        // e?.innerHTML?.toLowerCase().includes("volume")).length;
      }
      const checkChildren = [...e.children].filter(
          el => isNotIgnoreCommonContainerNode(el));
      let index = 0; // used for debugging only.
      for (const eachChild of checkChildren) {
        try {
          index++;
          const compStyleElem = getElemComputedStyle(eachChild); // $$$
          const rect = getCoords(eachChild);
          if (isBoundedRect(videoRect, rect)) {
            count++;
            if (COMMON_PARENT_SCORES) {
              containDbgMsg += `\n ${recurseFirst ?
                                     '' :
                                     '\t'} #${index}\t isBoundedRect: \t +1 result: \t ${count}`;
            }
          }
          if (compStyleElem?.position === 'absolute') {
            count++;
            if (COMMON_PARENT_SCORES) {
              containDbgMsg += `\n ${recurseFirst ?
                                     '' :
                                     '\t'} #${index}\t absPosition:   \t +1 result: \t ${count}`;
            }
          }
          if (INCLUDE_TRANSITION_WEIGHT_FOR_COMMON_SCORE &&
              hasTransitionEffect(compStyleElem)) {
            // tag it so we don't have to call getElemComputedStyle again later.
            eachChild.classList?.add(MARKER_TRANSITION_CLASS);
            count++;
            if (COMMON_PARENT_SCORES) {
              containDbgMsg += `\n  ${recurseFirst ?
                                      '' :
                                      '\t'} #${index}\t transition:   \t +1 result: \t ${count} "${compStyleElem?.transitionTimingFunction}"`;
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
      if (COMMON_PARENT_SCORES && recurseFirst === false) {
        trace(`\tChild Common Score \n\t${PrintNode(
            e)}\n${containDbgMsg}\n\tTotals: before ${runningCount} \t after: ${count}`);
        containDbgMsg = '';
      }
      return count;
    };

    if (!g_walker || !videoElem) {
      logerr("g_walker or videoElem is null. failing");
      return null;
    }
    const savedWalkerCurrentNode = g_walker.currentNode; // restore at end
    g_walker.currentNode = videoElem as Node;
    let bestMatchCommonParent: HTMLElement = videoElem;
    let bestMatchWeight = 1;

    let checkParents = CHECK_PARENTS_LEVELS_UP_MAX;
    while (g_walker.parentNode() && checkParents > 0) {
      try {
        if (!(g_walker.currentNode instanceof Element)) {
          continue;
        }
        const currentElem = g_walker.currentNode as HTMLElement;

        // these could be part of while condition, but we may want to
        // debug/trace on them.
        checkParents--; // counting down to zero.
        if (isStopNodeForCommonContainer(currentElem)) {
          trace(
              `  findCommonContainerFromElem stopped because hit stopping node`,
              currentElem);
          break;
        }
        const weight = countChildren(currentElem);
        trace(`findCommonContainerFromMatched ${weight > bestMatchWeight ?
                                                'NEW BEST' :
                                                ''} \n\t weight:${weight} \n\t ${PrintNode(
            g_walker.currentNode)} \n\t`);
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
    if (doc.location?.host?.includes('tubitv.') &&
        bestMatchCommonParent?.parentNode &&
        bestMatchCommonParent.parentNode instanceof Element) {
      trace('findCommonContainerFromElem: tubi specialcase using parent.');
      bestMatchCommonParent = bestMatchCommonParent.parentElement as HTMLElement;
    }

    // exception, never match the playback video itself, go to it's parent
    if (bestMatchCommonParent.nodeName.toLowerCase() === 'video') {
      trace('findCommonContainerFromElem matched video. Using parent');
      bestMatchCommonParent = bestMatchCommonParent.parentElement as HTMLElement;
    }
    videomaxGlobals.matchedCommonCntl = bestMatchCommonParent;

    bestMatchCommonParent?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
    return bestMatchCommonParent;
  };

  const exceptionToRuleFixup = (doc: Document | null, videoElem: Element | Node | null) => {
    if (!doc || !videoElem || !(videoElem instanceof Element)) {
      return;
    }
    // some sites have the playback controls completely cover the video, if we
    // don't adjust the height, then they are at the top or middle of the
    // screen.
    const existingPlaybacks = doc.querySelectorAll(
        `.${PLAYBACK_CNTLS_CSS_CLASS}`);
    if (existingPlaybacks?.length) {
      const videoElemHeight = getOuterBoundingRect(videoElem).height || 1;
      for (const eachPlaybackCntl of existingPlaybacks) {
        const height = getOuterBoundingRect(eachPlaybackCntl).height || 1;
        const ratio = height / videoElemHeight;
        if (height > 10 && ratio > 0.80) {
          trace(
              `=====\n\tADJUST_PLAYBACK_CNTL_HEIGHT seems like it should be full height\n=====`);
          eachPlaybackCntl.classList.add(PLAYBACK_CNTLS_FULL_HEIGHT_CSS_CLASS);
        }
      }
    }
  };

  /**
   * Some cases where videos are hidden in iframes or nested iframes cause us
   * to miss hiding some simblings
   * @param doc {Document}
   */
  const lastDitchHide = (doc: Document) => {
    if (LAST_DITCH_HIDE) {
      const matches = [
        ...doc.getElementsByClassName(MAX_CSS_CLASS),
          ...doc.getElementsByClassName(`${PREFIX_CSS_CLASS}-max`)];
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
                trace(
                    `lastDitchHide hasTransitionEffectRecursive=true not hiding. ${PrintNode(
                        eachSibling)}`);
              }
              if (NOHIDENODE_REAPPLY) {
                noHideElement(eachSibling);
                continue;
              }
            }
            if (underCommonCntl &&
                getAllElementsThatSmellsLikeControls(eachSibling).length) {
              if (DEBUG_HIDENODE) {
                trace(`lastDitchHide Smells like Controls. ${PrintNode(
                          eachSibling)}`,
                      getAllElementsThatSmellsLikeControls(eachSibling));
              }
              if (NOHIDENODE_REAPPLY) {
                noHideElement(eachSibling);
                continue;
              }
            }
            if (DEBUG_HIDENODE) {
              trace(`lastDitchHide Hiding. ${PrintNode(eachSibling)}`);
            }
            hideNode(eachSibling);
          }
        } catch (err) {
          logerr(err);
        }
      }
    }
  };

  const isSkippedNode = (el: Element): boolean => SKIPPED_NODE_NAMES.includes(
      el?.nodeName.toLowerCase());

  const isSkippedNodeForCntl = (el: Element): boolean => SKIPPED_NODE_NAMES_FOR_PLAYBACK_CTRLS.includes(
      el?.nodeName.toLowerCase());

  const isSkippedNonDiv = (el: Element): boolean => !['div', 'section'].includes(
      el.nodeName.toLowerCase());

  const isVisibleWalkerElem = (node: Node): number => {
    if (!(node instanceof HTMLElement) || isSkippedNode(node)) {
      return NodeFilter.FILTER_SKIP;
    }
    try {
      // chrome has a new method!
      if (USE_OLD_FAST_IS_VISIBLE_CHECK_IN_WALKER) {
        const vis = !!node?.offsetWidth &&
                    !!node?.offsetHeight &&
                    (typeof node.getClientRects === 'function') &&
                    !!node?.getClientRects()?.length;
        return vis ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }

      const vis = (node?.checkVisibility && node?.checkVisibility({
                                                                checkOpacity: true,
                                                                checkVisibilityCSS: true,
                                                              })) || true;
      return vis ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;

    } catch (err) {
      logerr(err, node);
      return NodeFilter.FILTER_SKIP;
    }
  };

  const ReApplyUpFromElem = (elem: Element | null, className: string, optStopElem: Element | null = null) => {
    if (!g_walker || !elem) {
      logerr('g_walker or elem is null');
      return;
    }

    const saveWalker = g_walker.currentNode;
    g_walker.currentNode = elem;
    do {
      const currentElem = g_walker.currentNode as HTMLElement; // filter only allows html elements
      try {
        if (hasAnyVideoMaxClass(currentElem)) {
          continue;
        }
        if (IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE && className === MAX_CSS_CLASS &&
            !isVisible(currentElem)) {
          if (DEBUG_HIDENODE) {
            trace(
                'ReApplyUpFromElem IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE. Elem is not visible, so don\'t maximize, just set to no_hide');
          }
          currentElem.classList.add(NO_HIDE_CLASS);
        } else {
          currentElem.classList.add(className);
        }
        if (ALWAYS_BACK_UP_STYLES) {
          backupAttr(currentElem, 'style');
        }
      } catch (err) {
        logerr(`walker error for ${PrintNode(g_walker.currentNode)}`, err);
      }
    } while (g_walker.parentNode() &&
             (optStopElem ?
              !optStopElem.isSameNode(g_walker.currentNode) :
              true));
    g_walker.currentNode = saveWalker;
  };

  /**
   * This version uses ParentNode and can walk up out of IFrames.
   * It also causes VideoMax to fail on some sites.
   */
  const ReApplyUpFromElem2 = (elem: Element, className: string, optStopElem: Element | null = null) => {
    let count: number = 0;
    let currentNode: Element | null = elem;
    if (videomaxGlobals.matchedIsHtml5Video &&
        currentNode.isEqualNode(videomaxGlobals.matchedVideo)) {
      // html5 videos often put con[trols next to the video in the dom
      // (siblings), so we want to go up a level
      currentNode = parentElement(currentNode);
    }
    let safetyCheck = 200;
    while (currentNode && safetyCheck--) {
      try {
        if (!hasAnyVideoMaxClass(currentNode)) {
          if (IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE && className ===
              MAX_CSS_CLASS &&
              !isVisible(currentNode)) {
            if (DEBUG_HIDENODE) {
              trace(
                  'ReApplyUpFromElem IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE. Elem is not visible, so don\'t maximize, just set to no_hide');
            }
            currentNode?.classList?.add(NO_HIDE_CLASS);
          } else {
            currentNode?.classList?.add(className);
            count++;
          }
          if (ALWAYS_BACK_UP_STYLES) {
            backupAttr(currentNode, 'style');
          }
        }
        const nextNode = parentElement(currentNode);
        if (nextNode === currentNode) { // loop detect
          trace('ReApplyUpFromElem loop detected', PrintNode(currentNode));
          break;
        }
        if (nextNode === null ||
            (optStopElem ? optStopElem.isSameNode(nextNode) : false)) {
          trace('ReApplyUpFromElem hit optStopElem node or parent is null',
                PrintNode(nextNode));
          break;
        }
        currentNode = nextNode;
      } catch (err) {
        logerr(`walker error for ${PrintNode(currentNode)}`, err);
      }

    }
    trace(`ReApplyUpFromElem: ${count}`);
    return count;
  };

  /**
   * Adds the maximized class to all elements from matched video up.
   * It often gets cleared after ads play because classLists are reset after
   * they play
   */
  const maximizeUpFromVideo = () => {
    if (!videomaxGlobals.matchedVideo) {
      return;
    }
    ReApplyUpFromElem(videomaxGlobals.matchedVideo, MAX_CSS_CLASS);
    // special case for when videos are in iframes that are not on a different
    // domain. e.g. dailymotion.com
    if (!isRunningInIFrame() && videomaxGlobals.matchedIsHtml5Video &&
        isElemInIFrame(videomaxGlobals.matchedVideo)) {
      const root = videomaxGlobals.matchedVideo.getRootNode();
      const iframe = findIFrameInDocument(root);
      if (iframe) {
        trace(`Running special case for accessible iframes`);
        ReApplyUpFromElem(iframe, MAX_CSS_CLASS);
      }
    }
  };

  /**
   * @param elem {HTMLElement}
   */
  function tagElementAsMatchedVideo(elem: Element | HTMLIFrameElement) {
    if (!(elem instanceof HTMLVideoElement ||
          elem instanceof HTMLIFrameElement)) {
      logerr(`tagElementAsMatchedVideo is not a video or iframe. FAILING`, elem);
      return;
    }
    videomaxGlobals.matchedVideo = elem;
    videomaxGlobals.matchVideoRect = getCoords(elem);
    videomaxGlobals.matchedIsHtml5Video = elem.nodeName.toLowerCase() ===
                                          'video';
    videomaxGlobals.matchedVideoSrc = getVideoSource(elem);
    videomaxGlobals.processInFrame = isRunningInIFrame(); // for debugging
    // set the data-videomax-id = "zoomed" so undo can find it.
    setAttr(elem, `${VIDEO_MAX_ATTRIB_FIND}`, VIDEO_MAX_ATTRIB_ID);
    elem?.classList?.add(PLAYBACK_VIDEO_MATCHED_CLASS, MAX_CSS_CLASS);
  }

  /**
   *
   * @param node {Node | HTMLElement}
   * @return {Node | HTMLElement}
   */
  const fixUpAttribs = (node: Node | HTMLElement): Node|HTMLElement => {
    if (!node || !(node instanceof Element)) {
      return node;
    }
    trace(`FixUpAttribs for elem type ${node?.nodeName}`, node);


      // tagElementAsMatchedVideo(node);  // 14Jun removed, why here?
      const attribs = node.attributes;

      trace(`attrib count = ${attribs.length}`);
      for (const eachattrib of attribs) {
        try {
          const {name} = eachattrib;
          const orgValue = eachattrib.value;
          let newValue = '';

          // skip our own.
          if (name.startsWith(PREFIX_CSS_CLASS)) {
            continue;
          }
          trace(`FixUpAttribs found attrib '${name}': '${orgValue}'`);
          switch (name.toLowerCase()) {
            case 'width':
              newValue = SCALESTRING_WIDTH; // 'calc(100vw)' works too?
              break;

            case 'height':
              newValue = SCALESTRING_HEIGHT; // 'calc(100vh)' works too?
              break;

            case 'data-width':
              newValue = 'calc(100vw)';
              break;

            case 'data-height':
              newValue = 'calc(100vh)';
              break;

            case 'style':
              newValue = `${orgValue};`; // remove at end. needed for parsing
              newValue = newValue.replace(/width\s*:\s*[^;&]+/i,
                                          `width: ${SCALESTRING_WIDTH}`);
              newValue = newValue.replace(/height\s*:\s*[^;&]+/i,
                                          `height: ${SCALESTRING_HEIGHT}`);
              newValue = newValue.substring(0, newValue.length - 1); // removing
              // trailing
              // ; we
              // added
              // above
              break;

            case 'scale':
              newValue = 'showAll';
              break;

              // case 'autoplay':
              //   if (orgValue === '0') {
              //     newValue = '1';
              //   } else {
              //     newValue = 'true';
              //   }
              //   break;

              // default:
            case 'flashlets':
            case 'data':
              newValue = grepFlashlets(orgValue);
              break;

            case 'controls':
              newValue = '1';
              break;

            case 'disablepictureinpicture':
              newValue = '0';
              break;

            default:
              break;
          }

          // replace only if set and not different
          if (newValue !== '' && newValue !== orgValue) {
            trace(`FixUpAttribs changing attribute: '${name}'
            old: '${orgValue}'
            new: '${newValue}'`, node);
            setAttrAndSave(node, name, newValue);
          }
        } catch (ex) {
          logerr('exception in looping over properties: ', ex);
        }
      }


    {
      // collect all changes here, then apply in a single writing loop. more
      // efficient for dom update
      const newParams: KeyValuePair = {};
      for (const eachnode of node.childNodes) {
        try {
          if (!(eachnode instanceof Element) ||eachnode.nodeName.toUpperCase() !== 'PARAM') {
            continue;
          }
          const attrName = getAttr(eachnode, 'name') || '';
          const attrValue = getAttr(eachnode, 'value') || '';

          trace(`  FixUpAttribs found param '${attrName}': '${attrValue}'`);
          if (['FLASHLETS', 'DATA'].includes(attrName.toUpperCase())) {
            newParams[attrName] = grepFlashlets(attrValue);
          } else {
            // we might override below.
            newParams[attrName] = attrValue;
          }
        } catch (ex) {
          logerr('ERROR reading flash params ex', ex);
        }
      }

      // define all nodes
      newParams.bgcolor = '#000000';
      newParams.scale = 'showAll';
      newParams.menu = 'true';
      newParams.quality = 'high';
      newParams.width = SCALESTRING_WIDTH;
      newParams.height = SCALESTRING_HEIGHT;
      newParams.quality = 'high';
      // newParams.autoplay = "true";

      // edit in place
      for (const eachnode of node.childNodes) {
        if (!(eachnode instanceof Element) ||eachnode.nodeName.toUpperCase() !== 'PARAM') {
          continue;
        }
        const name = getAttr(eachnode, 'name') || '';
        const orgValue = getAttr(eachnode, 'value') || '';

        if (Object.prototype.hasOwnProperty.call(newParams, name)) { // is this one we care about?
          trace(`FixUpAttribs changing child param '${name}'
            old: '${orgValue}'
            new: '${newParams[name]}'`);

          setAttrAndSave(eachnode, name, newParams[name]);
        }
      }
    }
    forceRefresh(node);
    return node;
  };

  /**
   * @param flashletsval {string}
   * @return {string}
   */
  const grepFlashlets = (flashletsval: string): string => {
    let result = flashletsval;
    if (result !== '' && result?.match(/[=%]/i) !== null) {
      const rejoinedResult = [];
      const params:KeyValuePair = parseParams(flashletsval);
      if (params) {
        for (const key of getKeys(params)) {
          if (Object.prototype.hasOwnProperty.call(params, key)) {
            switch (String(key).toLocaleLowerCase()) {
              case 'width':
              case 'vwidth':
              case 'playerwidth':
              case 'height':
              case 'vheight':
              case 'playerheight':
                params[key] = SCALESTRING;
                break;

              case 'scale':
                params[key] = 'showAll';
                break;

                // case "autoplay":
                //   if (params[key] === "0") {
                //     params[key] = "1";
                //   } else {
                //     params[key] = "true";
                //   }
                //   break;

              case 'flashlets':
              case 'data': {
                const value = params[key];
                if (value?.match(/[=%]/i) !== null) {
                  params[key] = grepFlashlets(value);
                }
              }
                break;
              default:
                break;
            }

            rejoinedResult.push(`${key}=${encodeURIComponent(params[key])}`);
          }
        }

        result = rejoinedResult.join('&');
        if (flashletsval.search(/\?/i) === 0) { // startswith
          result = `?${result}`;
        }
      }
      trace(
          `Replaced urls params:\n\tBefore:\t${flashletsval}\r\n\tAfter\t${result}`);
    }
    return result;
  };

  const noHideElement = (elem: Element) => {
    try {
      if (hasAnyVideoMaxClass(elem) || isAlwaysHideElem(elem)) {
        return;
      }
      if (DEBUG_HIDENODE) {
        trace(`Setting noHideElement for ${PrintNode(elem)}`);
      }
      elem.classList.add(NO_HIDE_CLASS);
    } catch (err) {
      trace(err);
    }
  };


  const hideNode = (elem: Node | Element,
                    skipPrep: boolean = false): // Use the "-prep" style suffix so adding doesn't change it until we're done
      boolean => {
    if (!(elem instanceof Element)) {
      // we use classnames to hide, so must be Element
      return false;
    }
    const printElem = DEBUG_HIDENODE ? PrintNode(elem) : '';
    if (isIgnoredNode(elem)) {
      if (DEBUG_HIDENODE) {
        trace(`  hideNode: NOT HIDING isIgnoredNode ${printElem}`);
      }
      return false;
    }

    if (hasAnyVideoMaxClass(elem)) {
      // if we hit a "no-hide" then we need to add the overlap!
      if (elem.classList.contains(NO_HIDE_CLASS)) {
        if (DEBUG_HIDENODE) {
          trace(
              `  hideNode: Adding overlap class since it contained NO_HIDE_CLASS! ${printElem}`);
        }
        addOverlapCtrl(elem);
      } else if (DEBUG_HIDENODE) {
        if (DEBUG_HIDENODE) {
          trace(
              `  hideNode: NOT HIDING already contains videomax class ${printElem}`);
        }
      }
      return false;
    }

    // some never hide elements.
    if (isSpecialCaseNeverHide(elem)) {
      if (DEBUG_HIDENODE) {
        trace(`  hideNode: NOT HIDING special case ${printElem}`);
      }
      return false;
    }

    if (DEBUG_HIDENODE && elem instanceof Element) {
      trace(`  hideNode: HIDING ${printElem}`);
    }
    elem.classList.add(
        skipPrep ? `${PREFIX_CSS_CLASS}-hide` : HIDDEN_CSS_CLASS); // prep
    return true;
  };

  const addOverlapCtrl = (elem: Node | Element) => {
    // we assume we can set attributes
    if (!(elem instanceof Element) || isIgnoredNode(elem)) {
      if (DEBUG_HIDENODE) {
        trace('NOT addOverlapCtrl isIgnoredNode:', IGNORE_NODES, elem);
      }
      return;
    }
    const debugPrintNode = DEBUG_HIDENODE ? PrintNode(elem) : '';
    if (hasAnyVideoMaxClass(elem)) {
      if (DEBUG_HIDENODE) {
        trace(`NOT addOverlapCtrl containsAnyVideoMaxClass: ${debugPrintNode}`);
      }
      return;
    }
    if (isSpecialCaseNeverOverlap(elem)) {
      if (DEBUG_HIDENODE) {
        trace(`NOT addOverlapCtrl special case: ${debugPrintNode}`);
      }
      return;
    }
    // the issue: controls overlapping should have a transition effect but
    // their are exceptions: Skip ad buttons... and ads!
    if (OVERLAPS_REQUIRE_TRANSITION_EFFECTS &&
        !hasTransitionEffect(getElemComputedStyle(elem)) &&
        !hasTransitionEffectRecursive(elem, true)) {

      // this is risky because some "skip ads" buttons do not disappear.
      if (DEBUG_HIDENODE) {
        trace(`NOT addOverlapCtrl !hasTransitionEffect: ${debugPrintNode}`);
      }
      return;
    }
    if (DEBUG_HIDENODE) {
      trace(`addOverlapCtrl: ${debugPrintNode}`);
    }
    elem?.classList?.add(OVERLAP_CSS_CLASS);
    if (SAVE_STYLE_FOR_OVERLAPs && isSaveStyleOverlapsSite()) {
      // we don't want a local style to conflict with the class we're adding
      backupAttr(elem, 'style');
    }
  };

  /**
   * All siblings as an array, (but not the node passed)
   */
  const getSiblings = (elem: Element, skipFunction:(el: Element) => boolean = isSkippedNode): Element[] => {
    try {
      const parent = elem.parentElement || elem.parentNode;
      if (!parent?.children) {
        return [];
      }
      const result = [...parent.children].filter(c => {
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
        trace(`getSiblings`, result);
      }
      return result;
    } catch (err) {
      logerr(err);
      return [];
    }
  };

  /**
   * @return {number}
   */
  function rehideUpFromVideo(): number {
    lastDitchHide(document);

    let reHideCount: number = 0;
    let current: Element | null = videomaxGlobals.matchedVideo;
    if (videomaxGlobals.matchedIsHtml5Video && videomaxGlobals.matchedVideo) {
      // html5 videos often put controls next to the video in the dom
      // (siblings), so we want to go up a level
      current = parentElement(videomaxGlobals.matchedVideo);
    }

    let safetyCheck = 200;
    while (current && safetyCheck--) {
      const siblings = getSiblings(current);
      for (const eachNode of siblings) {
        // we don't hide the tree we're walking up, just the siblings
        if (hideNode(eachNode)) { // may not actually hide for internal reasons like already has videomax class
          reHideCount++;
        }
      }
      const loopDetect = current;
      current = parentElement(current);
      if (loopDetect === current) {  // pornhub
        break;
      }
    }
    trace(`rehideUpFromVideo hid: ${reHideCount}`);
    return reHideCount;
  }


  class RetryTimeoutClass {
    private timerid:number;
    private delay: number;
    private retrycount: number;
    private maxretries: number;
    private debugname: string;
    private callback: () => boolean;

    constructor(debugname: string = '', delay: number = 250, maxretries: number = 8) {
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
      trace(
          `RetryTimeoutClass.retryFunc ${this.debugname} retry: ${this.retrycount}/${this.maxretries}`);
      this.cleartimeout();
      const result = this.callback();

      if (!result) {
        trace(
            `RetryTimeoutClass.retryFunc ${this.debugname}  function returned false. retying`);
        // returns true if we're done
        this.retrycount++;
        if (this.retrycount < this.maxretries) {
          this.timerid = setTimeout(this.retryFunc, this.delay);
        }
      } else {
        trace(
            `RetryTimeoutClass.retryFunc ${this.debugname}  function returned true. stopping`);
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

  const hideCSS = (id:string) => {
    // try {
    if (id) {
      const elem = document.getElementById(id);
      if (elem) {
        setAttrAndSave(elem, 'media', '_all');
      }
    }
  };

  const hasInjectedAlready = (): boolean => {
    const attr = document.body.getAttribute(VIDEO_MAX_INSTALLED_ATTR) || '';
    const thinksInstalled = attr?.length > 0;
    if (!thinksInstalled) {return false;}
    const videoStillInDoc = isVideoStillInDoc();
    if (!videoStillInDoc) {
      // we are in a partial state, we may need to unzoom? This can happen on multiple-videos in instagram
      logwarn("VIDEO_MAX_INSTALLED_ATTR on body but matched video missing. Atempting unzoom.");
      UndoZoom.mainUnzoom();
      return false;
    }
    return true;
  };

  /**
   * Returns whole numbers for bounding box instead of floats.
   * @param rectC {DomRect}
   * @return {DomRect}
   */
  const wholeClientRect = (rectC: DomRect): DomRect => ({
    top: Math.round(rectC.top),
    left: Math.round(rectC.left),
    bottom: Math.round(rectC.bottom),
    right: Math.round(rectC.right),
    width: Math.round(rectC.width),
    height: Math.round(rectC.height),
  });

  const EMPTY_DOC_RECT: DomRect = {
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
  };

  /**
   * Gets the window.visualViewport as our DomRect
   * @return {DomRect}
   */
  const getViewportRect = (): DomRect => {
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
  };

  /**
   * If the innerDomRect exactly matches the outerDomRect then the result is
   * {outerPercent: 1.0, innerPercent 1.0}
   * If the inner is completely contained by the outer but only fills up half
   * then
   * {outerPercent: 0.5, innerPercent 1.0}
   * If theres some overlap (e.g. where the inner is bleeding outside the outer
   * by half) then
   * {outerPercent: 0.5, innerPercent 5.0}
   * @param outerDomRect {DomRect}
   * @param innerDomRect {DomRect}
   * @return {{outerPercent: number, innerPercent: number}}
   */
  const getOverlapPercent = (outerDomRect: DomRect, innerDomRect: DomRect): {
    outerPercent: number;
    innerPercent: number;
  } => {
    const overlapWidth = Math.max(outerDomRect.right, innerDomRect.right) -
                         Math.min(outerDomRect.left, innerDomRect.left);
    const overlapHeight = Math.max(outerDomRect.bottom, innerDomRect.bottom) -
                          Math.min(outerDomRect.top, innerDomRect.top);

    if (overlapWidth <= 0 || overlapHeight <= 0) {
      return {
        outerPercent: 0,
        innerPercent: 0,
      };
    }

    // Calculate the area of each rectangle.
    const areaOverlap = overlapWidth * overlapHeight;
    const areaOuter = outerDomRect.width * outerDomRect.height;
    const areaInner = innerDomRect.width * innerDomRect.height;

    const outerPercent = areaOuter * 100 / areaOverlap;
    const innerPercent = areaInner * 100 / areaOverlap;

    return {
      outerPercent,
      innerPercent,
    };
  };

  /**
   *
   * @param outer {DomRect}
   * @param inner {DomRect}
   * @return {boolean}
   */
  const isBoundedRect = (outer: DomRect, inner: DomRect): boolean => {
    const inRange = (num:number, lower:number, upper:number) => ((num >= lower) && (num <= upper));
    if (isEmptyRect(outer) || isEmptyRect(inner)) {
      return false;
    }
    return (inRange(inner.top, outer.top, outer.bottom) &&
            inRange(inner.bottom, outer.top, outer.bottom) &&
            inRange(inner.left, outer.left, outer.right) &&
            inRange(inner.right, outer.left, outer.right));
  };

  /**
   * This includes margin and padding.
   */
  function getOuterBoundingRect(elem: Element): DomRect {
    try {
      return wholeClientRect(elem.getBoundingClientRect());
    } catch (_err) {
      return EMPTY_DOC_RECT;
    }
  }

  /**
   * This includes margin and padding.
   */
  const cumulativePositionRect = (elemIn: Element,
                                  compStyle: CSSStyleDeclaration | null = null): DomRect => {
    const result = getOuterBoundingRect(elemIn);
    if (!(elemIn instanceof HTMLElement)) {
      logerr("cumulativePositionRect on Element that's not an HTMLElement", PrintNode(elemIn));
      return result;
    }

    // always use initial position
    let top = 0;
    let left = 0;
    let eachElem = elemIn;
    while (eachElem?.offsetParent instanceof HTMLElement) {
      const compStyleElem = getElemComputedStyle(eachElem); // $$$
      if (compStyleElem.position !== 'absolute') {
        top += eachElem.offsetTop;
        left += eachElem.offsetLeft;
      }
      eachElem = eachElem.offsetParent;
    }
    // transformOrigin special case. (WHY is getting the ACTUAL viewports
    // coordinates SO HARD?!?) transformOrigin is for pluto's tv guide section.
    // there's still "transform: translate()" not handled.
    if (compStyle?.transformOrigin) {
      // there's lots of string values for transformOrigin... we're just going
      // to handle "#px #px"
      const regex = /(-?\d+?.\d+)px (-?\d+?.\d+)px/;
      const matches = compStyle?.transformOrigin.match(regex);
      if (matches?.length === 3) {
        top += parseFloat(matches[1]);
        left += parseFloat(matches[2]);
      }
    }
    if (compStyle?.transform) {
      // "translate(100.1px, 202.202px) ..."
      const regex = /translate\((-?\d+?.\d+)px, (-?\d+?.\d+)px\)/;
      const matches = compStyle?.transformOrigin.match(regex);
      if (matches?.length === 3) {
        top += parseFloat(matches[1]);
        left += parseFloat(matches[2]);
      }
    }

    // result.height, result.width set already
    result.top = top;
    result.left = left;
    result.bottom = top + result.height;
    result.right = left + result.width;
    return result;
  };

  // this is from a stack-overflow discussion, it's NOT 100%
  const getCoords = (el: Element) => {
    try {
      const {body} = document;
      const docEl = document.documentElement;

      const scrollTop = window.pageYOffset || docEl.scrollTop || body.scrollTop;
      const scrollLeft = window.pageXOffset || docEl.scrollLeft ||
                         body.scrollLeft;

      const clientTop = docEl.clientTop || body.clientTop || 0;
      const clientLeft = docEl.clientLeft || body.clientLeft || 0;

      const box = el?.getBoundingClientRect();
      const top = Math.round(box.top + scrollTop - clientTop);
      const left = Math.round(box.left + scrollLeft - clientLeft);
      const bottom = top + box.height; // already rounded.
      const right = left + box.width;

      return {
        top,
        left,
        bottom,
        right,
        width: box.width,
        height: box.height,
      };
    } catch (err) {
      logerr(err);
      return {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
      };
    }
  };

  /**
   * @param elem {HTMLElement|Node|string}
   * @param matches {RegExp[]}
   * @return {boolean}
   */
  const smellsLikeMatch = (elem: HTMLElement | Node | string, matches: RegExp[]): boolean => {
    try {
      const elementAttribsStr = PrintNode(elem).toLowerCase();
      if (elementAttribsStr?.length) {
        for (const eachMatch of matches) {
          if (eachMatch.test(elementAttribsStr)) {
            trace(`smellsLikeMatch true for "${elementAttribsStr}"`, eachMatch);
            return true;
          }
        }
      }
    } catch (err) {
      trace(`smellsLikeMatch err`, err);
    }
    return false;
  };

  const NEVERHIDEMATCHES = [
    /ytp-ad-module/i, // youtube "skip ad"
    /caption/i, // youtube cc
    /subtitles/i, // nbc cc
    /ccContainer/i, // pornhub cc
    /web-player-icon-resize/i, // tubi's non-508 playback
  ];
  /**
   * @param elem {Node}
   * @return {boolean}
   */
  const isSpecialCaseNeverHide = (elem: Node): boolean => smellsLikeMatch(elem,
                                                                          NEVERHIDEMATCHES);

  /**
   * @param _elem {Node}
   * @return {boolean}
   */
  const isSpecialCaseNeverOverlap = (_elem: Node): boolean => // in theory more logic can go here.
      false;

  /** optimization since the matches are called often */
  const AdverRegex = /(?:^|\W|-)adver/ig;
  const AdRegex = /(?:^|\W|-)ad-|-ad$/ig;
  const BrandingRegex = /(?:^|\W|-)branding/ig;

  /**
   * Does NOT block ads.
   * Some specific rules where ads overlap videos and when we zoom them and
   * they permanently hide the main video.
   * Most sights do it right, but there some that don't.
   * @param elem {Node}
   */
  const smellsLikeAdElem = (elem: Node) => {
    if (!(elem instanceof HTMLElement)) {
      return false;
    }
    // regex /^(@)(\wadver)/ig)) <- means start of word
    const arialabel = getAttr(elem, 'aria-label');
    if (arialabel?.match(AdverRegex)) {
      trace(`smellsLikeAdElem: matched aria-label for "adver" '${arialabel}'`);
      return true;
    }
    if (arialabel?.match(AdRegex)) {
      trace(`smellsLikeAdElem: matched aria-label for "ad-" '${arialabel}'`);
      return true;
    }
    const className = getAttr(elem, 'class');
    if (className?.match(AdverRegex)) {
      trace(`smellsLikeAdElem: matched classname for "adver"? '${className}'`);
      return true;
    }
    if (className?.match(BrandingRegex)) {
      trace(
          `smellsLikeAdElem: atched classname for "branding"? '${className}'`);
      return true;
    }
    const title = getAttr(elem, 'title');
    if (title?.match(AdverRegex)) {
      trace(`smellsLikeAdElem: matched title for "adver" '${title}'`);
      return true;
    }
    if (title?.match(AdRegex)) {
      trace(`smellsLikeAdElem: matched title for "ad-" '${title}'`);
      return true;
    }
    return false;
  };

  /**
   * So. many. iframes on some sites (like > 150), early exit if they are too
   * small. Only works when injected into an iframe
   * @return {boolean}
   */
  const earyExitForSmallIFrame = (): boolean => {
    if (!isRunningInIFrame()) {
      return false;
    }
    // Running in iframe means.
    // window !== window?.parent

    if (document.childElementCount === 0) {
      return true;
    }

    if (window.innerWidth < MIN_IFRAME_WIDTH || window.innerHeight <
        MIN_IFRAME_HEIGHT) {
      trace(
          `Early exit when running in small iframe ${window.innerWidth} x ${window.innerHeight}`);
      return true;
    }

    return false;
  };

  /**
   * @param commonContainerElem: pass in undefined to get whole doc
   */
  const getAllElementsThatSmellsLikeControls = (commonContainerElem: Element | Node | undefined | null): Element[] => {
    if (!commonContainerElem || !(commonContainerElem instanceof Element)) {
      return [];
    }
    // the volume matcher can be tested on nbcnews.com/now
    // negative case test that matches ads on dailymail
    const topElem = commonContainerElem || window.document;

    try {
      const skipFilter = (el: Element): boolean => !isSkippedNodeForCntl(el) &&
                                 !smellsLikeAdElem(el);

      const matchesVolume = NO_SEARCHING_IGNORED_NODES_COMMON ?
          [
            ...querySelectorAllFiltered(topElem, `input[type="range"]`,
                                        skipFilter)] :
                            [...topElem.querySelectorAll(`input[type="range"]`)].filter(
                                (e) => !isSkippedNodeForCntl(e) && smellsLikeMatch(e, [/volume/i]) &&
                                       !smellsLikeAdElem(e));
      const matchesSlider = NO_SEARCHING_IGNORED_NODES_COMMON ?
          [
            ...querySelectorAllFiltered(topElem, `[role="slider"]`,
                                        skipFilter)] :
                            [...topElem.querySelectorAll(`[role="slider"]`)].filter(
                                (e) => !isSkippedNodeForCntl(e) && !smellsLikeAdElem(e));

      if (DEBUG_HIDENODE) {
        trace(`getAllElementsThatSmellsLikeControls for ${PrintNode(
            commonContainerElem)}
        matchesVolume: `, matchesVolume, `
        matchesSlider: `, matchesSlider);
      }
      return [
        ...matchesVolume,
        ...matchesSlider];
    } catch (err) {
      trace(err);
    }
    return [];
  };

  /**
   * Used when the matched video is a <video> (vs in iframe)
   */
  const maximizeVideoDom = () => {
    if (!videomaxGlobals.matchedVideo) {
      return;
    }
    SANITY_CHECK_MATCH_NOT_DELETED();

    trace('maximizeVideoDom');
    maximizeUpFromVideo();
    const commonContainerElem = findCommonContainerFromMatched();

    if (commonContainerElem instanceof Element) {
      // now we try to find playback controls that may have been missed.
      // <input type="range" class="styles_volumeSlider__gCfqY" min="-50" max="0"
      // step="0.5" value="-50" style="--volume: 0%;">
      if (DO_HIDE_EXCEPTION_CHECK) {
        // pass in undefined to get all for whole document.
        const matches = getAllElementsThatSmellsLikeControls(
            USE_WHOLE_WINDOW_TO_SEARCH_FOR_CONTROLS ?
            undefined :
            commonContainerElem);
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
    if ((FIND_CONTROLS_ON_MAIN_THREAD_FOR_IFRAME_MATCH &&
         !isRunningInIFrame()) ||
        videomaxGlobals.matchedIsHtml5Video) {
      const videoSiblings = getSiblings(videomaxGlobals.matchedVideo);
      for (const eachElem of videoSiblings) {
        addOverlapCtrl(eachElem);  // does additional checks before adding
      }
    }

    const videoElem = videomaxGlobals.matchedVideo; // readability
    exceptionToRuleFixup(getOwnerDoc(videoElem), videoElem);
    if (EXCEPTIONTORULE_FIXUP_FOR_WHOLE_DOC) {
      const {
        document,
        element,
      } = getTopDocumentForIFrameBreakOut(videoElem);
      if (element !== videoElem) {
        trace('exceptionToRuleFixup followup');
        exceptionToRuleFixup(document, element);
      }
    }

    document.body.classList.add(MAX_CSS_CLASS);
  };

  class ElemMatcherClass {
    private largestElem: Element | HTMLIFrameElement | undefined = undefined;

    private largestScore = 0;

    private matchCount = 0;

    private checkedDedup: Node[] = [];

    getBestMatch = () => this.largestElem;

    getLargestScore = () => this.largestScore;

    getMatchCount = () => this.matchCount; // should be 1 for most case

    /**
     * @return True means done
     */
    checkIfBest = (elem: Element | HTMLIFrameElement | undefined): boolean => {
      if (!elem) {
        return false;
      }
      if (this.largestElem && elem.isSameNode(this.largestElem)) {
        trace('  Matched element same element');
        return true;
      }
      if (this.largestElem && (parentElement(this.largestElem) !== null) &&
          elem.isSameNode(parentElement(this.largestElem))) {
        trace('  Matched element same as parent.');
        return true;
      }
      if (this.checkedDedup.includes(elem)) {
        trace('  Matched element already checked.');
        return false;
      }
      this.checkedDedup.push(elem);

      const elemStyle = getElemComputedStyle(elem);
      const score = this.getElemMatchScore(elem, elemStyle);
      if (EMBED_SCORES) {
        setAttr(elem, EMBEDED_SCORES, score.toString());
      }

      if (score === 0) {
        return false;
      }

      if (score > this.largestScore) {
        if (BREAK_ON_BEST_MATCH) {
          // eslint-disable-next-line no-debugger
          debugger;
        }
        // special case when we can dig down through iframes and find videos
        trace(`setting new best: score: ${score}, elem: `, elem);
        this.largestScore = score;
        this.largestElem = elem;
        this.matchCount = 1;
        trace(
            `Making item best match: \t${elem.nodeName}\t${elem.className.toString()}\t${elem.id}`);
        return true;
      }

      if (score === this.largestScore) {
        trace(
            `same score: ${score}, favoring on that came first. Total count: ${this.matchCount} elem: `,
            elem);
        this.matchCount++;
        return true;
      }
      return false;
    };

    /**
     *   weight for videos that are the right ratios!
     *   16:9 == 1.77_  4:3 == 1.33_  3:2 == 1.50
     */
    private getElemDimensions = (elem: Element, compStyle: CSSStyleDeclaration): {
      width: number,
      height: number
    } => {
      if (!elem) {
        logerr('empty element gets score of zero');
        return {
          width: 0,
          height: 0,
        };
      }
      let width = 0;
      let height = 0;

      if (!compStyle?.width || !compStyle?.height) {
        logerr('Could NOT load computed style for element so score is zero',
               elem);
        return {
          width,
          height,
        };
      }

      // make sure the ratio is reasonable for a video.
      width = safeParseFloat(compStyle.width);
      height = safeParseFloat(compStyle.height);
      if (!width || !height) {
        trace('width or height zero. likely hidden element', elem);
        return {
          width: 0,
          height: 0,
        };
      }

      if (width < 100 || height < 75) {
        trace('width or height too small so no score', elem);
        return {
          width: 0,
          height: 0,
        };
      }

      trace(`Found width/height for elem. width=${width}px height=${height}px`,
            elem);
      return {
        width,
        height,
      };
    };

    private diceCoefficient = (str1: string, str2: string): number => {
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
    };

    private customDiceCoefficient = (pageUrl: string, elemUrl: string): number => {
      const pageParts = splitUrlWords(pageUrl);
      const urlParts = splitUrlWords(elemUrl);
      const overlapCount = getOverlapCount(pageParts, urlParts);
      const count = Math.max(1, pageParts.length);
      const avgCount = (count + count) / 2.0;
      return overlapCount / avgCount;
    };

    private getElemMatchScore = (elem: Element, compStyle: CSSStyleDeclaration): number => {
      if (!elem) {
        return 0;
      }

      // the most common ratios. The closer a video is to these, the higher the
      // score.
      const VIDEO_RATIOS = {
        21_9: (21 / 9),
        16_9: (16.0 / 9.0),
        4_3: (4.0 / 3.0),
        3_2: (3.0 / 2.0),
        240: (2.40 / 1.0), // portrait ( < 1)
        // 4_5:  (4 / 5),
        // 9_16: (9 / 16),
      };

      const {
        width,
        height,
      } = this.getElemDimensions(elem, compStyle);

      // videos may be constrained by the iframe or window.
      const doc = getElemsDocumentView(elem);

      if (!doc ||
          (width < MIN_VIDEO_WIDTH || height < MIN_VIDEO_HEIGHT) && // too small
          doc.outerWidth > MIN_VIDEO_WIDTH && // but not a small window.
          doc.outerHeight > MIN_VIDEO_HEIGHT &&
          !isAllowSmallVideosSite()) { /// / we allow really small on some sites.
        trace(`\tWidth or height too small, skipping other checks
        width: ${width} < ${MIN_VIDEO_WIDTH} (MIN_VIDEO_HEIGHT)
        width: ${height} < ${MIN_VIDEO_HEIGHT} (MIN_VIDEO_WIDTH)`, elem);
        return 0;
      }

      // twitch allows videos to be any random size. If the width & height of
      // the window are too short, then we can't find the video.
      if (elem.id === 'live_site_player_flash') {
        trace('Matched twitch video. Returning high score.');
        return 3000000;
      }

      const traceweights = ['']; // start with blankline. turned into trace
                                 // message
      videomaxGlobals.matchCounter++;

      // Found an html5 video tag not iframe
      const isVideoElem = elem instanceof HTMLVideoElement;
      const isHtmlElem = elem instanceof HTMLElement;
      let weight = 0;

      if (EMBED_SCORES) {
        const elemStr = PrintNode(elem);
        traceweights.push(`===========================\n${elemStr}\n`);
        traceweights.push(`START_WEIGHT: ${START_WEIGHT}`);
        traceweights.push(
            `  Width: ${width}  Height: ${fmtInt.format(height)}`);

        const vidRect = cumulativePositionRect(elem, compStyle);
        traceweights.push(
            `  top: ${vidRect.top}  left: ${vidRect.left}   bottom: ${vidRect.bottom}    right:${vidRect.right}`);
        traceweights.push(
            `  doc.outerWidth: ${doc?.outerWidth || 0} ${fmtFlt.format(
                width * 100 / (doc?.outerWidth||0.001))}%`);
      }
      {
        // common video sizes
        // 320x180, 320x240, 640x480, 640x360, 640x480, 640x360, 768x576,
        // 720x405, 720x576
        const ratio = width / height;
        // which ever is smaller is better (closer to one of the magic ratios)
        const distances = Object.values(VIDEO_RATIOS).map((v) => Math.abs(v - ratio));
        const bestRatioComp = Math.min(...distances) + 0.001; // +0.001;
                                                              // prevents
                                                              // div-by-zero

        // inverse distance
        const inverseDist = round(1.0 / bestRatioComp ** 1.15);  // was 1.25
        const videoSize = round(Math.log2(width * height));

        weight += START_WEIGHT * inverseDist * RATIO_WEIGHT;
        weight += START_WEIGHT * videoSize * SIZE_WEIGHT; // bigger is worth
                                                          // more
        if (EMBED_SCORES) {
          traceweights.push(
              `  Distances: ${distances.map(n => fmtFlt.format(n)).join(',')}`);
          traceweights.push(`  inverseDist: RATIO_WEIGHT: ${fmtInt.format(
              START_WEIGHT * inverseDist *
              RATIO_WEIGHT)} \t Weight:${RATIO_WEIGHT}`);
          traceweights.push(`  dimensions: SIZE_WEIGHT: ${fmtInt.format(
              START_WEIGHT * videoSize *
              SIZE_WEIGHT)} \t Weight:  ${SIZE_WEIGHT}`);
        }

        // this also uses the ratio.
        if (IN_VIEW_WEIGHT !== 0) {
          const visualViewport = getViewportRect();
          const elemBounds = cumulativePositionRect(elem);
          const {
            outerPercent,
            innerPercent,
          } = getOverlapPercent(visualViewport, elemBounds);

          if (outerPercent > 0.0) {
            if (EMBED_SCORES) {
              traceweights.push(
                  `\tIN_VIEW_WEIGHT: ` +
                  `${fmtInt.format(
                      START_WEIGHT * IN_VIEW_WEIGHT * (outerPercent + 100) *
                      innerPercent)} * (inverseDist * RATIO_WEIGHT) * (videoSize * SIZE_WEIGHT) ` +
                  `\t outerPercent: ${fmtFlt.format(outerPercent + 100)} ` +
                  `\t innerPercent:${fmtFlt.format(innerPercent)}` +
                  `\t in ${isRunningInIFrame() ?
                           'iFrame (may be 1.0 for iframe)' :
                           'Main'}`);
            }
            weight += (START_WEIGHT * IN_VIEW_WEIGHT * (outerPercent + 100) *
                       innerPercent *
                       (inverseDist * RATIO_WEIGHT * .1) *
                       (videoSize * SIZE_WEIGHT * .1));
          }
        }
      }

      if (EMBED_SCORES) {
        traceweights.push(`  ORDER_WEIGHT: ${fmtInt.format(
            START_WEIGHT * videomaxGlobals.matchCounter *
            ORDER_WEIGHT)} Order: ${videomaxGlobals.matchCounter} Weight:${ORDER_WEIGHT}`);
      }
      weight += START_WEIGHT * videomaxGlobals.matchCounter * ORDER_WEIGHT;

      // try to figure out if iframe src looks like a video link.
      // frame shaped like videos?
      if (isIFrameElem(elem)) {
        if (DEBUG_ENABLED && !isIFrameElemMeetsRequirements(elem)) {
          logwarn('isIFrameElemMeetsRequirements is false, should skip?',
                  PrintNode(elem));
        }
        const src = elem.getAttribute('src') || '';

        for (const eachMatch of DO_NOT_MATCH_IFRAME_SRC) {
          if (eachMatch.test(src)) {
            trace(`DO_NOT_MATCH_IFRAME_SRC true for "${src}"
            Old weight=${weight}`, eachMatch);
            return 0;
          }
        }
      }

      if (compStyle?.zIndex) {
        // espn makes the zindex for ads crazy large and breaks things, cap it.
        const zindex = Math.min(safeParseInt(compStyle?.zIndex), 100);
        if (EMBED_SCORES) {
          traceweights.push(`  ZINDEX_WEIGHT: ${fmtInt.format(
              START_WEIGHT * zindex *
              ZINDEX_WEIGHT)} \t Weight: ${ZINDEX_WEIGHT}`);
        }
        weight += (START_WEIGHT * zindex * ZINDEX_WEIGHT); // zindex is tricky,
                                                           // could be "1" or
        // "1000000"
      }

      if (isVideoElem &&
          (compStyle?.visibility.toLowerCase() === 'hidden' ||
          compStyle?.display.toLowerCase() ===
          'none' || compStyle?.opacity === '0' || elem.offsetParent === null ||
          safeParseInt(compStyle?.width) === 0 ||
          safeParseInt(compStyle?.height) === 0)) {

        // Vimeo hides video before it starts playing (replacing it with a
        // static image), so we cannot ignore hidden. But UStream's homepage
        // has a large hidden flash that isn't a video.
        if (EMBED_SCORES) {
          traceweights.push(`  HIDDEN_VIDEO_WEIGHT: ${fmtInt.format(
              START_WEIGHT *
              HIDDEN_VIDEO_WEIGHT)} \t Weight:${HIDDEN_VIDEO_WEIGHT}`);
          traceweights.push(`\tvisibility: '${compStyle?.visibility}'\n` +
                            `\tdisplay: '${compStyle?.display}' \n` +
                            `\topacity: '${compStyle?.opacity}'`);
        }
        weight += (START_WEIGHT * HIDDEN_VIDEO_WEIGHT);
      }

      const tabindex = getAttr(elem, 'tabindex');
      if (TAB_INDEX_WEIGHT !== 0.0 && tabindex !== null) {
        // this is a newer thing for accessibility, it's a good indicator
        if (EMBED_SCORES) {
          traceweights.push(`  TAB_INDEX_WEIGHT: ${fmtInt.format(
              -1 & START_WEIGHT *
              TAB_INDEX_WEIGHT)}\t Weight: ${TAB_INDEX_WEIGHT}`);
        }
        weight += (-1 * START_WEIGHT * TAB_INDEX_WEIGHT);
      }

      const allowfullscreenAttr = getAttr(elem, 'allowfullscreen');
      if (allowfullscreenAttr !== null) {
        if (EMBED_SCORES) {
          traceweights.push(
              `  ALLOW_FULLSCREEN_WEIGHT: ${fmtInt.format(
                  START_WEIGHT *
                  ALLOW_FULLSCREEN_WEIGHT)} \t Weight: ${ALLOW_FULLSCREEN_WEIGHT}`);
        }
        weight += (START_WEIGHT * ALLOW_FULLSCREEN_WEIGHT);
      }

      if (smellsLikeAdElem(elem)) {
        // don't hide ads, but we dont' want to match them as main videos
        // ADVERTISE_WEIGHT is Neg
        if (EMBED_SCORES) {
          traceweights.push(`  ADVERTISE_WEIGHT: ${fmtInt.format(
              START_WEIGHT * ADVERTISE_WEIGHT)} \t  Weight: ${ADVERTISE_WEIGHT}`);
        }
        weight += (START_WEIGHT * ADVERTISE_WEIGHT);
      }

      if (isVideoElem) {
        const videoElem: HTMLMediaElement = elem;
        if (EMBED_SCORES) {
          traceweights.push(
              `  VIDEO_OVER_IFRAME_WEIGHT: ${fmtInt.format(
                  START_WEIGHT *
                  VIDEO_OVER_IFRAME_WEIGHT)} \t  Weight: ${VIDEO_OVER_IFRAME_WEIGHT}`);
        }
        weight += (START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT);

        // if a video, lets see if it's actively playing
        if (!videoElem.paused && videoElem?.ended === false) {
          let playingWeight = VIDEO_PLAYING_WEIGHT;
          if (DOOMSCROLL_PLAYING_BOOST_FACTOR > 1.0 && isDoomScrollingSite()) {
            playingWeight = VIDEO_PLAYING_WEIGHT *
                            DOOMSCROLL_PLAYING_BOOST_FACTOR;
          }
          if (EMBED_SCORES) {
            traceweights.push(
                `  VIDEO_PLAYING: Weight:${fmtInt.format(START_WEIGHT *
                                                         playingWeight)} \t weight: ${playingWeight} \t Paused:${videoElem.paused} \t Ended: ${videoElem.ended}`);
          }
          weight += (START_WEIGHT * playingWeight);
        }

        // video length, cap at 2hrs
        const duration = Math.min((videoElem?.duration || 0),
                                  MAX_DURATION_SECS);
        if (EMBED_SCORES) {
          traceweights.push(`  VIDEO_DURATION: ${fmtInt.format(
              START_WEIGHT * VIDEO_DURATION_WEIGHT *
              duration)} \t Weight: ${VIDEO_DURATION_WEIGHT} \t Duration:${fmtInt.format(
              duration)}s`);
        }
        weight += (START_WEIGHT * VIDEO_DURATION_WEIGHT * duration);

        // looping downgrades
        if (videoElem?.loop) {
          if (EMBED_SCORES) {
            traceweights.push(
                `  VIDEO_NO_LOOP_WEIGHT:${fmtInt.format(
                    START_WEIGHT *
                    VIDEO_LOOPS_WEIGHT)} \t weight: ${VIDEO_LOOPS_WEIGHT} \t loop:${videoElem.loop}`);
          }
          weight += (START_WEIGHT * VIDEO_LOOPS_WEIGHT);
        }

        // has audio
        if (videoElem.muted === false) {
          let hasSoundWeight = VIDEO_HAS_SOUND_WEIGHT;
          if (DOOMSCROLL_UNMUTED_BOOST_FACTOR > 1.0 && isDoomScrollingSite()) {
            hasSoundWeight = VIDEO_HAS_SOUND_WEIGHT *
                             DOOMSCROLL_UNMUTED_BOOST_FACTOR;
          }

          if (EMBED_SCORES) {
            traceweights.push(
                `  VIDEO_HAS_SOUND_WEIGHT:${fmtInt.format(
                    START_WEIGHT *
                    hasSoundWeight)} \t weight: ${hasSoundWeight} \t muted:${videoElem.muted}  `);
          }
          weight += (START_WEIGHT * hasSoundWeight);
        }
      }

      if (!isRunningInIFrame()) {
        if (EMBED_SCORES) {
          traceweights.push(
              `  MAIN_FRAME_WEIGHT (running in main) MAIN_FRAME_WEIGHT:${fmtInt.format(
                  START_WEIGHT *
                  MAIN_FRAME_WEIGHT)} \t weight: ${MAIN_FRAME_WEIGHT} `);
        }
        weight += (START_WEIGHT * MAIN_FRAME_WEIGHT);
      }

      // does the video source url look kinda close to the page url?
      // todo: better string proximity calc is probably needed
      try {
        const pageUrl = getPageUrl();
        if (isVideoElem && pageUrl?.length &&
            (pageUrl.startsWith('https://') ||
             pageUrl.startsWith('blob:https://'))) {
          // no see if we can get this video's source.
          let elemUrl = elem?.src || '';
          if (elemUrl === '') {
            // sometimes there's a <video><source src=""></video> approach.
            // this is used when there might be different data formatting
            // available for the same video (e.g. one for video/mp4 and another
            // for video/webm). if a site is going through this much work, it's
            // probably NOT an ad.
            const matchedSources = elem.getElementsByTagName('source');
            if (matchedSources.length > 0) {
              // there may be multiple, but they are likely very simailar.
              elemUrl = matchedSources[0].src || '';
            }
          }
          if (elemUrl.length &&
              (elemUrl.startsWith('https://') ||
               elemUrl.startsWith('blob:https://'))) {
            const overlapRatio = this.customDiceCoefficient(pageUrl, elemUrl);

            if (EMBED_SCORES) {
              // maybe a standard algo is better?
              const diceRatio = this.diceCoefficient(pageUrl, elemUrl);
              traceweights.push(
                  `  URL_OVERLAP_WEIGHT: ${fmtInt.format(
                      START_WEIGHT * URL_OVERLAP_WEIGHT * overlapRatio)} ` +
                  `\t Weight: ${URL_OVERLAP_WEIGHT}` +
                  `\t OverlapRatio:${fmtFlt.format(overlapRatio)} ` +
                  `\t Dice distance: ${fmtFlt.format(diceRatio)}`);
            }
            weight += (START_WEIGHT * URL_OVERLAP_WEIGHT * overlapRatio);

            const urlParts = splitUrlWords(elemUrl);
            const negOverlapCount = getOverlapCount(['disqus'], urlParts);
            if (EMBED_SCORES && negOverlapCount) {
              traceweights.push(
                  `  URL_OVERLAP_WEIGHT - "disqus" (neg): ${fmtInt.format(
                      START_WEIGHT * URL_OVERLAP_WEIGHT *
                      negOverlapCount)} \t Weight: -${URL_OVERLAP_WEIGHT} \t Count:${negOverlapCount}`);
            }
            weight -= (START_WEIGHT * URL_OVERLAP_WEIGHT * negOverlapCount);
          }
        }
      } catch (err) {
        // iframes can throw when you try to read their url, just keep going
        // and ignore
        trace('URL_OVERLAP_WEIGHT failed because of security block?', err);
      }

      if (isHtmlElem) {
        try {
          const titleELem = (elem?.title || elem?.ariaLabel || '').toLowerCase();
          const titlePage = window.document?.title.toLowerCase() || '';
          const dice = this.diceCoefficient(titleELem, titlePage);
          const titleParts = splitUrlWords(
              window.document?.title.toLowerCase() || '');
          const elemParts = splitUrlWords(PrintNode(elem).toLowerCase());
          const overlap = getOverlapCount(titleParts, elemParts);
          const overlapRatio = overlap / (titleParts.length || 1);
          if (EMBED_SCORES) {
            traceweights.push(
                `TITLE_OVERLAP_WEIGHT: ` +
                `${fmtInt.format(
                    START_WEIGHT * TITLE_OVERLAP_WEIGHT * overlapRatio)} ` +
                `\t weight: ${TITLE_OVERLAP_WEIGHT} ` +
                `\t Count:${overlap} ` +
                `\t OverlapRatio:${fmtFlt.format(overlapRatio)}` +
                `\t Dice distance: ${fmtFlt.format(dice)}`);
          }
          weight += (START_WEIGHT * TITLE_OVERLAP_WEIGHT * overlapRatio);
        } catch (err) {
          logerr(err);
        }
      }

      weight = Math.round(weight);
      if (DEBUG_ENABLED) {
        if (Number.isNaN(weight)) {
          logerr('======weight got corrupted======');
        }
      }
      if (EMBED_SCORES) {
        traceweights.push(`FINAL WEIGHT: ${fmtInt.format(weight)}`);
        const result = traceweights.join('\n\t');
        trace('*** weight for element***', result, elem);
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
  const alwaysHideSomeElements = (doc: Document = document) => {
    if (typeof (doc?.getElementsByTagName) !== 'function') {
      // this might fair if the doc is an iframe across domains
      return;
    }
    trace(`alwaysHideSomeElements`);
    for (const eachtag of ALWAYS_HIDE_NODES) {
      const elems = doc.getElementsByTagName(eachtag);
      for (const elem of elems) {
        if (DEBUG_HIDENODE) {
          trace(`ALWAYS_HIDE_NODES "${eachtag}"`, elem);
        }
        hideNode(elem);
      }
    }
    const navItems = doc?.querySelectorAll(
        `:not([class*="${PREFIX_CSS_CLASS}"])[role="navigation"]`);
    const toolbarItems = doc?.querySelectorAll(
        `:not([class*="${PREFIX_CSS_CLASS}"])[role="toolbar"]`);
    for (const eachElem of [...navItems, ...toolbarItems]) {
      if (DEBUG_HIDENODE) {
        trace(`ALWAYS_HIDE_NODES [role="navigation"]`, eachElem);
      }
      hideNode(eachElem);
    }
  };

  const saveAllScrollPositions = () => {
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
          logerr('saveAllScrollPositions: inner error:', err);
        }
      } while (g_walker.nextNode());
      trace(
          `saveAllScrollPositions: saved counts top:${countTop} left:${countLeft}`);
    } catch (err) {
      logerr('saveAllScrollPositions: function error', err);
    }
    g_walker.currentNode = savedWalkerNode;
  };

  const restoreAllSrollPositions = () => {
    // on scroll events should be stopped
    // need to make this more generic and remove dup code `{top}` vs `{left}`
    // makes tricky
    {
      const topScrolledElems = [
        ...document.querySelectorAll(
            `[${SAVED_SCROLL_TOP_ATTR}]`)].reverse();
      for (const eachElem of topScrolledElems) {
        const pos = Number(getAttr(eachElem, SAVED_SCROLL_TOP_ATTR) || 0);
        removeAttr(eachElem, SAVED_SCROLL_TOP_ATTR);
        if (eachElem?.scrollTo) {
          eachElem.scrollTo({top:pos});
          trace(`restoreAllSrollPositions top: ${pos} for elem ${PrintNode(
              eachElem)}`);
        }
      }
    }
    {
      const leftScrolledElems = [
        ...document.querySelectorAll(
            `[${SAVED_SCROLL_LEFT_ATTR}]`)].reverse();
      for (const eachElem of leftScrolledElems) {
        const pos = Number(getAttr(eachElem, SAVED_SCROLL_LEFT_ATTR)) || 0;
        removeAttr(eachElem, SAVED_SCROLL_LEFT_ATTR);
        if (eachElem?.scrollTo) {
          eachElem.scrollTo({left:pos});
          trace(`restoreAllSrollPositions left: ${pos} for elem ${PrintNode(
              eachElem)}`);
        }
      }
    }
  };

  /**
   * The LAST step of zooming is ot flip all the "videomax-ext-prep-*" to
   * videomax-ext-*" The reason for this is that if the css is already
   * injected, then trying to measure client rects gets messed up if we're
   * modifying classNames as we go.
   * @param doc {Document}
   * @return {number}
   */
  const flipCssRemovePrep = (doc: Document = document): number => {
    if (typeof (doc?.querySelectorAll) !== 'function') {
      // security can block
      trace(`flipCssRemovePrep: doc?.querySelectorAll) !== "function"`);
      return 0;
    }
    const allElementsToFix = doc.querySelectorAll(
        `[class*="${PREFIX_CSS_CLASS_PREP}"]`);
    const count = allElementsToFix.length;
    // that matches PREFIX_CSS_CLASS_PREP
    for (const eachElem of allElementsToFix) {
      try {
        // we are generically mapping "videomax-ext-prep-*" to videomax-ext-*"
        const subFrom = [];
        const subTo = [];
        const allClassNameOnElem = Object.values(eachElem.classList) || [];
        for (const eachClassName of allClassNameOnElem) {
          if (eachClassName.startsWith(PREFIX_CSS_CLASS_PREP)) {
            // remove '-prep' from the classname, '-prep-' => '-'
            const replacementClassName = eachClassName.replace('-prep-', '-');
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

          // some sites muck with the style
          // hack. This crazy thing happens on some sites (dailymotion) where
          // our resizing the video triggers scripts to run that muck with the
          // element style, so we're going to save and restore that style so
          // the undo works. We apply when we flip the classNames so we don't
          // zero size things as we're finding playback controls.
          if (subFrom.includes(MAX_CSS_CLASS)) {
            if (REMOVE_STYLE_FROM_ELEMS) {
              // removes after saving off
              backupAttr(eachElem, 'style');
            }
          }
        }
      } catch (err) {
        logerr('flipCssRemovePrep', err);
      }
    }
    return count;
  };

  const recursiveIFrameFlipClassPrep = (docOrIFrame: Document | HTMLIFrameElement) => {
    try {
      if (getVideomaxCmd() === 'unzoom') {
        trace('UNZOOMING! skipping recursiveIFrameFlipClassPrep');
        return;
      }
      if (docOrIFrame instanceof Document) {
        flipCssRemovePrep(docOrIFrame);
        return;
      }

      if (!(docOrIFrame instanceof HTMLIFrameElement &&
          typeof (docOrIFrame.querySelectorAll) !== 'function')) {
        // security can block
        return;
      }
      const allIFrames = docOrIFrame.querySelectorAll('iframe');
      for (const frame of allIFrames) {
        try {
          const framedoc = frame?.contentDocument;
          if (!framedoc) {
            continue;
          }
          flipCssRemovePrep(framedoc);
          recursiveIFrameFlipClassPrep(framedoc);
        } catch (err) {
          // probably cross-domain frame boundry issue
        }
      }
    } catch (err) {
      // probably cross-domain frame boundry issue
    }
  };

  const fixUpPageZoom = () => {
    if (!documentLoaded()) {
      return false;
    }
    if (videomaxGlobals.tagonly) {
      return false;
    }
    if (getVideomaxCmd() === 'unzoom') {
      trace('UNZOOMING?!?');
      return false;
    }

    if (!videomaxGlobals.matchedVideo) {
      logerr('maxGlobals.matchedVideo empty');
      return false;
    }

    maximizeVideoDom();

    fixUpAttribs(videomaxGlobals.matchedVideo);

    // going to return true, so we redo this since
    // some sites re-show these elements, hide again to be safe
    const doRehideTimeoutLoop = (rehideOneMoreTime = false) => {
      if (getVideomaxCmd() === 'unzoom') {
        trace('UNZOOMING! - skipping doRehideTimeoutLoop');
        return;
      }
      // nbc shows add on delay, we need at least on more pass.
      let rehideCount = rehideOneMoreTime ? 1 : 0;
      try {
        maximizeUpFromVideo();
        alwaysHideSomeElements();
        if (videomaxGlobals.matchedCommonCntl) {
          videomaxGlobals.matchedCommonCntl?.classList?.add(
              MARKER_COMMON_CONTAINER_CLASS);
        }

        rehideCount += rehideUpFromVideo();
        recursiveIFrameFlipClassPrep(document);
        recursiveIFrameFlipClassPrep(getTopElemNode() as HTMLIFrameElement); //dicey AF
      } catch (err) {
        logerr(err);
      }
      if (rehideCount !== 0) {
        trace('Retrying rehide until no more matches. 1001ms');
        setTimeout(() => doRehideTimeoutLoop(), 1001);
      }
    };

    doRehideTimeoutLoop(true); // first run, always try 1s later no matter
                               // what. (nbc banner ad)
    return true; // stop retrying
  };

  const postFixUpPageZoom = () => {
    let useObserver = true;
    // some sites (mba) position a full sized overlay that needs to be centered.
    if (// !isRunningInIFrame() && // NBCNews iframe styles constantly getting
        // updated
        !videomaxGlobals.matchedIsHtml5Video) {
      if (DEBUG_MUTATION_OBSERVER) {
        trace(`OBSERVER: NOT INSTALLING observer because 
        videomaxGlobals.matchedIsHtml5Video: ${videomaxGlobals.matchedIsHtml5Video}`);
      }
      useObserver = false;
    }
    if (!MUTATION_OBSERVER_WATCH_ALL_MAX &&
        !videomaxGlobals.matchedCommonCntl) {
      if (DEBUG_MUTATION_OBSERVER) {
        trace(`OBSERVER: NOT INSTALLING observer because 
        MUTATION_OBSERVER_WATCH_ALL_MAX = ${MUTATION_OBSERVER_WATCH_ALL_MAX}
        videomaxGlobals.matchedCommonCntl = ${videomaxGlobals.matchedCommonCntl}`);
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

        domainName = domainName.replace('.', '-');

        document.body.classList.add(`${PREFIX_CSS_CLASS}-${domainName}`);
      } catch (err) {
        logerr(err);
      }
    }
  };

  /**
   *
   * @param video_elem {HTMLElement}
   * @param removeOnly {boolean}
   */
  function updateEventListeners(video_elem: HTMLElement, removeOnly: boolean = false) {
    /** @param event {KeyboardEvent} */
    const _onPress = (event: KeyboardEvent) => {
      try {
        if (event.keyCode === 27) { // esc key
          trace('esc key press detected, unzooming');
          // unzoom here!
          videomaxGlobals.isMaximized = false;
          videomaxGlobals.unzooming = true;
          removeAttr(document.body, VIDEO_MAX_INSTALLED_ATTR);
          try {
            const allVideos = document.querySelectorAll('video');
            for (const eachVideo of allVideos) {
              if (eachVideo?.playbackRate && eachVideo?.playbackRate !== 1.0) {
                eachVideo.playbackRate = 1.0;
              }
            }
          } catch (err) {}
          UndoZoom.mainUnzoom();
          trace('trying to stop default event handler');
          event.stopPropagation();
          event.preventDefault();
          document.removeEventListener('keydown', _onPress);
        }
      } catch (err) {
        logerr(err);
      }
    };
    /** @param event {Event} */

    try {
      // this will allow "escape key" undo the zoom.
      trace('updateEventListeners');
      const doc = video_elem?.ownerDocument;
      doc?.removeEventListener('keydown', _onPress);
      window?.document?.removeEventListener('keydown', _onPress);
      if (!removeOnly) {
        doc?.addEventListener('keydown', _onPress);
        window?.document?.addEventListener('keydown', _onPress);
      }
    } catch (err) {
      logerr(err);
    }
    return true;
  }

  const isYoutubeInTheaterMode = () => {
    if (isRunningInIFrame()) {
      return false;
    }
    const masthead = document.getElementById('masthead');
    if (!masthead) {
      return false;
    }
    const theaterAttr = getAttr(masthead, 'theater');
    return (theaterAttr !== null);
  };

  /**
   * Fixing youtube's progress indicator when it's in small mode is next to
   * impossible to make large-screen friendly. The thumb position is set via
   * javascript that sets a style directly
   * (not very CSP friendly) A more reliable solution is to put page in theater
   * mode and then restore it when we unzoom.
   * @param theaterMode {boolean}
   */
  const setYoutubeIntoTheaterMode = (theaterMode: boolean) => {
    // verify it smells like a youtube domain. But the element check below
    // would probably be enough
    if (!smellsLikeMatch(getPageUrl(), YOUTUBE_TLD_NAMES)) {
      return;
    }
    // check if we're in theater mode we want
    if (isYoutubeInTheaterMode() === theaterMode) {
      trace(`youtube already in ${theaterMode ?
                                  'theater' :
                                  'non-theater'} mode, doing nothing`);
      return;
    }

    if (theaterMode) {
      // if we're putting it into theater mode, we should restore it.
      setAttr(document.body, YOUTUBE_RESTORE_NON_THEATER_ATTR, '1');
    } else {
      removeAttr(document.body, YOUTUBE_RESTORE_NON_THEATER_ATTR);
    }

    const theaterButton = document.getElementsByClassName(
        'ytp-size-button')?.[0];
    if (theaterButton instanceof HTMLElement) {
      theaterButton.click?.();
    }
  };

  /**
   * Called multiple time until it succeeds. Required because some pages just
   * deferred js to load videos.
   *
   * @return {boolean} Returning True stops retry
   */
  function doZoomPageRetries(): boolean {
    if (getVideomaxCmd() === 'unzoom') {
      trace('UNZOOMING! - skipping doZoomPage');
      return true;
    }

    // @ts-ignore This .src is correct. https://developer.mozilla.org/en-US/docs/Web/API/Window/frameElement
    if (window?.frameElement?.src === 'about:blank') {
      trace('Injected into blank iframe, not running');
      return true; // stop retrying
    }

    if (!documentLoaded()) {
      trace(`document state not complete: '${document.readyState}'`);
      return false;
    }

    if (isMaximized()) {
      trace(`doZoomPage videomaxGlobals.isMaximized=true, NOT running.`);
      return true;
    }

    if (!videomaxGlobals.elementMatcher) {
      logerr(`videomaxGlobals.elementMatcher is null`);
      return true;
    }

    const reinstall = hasInjectedAlready();
    trace(
        `doZoomPage readystate = ${document.readyState}  reinstall=${reinstall}`);

    if (DEBUG_ENABLED && isMaximized() === false && reinstall) {
      trace(
          'Something\'s weird. isMaximized()=false but hasInjectedAlready()=true');
    }

    videomaxGlobals.matchCounter = 0;

    const foundVideoNewAlgo = findLargestVideoNew(document);

    const getMatchCount = videomaxGlobals.elementMatcher?.getMatchCount() || 0;
    if (getMatchCount === 0) {
      trace(`No video found, ${isRunningInIFrame() ? 'iFrame' : 'Main'}.
        foundVideoNewAlg=${foundVideoNewAlgo}`);
      return false; // keep trying
    }

    const bestMatch = videomaxGlobals.elementMatcher.getBestMatch();

    if (!bestMatch) {
      logerr("No video found, should not be running doZoomPageRetries?");
      return true;
    }

    trace('video found', bestMatch);
    // mark it with a class.
    tagElementAsMatchedVideo(bestMatch);

    const matchCount = videomaxGlobals.elementMatcher.getMatchCount();
    if (matchCount > 1) {
      if (DEBUG_ENABLED) {
        trace(`FOUND TOO MANY VIDEOS ON PAGE? #${matchCount}`);
        // eslint-disable-next-line no-debugger
        debugger;
      }
    } else {
      trace('Final Best Matched Element: ', bestMatch.nodeName, bestMatch);
    }
    if (bestMatch instanceof HTMLElement) {
      updateEventListeners(bestMatch);
    }

    if (EMBED_SCORES) {
      // append the final results of what was discovered.
      appendSelectorItemsToResultInfo('=Main Video=',
                                      `.${PREFIX_CSS_CLASS}-video-matched`);
      appendSelectorItemsToResultInfo('=Playback controls=',
                                      `.${PREFIX_CSS_CLASS}-playback-controls`);
      appendUnitTestResultInfo('==========DONE==========\n\n');
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
                                  block: 'center',
                                  inline: 'center',
                                });
    }

    videomaxGlobals.isMaximized = true;

    // this timer will hide everything
    if (videomaxGlobals.tagonly) {
      document.body.setAttribute(VIDEO_MAX_INSTALLED_ATTR, 'tagonly');
      recursiveIFrameFlipClassPrep(document);
      recursiveIFrameFlipClassPrep(getTopElemNode() as HTMLIFrameElement); // Dicey AF
      trace('Tag only is set. Will not modify page to zoom video');
    } else {
      document.body.setAttribute(VIDEO_MAX_INSTALLED_ATTR, 'zoomed');
      videomaxGlobals.hideEverythingTimer?.startTimer(() => {
        if (!isMaximized()) {
          trace('hideEverythingTimer: isMaximized false');
          return true;
        }
        // BBC has some special css with lots of !importants
        hideCSS('screen-css');
        if (!fixUpPageZoom()) {
          return false;
        }

        postFixUpPageZoom();

        // this refresh will cause the scroller js in the page to "update" it's
        // visible list of videos and may remove our primary.
        forceRefresh(videomaxGlobals.matchedVideo);
        forceRefresh(window.document.body);
        forceRefresh(window);

        videomaxGlobals.isMaximized = true;
        document.body.setAttribute(VIDEO_MAX_INSTALLED_ATTR, 'running');
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
   * @param evt {Event}
   * @return {boolean}
   */
  const cancelScrollEvents = (evt: Event): boolean => {
    try {
      if (!videomaxGlobals?.isMaximized === true) {
        return false;
      }
      trace('cancelScrollEvent');
      evt.preventDefault();
      evt.stopImmediatePropagation();
    } catch (_err) {
    }
    return false;
  };
  // so add and remove stay in sync.
  const CANCEL_EVT_OPTIONS = {
    capture: true,
    passive: false,
  };

  function mainZoom(tagonly = false) {
    videomaxGlobals.unzooming = false; // clear if we start zooming again.
                                       // needed or retry timers
    if (hasInjectedAlready()) {
      trace('detected already injected. something is off?');
      return;
    }
    trace('running mainVideoMaxInject');

    const retries = isRunningInIFrame() ? 2 : 8;

    if (earyExitForSmallIFrame()) {
      return;
    }

    if (CANCEL_SCROLL_EVENTS && !isRunningInIFrame()) {
      // this is to prevent doomscrollers from completely changing the dom on us
      document.addEventListener('scroll', cancelScrollEvents,
                                CANCEL_EVT_OPTIONS);
    }

    if (!g_walker) {
      g_walker = document.createTreeWalker(document.body,
                                           NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_DOCUMENT,
                                           isVisibleWalkerElem);
    }

    if (!videomaxGlobals.elementMatcher) {
      videomaxGlobals.elementMatcher = new ElemMatcherClass();
    }

    setYoutubeIntoTheaterMode(true);

    if (!tagonly) {
      videomaxGlobals.hideEverythingTimer = new RetryTimeoutClass(
          'hideEverythingTimer', 250,
          retries);
      // don't start there, do it from doZoomPage()
    }

    videomaxGlobals.tagonly = tagonly;
    videomaxGlobals.findVideoRetryTimer = new RetryTimeoutClass('doZoomPage',
                                                                500, retries);
    videomaxGlobals.findVideoRetryTimer.startTimer(doZoomPageRetries);
  }

  const removeClassObserver = () => {
    if (videomaxGlobals.mutationObserver) {
      videomaxGlobals.mutationObserver.disconnect();
      videomaxGlobals.mutationObserver = null;
    }
  };

  const OBSERVE_ATTRIB_OPTIONS = {
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true,
    // new approach adds MULTIPLE observed elements and just watches children
    // old way used the `-common` and watched everything under it.
    childList: MUTATION_OBSERVER_WATCH_ALL_MAX,
    subtree: !MUTATION_OBSERVER_WATCH_ALL_MAX,
    characterData: false,
  };

  const startObserving = () => {
    if (!videomaxGlobals?.mutationObserver) {
      logerr('starting observer but videomaxGlobals.mutationObserver is null');
      return;
    }
    if (MUTATION_OBSERVER_WATCH_ALL_MAX) {
      // childList: true
      // subtree: false
      const zoomedElems = [
        ...document.querySelectorAll(`[class*="${PREFIX_CSS_CLASS}"]`),
        ...document.querySelectorAll(`[class*="${PREFIX_CSS_CLASS_PREP}"]`)];
      for (const eachElem of zoomedElems) {
        // can call it multiple times.
        try {
          videomaxGlobals.mutationObserver.observe(eachElem,
                                                   OBSERVE_ATTRIB_OPTIONS);
        } catch (err) {
          logerr(`OBSERVER: error for ${PrintNode(eachElem)}`);
        }
      }
      if (DEBUG_MUTATION_OBSERVER) {
        trace(
            `OBSERVER: installing MUTATION_OBSERVER_WATCH_ALL_MAX on ${zoomedElems.length} elements`);
        trace(`OBSERVER: check count using: 
        [...document.querySelectorAll('[class*="${PREFIX_CSS_CLASS}"]'),
        ...document.querySelectorAll('[class*="${PREFIX_CSS_CLASS_PREP}"]')].length
        `);
      }
    } else {
      if (DEBUG_MUTATION_OBSERVER) {
        if (videomaxGlobals.matchedCommonCntl) {
          trace('OBSERVER: installing observer on matchedCommonCntl',
                videomaxGlobals.matchedCommonCntl);
        } else {
          trace(
              'OBSERVER: \n\n \t ==== NOT installing no videomaxGlobals.matchedCommonCntl');
        }
      }
      // old approach
      // childList: false
      // subtree: true
      if (videomaxGlobals.matchedCommonCntl) {
        videomaxGlobals.mutationObserver.observe(
            videomaxGlobals.matchedCommonCntl,
            OBSERVE_ATTRIB_OPTIONS);
      }
    }
  };

  const addClassMutationObserver = () => {
    if (!USE_MUTATION_OBSERVER_ATTR) {
      return;
    }

    if (videomaxGlobals.mutationObserver) {
      if (DEBUG_MUTATION_OBSERVER) {
        trace('OBSERVER: \n\n \t ==== RERUNNING observer watching setup ====');
      }
      startObserving();
      return;
    }

    SANITY_CHECK_MATCH_NOT_DELETED();

    videomaxGlobals.mutationObserver = new MutationObserver(
        (mutations, _observer) => {
          // called when change happens. first disconnect to avoid recursions
          // observer.disconnect();
          // SANITY_CHECK_MATCH_NOT_DELETED();

          if (!isMaximized()) {
            logerr(
                'mutationObserver - !isMaximized() probably video element deleted');
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
          if (videomaxGlobals.mutationObserver) {
            for (const eachMutation of mutations) {
              if (eachMutation.type !== 'attributes') {
                continue;
              }
              // is one of our classnames on the old value?
              if (eachMutation?.oldValue?.length &&
                  eachMutation?.oldValue?.indexOf(PREFIX_CSS_CLASS) < 0) {
                // not found
                continue;
              }
              if (!(eachMutation.target instanceof HTMLElement)) {
                continue;
              }

              // our classname was there, but it's removed?
              if (hasAnyVideoMaxClass(eachMutation.target)) {
                continue;
              }

              // if we reach here then our classname was removed
              const oldClassNames = eachMutation.oldValue?.split(' ') || "";
              // figure out what classnames were removed and re-add it.
              for (const eachClassname of oldClassNames) {
                if (eachClassname.startsWith(PREFIX_CSS_CLASS)) {
                  eachMutation.target?.classList?.add(eachClassname);
                }
              }
              if (oldClassNames.length > 0 && DEBUG_MUTATION_OBSERVER) {
                const newClassName = getAttr(eachMutation.target, 'class');
                trace(
                    `OBSERVER: detected classname changes\n\t before:"${eachMutation?.oldValue}"\n\t new:"${newClassName}"\n\t fixed:"${getAttr(
                        eachMutation.target, 'class')}"`);
              }
            }
          }
        });
    startObserving();
  };

  const isVisible = (elem: Element): boolean => (elem?.checkVisibility &&
                                                 elem.checkVisibility({
                                                                        checkOpacity: true,
                                                                        checkVisibilityCSS: true,
                                                                      })) || false;

  /**
   *
   * @param videoElem {HTMLVideoElement}
   * @return {boolean}
   */
  const isTopVisibleVideoElem = (videoElem: HTMLVideoElement): boolean => {
    if (isRunningInIFrame()) {
      // this could be tricky as hell... we likely to what's outside our frame
      if (FULL_DEBUG) {
        // eslint-disable-next-line no-debugger
        debugger;
      }
    }
    // center of the element
    const {
      top,
      left,
      width,
      height,
    } = getCoords(videoElem);
    const layedElems = document.elementsFromPoint(
        Math.round(left + (width / 2)),
        Math.round(top + (height / 2)));

    // we walk down the layers checking to see if it's a video and if it's
    // visible.
    const match = layedElems.find((eachLayer) => {
      if (!['video', 'iframe'].includes(eachLayer.nodeName.toLowerCase())) {
        return false;
      }
      return isVisible(eachLayer);
    });

    const result = videoElem.isSameNode(match || null); // undefined->null
    trace(`isTopVisibleVideoElem is ${result} for ${PrintNode(videoElem)}
    videoElem: `, videoElem, `
    match: `, match, `
    layedElems: `, layedElems);
    return result;
  };

  /**
   * logic to reapply the playback speed after a video leaves buffering state.
   * some sites are watching this event and resetting the speed.
   * we do it on a setTimeout to run after their routines.
   * Triggered on "canplay" event for the main video.
   */
  const updateSpeedFromAttr: EventListener = (evt) => {
    setTimeout(() => {
      try {
        const videoElem = evt.currentTarget || evt.target;
        if (!(videoElem instanceof HTMLVideoElement)) {
          return;
        }
        if (!isVisible(videoElem)) {
          // we only need to do something if it's visible.
          trace(
              `updateSpeedFromAttr not running because video isn't visible ${PrintNode(
                  videoElem)}`);
          return;
        }
        // do we update speed on ALL visible videos or only the one we think it
        // the frontmost? this can happen when ads cover or are behind the main
        // video.
        const speedStr = document.body.getAttribute(PLAYBACK_SPEED_ATTR) || DEFAULT_SPEED;
        const speedFloat = safeParseFloat(speedStr);
        if (!videoElem.paused && !videoElem.ended && speedFloat > 0 &&
            videoElem.playbackRate !==
            speedFloat) {
          const isTopItem = isTopVisibleVideoElem(videoElem);
          trace(
              `updateSpeedFromAttr video: isTopVisibleVideoElem:${isTopItem} speedStr:${speedStr} \n\t\t ${PrintNode(
                  videoElem)}`);
          videoElem.playbackRate = Math.abs(speedFloat);
        } else if (videoElem.playbackRate !== speedFloat && speedFloat ===
                   1.0) {
          // we're trying to reset the speed to 1.0
          videoElem.playbackRate = 1.0;
        } else {
          trace(
              `updateSpeedFromAttr not running\n\t\tvideoElem.paused:${videoElem.paused} \n\t\t speedFloat:${speedFloat} \n\t\t videoElem.playbackRate:${videoElem.playbackRate}\n\t\t ${PrintNode(
                  videoElem)}`);
        }
      } catch (err) {
        logerr(err);
      }
    }, 1);
  };

  const videoCanPlayRemove = () => {
    try {
      videomaxGlobals?.matchedVideo?.removeEventListener('canplay',
                                                       updateSpeedFromAttr);
    } catch (_err) {}

    if (!REAPPLY_PLAYBACKSPEED) {
      return;
    }
    const videos = document.getElementsByTagName('video');
    for (const eachVideo of videos) {
      try {
        if (eachVideo.playbackRate !== 1.0) {
          eachVideo.playbackRate = 1.0;
        }
        eachVideo.removeEventListener('canplay', updateSpeedFromAttr);
      } catch (err) {
        logerr(err);
      }
    }
  };

  const videoCanPlayBufferingInit = () => {
    if (!REAPPLY_PLAYBACKSPEED) {
      return;
    }
    const videos = document.getElementsByTagName('video');
    for (const eachVideo of videos) {
      try {
        // watch for video to be ready (buffer done and run reapply the speed)
        eachVideo.removeEventListener('canplay', updateSpeedFromAttr);
        eachVideo.addEventListener('canplay', updateSpeedFromAttr);
      } catch (err) {
        logerr(err);
      }
    }
  };

// <editor-fold defaultstate="collapsed" desc="UndoZoom">
  /**
   * Using a class for better namespacing. Should do the same for zooming logic
   */
  class UndoZoom {
    /** @param doc {Document} */
    static recurseIFrameUndoAll(doc: Document) {
      try {
        if (typeof (doc?.querySelectorAll) !== 'function') {
          // security can block
          return;
        }
        const allIFrames = doc.querySelectorAll('iframe');
        for (const frame of allIFrames) {
          try {
            const framedoc = frame?.contentDocument;
            if (!framedoc) {
              continue;
            }
            setTimeout(UndoZoom.undoAll, 0, framedoc);
            UndoZoom.recurseIFrameUndoAll(framedoc);
          } catch (err) {
            // probably iframe boundry security related
          }
        }
      } catch (err) {
        // probably security related
      }
    }

    /** @param doc {Document} */
    static removeAllClassStyles(doc: Document) {
      if (typeof (doc?.querySelectorAll) !== 'function') {
        // security can block
        return;
      }
      const allElementsToFix = doc.querySelectorAll(
          `[class*="${PREFIX_CSS_CLASS}"]`);
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
          removeAttr(elem, 'class');
        }
      }
    }

    /** @param doc {Document} */
    static undoStyleSheetChanges(doc: Document) {
      try {
        if (typeof (doc?.getElementsByTagName) !== 'function') {
          // some iframes block access for security reasons
          return;
        }
        const cssNode = doc.getElementById(CSS_STYLE_HEADER_ID);
        if (parentElement(cssNode) && cssNode?.parentNode?.removeChild) {
          parentElement(cssNode)?.removeChild(cssNode);
        }

        const externcsss = doc.getElementsByTagName('link');
        for (const elem of externcsss) {
          if (elem.getAttribute('media') === '_all') {
            elem.setAttribute('media', 'all');
          }
        }
      } catch (ex) {
        logerr(ex);
      }
    }

    /** @param doc {Document} */
    static undoAttribChange(doc: Document) {
      if (typeof (doc?.querySelectorAll) !== 'function') {
        // security can block
        return;
      }
      // we tag all elements that have saved attributes by adding the
      // VIDEO_MAX_DATA_ATTRIB_UNDO_TAG
      const hasAttrTags = doc.querySelectorAll(
          `[${VIDEO_MAX_DATA_ATTRIB_UNDO_TAG}]`);
      for (const elem of hasAttrTags) {
        try {
          restoreAllSavedAttr(elem);
          //  try and make the element realizes it needs to redraw. Fixes
          // progress bar
          trace(
              `undoAttribChange: Generating 'resize' and 'visabilitychange" events to force refresh for ${PrintNode(
                  elem)}`);
          elem.dispatchEvent(new Event('resize'));
          elem.dispatchEvent(new Event('visabilitychange'));
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
      if (videomaxGlobals.hideEverythingTimer) {
        videomaxGlobals.hideEverythingTimer.cleartimeout();
        videomaxGlobals.hideEverythingTimer = null;
      }
      if (videomaxGlobals.findVideoRetryTimer) {
        videomaxGlobals.findVideoRetryTimer.cleartimeout();
        videomaxGlobals.findVideoRetryTimer = null;
      }

      if (!isRunningInIFrame()) {
        // this is to prevent doomscrollers from completely changing the dom on
        // us
        document.removeEventListener('scroll', cancelScrollEvents,
                                     CANCEL_EVT_OPTIONS);
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
        trace(
            `unzoom:forceRefresh: Generating 'resize' and 'visabilitychange" events to force refresh for window`);
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('visabilitychange'));
        if (optionalElem?.dispatchEvent) {
          optionalElem.dispatchEvent(new Event('resize'));
          optionalElem.dispatchEvent(new Event('visabilitychange'));
        } else {
          UndoZoom.touchDocBodyToTriggerUpdate();
        }
      }, 1); // was 50
    }

    static mainUnzoom() {
      try {
        const savedVideo = videomaxGlobals.matchedVideo;
        videomaxGlobals.unzooming = true;
        videomaxGlobals.isMaximized = false;
        document.body.removeAttribute(VIDEO_MAX_INSTALLED_ATTR);

        if (videomaxGlobals.matchedVideo) {
          updateEventListeners(videomaxGlobals.matchedVideo, true);
        }

        removeClassObserver();
        videoCanPlayRemove();

        UndoZoom.undoAll(document);

        if (videomaxGlobals.matchedVideo?.ownerDocument &&
            videomaxGlobals.matchedVideo.ownerDocument !== document) {
          UndoZoom.undoAll(videomaxGlobals.matchedVideo.ownerDocument);
        }
        UndoZoom.recurseIFrameUndoAll(document);
        UndoZoom.recurseIFrameUndoAll(window.document);

        if (!isRunningInIFrame() &&
            getAttr(document.body, YOUTUBE_RESTORE_NON_THEATER_ATTR) !==
            null) {
          trace('Detected we put youtube in theater mode, undoing it');
          setYoutubeIntoTheaterMode(false);
        }

        // remove the video "data-videomax-" attributes
        const ALL_DOCS = [document, window.document];
        for (const eachAttr of REMOVE_ATTR_LIST) {
          for (const eachDoc of ALL_DOCS) {
            try {
              if (typeof (eachDoc?.querySelectorAll) !== 'function') {
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

        if (DEBUG_ENABLED) {
          // fallback - find ALL elements that have a videomax class and
          // remove. PREFIX_CSS_CLASS matches prep, too
          const missedRemoved1 = document.querySelectorAll(
              `[class*="${PREFIX_CSS_CLASS}"]`);
          if (missedRemoved1.length) {
            // undo didn't remove all "videomax-ext" classes from this doc
            // (maybe iframe) eslint-disable-next-line no-debugger
            debugger;
          }

          if (videomaxGlobals.matchedVideo?.ownerDocument) {
            const notRemoved2 = videomaxGlobals.matchedVideo.ownerDocument.querySelectorAll(
                `[class*="${PREFIX_CSS_CLASS}"]`) || [];
            if (notRemoved2.length) {
              // undo didn't remove all "videomax-ext" classes from document
              // where video was found eslint-disable-next-line no-debugger
              debugger;
            }
          }
        } // DEBUG_ENABLED

        // clear if we have var saved in window/document
        if (!isRunningInIFrame() && document?._VideoMaxExt) {
          window._VideoMaxExt = undefined;
        } else if (document._VideoMaxExt) {
          document._VideoMaxExt = undefined;
        }
        UndoZoom.unzoomForceRefresh(document);
        // UndoZoom.unzoomForceRefresh(savedVideo);
      } catch (ex) {
        logerr(ex);
      }
    }

  }

// </editor-fold>

// look at the command set by the first injected file
  trace(`
    ***
    videmax_cmd: window.videmax_cmd:'${document.videmax_cmd}'  getVideomaxCmd():'${getVideomaxCmd()}'
    ***`);
  switch (getVideomaxCmd()) {
    case 'unzoom':
      UndoZoom.mainUnzoom();
      break;

    case 'tagonly':
      // this is for sites that already zoom correctly, but we'd like to do
      // speed control
      mainZoom(true);
      break;

    case 'zoom':
      mainZoom();
      break;

    default:
      logerr('document.videmax_cmd missing');
      mainZoom();
      break;
  }
} catch (err: any) {
  // eslint-disable-next-line no-console
  console.error('videomax extension error', err, err.stack);
}
