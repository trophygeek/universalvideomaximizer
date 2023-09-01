// @ts-check
/*
 Video Maximizer
 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.
 Copyright (C) 2023 trophygeek@gmail.com
 www.videomaximizer.com
 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/
 */
try { // scope and prevent errors from leaking out to page.
  const FULL_DEBUG = false;
  const DEBUG_ENABLED = FULL_DEBUG;
  const TRACE_ENABLED = FULL_DEBUG;
  const ERR_BREAK_ENABLED = FULL_DEBUG;
  const BREAK_ON_BEST_MATCH = false;

  // These are noisy and can be enabled when debugging areas. FULL_DEBUG must also be true
  const EMBED_SCORES = false;
  const COMMON_PARENT_SCORES = false;
  const DEBUG_HIDENODE = false;
  const DEBUG_MUTATION_OBSERVER = false;

  // Recent changes - keep these flags to quickly regression check various fixes across sites
  // What fixes one site often breaks another.
  // Eventually, these can go away as we verify no adverse interactions.
  const ONLY_RUN_AFTER_DOC_LOADED = true;
  const IFRAME_PARENT_NODE_WORKS = true;
  const USE_MUTATION_OBSERVER_ATTR = true;
  const INCLUDE_TRANSITION_MATCHING = false;
  const SAVE_STYLE_FOR_OVERLAPs = true;
  const DO_HIDE_EXCEPTION_CHECK = true;
  const ALWAYS_BACK_UP_STYLES = true;
  const LAST_DITCH_HIDE = true;
  const REAPPLY_PLAYBACKSPEED = true;
  const MUTATION_OBSERVER_WATCH_ALL_MAX = true;
  const MUTATION_OBSERVER_HIDE_NEW_ELEMS_ADDED = true;
  const USE_OLD_FAST_IS_VISIBLE_CHECK_IN_WALKER = false; // new code => false
  const FIND_CONTROLS_ON_MAIN_THREAD_FOR_IFRAME_MATCH = true;
  const USE_WHOLE_WINDOW_TO_SEARCH_FOR_CONTROLS = true;
  const IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE = true;  // jasmine has some hidden div in path.
  const NOHIDENODE_REAPPLY = true;
  const USE_BOOST_SCORES_FIND_COMMON = true;
  const USE_NERF_SCORES_FIND_COMMON = true;
  const FIX_UP_BODY_CLASS_TO_SITE_SPECIFIC_CSS_MATCH = true;
  const OVERLAPS_REQUIRE_TRANSITION_EFFECTS = true;
  const REMOVE_STYLE_FROM_ELEMS = false; // test to see it can be removed
  const CHECK_PRESENTATION_ROLE = false; // removed to Youtube over-matching problem.

  const MIN_VIDEO_WIDTH = 320;
  const MIN_VIDEO_HEIGHT = 240;

  const MIN_IFRAME_WIDTH = MIN_VIDEO_WIDTH;
  const MIN_IFRAME_HEIGHT = MIN_VIDEO_HEIGHT;


  // when walking dom how many levels up to check when looking for controls?
  // too low and we miss some playback position controls (vimeo)
  // too high an we find non-controls like ads
  const CHECK_PARENTS_LEVELS_UP_MAX = 8; // was 6

  const START_WEIGHT = 1000;
  const RATIO_WEIGHT = 0.50;
  const SIZE_WEIGHT = 5.0;
  const ORDER_WEIGHT = -5.0; // was -10
  const TAB_INDEX_WEIGHT = -6.0;
  const HIDDEN_VIDEO_WEIGHT = -10; // downgrades
  const ZINDEX_WEIGHT = 0.5;
  const VIDEO_OVER_IFRAME_WEIGHT = 0; // video gets VIDEO_PLAYING_WEIGHT, VIDEO_DURATION_WEIGHT,
                                      // VIDEO_LOOPS_WEIGHT, etc
  const MAIN_FRAME_WEIGHT = 5.0;
  const VIDEO_PLAYING_WEIGHT = 10.0;
  const VIDEO_DURATION_WEIGHT = 2; // was 0.5
  const MAX_DURATION_SECS = 60 * 60 * 2; // 2hrs max - live videos skew results
  const VIDEO_LOOPS_WEIGHT = -10.0;
  const VIDEO_HAS_SOUND_WEIGHT = 10.0;
  const URL_OVERLAP_WEIGHT = 100.0;
  const TITLE_OVERLAP_WEIGHT = 100;
  const ALLOW_FULLSCREEN_WEIGHT = 10.0;
  const ADVERTISE_WEIGHT = -100.0; // de don't hide ads, but we dont' want to match them as
                                   // main videos

  /** @type {HtmlElementTypes} */
  const ALWAYS_HIDE_NODES = ["footer", "header", "nav"];  // aside needed for

  /** @type {HtmlElementTypes} */
  const IGNORE_NODES = ["noscript",
                        "script",
                        "head",
                        "link",
                        "style",
                        "hmtl"];
  /** @type {HtmlElementTypes} */
  const IGNORE_CNTL_NODES = [...IGNORE_NODES,
                             ...ALWAYS_HIDE_NODES,
                             "head",
                             "body",
                             "html",
                             "iframe"];
  /** @type {HtmlElementTypes} */
  const STOP_NODES_COMMON_CONTAINER = [...IGNORE_CNTL_NODES, "main", "section", "article"];
  const IGNORE_COMMON_CONTAINER_COUNT_NODES = [...ALWAYS_HIDE_NODES,
                                               "head",
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
                                               "span"];
  const SKIPPED_NODE_NAMES = ["#document", // iframe top element
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
                              "header",
                              "footer",
    // "figure", // secsports puts it under a <figure> seriously?
                              "caption",
                              "area",
                              "br",
                              "button",
                              "code",
                              "cite",
                              "data",
                              "del",
                              "fieldset",
                              "figcaption",
                              "form",
                              "hgroup",
                              "input"];
  const SKIPPED_NODE_NAMES_FOR_PLAYBACK_CTRLS = [
    ...IGNORE_NODES,
    ...SKIPPED_NODE_NAMES,
    ...IGNORE_COMMON_CONTAINER_COUNT_NODES];

  const CSS_STYLE_HEADER_ID = "maximizier-css-inject";

  // we use the prop class then flip all the classes at the end.
  // The reason for this is that the clientRect can get confused on rezoom if
  //     the background page couldn't inject the css as a header.
  const PREFIX_CSS_CLASS = "videomax-ext";
  const PREFIX_CSS_CLASS_PREP = "videomax-ext-prep";
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
  const VIDEO_MAX_DATA_PREFIX = "data-videomax";
  const VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX = `${VIDEO_MAX_DATA_PREFIX}-saved`;
  // used to find all the VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX easily
  const VIDEO_MAX_DATA_ATTRIB_UNDO_TAG = `${VIDEO_MAX_DATA_PREFIX}-tag-saved`;

  // from background script on body
  const PLAYBACK_SPEED_ATTR = `${VIDEO_MAX_DATA_PREFIX}-playbackspeed`;
  const VIDEO_MAX_INSTALLED_ATTR = `${VIDEO_MAX_DATA_PREFIX}-running`; // data-videomax-running

  const EMBEDED_SCORES = `${VIDEO_MAX_DATA_PREFIX}-scores`;
  const VIDEO_MAX_ATTRIB_FIND = `${VIDEO_MAX_DATA_PREFIX}-target`;
  const VIDEO_MAX_ATTRIB_ID = "zoomed-video";


  const REMOVE_ATTR_LIST = [PLAYBACK_SPEED_ATTR,
                            VIDEO_MAX_ATTRIB_FIND,
                            EMBEDED_SCORES,
    // old videomax for comparision. remove them too
                            `data-videomax-weights`,
                            `videomax-ext-prep-scores`];

  const SCALESTRING_WIDTH = "100%"; // "calc(100vw)";
  const SCALESTRING_HEIGHT = "100%"; // "calc(100vh)";
  const SCALESTRING = "100%";

  // per doc globals (e.g. inside iframes from background inject gets it's own)
  let videomaxGlobals = {
    /** @type {ElemMatcherClass | null} */
    elementMatcher: null,

    /** @type {HTMLVideoElement | HTMLIFrameElement} */
    matchedVideo: null,
    /** @type {DomRect} */
    matchVideoRect: null,
    /** @type {boolean} */
    matchedIsHtml5Video: false,
    /** @type {boolean} */
    processInFrame: false,
    /** @type {HTMLElement | Node} */
    matchedCommonCntl: null,
    /** @type {boolean} */
    injectedCss: false,
    /** @type {string} */
    cssToInject: "",

    /** @var {MutationObserver} */
    mutationObserver: null,

    /** @type {RetryTimeoutClass | null} */
    findVideoRetryTimer: null,
    /** @type {RetryTimeoutClass | null} */
    hideEverythingTimer: null,
    /** @type {boolean} */
    isMaximized: false,
    /** @type {boolean} */
    tagonly: false,
    /** @type {number} */
    match_counter: 0,
  };

  /** @type {TreeWalker | null} */
  let walker = null;

  const isRunningInIFrame = () => window !== window?.parent;

  const logerr = (...args) => {
    if (DEBUG_ENABLED === false) {
      return;
    }
    const inIFrame = isRunningInIFrame() ? "iframe" : "main";
    // eslint-disable-next-line no-console
    console.trace(`%c VideoMax INJECT ${inIFrame} ERROR`,
                  "color: white; font-weight: bold; background-color: red", ...args);
    if (ERR_BREAK_ENABLED) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
  };

  const trace = (...args) => {
    if (TRACE_ENABLED === false) {
      return;
    }
    const color = `color: white; font-weight: bold; background-color: blue`;
    const iframe = isRunningInIFrame() ? "iFrame" : "Main";
    // blue color , no break
    // eslint-disable-next-line no-console
    console.log(`%c VideoMax ${iframe}`, color, ...args);
  };

  if (!isRunningInIFrame()) {
    if (window?._VideoMaxExt) {
      trace("Found globals, restoring");
      videomaxGlobals = window._VideoMaxExt;
    } else {
      trace("Initializing globals");
      window._VideoMaxExt = videomaxGlobals;
    }
  } else {
    // running in iFrame
    // eslint-disable-next-line no-lonely-if
    if (document._VideoMaxExt) {
      videomaxGlobals = document._VideoMaxExt;
    } else {
      document._VideoMaxExt = videomaxGlobals;
    }
  }

  /** these should be unit tests - not sure how to do it */
  const getOverlapCount = (arrA, arrB) => arrA.filter(x => arrB.includes(x)).length;

// split on :// and use what comes after, then trim of cgi params, the split into
// works and filter out empty
  /**
   * @param url {string}
   * @return {string[]}
   */
  const splitUrlWords = (url) => {
    if (!url?.length) {
      return [];
    }
    const path = url.split("://")[1] || url;
    const noArgs = path.split("?")[0] || path;
    return [...noArgs.split(/[^A-Z0-9]+/i)
      .filter(s => s.length > 0)];
  };

  /**
   * @param str {string}
   * @return {number|number}
   */
  function safeParseInt(str) {
    const result = parseInt(str, 10);
    return Number.isNaN(result) ? 0 : result;
  }

  /**
   * @param str {string}
   * @return {number|number}
   */
  function safeParseFloat(str) {
    const result = parseFloat(str);
    return Number.isNaN(result) ? 0 : result;
  }

  /**
   * @return {string}
   */
  const getPageUrl = () => isRunningInIFrame() ?
                           document.referrer :
                           document.location.href;

  /**
   * Needs unit tests. ATTEMPT to turn "www.foo.com" and "web.foo.net" into just "foo".
   * @return {string}
   */
  const getPageDomainNormalized = () => {
    const url = new URL(getPageUrl());
    let domainName = url.hostname;

    // normalizing the tld is next to impossible w/out some cookie setting hack
    // so we just remove any prefix like www or web
    const prefixesToRemove = ["www", "web", "static", "video", "tv"];
    for (const prefix of prefixesToRemove) {
      if (domainName.startsWith(`${prefix}.`)) {
        domainName = domainName.substring(prefix.length + 1);
        break; // we found one, stop
      }
    }
    // now we trim off the tld ".com" or ".whatever", it won't work for some
    // countries like 'co.uk", but it's probably good enough for our matching needs.
    // we only use it to match css classes, not security related
    const lastDotOffset = domainName.lastIndexOf(".");
    domainName = domainName.substring(0, lastDotOffset > 0 ? lastDotOffset : domainName.length);
    return domainName;
  };

  /**
   * @param urlformat {string}
   * @return {{[key: string]: string}}
   */
  const parseParams = (urlformat) => {
    const pl = /\+/g; // Regex for replacing addition symbol with a space
    const search = /([^&=]+)=?([^&]*)/g;
    const decode = (s) => decodeURIComponent(s.replace(pl, " "));
    const query = urlformat;

    const urlParamsResult = {};
    let match = search.exec(query);
    while (match) {
      urlParamsResult[decode(match[1])] = decode(match[2]);
      match = search.exec(query);
    }
    return urlParamsResult;
  };

  /**
   * Returns the document of an IFrame and tries to handle security
   * @param iframe {HTMLFrameElement | HTMLIFrameElement | Document | undefined}
   * @return {Document|HTMLDocument}
   */
  const getIFrameDoc = (iframe) => {
    try {
      if (iframe instanceof Document) {
        return iframe;
      }
      return iframe?.contentDocument || iframe?.contentWindow?.document;
    } catch (_err) {
      // security errors are hard to detect and prevent, just have to catch them.
      return undefined;
    }
  };

  /**
   * Walking out of an iFrame. We searh the main window for the iframe
   * @param docElem {HTMLIFrameElement || HTMLDocument}
   * @return {undefined|HTMLIFrameElement}
   */
  const getFrameForDocument = (docElem) => {
    try {
      if (!docElem) {
        return undefined;
      }
      const w = docElem.defaultView || docElem.parentWindow;
      const frames = w.parent.document.getElementsByTagName("iframe");
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
      trace(`getFrameForDocument err`, err);
    }
    return undefined;
  };

  /**
   *
   * @param elem {Node || Document}
   * @return {boolean}
   */
  const isElemInIFrame = (elem) => {
    try {
      return (elem.ownerDocument !== document);
    } catch (_err) {
    }
    return false;
  };

  /**
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  const isIFrameElem = (elem) => elem?.nodeName === "IFRAME" || elem?.nodeName === "FRAME" || false;


  /**
   *
   * @param elem {Element}
   * @return {Element || undefined}
   */
  const parentNode = (elem) => {
    let result;
    try {
      // no not remove
      result = elem?.parentNode || undefined; // assignment can throw but not testing value
      if (result) {return result;}
      // this next trick will keep walking up out of iframes (when it's on the same domain)
      // Potential problem: is that this frame MAY NOT BE THE BEST match at the top level if
      // multiple iframes
      if (IFRAME_PARENT_NODE_WORKS && isRunningInIFrame()) {
        result = getFrameForDocument(elem);
        if (result) {
          trace("Walking up out of iframe");
        }
      }
    } catch (err) {
      // can throw CSP error if crosses an iframe boundry.
      trace("parentNode err", err);
    }
    return result;
  };

  /**
   * We want to SAVE these results somewhere that automated unit tests can e
   * easily extract the scores to measure changes across revisions
   * @param newStr {string}
   */
  const appendUnitTestResultInfo = (newStr) => {
    if (!EMBED_SCORES) {
      return;
    }
    try {
      if (isRunningInIFrame()) {
        return;
      }

      window.document.body.parentNode.append(window.document.createComment(`
      ${newStr}

      `));
    } catch (err) {
      trace(err);
    }
  };

  /**
   *
   * @param elem {HTMLElement | Node}
   * @return {string}
   * @constructor
   */
  const PrintNode = (elem) => {
    try {
      if (!elem) {
        return "undefined";
      }
      // lol... if <video> has autoplay, then a cloneNode can trigger the sound to play twice.
      let restoreAutoplayAttr = null;
      if (elem.nodeName === "VIDEO") {
        // playeur gets duplicate sound playing. So weird.
        restoreAutoplayAttr = getAttr(bestMatch, "autoplay");
        if (!!restoreAutoplayAttr?.length) {
          trace(`Removing autoplay from video element`);
          removeAttr(elem, "autoplay");
          // technically, we should re-add it below but this is a debug feature.
        }
        // now we should "play"
      }

      let clone = elem?.cloneNode(false);

      if (!!restoreAutoplayAttr?.length) {
        trace(`Restoring autoplay from video element`);
        setAttr(elem, "autoplay", restoreAutoplayAttr);
      }

      if (!clone) {
        return "";
      }
      clone.innerText = "";
      if (clone?.srcdoc?.length) {
        clone.srcdoc = "";
      }
      const result = clone?.outerHTML || " - ";

      // do our best to free this.
      delete(clone);
      clone = null;

      // don't allow it to be too big. iframes with inlined src can be huge
      return result.substring(0, 1024);
    } catch (err) {
      return " - ";
    }
  };

  /**
   *
   * @param rect {DomRect}
   * @return {string}
   * @constructor
   */

    // Intl.NumberFormat is slow unless cached like this.
  const fmtInt = new Intl.NumberFormat("en-US", {
      useGrouping:           true,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  const fmtFlt = new Intl.NumberFormat("en-US", {
    useGrouping:           false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  });

  /**
   * Rounds a float consistently - WTF javascript?
   * @param value {number} The number to round
   * @returns {number} The value rounded to the given number of significant figures
   */
  const round = (value) => parseFloat(fmtFlt.format(value));

  /**
   * @param strMessage {string}
   * @param strSelector {string}
   */
  const appendSelectorItemsToResultInfo = (strMessage, strSelector) => {
    const results = [strMessage];
    const matches = document.querySelectorAll(strSelector);
    for (const match of matches) {
      results.push(PrintNode(match));
    }
    const combinedResults = results.join(`\n`);
    appendUnitTestResultInfo(`${combinedResults}\n`);
  };

  const documentLoaded = () => ["complete", "interactive"].includes(document.readyState);
  const getTopElemNode = () => window.document.body.parentNode || window.document.body;
  /**
   * Node does not have getAttributes or classList. Elements do
   * @param nodeOrElem {Node | HTMLElement}
   * @return {boolean}
   */
  const isElem = (nodeOrElem) => (nodeOrElem instanceof HTMLElement);
  // or is it (nodeOrElem.nodeType === Node.ELEMENT_NODE)?

  /**
   *
   * @param elem {Node || HTMLElement}
   * @param attr {string || null}
   * return {string}
   */
  const getAttr = (elem, attr) => {
    try {
      return elem?.getAttribute(attr) || null;
    } catch (err) {
      return null;
    }
  };

  /**
   *
   * @param elem {Node || HTMLElement}
   * @param attr {string}
   * @param value {string}
   */
  const setAttr = (elem, attr, value) => {
    try {
      elem.setAttribute(attr, value);
    } catch (err) {
      trace(err);
    }
  };

  /**
   *
   * @param elem {Node || HTMLElement}
   * @param attr {string}
   */
  const removeAttr = (elem, attr) => {
    try {
      elem.removeAttribute(attr);
    } catch (err) {
      trace(err);
    }
  };

  /**
   * Returns true if any css classname starts with our prefix.
   * @param node {Node || HTMLElement}
   * @return {boolean}
   */
  const hasAnyVideoMaxClass = (node) => {
    try {
      // node.className for an svg element is an array not a string.
      const className = getAttr(node, "class");
      return (className !== null && className.toString()
        .toLowerCase()
        .indexOf(PREFIX_CSS_CLASS) !== -1);  // "videomax-ext"
    } catch (err) {
      logerr(err);
    }
    return false;
  };


  /**
   * Will copy the existing attribute into a data-videomax-{attr} as a save, then set the attr
   * to the new value.
   * Use cases:
   *  1. Save existing attr (e.g. "style") and replace it with a new value
   *  2. Save existing attr and replace it NOTHING. newValue is "" (remove it but restore later)
   *  3. There's no existing attr to save but add a new one.
   *  4. We go to save an exist attr but there's already something saved. Do NOT overwrite it. (we
   * could merge?)
   *
   *  Undo should handle all cases as well.
   *
   * @param node {Node || HTMLElement}
   * @param attrKey {string}
   * @param newValue {string || null}
   */
  const setAttrAndSave = (node, attrKey, newValue) => {
    if (!isElem(node)) {
      return;
    }
    backupAttr(node, attrKey);
    setAttr(node, attrKey, newValue);
    setAttr(node, VIDEO_MAX_DATA_ATTRIB_UNDO_TAG, "1");
  };

  /**
   * for readability, could flip around logic
   * @param node {Node || HTMLElement}
   * @param attrKey {string}
   */
  const backupAttr = (node, attrKey) => {
    const orgValue = getAttr(node, attrKey);
    if (orgValue === null) { // anything to save?
      return;
    }
    const backupName = `${VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX}-${attrKey}`;
    if (getAttr(node, backupName) !== null) {
      trace(`Attempting to resave attribute? ${PrintNode(node)}"`);
    } else {
      setAttr(node, backupName, orgValue);
      setAttr(node, VIDEO_MAX_DATA_ATTRIB_UNDO_TAG, "1");
    }
  };

  /**
   * @param styleStr {string}
   * @param mergeIntoObj {{[key: string]: string}}
   * @return {{[key: string]: string}}
   */
  const styleStrToObject = (styleStr, mergeIntoObj) => {
    const result = mergeIntoObj;
    const parts = styleStr.split(";");
    for (const eachPart of parts) {
      const pair = eachPart.split(":");
      if (pair.length !== 2) {
        continue;
      }
      const key = pair[0].trim();
      result[key] = pair[1].trim();
    }
    return result;
  };

  /**
   * find and restore all the saved attributes. If you touch this, verify youtube toggle and
   * crunchyroll
   * @param elem {HTMLElement}
   */
  const restoreAllSavedAttr = (elem) => {
    // filter on `data-videomax-saved-*` attributes
    const attrNames = /** @type string[] */ [...(elem?.getAttributeNames() || [])]
      .filter((attr) => attr.startsWith(VIDEO_MAX_DATA_ATTRIB_UNDO_PREFIX)); // clone array
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
      // case where we want to remove values we set?  removeAttr(elem, originalAttrName);
      if (originalAttrName === "style") {
        // we add our changes back but if there are new changes, we append.
        /** @type {{[key: string]: string}} */
        const currentStyleParts = styleStrToObject(savedValue, styleStrToObject(currentVal, {}));

        let mergedValue = Object.keys(currentStyleParts)
          .map(key => `${key}: ${currentStyleParts[key]}`)
          .join("; ");


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
  };

  /**
   *
   * @param elem {Node}
   * @returns {boolean}
   */
  const isStopNodeForCommonContainer = (elem) => {
    const nodename = /** @type HtmlElementType */ elem?.nodeName?.toLowerCase() || "";
    return STOP_NODES_COMMON_CONTAINER.includes(nodename);
  };

  /// / finding video logic. this code is a bit of a mess.
  /**
   *
   * @param doc {Document}
   * @return {boolean}
   */
  const findLargestVideoNew = (doc) => {
    try {
      // try top level doc
      {
        const allvideos = document.querySelectorAll("video");
        for (const eachvido of allvideos) {
          videomaxGlobals.elementMatcher.checkIfBest(eachvido);
        }
      }
      // now go into frames
      if (typeof (doc?.querySelectorAll) === "function") {
        const frames = doc.querySelectorAll("iframe");
        for (const frame of frames) {
          try {
            videomaxGlobals.elementMatcher.checkIfBest(frame);

            if (typeof (frame?.contentWindow?.document?.querySelectorAll) !== "function") {
              continue;
            }
            const allvideos = frame.contentWindow.document.querySelectorAll("video");
            for (const eachvido of allvideos) {
              videomaxGlobals.elementMatcher.checkIfBest(eachvido);
            }
          } catch (err) {
            if (err.toString()
                  .toLowerCase()
                  .indexOf("blocked a frame") !== -1) {
              trace("iframe security blocked cross domain - expected");
            } else {
              logerr(err);
            }
          }
        }
      }
      return (videomaxGlobals.elementMatcher.getBestMatchCount() > 0);
    } catch (err) {
      trace(err);
      return false;
    }
  };

  /**
   * @param node {Node || HTMLElement}
   * @return {Document|ActiveX.IXMLDOMDocument|Document}
   */
  const getOwnerDoc = (node) => {
    if (node instanceof Document) {
      return node;
    }
    return node?.ownerDocument || document;
  };

  /**
   *
   * @param node {Node || HTMLElement}
   * @return {Window}
   */
  const getElemsDocumentView = (node) => getOwnerDoc(node).defaultView;

  /**
   * This is kind of an expensive op, maybe cache. The CSSStyleDeclaration is massive.
   * @param node {Node || HTMLElement}
   * @returns {CSSStyleDeclaration}
   */
  const getElemComputedStyle = (node) => {
    try {
      const view = getElemsDocumentView(node);
      return view.getComputedStyle(node, null);
    } catch (err) {
      // can throw if cross iframe boundary
      logerr(err);
      return {};
    }
  };

  /**
   * @param rect {DomRect}
   * @return {boolean}
   */
  const isEmptyRect = (rect) => (rect.width < 2 || rect.height < 2);


  /**
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  const isIgnoredNode = (elem) => {
    const nodename = /** @type HtmlElementType */ elem?.nodeName?.toLowerCase() || "";
    return IGNORE_NODES.includes(nodename);
  };

  // when we're trying to find the common container, don't count these
  const isIgnoreCommonContainerNode = (elem) => {
    const nodename = /** @type HtmlElementType */ elem?.nodeName?.toLowerCase() || "";
    return IGNORE_COMMON_CONTAINER_COUNT_NODES.includes(nodename);
  };

  /**
   *
   * @param elem {Node || HTMLElement || Window}
   */
  function forceRefresh(elem) {
    if (typeof (elem?.dispatchEvent) !== "function") {
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

  // cache this. Trying to avoid hard-coding "all 0s ease 0s"
  let g_cachedDefaultTransitionString = "";
  /**
   * @param compStyleElem {CSSStyleDeclaration}
   * @return {boolean}
   */
  const hasTransitionEffect = (compStyleElem) => {
    if (g_cachedDefaultTransitionString.length === 0) {
      const bodystyle = getElemComputedStyle(document.body);
      g_cachedDefaultTransitionString = bodystyle.transition;
      trace(`g_cachedDefaultTransitionString: "${g_cachedDefaultTransitionString}"`);
    }
    return compStyleElem?.transition !== g_cachedDefaultTransitionString;
  };

  let containDbgMsg = "";

  /**
   * we going to work our way up looking for some element that has a bunch of children but few
   * siblings. We're only going to search up (CHECK_PARENTS_LEVELS_UP_MAX) elements, then give
   * up.
   * For <video> matching, the playback controls are "position: absolute" under a common
   * div "position: relative".
   *
   * @return {Node | HTMLElement}
   */
  const findCommonContainerFromMatched = () => {
    if (DEBUG_ENABLED) {
      const matches = document.querySelectorAll(`.${MARKER_COMMON_CONTAINER_CLASS}`);
      if (matches?.length) {
        logerr(`Already found common container, shouldn't match two. IFrame issue?`, matches);
      }
    }
    if (!videomaxGlobals.matchedIsHtml5Video) {
      return videomaxGlobals.matchedVideo.parentElement;
    }

    if (document.location?.host?.includes("pluto.tv")) {
      // finding the common parent is a special case for this strange layout.
      const matchCommon = document?.getElementsByClassName("video-player-layout");
      if (matchCommon.length === 1) {
        const bestPlutoMatch = matchCommon[0];
        videomaxGlobals.matchedCommonCntl = bestPlutoMatch;
        bestPlutoMatch?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
        return bestPlutoMatch;
      }
      // if it doesn't match, then site maybe changed, just fallback to regular matching
    }

    const videoElem = videomaxGlobals.matchedVideo;
    const videoRect = videomaxGlobals.matchVideoRect;

    const countChildren = (e, recurseFirst = true, runningCount = 0) => {
      let count = runningCount;
      if (recurseFirst) {
        if (USE_BOOST_SCORES_FIND_COMMON) {
          const boostMatches = [...e.querySelectorAll(`[role="slider"]`)];
          // ...e.querySelectorAll(`[role="presentation"]`)]; // player puts this on every preview
          // video on the page
          count += boostMatches.length * 2;  // 2x points if there's a slider under this element.
          if (COMMON_PARENT_SCORES) {
            containDbgMsg += `\n Slider count: BOOST +${boostMatches.length}*2 result:${count}`;
          }
        }

        if (USE_NERF_SCORES_FIND_COMMON) {
          const nerfMatches = [...e.querySelectorAll(`[role="toolbar"]`),
                               ...e.querySelectorAll(`[role="navigation"]`)];
          count -= nerfMatches.length * 2;  // 2x points if there's a navigation components under
                                            // this element.
          if (COMMON_PARENT_SCORES) {
            containDbgMsg += `\n Slider count: NERF -${nerfMatches.length}*2 result:${count}`;
          }
        }

        // Tubi is horrible about 508 accessibility. It just uses <svg> for all controls.
        // It also removes the elements when they aren't active, so they are impossible to find.
        // example how to select if they weren't hidden
        // const volSgvCount   = [...e.querySelectorAll(`svg > title`)].filter(
        //   (e) => e?.innerHTML?.toLowerCase().includes("volume")).length;
      }
      const checkChildren = [...e.children].filter(el => !isIgnoreCommonContainerNode(el));
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
                                     "" :
                                     "\t"} #${index}\t isBoundedRect: \t +1 result: \t ${count}`;
            }
          }
          if (compStyleElem?.position === "absolute") {
            count++;
            if (COMMON_PARENT_SCORES) {
              containDbgMsg += `\n ${recurseFirst ?
                                     "" :
                                     "\t"} #${index}\t absPosition:   \t +1 result: \t ${count}`;
            }
          }
          if (INCLUDE_TRANSITION_MATCHING && hasTransitionEffect(compStyleElem)) {
            // tag it so we don't have to call getElemComputedStyle again later.
            eachChild.classList?.add(MARKER_TRANSITION_CLASS);
            count++;
            if (COMMON_PARENT_SCORES) {
              containDbgMsg += `\n  ${recurseFirst ?
                                      "" :
                                      "\t"} #${index}\t transition:   \t +1 result: \t ${count} "${compStyleElem?.transitionTimingFunction}"`;
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
        trace(`${containDbgMsg}\nTotal:${count}`, e);
        containDbgMsg = "";
      }
      return count;
    };

    const savedWalkerCurrentNode = walker.currentNode; // restore at end
    walker.currentNode = videoElem;
    let bestMatch = videoElem;
    let bestMatchWeight = 1;

    let checkParents = CHECK_PARENTS_LEVELS_UP_MAX;
    while (walker.parentNode() && checkParents > 0) {
      try {
        // these could be part of while condition, but we may want to debug/trace on them.
        checkParents--; // counting down to zero.
        if (isStopNodeForCommonContainer(walker.currentNode)) {
          trace(`  findCommonContainerFromElem stopped because hit stopping node`,
                walker.currentNode);
          break;
        }
        const weight = countChildren(walker.currentNode);
        trace(`findCommonContainerFromMatched ${weight > bestMatchWeight ?
                                                "NEW BEST" :
                                                ""} \n\t weight:${weight} \n\t ${PrintNode(
          walker.currentNode)} \n\t`, walker.currentNode);
        if (weight > bestMatchWeight) {
          bestMatchWeight = weight;
          bestMatch = walker.currentNode; // we've already moved to parentNode()
        }
      } catch (err) {
        logerr(err);
      }
    }

    // done, restore
    walker.currentNode = savedWalkerCurrentNode;

    // tubi is an exception since they use non-508 friendly playback controls.
    if (document.location?.host?.includes("tubitv.")) {
      trace("findCommonContainerFromElem: tubi specialcase using parent.");
      bestMatch = bestMatch?.parentNode;
    }

    // exception, never match the playback video itself, go to it's parent
    if (bestMatch.nodeName.toLowerCase() === "video") {
      trace("findCommonContainerFromElem matched video. Using parent");
      bestMatch = bestMatch.parentElement || bestMatch.parentNode;
    }
    videomaxGlobals.matchedCommonCntl = bestMatch;

    bestMatch?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
    return bestMatch;
  };

  /**
   *
   * @param doc {Document}
   * @param videoElem {Node}
   */
  const exceptionToRuleFixup = (doc, videoElem) => {
    // some sites have the playback controls completely cover the video, if we don't
    // adjust the height, then they are at the top or middle of the screen.
    const existingPlaybacks = doc.querySelectorAll(`.${PLAYBACK_CNTLS_CSS_CLASS}`);
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
   * Some cases where videos are hidden in iframes or nested iframes cause us to miss hiding some
   * simblings
   * @param doc {Document}
   */
  const lastDitchHide = (doc) => {
    if (LAST_DITCH_HIDE) {
      const matches = [...doc.getElementsByClassName(MAX_CSS_CLASS),
                       doc.getElementsByClassName(`${PREFIX_CSS_CLASS}-max`)];
      for (const eachElem of matches) {
        try {
          const siblings = getSiblings(eachElem);
          for (const eachSibling of siblings) {
            if (getAllElementsThatSmellsLikeControls(eachSibling).length) {
              if (DEBUG_HIDENODE) {
                trace(`lastDitchHide Smells like Controls. ${PrintNode(eachSibling)}`,
                      getAllElementsThatSmellsLikeControls(eachSibling));
              }
              if (NOHIDENODE_REAPPLY) {
                noHideNode(eachSibling);
              }
            } else {
              if (DEBUG_HIDENODE) {
                trace(`lastDitchHide Hiding. ${PrintNode(eachSibling)}`);
              }
              hideNode(eachSibling);
            }
          }
        } catch (err) {
          logerr(err);
        }
      }
    }
  };

  /** @param el {HTMLElement}
   * @return {boolean} */
  const isSkippedNode = (el) => SKIPPED_NODE_NAMES.includes(el?.nodeName.toLowerCase());

  /** @param el {HTMLElement || Node}
   * @return {boolean} */
  const isSkippedNodeForCntl = (el) => SKIPPED_NODE_NAMES_FOR_PLAYBACK_CTRLS.includes(el?.nodeName.toLowerCase());

  /**
   * @param el {HTMLElement}
   * @return {1|2||3}
   */
  const isVisibleWalkerElem = (el) => {
    if (isSkippedNode(el)) {
      return NodeFilter.FILTER_SKIP;
    }
    try {
      // chrome has a new method!
      if (USE_OLD_FAST_IS_VISIBLE_CHECK_IN_WALKER) {
        const vis = !!el?.offsetWidth &&
                    !!el?.offsetHeight &&
                    (typeof el.getClientRects === "function") &&
                    !!el?.getClientRects()?.length;
        return vis ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      } else {

        const vis = (el?.checkVisibility && el?.checkVisibility({
                                                                  checkOpacity:       true,
                                                                  checkVisibilityCSS: true,
                                                                })) || true;
        return vis ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    } catch (err) {
      logerr(err, el);
      return NodeFilter.FILTER_SKIP;
    }
  };

  /**
   *
   * @param elem {Element}
   * @param className {string}
   * @param optStopElem {Element | null}
   * @constructor
   */
  const ReApplyUpFromElem = (elem, className, optStopElem = null) => {
    const saveWalker = walker.currentNode;
    walker.currentNode = elem;
    do {
      try {
        if (hasAnyVideoMaxClass(walker?.currentNode)) {
          continue;
        }
        if (IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE && className === MAX_CSS_CLASS &&
            !isVisible(walker?.currentNode)) {
          if (DEBUG_HIDENODE) {
            trace(
              "ReApplyUpFromElem IF_PATH_INVISIBLE_DO_NOT_MAXIMIZE. Elem is not visible, so don't maximize, just set to no_hide");
          }
          walker?.currentNode?.classList?.add(NO_HIDE_CLASS);
        } else {
          walker?.currentNode?.classList?.add(className);
        }
        if (ALWAYS_BACK_UP_STYLES) {
          backupAttr(walker.currentNode, "style");
        }
      } catch (err) {
        logerr(`walker error for ${PrintNode(walker.currentNode)}`, err);
      }
    } while (walker.parentNode() &&
             (optStopElem ? !optStopElem.isSameNode(walker.currentNode) : true));
    walker.currentNode = saveWalker;
  };

  /**
   * Adds the maximized class to all elements from matched video up.
   * It often gets cleared after ads play because classLists are reset after they play
   */
  const maximizeUpFromVideo = () => {
    ReApplyUpFromElem(videomaxGlobals.matchedVideo, MAX_CSS_CLASS);
    // special case for when videos are in iframes that are not on a different domain.
    // e.g. dailymotion.com
    if (!isRunningInIFrame() && videomaxGlobals.matchedIsHtml5Video &&
        isElemInIFrame(videomaxGlobals.matchedVideo)) {
      const iframe = getFrameForDocument(videomaxGlobals.matchedVideo.getRootNode());
      if (iframe) {
        trace(`Running special case for accessible iframes`);
        ReApplyUpFromElem(iframe, MAX_CSS_CLASS);
      }
    }
  };

  /**
   * @param elem {HTMLElement}
   */
  function tagElementAsMatchedVideo(elem) {
    videomaxGlobals.matchedVideo = elem;
    videomaxGlobals.matchVideoRect = getCoords(elem);
    videomaxGlobals.matchedIsHtml5Video = elem.nodeName.toLowerCase() === "video";
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
  const fixUpAttribs = (node) => {
    if (!node) {
      return node;
    }
    trace(`FixUpAttribs for elem type ${node?.nodeName}`, node);

    // this may not be an Element, but we still want to walk children below
    if (isElem(node)) {
      // tagElementAsMatchedVideo(node);  // 14Jun removed, why here?
      const attribs = node.attributes;

      trace(`attrib count = ${attribs.length}`);
      for (const eachattrib of attribs) {
        try {
          const { name } = eachattrib;
          const orgValue = eachattrib.value;
          let newValue = "";

          // skip our own.
          if (name.startsWith(PREFIX_CSS_CLASS)) {
            continue;
          }
          trace(`FixUpAttribs found attrib '${name}': '${orgValue}'`);
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
            trace(`FixUpAttribs changing attribute: '${name}'
            old: '${orgValue}'
            new: '${newValue}'`, node);
            setAttrAndSave(node, name, newValue);
          }
        } catch (ex) {
          logerr("exception in looping over properties: ", ex);
        }
      }
    }

    {
      // collect all changes here, then apply in a single writing loop. more
      // efficient for dom update
      const newParams = {};
      for (const eachnode of node.childNodes) {
        try {
          if (eachnode.nodeName.toUpperCase() !== "PARAM") {
            continue;
          }
          const attrName = getAttr(eachnode, "name") || "";
          const attrValue = getAttr(eachnode, "value") || "";

          trace(`  FixUpAttribs found param '${attrName}': '${attrValue}'`);
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
        if (eachnode.nodeName.toUpperCase() !== "PARAM") {
          continue;
        }
        const name = getAttr(eachnode, "name") || "";
        const orgValue = getAttr(eachnode, "value") || "";

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
  const grepFlashlets = (flashletsval) => {
    let result = flashletsval;
    if (result !== "" && result?.match(/[=%]/i) !== null) {
      const rejoinedResult = [];
      const params = parseParams(flashletsval);
      if (params) {
        for (const key of params) {
          if (Object.prototype.hasOwnProperty.call(params, key)) {
            switch (key.toLocaleLowerCase()) {
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
              case "data": {
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

        result = rejoinedResult.join("&");
        if (flashletsval.search(/\?/i) === 0) { // startswith
          result = `?${result}`;
        }
      }
      trace(`Replaced urls params:\n\tBefore:\t${flashletsval}\r\n\tAfter\t${result}`);
    }
    return result;
  };

  /**
   * @param elem {Node || HTMLElement}
   */
  const noHideNode = (elem) => {
    try {
      if (!hasAnyVideoMaxClass(elem) || alwaysHideSomeElements()) {
        if (DEBUG_HIDENODE) {
          trace(`Setting noHideNode for ${PrintNode(elem)}`);
        }
        elem?.classList?.add(NO_HIDE_CLASS);
      }
    } catch (err) {
      trace(err);
    }
  };

  /**
   * @param elem {Node || HTMLElement}
   * @param skipPrep {boolean} Use the "-prep" style suffix so adding doesn't change it until we're
   *   done
   * @return {boolean} true if hidden
   */
  const hideNode = (elem, skipPrep = false) => {
    const printElem = DEBUG_HIDENODE ? PrintNode(elem) : "";
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
          trace(`  hideNode: Adding overlap class since it contained NO_HIDE_CLASS! ${printElem}`);
        }
        addOverlapCtrl(elem);
      } else if (DEBUG_HIDENODE) {
        if (DEBUG_HIDENODE) {
          trace(`  hideNode: NOT HIDING already contains videomax class ${printElem}`);
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

    if (DEBUG_HIDENODE && elem?.classList?.add) {
      trace(`  hideNode: HIDING ${printElem}`);
    }
    elem?.classList?.add(skipPrep ? `${PREFIX_CSS_CLASS}-hide` : HIDDEN_CSS_CLASS); // prep
    return true;
  };

  /**
   * @param elem {Node || HTMLElement}
   */
  const addOverlapCtrl = (elem) => {
    if (isIgnoredNode(elem)) {
      if (DEBUG_HIDENODE) {
        trace("NOT addOverlapCtrl isIgnoredNode:", IGNORE_NODES, elem);
      }
      return;
    }
    const debugPrintNode = DEBUG_HIDENODE ? PrintNode(elem) : "";
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
    if (OVERLAPS_REQUIRE_TRANSITION_EFFECTS && !hasTransitionEffect(getElemComputedStyle(elem))) {
      // this is risky because some "skip ads" buttons do not disappear.
      if (DEBUG_HIDENODE) {
        trace(`NOT addOverlapCtrl hasTransitionEffect: ${debugPrintNode}`);
      }
      return;
    }
    if (DEBUG_HIDENODE) {
      trace(`addOverlapCtrl: ${debugPrintNode}`);
    }
    elem?.classList?.add(OVERLAP_CSS_CLASS);
    if (SAVE_STYLE_FOR_OVERLAPs) {
      // we don't want a local style to conflict with the class we're adding
      backupAttr(elem, "style");
    }
  };

  /**
   * All siblings as an array, (but not the node passed)
   * @param node {Node}
   * @return {Node[]}
   */
  const getSiblings = (node) => {
    try {
      if (!node.parentElement?.children) {
        return [];
      }
      return [...node.parentElement.children].filter(c => {
        if (c === node) {
          return false;
        }
        if (c.nodeType === Node.ELEMENT_NODE) {
          return true;
        }
        if (c.nodeType === Node.DOCUMENT_NODE) {
          // this includes HTML, XML and SVG!
          if (!(c.nodeType instanceof HTMLDocument)) {
            return false;
          }
        }
        return !isSkippedNode(c);
      });
    } catch (err) {
      logerr(err);
      return [];
    }
  };

  /**
   * @return {number}
   */
  function rehideUpFromVideo() {
    lastDitchHide(document);

    /** @type {number} */
    let reHideCount = 0;
    /** @type {HTMLElement | Node | undefined} */
    let current = videomaxGlobals.matchedVideo;
    if (videomaxGlobals.matchedIsHtml5Video) {
      // html5 videos often put controls next to the video in the dom (siblings), so we want
      // to go up a level
      current = parentNode(current);
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
      current = parentNode(current);
      if (loopDetect === current) {  // pornhub
        break;
      }
    }
    trace(`rehideUpFromVideo hid: ${reHideCount} for ${isRunningInIFrame() ? "iFrame" : "Main"}`);
    return reHideCount;
  }

  /**
   * @constructor
   * @param debugname {string} handy for debugging.
   * @param delay {number}
   * @param maxretries {number}
   */
  function RetryTimeoutClass(debugname = "", delay = 250, maxretries = 8) {
    this.timerid = 0;
    this.delay = delay; // + (Math.round((0.5 - Math.random()) * delay) / 10); //  +/-

    this.maxretries = maxretries;
    this.retrycount = 0;
    this.debugname = debugname;
    this.func = () => {};

    // func() returning true means done
    /**
     * @param func {() => boolean}
     */
    this.startTimer = (func) => {
      this.func = func;
      this.retryFunc.bind(this);
      this.retryFunc();
    };

    this.retryFunc = () => {
      trace(
        `RetryTimeoutClass.retryFunc ${this.debugname} retry: ${this.retrycount}/${this.maxretries}`);
      this.cleartimeout();
      const result = this.func();

      if (result !== true) {
        trace(`RetryTimeoutClass.retryFunc ${this.debugname}  function returned false. retying`);
        // returns true if we're done
        this.retrycount++;
        if (this.retrycount < this.maxretries) {
          this.timerid = setTimeout(this.retryFunc, this.delay);
        }
      } else {
        trace(`RetryTimeoutClass.retryFunc ${this.debugname}  function returned true. stopping`);
      }

      return result;
    };

    this.cleartimeout = () => {
      let timerid = 0;
      [this.timerid, timerid] = [timerid, this.timerid]; // swap
      if (timerid) {
        clearTimeout(timerid);
      }
    };
  }

  const hideCSS = (id) => {
    // try {
    if (id) {
      const elem = document.getElementById(id);
      if (elem) {
        setAttrAndSave(elem, "media", "_all");
      }
    }
  };

  /**
   * @return {boolean}
   */
  const hasInjectedAlready = () => {
    const attr = document.body.getAttribute(VIDEO_MAX_INSTALLED_ATTR) || "";
    return attr?.length > 0;
  };

  /**
   * Returns whole numbers for bounding box instead of floats.
   * @param rectC {DomRect}
   * @return {DomRect}
   */
  const wholeClientRect = (rectC) => ({
    top:    Math.round(rectC.top),
    left:   Math.round(rectC.left),
    bottom: Math.round(rectC.bottom),
    right:  Math.round(rectC.right),
    width:  Math.round(rectC.width),
    height: Math.round(rectC.height),
  });

  /**
   *
   * @param outer {DomRect}
   * @param inner {DomRect}
   * @return {boolean}
   */
  const isBoundedRect = (outer, inner) => {
    const inRange = (num, lower, upper) => ((num >= lower) && (num <= upper));
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
   * @param node {Node || HTMLElement || HTMLFrameElement}
   * @return {DomRect}
   */
  const getOuterBoundingRect = (node) => {
    try {
      return wholeClientRect(node.getBoundingClientRect());
    } catch (_err) {
      return {
        top:    0,
        left:   0,
        bottom: 0,
        right:  0,
        width:  0,
        height: 0,
      };
    }
  };

  /**
   * This includes margin and padding.
   * @param elemIn {Node || HTMLElement || HTMLFrameElement}
   * @param compStyle {CSSStyleDeclaration}
   * @return {DomRect}
   */
  const cumulativePositionRect = (elemIn, compStyle = undefined) => {
    const result = getOuterBoundingRect(elemIn);
    // always use initial position
    let top = elemIn.offsetTop;
    let left = elemIn.offsetLeft;
    let elem = elemIn.offsetParent;

    while (elem?.offsetParent) {
      elem = elem.offsetParent;
      const compStyleElem = getElemComputedStyle(elem); // $$$
      if (compStyleElem.position !== "absolute") {
        top += elem.offsetTop;
        left += elem.offsetLeft;
      }
    }
    // transformOrigin special case. (WHY is getting the ACTUAL viewports coordinates SO HARD?!?)
    // transformOrigin is for pluto's tv guide section.
    // there's still "transform: translate()" not handled.
    if (compStyle?.transformOrigin) {
      // there's lots of string values for transformOrigin... we're just going to handle "#px #px"
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
  const getCoords = (el) => {
    try {
      const { body } = document;
      const docEl = document.documentElement;

      const scrollTop = window.pageYOffset || docEl.scrollTop || body.scrollTop;
      const scrollLeft = window.pageXOffset || docEl.scrollLeft || body.scrollLeft;

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
        width:  box.width,
        height: box.height,
      };
    } catch (err) {
      logerr(err);
      return {
        top:    0,
        left:   0,
        bottom: 0,
        right:  0,
        width:  0,
        height: 0,
      };
    }
  };

  /**
   * @param elem {HTMLElement|Node}
   * @param matches {RegExp[]}
   * @return {boolean}
   */
  const smellsLikeMatch = (elem, matches) => {
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


  const NEVERHIDEMATCHES = [/ytp-ad-module/i, // youtube skip add
                            /mgp_ccContainer/i, // pornhub cc
                            /web-player-icon-resize/i, // tubi's non-508 playback
  ];
  /**
   * @param elem {Node}
   * @return {boolean}
   */
  const isSpecialCaseNeverHide = (elem) => smellsLikeMatch(elem, NEVERHIDEMATCHES);


  /**
   * @param _elem {Node}
   * @return {boolean}
   */
  const isSpecialCaseNeverOverlap = (_elem) => // in theory more logic can go here.
    false;

  /** optimization since the matches are called often */
  const AdverRegex = new RegExp(/(?:^|\W|-)adver/ig);
  const AdRegex = new RegExp(/(?:^|\W|-)ad-|-ad$/ig);
  const BrandingRegex = new RegExp(/(?:^|\W|-)branding/ig);
  /**
   * Does NOT block ads.
   * Some specific rules where ads overlap videos and when we zoom them and
   * they permanently hide the main video.
   * Most sights do it right, but there some that don't.
   * @param elem {Node}
   */
  const smellsLikeAdElem = (elem) => {
    // regex /^(@)(\wadver)/ig)) <- means start of word
    const arialabel = getAttr(elem, "aria-label");
    if (arialabel?.match(AdverRegex)) {
      trace(`smellsLikeAdElem: matched aria-label for "adver" '${arialabel}'`);
      return true;
    }
    if (arialabel?.match(AdRegex)) {
      trace(`smellsLikeAdElem: matched aria-label for "ad-" '${arialabel}'`);
      return true;
    }
    const className = getAttr(elem, "class");
    if (className?.match(AdverRegex)) {
      trace(`smellsLikeAdElem: matched classname for "adver"? '${className}'`);
      return true;
    }
    if (className?.match(BrandingRegex)) {
      trace(`smellsLikeAdElem: atched classname for "branding"? '${className}'`);
      return true;
    }
    const title = getAttr(elem, "title");
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
   * So. many. iframes on some sites (like > 150), early exit if they are too small
   * @return {boolean}
   */
  const earyExitForSmallIFrame = () => {
    if (!isRunningInIFrame()) {
      return false;
    }
    // Running in iframe means.
    // window !== window?.parent

    if (document.childElementCount === 0) {
      return true;
    }

    if (window.innerWidth < MIN_IFRAME_WIDTH || window.innerHeight < MIN_IFRAME_HEIGHT) {
      trace(`Early exit when running in small iframe ${window.innerWidth} x ${window.innerHeight}`);
      return true;
    }

    return false;
  };

  /**
   *
   * @param commonContainerElem {HTMLElement | undefined} pass in undefined to get whole doc
   * @return {HTMLElement[]}
   */
  const getAllElementsThatSmellsLikeControls = (commonContainerElem) => {
    // the volume matcher can be tested on nbcnews.com/now
    // negative case test that matches ads on dailymail
    const topElem = commonContainerElem ? commonContainerElem : window.document;

    try {
      const matchesVolume = [...topElem.querySelectorAll(`input[type="range"]`)].filter(
        (e) => !isSkippedNodeForCntl(e) && smellsLikeMatch(e, [/volume/i]) && !smellsLikeAdElem(e));
      const matchesSlider = [...topElem.querySelectorAll(`[role="slider"]`)].filter(
        (e) => !isSkippedNodeForCntl(e) && !smellsLikeAdElem(e));
      const matchesPresentation = CHECK_PRESENTATION_ROLE ? [...topElem.querySelectorAll(`[role="presentation"]`)].filter(
        (e) => !isSkippedNodeForCntl(e) && !smellsLikeAdElem(e)) : [];
      if (DEBUG_HIDENODE) {
        trace(`getAllElementsThatSmellsLikeControls for ${PrintNode(commonContainerElem)}
        matchesVolume: `, matchesVolume, `
        matchesSlider: `, matchesSlider, `
        matchesPresentation: `, matchesPresentation);
      }
      return [
        ...matchesVolume,
        ...matchesSlider,
        ...matchesPresentation];
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
    trace("maximizeVideoDom");
    maximizeUpFromVideo();
    const commonContainerElem = findCommonContainerFromMatched();

    // now we try to find playback controls that may have been missed.
    // <input type="range" class="styles_volumeSlider__gCfqY" min="-50" max="0" step="0.5"
    // value="-50" style="--volume: 0%;">
    if (DO_HIDE_EXCEPTION_CHECK) {
      // pass in undefined to get all for whole document.
      const matches = getAllElementsThatSmellsLikeControls(
        USE_WHOLE_WINDOW_TO_SEARCH_FOR_CONTROLS ? undefined : commonContainerElem);
      for (const elem of matches) {
        // walk up to common and make sure we don't hide. We do this by adding an empty videeomax
        // style class (wistia)
        ReApplyUpFromElem(elem, NO_HIDE_CLASS, commonContainerElem);
      }
    }

    for (const elem of commonContainerElem.children) {
      addOverlapCtrl(elem); // does additional checks before adding
    }

    // ANY siblings to the <video> should always just be considered overlapping (crunchyroll's CC
    // canvas
    if ((FIND_CONTROLS_ON_MAIN_THREAD_FOR_IFRAME_MATCH && !isRunningInIFrame()) ||
        videomaxGlobals.matchedIsHtml5Video) {
      const videoSiblings = getSiblings(videomaxGlobals.matchedVideo);
      for (const elem of videoSiblings) {
        addOverlapCtrl(elem);  // does additional checks before adding
      }
    }

    const videoElem = videomaxGlobals.matchedVideo; // readability
    exceptionToRuleFixup(getOwnerDoc(videoElem), videoElem);

    document.body.classList.add(MAX_CSS_CLASS);
  };

  /**
   * @constructor
   */
  function ElemMatcherClass() {
    /** @type {undefined | HTMLElement | HTMLFrameElement} * */
    this.largestElem = undefined;
    /** @type {number} */
    this.largestScore = 0;
    /** @type {number} */
    this.matchCount = 0;
    /** @type {Node[]} */
    this.checkedDedup = [];

    /**
     *
     * @param elem {HTMLElement}
     * @return {boolean} True means done
     */
    this.checkIfBest = (elem) => {
      if (elem.isSameNode(this.largestElem)) {
        trace("  Matched element same element");
        return true;
      }
      if (this.largestElem && parentNode(this.largestElem) &&
          elem.isSameNode(parentNode(this.largestElem))) {
        trace("  Matched element same as parent.");
        return true;
      }
      if (this.checkedDedup.includes(elem)) {
        trace("  Matched element already checked.");
        return false;
      }
      this.checkedDedup.push(elem);

      const elemStyle = getElemComputedStyle(elem);
      const score = this._getElemMatchScore(elem, elemStyle);
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

    this.getBestMatch = () => this.largestElem;
    this.getBestMatchCount = () => this.matchCount; // should be 1 for most case

    /**
     *   weight for videos that are the right ratios!
     *   16:9 == 1.77_  4:3 == 1.33_  3:2 == 1.50
     * @param elem {HTMLElement}
     * @param compStyle {CSSStyleDeclaration}
     * @return {{width: number, height: number}}
     * @private
     */
    this._getElemDimensions = (elem, compStyle) => {
      if (!elem) {
        logerr("empty element gets score of zero");
        return {
          width:  0,
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
        trace("width or height zero. likely hidden element", elem);
        return {
          width:  0,
          height: 0,
        };
      }

      if (width < 100 || height < 75) {
        trace("width or height too small so no score", elem);
        return {
          width:  0,
          height: 0,
        };
      }

      trace(`Found width/height for elem. width=${width}px height=${height}px`, elem);
      return {
        width,
        height,
      };
    };

    /**
     *
     * @param str1 {string}
     * @param str2 {string}
     * @return {number}
     */
    const diceCoefficient = (str1, str2) => {
      let intersection = 0;

      for (let i = 0; i < str1.length; i++) {
        for (let j = 0; j < str2.length; j++) {
          if (str1[i] === str2[j]) {
            intersection++;
          }
        }
      }
      const union = str1.length + str2.length - intersection;
      return intersection / union;
    };

    /**
     *
     * @param pageUrl {string}
     * @param elemUrl {string}
     * @return {number}
     */
    const customDiceCoefficient = (pageUrl, elemUrl) => {
      const pageParts = splitUrlWords(pageUrl);
      const urlParts = splitUrlWords(elemUrl);
      const overlapCount = getOverlapCount(pageParts, urlParts);
      const count = Math.max(1, pageParts.length);
      const avgCount = (count + count) / 2.0;
      return overlapCount / avgCount;
    };

    /**
     *
     * @param elem {HTMLElement}
     * @param compStyle {CSSStyleDeclaration}
     * @return {number}
     * @private
     */
    this._getElemMatchScore = (elem, compStyle) => {
      if (!elem) {
        return 0;
      }

      // the most common ratios. The closer a video is to these, the higher the score.
      const VIDEO_RATIOS = {
        21_9: (21 / 9),
        16_9: (16.0 / 9.0),
        4_3:  (4.0 / 3.0),
        3_2:  (3.0 / 2.0),
        240:  (2.40 / 1.0), // portrait ( < 1)
        // 4_5:  (4 / 5),
        // 9_16: (9 / 16),
      };

      const {
        width,
        height,
      } = this._getElemDimensions(elem, compStyle);

      // videos may be constrained by the iframe or window.
      const doc = getElemsDocumentView(elem);

      if ((width < MIN_VIDEO_WIDTH || height < MIN_VIDEO_HEIGHT) && // too small
          doc.outerWidth > MIN_VIDEO_WIDTH && doc.outerHeight > MIN_VIDEO_HEIGHT) {  // but not a small window.
        trace(`\tWidth or height too small, skipping other checks
        width: ${width} < ${MIN_VIDEO_HEIGHT} (MIN_VIDEO_HEIGHT)
        width: ${height} < ${MIN_VIDEO_WIDTH} (MIN_VIDEO_WIDTH)`, elem);
        return 0;
      }

      // twitch allows videos to be any random size. If the width & height of
      // the window are too short, then we can't find the video.
      if (elem.id === "live_site_player_flash") {
        trace("Matched twitch video. Returning high score.");
        return 3000000;
      }

      const traceweights = [""]; // start with blankline. turned into trace message
      videomaxGlobals.match_counter++;

      let weight = 0;

      if (EMBED_SCORES) {
        const elemStr = PrintNode(elem);
        traceweights.push(`===========================\n${elemStr}\n`);
        traceweights.push(`START_WEIGHT: ${START_WEIGHT}`);
        traceweights.push(`  Width: ${width}  Height: ${fmtInt.format(height)}`);

        const vidRect = cumulativePositionRect(elem, compStyle);
        traceweights.push(
          `  top: ${vidRect.top}  left: ${vidRect.left}   bottom: ${vidRect.bottom}    right:${vidRect.right}`);
        traceweights.push(
          `  doc.outerWidth: ${doc.outerWidth} ${fmtFlt.format(width * 100 / doc.outerWidth)}%`);
      }
      {
        // common video sizes
        // 320x180, 320x240, 640x480, 640x360, 640x480, 640x360, 768x576, 720x405, 720x576
        const ratio = width / height;
        // which ever is smaller is better (closer to one of the magic ratios)
        const distances = Object.values(VIDEO_RATIOS)
          .map((v) => Math.abs(v - ratio));
        const bestRatioComp = Math.min(...distances) + 0.001; // +0.001; prevents div-by-zero

        // inverse distance
        const inverseDist = round(1.0 / bestRatioComp ** 1.15);  // was 1.25
        const videoSize = round(Math.log2(width * height));

        weight += START_WEIGHT * inverseDist * RATIO_WEIGHT;
        weight += START_WEIGHT * videoSize * SIZE_WEIGHT; // bigger is worth more
        if (EMBED_SCORES) {
          traceweights.push(`  Distances: ${distances.map(n => fmtFlt.format(n))
            .join(",")}`);
          traceweights.push(`  inverseDist: RATIO_WEIGHT: ${fmtInt.format(
            START_WEIGHT * inverseDist * RATIO_WEIGHT)} \t Weight:${RATIO_WEIGHT}`);
          traceweights.push(`  dimensions: SIZE_WEIGHT: ${fmtInt.format(
            START_WEIGHT * videoSize * SIZE_WEIGHT)} \t Weight:  ${SIZE_WEIGHT}`);
        }
      }


      if (EMBED_SCORES) {
        traceweights.push(`  ORDER_WEIGHT: ${fmtInt.format(
          START_WEIGHT * videomaxGlobals.match_counter *
          ORDER_WEIGHT)} Order: ${videomaxGlobals.match_counter} Weight:${ORDER_WEIGHT}`);
      }
      weight += START_WEIGHT * videomaxGlobals.match_counter * ORDER_WEIGHT;


      // try to figure out if iframe src looks like a video link.
      // frame shaped like videos?
      if (isIFrameElem(elem)) {
        const src = elem.getAttribute("src") || "";
        if (src.match(/\.facebook\.com/i)) {
          trace(`demoting facebook plugin iframe. \tOld weight=${weight}\tNew Weight=0`);
          return 0;
        }
        if (src.match(/javascript:/i)) {
          trace(`demoting :javascript iframe. \tOld weight=${weight}\tNew Weight=0`);
          return 0;
        }
        if (src.match(/platform\.tumblr\.com/i)) {
          trace(`demoting platform.tumbr.com \tOld weight=${weight}\tNew Weight=0`);
          return 0;
        }
      }

      if (compStyle?.zIndex) {
        // espn makes the zindex for ads crazy large and breaks things, cap it.
        const zindex = Math.min(safeParseInt(compStyle?.zIndex), 100);
        if (EMBED_SCORES) {
          traceweights.push(`  ZINDEX_WEIGHT: ${fmtInt.format(
            START_WEIGHT * zindex * ZINDEX_WEIGHT)} \t Weight: ${ZINDEX_WEIGHT}`);
        }
        weight += (START_WEIGHT * zindex * ZINDEX_WEIGHT); // zindex is tricky, could be "1" or
        // "1000000"
      }

      if (compStyle?.visibility.toLowerCase() === "hidden" || compStyle?.display.toLowerCase() ===
          "none" || compStyle?.opacity === "0" || elem.offsetParent === null ||
          safeParseInt(compStyle?.width) === 0 || safeParseInt(compStyle?.height) === 0) {

        // Vimeo hides video before it starts playing (replacing it with a
        // static image), so we cannot ignore hidden. But UStream's homepage
        // has a large hidden flash that isn't a video.
        if (EMBED_SCORES) {
          traceweights.push(`  HIDDEN_VIDEO_WEIGHT: ${fmtInt.format(
            START_WEIGHT * HIDDEN_VIDEO_WEIGHT)} \t Weight:${HIDDEN_VIDEO_WEIGHT}`);
          traceweights.push(`\tvisibility: '${compStyle?.visibility}'\n` +
                            `\tdisplay: '${compStyle?.display}' \n` +
                            `\topacity: '${compStyle?.opacity}'`);
        }
        weight += (START_WEIGHT * HIDDEN_VIDEO_WEIGHT);
      }

      const tabindex = getAttr(elem, "tabindex");
      if (tabindex !== null) {
        // this is a newer thing for accessibility, it's a good indicator
        if (EMBED_SCORES) {
          traceweights.push(`  TAB_INDEX_WEIGHT: ${fmtInt.format(
            -1 & START_WEIGHT * TAB_INDEX_WEIGHT)}\t Weight: ${TAB_INDEX_WEIGHT}`);
        }
        weight += (-1 * START_WEIGHT * TAB_INDEX_WEIGHT);
      }

      const allowfullscreenAttr = getAttr(elem, "allowfullscreen");
      if (allowfullscreenAttr !== null) {
        if (EMBED_SCORES) {
          traceweights.push(
            `  ALLOW_FULLSCREEN_WEIGHT: ${fmtInt.format(
              START_WEIGHT * ALLOW_FULLSCREEN_WEIGHT)} \t Weight: ${ALLOW_FULLSCREEN_WEIGHT}`);
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

      // Found an html5 video tag
      const isVideo = (elem.nodeName.toLowerCase() === "video");
      if (isVideo) {
        /** @type {HTMLMediaElement} * */
        const videoElem = elem;
        if (EMBED_SCORES) {
          traceweights.push(
            `  VIDEO_OVER_IFRAME_WEIGHT: ${fmtInt.format(
              START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT)} \t  Weight: ${VIDEO_OVER_IFRAME_WEIGHT}`);
        }
        weight += (START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT);

        // if a video, lets see if it's actively playing
        if (videoElem.paused === false && videoElem?.ended === false) {
          if (EMBED_SCORES) {
            traceweights.push(
              `  VIDEO_PLAYING: Weight:${fmtInt.format(START_WEIGHT *
                                                       VIDEO_PLAYING_WEIGHT)} \t weight: ${VIDEO_PLAYING_WEIGHT} \t Paused:${videoElem.paused} \t Ended: ${videoElem.ended}`);
          }
          weight += (START_WEIGHT * VIDEO_PLAYING_WEIGHT);
        }

        // video length, cap at 2hrs
        const duration = Math.min((videoElem?.duration || 0), MAX_DURATION_SECS);
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
          if (EMBED_SCORES) {
            traceweights.push(
              `  VIDEO_HAS_SOUND_WEIGHT:${fmtInt.format(
                START_WEIGHT *
                VIDEO_HAS_SOUND_WEIGHT)} \t weight: ${VIDEO_HAS_SOUND_WEIGHT} \t muted:${videoElem.muted}  `);
          }
          weight += (START_WEIGHT * VIDEO_HAS_SOUND_WEIGHT);
        }
      }

      if (!isRunningInIFrame()) {
        if (EMBED_SCORES) {
          traceweights.push(
            `  MAIN_FRAME_WEIGHT (running in main) MAIN_FRAME_WEIGHT:${fmtInt.format(
              START_WEIGHT * MAIN_FRAME_WEIGHT)} \t weight: ${MAIN_FRAME_WEIGHT} `);
        }
        weight += (START_WEIGHT * MAIN_FRAME_WEIGHT);
      }

      // does the video source url look kinda close to the page url?
      // todo: better string proximity calc is probably needed
      try {
        const pageUrl = getPageUrl();
        if (pageUrl?.length &&
            (pageUrl.startsWith("https://") || pageUrl.startsWith("blob:https://"))) {
          // no see if we can get this video's source.
          let elemUrl = elem?.src || "";
          if (elemUrl === "" && isVideo) {
            // sometimes there's a <video><source src=""></video> approach.
            // this is used when there might be different data formatting available for
            // the same video (e.g. one for video/mp4 and another for video/webm).
            // if a site is going through this much work, it's probably NOT an ad.
            const matchedSources = elem.getElementsByTagName("source");
            if (matchedSources.length > 0) {
              // there may be multiple, but they are likely very simailar.
              elemUrl = matchedSources[0].src || "";
            }
          }
          if (elemUrl.length &&
              (elemUrl.startsWith("https://") || elemUrl.startsWith("blob:https://"))) {
            const overlapRatio = customDiceCoefficient(pageUrl, elemUrl);

            if (EMBED_SCORES) {
              // maybe a standard algo is better?
              const diceRatio = diceCoefficient(pageUrl, elemUrl);
              traceweights.push(
                `  URL_OVERLAP_WEIGHT: ${fmtInt.format(
                  START_WEIGHT * URL_OVERLAP_WEIGHT * overlapRatio)} ` +
                `\t Weight: ${URL_OVERLAP_WEIGHT}` +
                `\t OverlapRatio:${fmtFlt.format(overlapRatio)} ` +
                `\t Dice distance: ${fmtFlt.format(diceRatio)}`);
            }
            weight += (START_WEIGHT * URL_OVERLAP_WEIGHT * overlapRatio);

            const urlParts = splitUrlWords(elemUrl);
            const negOverlapCount = getOverlapCount(["disqus"], urlParts);
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
        // iframes can throw when you try to read their url, just keep going and ignore
        trace("URL_OVERLAP_WEIGHT failed because of security block?", err);
      }


      try {
        const titleELem = (elem?.title || elem?.ariaLabel || "").toLowerCase();
        const titlePage = window.document?.title.toLowerCase() || "";
        const dice = diceCoefficient(titleELem, titlePage);
        const titleParts = splitUrlWords(window.document?.title.toLowerCase() || "");
        const elemParts = splitUrlWords(PrintNode(elem)
                                          .toLowerCase());
        const overlap = getOverlapCount(titleParts, elemParts);
        const overlapRatio = overlap / (titleParts.length || 1);
        if (EMBED_SCORES) {
          traceweights.push(
            `TITLE_OVERLAP_WEIGHT: ` +
            `${fmtInt.format(START_WEIGHT * TITLE_OVERLAP_WEIGHT * overlapRatio)} ` +
            `\t weight: ${TITLE_OVERLAP_WEIGHT} ` +
            `\t Count:${overlap} ` +
            `\t OverlapRatio:${fmtFlt.format(overlapRatio)}` +
            `\t Dice distance: ${fmtFlt.format(dice)}`);
        }
        weight += (START_WEIGHT * TITLE_OVERLAP_WEIGHT * overlapRatio);
      } catch (err) {
        logerr(err);
      }


      weight = Math.round(weight);
      if (DEBUG_ENABLED) {
        if (Number.isNaN(weight)) {
          logerr("======weight got corrupted======");
        }
      }
      if (EMBED_SCORES) {
        traceweights.push(`FINAL WEIGHT: ${fmtInt.format(weight)}`);
        const result = traceweights.join("\n\t");
        trace("*** weight for element***", result, elem);
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
  const alwaysHideSomeElements = (doc = document) => {
    if (typeof (doc?.getElementsByTagName) !== "function") {
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


  /**
   * The LAST step of zooming is ot flip all the "videomax-ext-prep-*" to videomax-ext-*"
   * The reason for this is that if the css is already injected, then trying to measure
   * client rects gets messed up if we're modifying classNames as we go.
   * @param doc {Document}
   * @return {number}
   */
  const flipCssRemovePrep = (doc = document) => {
    if (typeof (doc?.querySelectorAll) !== "function") {
      // security can block
      return 0;
    }
    const allElementsToFix = doc.querySelectorAll(`[class*="${PREFIX_CSS_CLASS_PREP}"]`);
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
            const replacementClassName = eachClassName.replace("-prep-", "-");
            // because we're iterating, don't modify until we're done
            subFrom.push(eachClassName);
            subTo.push(replacementClassName);
          }
        }
        // classList supports bulk adding and removing if we expand parameters out.
        if (subFrom.length) {
          eachElem.classList.remove(...subFrom);
          eachElem.classList.add(...subTo);

          // some sites muck with the style
          // hack. This crazy thing happens on some sites (dailymotion) where our
          // resizing the video triggers scripts to run that muck with the
          // element style, so we're going to save and restore that style so the
          // undo works.
          // We apply when we flip the classNames so we don't zero size things as
          // we're finding playback controls.
          if (subFrom.includes(MAX_CSS_CLASS)) {
            if (REMOVE_STYLE_FROM_ELEMS) {
              // removes after saving off
              backupAttr(eachElem, "style");
            }
          }
        }
      } catch (err) {
        logerr("flipCssRemovePrep", err);
      }
    }
    return count;
  };

  /**
   *
   * @param doc {Document|HTMLDocument}
   */
  const recursiveIFrameFlipClassPrep = (doc) => {
    try {
      if (document.videmax_cmd === "unzoom") {
        trace("UNZOOMING! skipping recursiveIFrameFlipClassPrep");
        return;
      }
      flipCssRemovePrep(doc);

      if (typeof (doc?.querySelectorAll) !== "function") {
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
    if (document.videmax_cmd === "unzoom") {
      trace("UNZOOMING?!?");
      return false;
    }

    if (!videomaxGlobals.matchedVideo) {
      logerr("maxGlobals.matchedVideo empty");
      return false;
    }

    maximizeVideoDom();

    fixUpAttribs(videomaxGlobals.matchedVideo);

    // going to return true, so we redo this since
    // some sites re-show these elements, hide again to be safe
    const doRehideTimeoutLoop = (rehideOneMoreTime = false) => {
      if (document.videmax_cmd === "unzoom") {
        trace("UNZOOMING! - skipping doRehideTimeoutLoop");
        return;
      }
      // nbc shows add on delay, we need at least on more pass.
      let rehideCount = rehideOneMoreTime ? 1 : 0;
      try {
        maximizeUpFromVideo();
        alwaysHideSomeElements();
        if (videomaxGlobals.matchedCommonCntl) {
          videomaxGlobals.matchedCommonCntl?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
        }

        rehideCount += rehideUpFromVideo();
        recursiveIFrameFlipClassPrep(document);
        recursiveIFrameFlipClassPrep(getTopElemNode());
      } catch (err) {
        logerr(err);
      }
      if (rehideCount !== 0) {
        trace("Retrying rehide until no more matches. 1001ms");
        setTimeout(() => doRehideTimeoutLoop(), 1001);
      }
    };

    doRehideTimeoutLoop(true); // first run, always try 1s later no matter what. (nbc banner ad)
    return true; // stop retrying
  };

  const postFixUpPageZoom = () => {
    // some sites (mba) position a full sized overlay that needs to be centered.
    if (// !isRunningInIFrame() && // NBCNews iframe styles constantly getting updated
      !videomaxGlobals.matchedIsHtml5Video) {
      if (DEBUG_MUTATION_OBSERVER) {
        trace(`OBSERVER: NOT INSTALLING observer because 
        videomaxGlobals.matchedIsHtml5Video: ${videomaxGlobals.matchedIsHtml5Video}`);
      }
      return;
    }
    if (MUTATION_OBSERVER_WATCH_ALL_MAX === false && !videomaxGlobals.matchedCommonCntl) {
      if (DEBUG_MUTATION_OBSERVER) {
        trace(`OBSERVER: NOT INSTALLING observer because 
        MUTATION_OBSERVER_WATCH_ALL_MAX = ${MUTATION_OBSERVER_WATCH_ALL_MAX}
        videomaxGlobals.matchedCommonCntl = ${videomaxGlobals.matchedCommonCntl}`);
      }
      return;
    }

    rehideUpFromVideo(); // one more time before adding observers to keep from triggering a bunch
                         // of events (NBC Banner ad)
    addClassMutationObserver();
    videoCanPlayBufferingInit();
    if (FIX_UP_BODY_CLASS_TO_SITE_SPECIFIC_CSS_MATCH) {
      try {
        // The easiest way to fix site specific layout issues to to do it in CSS.
        // but even matching on class names or ids can be problematic if two sites happen
        // to use the same class name or id.
        // So instead of site specific code, we add a class name to the body that is unique
        // for the site, so the css can select on it!
        let domainName = getPageDomainNormalized();

        // now turn any "." to "-",
        // we do this because css uses "." as a className prefix
        // this could generate confusion for cases like "domain-name.com" vs "domain.name.com"
        // but the consequence is that we may mess up some css layout if this happens.

        domainName = domainName.replace(".", "-");

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
  function updateEventListeners(video_elem, removeOnly = false) {
    const _onPress = (event) => {
      try {
        if (event.keyCode === 27) { // esc key
          trace("esc key press detected, unzooming");
          // unzoom here!
          videomaxGlobals.isMaximized = false;
          videomaxGlobals.unzooming = true;
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
          trace("trying to stop default event handler");
          event.stopPropagation();
          event.preventDefault();
          document.removeEventListener("keydown", _onPress);
        }
      } catch (err) {
        logerr(err);
      }
    };

    try {
      // this will allow "escape key" undo the zoom.
      trace("updateEventListeners");
      const doc = window.document; // || video_elem?.ownerDocument;
      doc?.removeEventListener("keydown", _onPress);
      if (!removeOnly) {
        doc?.addEventListener("keydown", _onPress);
      }
    } catch (err) {
      logerr(err);
    }
    return true;
  }

  /**
   * @return {boolean} Returning True stops retry
   */
  function doZoomPage() {
    if (document.videmax_cmd === "unzoom") {
      trace("UNZOOMING! - skipping doZoomPage");
      return true;
    }

    if (window?.frameElement?.src === "about:blank") {
      trace("Injected into blank iframe, not running");
      return true; // stop retrying
    }

    if (ONLY_RUN_AFTER_DOC_LOADED && !documentLoaded()) {
      trace(`document state not complete: '${document.readyState}'`);
      return false;
    }

    if (videomaxGlobals.isMaximized) {
      trace(`doZoomPage videomaxGlobals.isMaximized=true, NOT running.`);
      return true;
    }

    const reinstall = hasInjectedAlready();
    trace(`doZoomPage readystate = ${document.readyState}  reinstall=${reinstall}`);

    if (DEBUG_ENABLED && videomaxGlobals.isMaximized === false && reinstall) {
      trace("Something's weird. isMaximized=false but hasInjectedAlready()=true");
    }

    videomaxGlobals.match_counter = 0;

    const foundVideoNewAlgo = findLargestVideoNew(document);

    const getBestMatchCount = videomaxGlobals.elementMatcher.getBestMatchCount();
    if (getBestMatchCount === 0) {
      trace(`No video found, ${isRunningInIFrame() ? "iFrame" : "Main"}.
        foundVideoNewAlg=${foundVideoNewAlgo}`);
      return false; // keep trying
    }

    const bestMatch = videomaxGlobals.elementMatcher.getBestMatch();
    trace("video found", bestMatch);

    bestMatch?.scrollIntoView({
                                block:  "center",
                                inline: "center",
                              });


    // mark it with a class.
    tagElementAsMatchedVideo(bestMatch);

    const bestMatchCount = videomaxGlobals.elementMatcher.getBestMatchCount();
    if (bestMatchCount > 1) {
      if (DEBUG_ENABLED) {
        trace(`FOUND TOO MANY VIDEOS ON PAGE? #${bestMatchCount}`);
        // eslint-disable-next-line no-debugger
        debugger;
      }
    } else {
      trace("Final Best Matched Element: ", bestMatch.nodeName, bestMatch);
    }
    if (!isRunningInIFrame() && bestMatchCount > 0) {
      // only install from main page once. Because we inject for each iframe, this can
      // get called multiple times. The listener is on window.document, so it only needs
      // to be installed once for the main frame.
      updateEventListeners(bestMatch);
    }

    if (EMBED_SCORES) {
      // append the final results of what was discovered.
      appendSelectorItemsToResultInfo("=Main Video=", `.${PREFIX_CSS_CLASS}-video-matched`);
      appendSelectorItemsToResultInfo("=Playback controls=",
                                      `.${PREFIX_CSS_CLASS}-playback-controls`);
      appendUnitTestResultInfo("==========DONE==========\n\n");
    }

    videomaxGlobals.isMaximized = true;

    // this timer will hide everything
    if (videomaxGlobals.tagonly) {
      document.body.setAttribute(VIDEO_MAX_INSTALLED_ATTR, "tagonly");
      recursiveIFrameFlipClassPrep(document);
      recursiveIFrameFlipClassPrep(getTopElemNode());
      trace("Tag only is set. Will not modify page to zoom video");
    } else {
      document.body.setAttribute(VIDEO_MAX_INSTALLED_ATTR, "zoomed");
      videomaxGlobals.hideEverythingTimer?.startTimer(() => {
        if (document.videmax_cmd === "unzoom") {
          trace("UNZOOMING! - skipping hideEverythingTimer");
          return true;
        }
        // BBC has some special css with lots of !importants
        hideCSS("screen-css");
        if (!fixUpPageZoom()) {
          return false;
        }

        postFixUpPageZoom();

        forceRefresh(videomaxGlobals.matchedVideo);
        forceRefresh(window.body);
        forceRefresh(window);

        videomaxGlobals.isMaximized = true;
        document.body.setAttribute(VIDEO_MAX_INSTALLED_ATTR, "running");
        return true; // stop retrying - we kep trying to rehide
      });
    }
    return true;
  }

  function mainZoom(tagonly = false) {
    videomaxGlobals.unzooming = false; // clear if we start zooming again. needed or retry timers
    if (hasInjectedAlready()) {
      trace("detected already injected. something is off?");
      return;
    }
    trace("running mainVideoMaxInject");

    const retries = isRunningInIFrame() ? 2 : 8;

    if (earyExitForSmallIFrame()) {
      return;
    }

    walker = document.createTreeWalker(document.body,
                                       NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_DOCUMENT,
                                       isVisibleWalkerElem);

    videomaxGlobals.elementMatcher = new ElemMatcherClass();

    if (!tagonly) {
      videomaxGlobals.hideEverythingTimer = new RetryTimeoutClass("hideEverythingTimer", 250,
                                                                  retries);
      // don't start there, do it from doZoomPage()
    }

    videomaxGlobals.tagonly = tagonly;
    videomaxGlobals.findVideoRetryTimer = new RetryTimeoutClass("doZoomPage", 500, retries);
    videomaxGlobals.findVideoRetryTimer.startTimer(doZoomPage);
  }

  const removeClassObserver = () => {
    if (videomaxGlobals.mutationObserver) {
      videomaxGlobals.mutationObserver.disconnect();
      videomaxGlobals.mutationObserver = null;
    }
    try {
      videomaxGlobals.matchedVideo.removeEventListener("canplay", updateSpeedFromAttr);
    } catch (_err) {}
  };


  const OBSERVE_ATTRIB_OPTIONS = {
    attributes:        true,
    attributeFilter:   ["class"],
    attributeOldValue: true,
    // new approach adds MULTIPLE observed elements and just watches children
    // old way used the `-common` and watched everything under it.
    childList:     MUTATION_OBSERVER_WATCH_ALL_MAX,
    subtree:       !MUTATION_OBSERVER_WATCH_ALL_MAX,
    characterData: false,
  };


  const startObserving = () => {
    if (!videomaxGlobals?.mutationObserver) {
      logerr("starting observer but videomaxGlobals.mutationObserver is null");
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
          videomaxGlobals.mutationObserver.observe(eachElem, OBSERVE_ATTRIB_OPTIONS);
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
          trace("OBSERVER: installing observer on matchedCommonCntl",
                videomaxGlobals.matchedCommonCntl);
        } else {
          trace("OBSERVER: \n\n \t ==== NOT installing no videomaxGlobals.matchedCommonCntl");
        }
      }
      // old approach
      // childList: false
      // subtree: true
      if (videomaxGlobals.matchedCommonCntl) {
        videomaxGlobals.mutationObserver.observe(videomaxGlobals.matchedCommonCntl,
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
        trace("OBSERVER: \n\n \t ==== RERUNNING observer watching setup ====");
      }
      startObserving();
      return;
    }

    videomaxGlobals.mutationObserver = new MutationObserver((mutations, _observer) => {
      // called when change happens. first disconnect to avoid recursions
      // observer.disconnect();

      if (document.videmax_cmd === "unzoom") {
        trace("UNZOOMING INTERRUPT! - skipping MutationObserver");
        return;
      }
      // check to see if things are in the process of going away. They might be.
      if (videomaxGlobals.mutationObserver && videomaxGlobals.isMaximized) {
        for (const eachMutation of mutations) {

          if (eachMutation.type === "attributes") {
            // is one of our classnames on the old value?
            if (eachMutation?.oldValue?.length &&
                eachMutation?.oldValue?.indexOf(PREFIX_CSS_CLASS) < 0) {
              // not found
              continue;
            }

            // our classname was there, but it's removed?
            if (hasAnyVideoMaxClass(eachMutation.target)) {
              continue;
            }

            // if we reach here then our classname was removed
            const oldClassNames = eachMutation.oldValue.split(" ");
            // figure out what classnames were removed and re-add it.
            for (const eachClassname of oldClassNames) {
              if (eachClassname.startsWith(PREFIX_CSS_CLASS)) {
                eachMutation.target?.classList?.add(eachClassname);
              }
            }
            if (oldClassNames.length > 0 && DEBUG_MUTATION_OBSERVER) {
              const newClassName = getAttr(eachMutation.target, "class");
              trace(
                `OBSERVER: detected classname changes\n\t before:"${eachMutation?.oldValue}"\n\t new:"${newClassName}"\n\t fixed:"${getAttr(
                  eachMutation.target, "class")}"`);
            }
          }

          if (MUTATION_OBSERVER_HIDE_NEW_ELEMS_ADDED && eachMutation.type === "childList") {
            for (const eachElem of eachMutation.addedNodes) {
              if (eachElem.nodeName.toLowerCase() === "video") {
                continue;
              }
              if (DEBUG_MUTATION_OBSERVER) {
                trace(`OBSERVER: Detected new element added ${PrintNode(eachElem)}`);
              }
              const hidden = hideNode(eachElem, true);
              if (hidden) {
                // we need to add to list of observers to make sure not changed.
                videomaxGlobals?.mutationObserver?.observe(eachElem, OBSERVE_ATTRIB_OPTIONS);
                if (DEBUG_MUTATION_OBSERVER) {
                  trace("OBSERVER: Hide new element, added to observer list");
                }
              } else if (DEBUG_MUTATION_OBSERVER) {
                trace("OBSERVER: Show new element");
              }
            }
          }
        }
      }
    });
    startObserving();
  };

  /**
   *
   * @param elem {HTMLElement}
   * @return {boolean}
   */
  const isVisible = (elem) => {
    return elem?.checkVisibility({
                                   checkOpacity:       true,
                                   checkVisibilityCSS: true,
                                 }) || false;
  };

  /**
   *
   * @param videoElem {HTMLVideoElement}
   * @return {boolean}
   */
  const isTopVisibleVideoElem = (videoElem) => {
    // if (!isVisible(videoElem)) { // done already in calling code
    //   return false; // easy out.
    // }

    if (isRunningInIFrame()) {
      // this could be tricky as hell... we likely to what's outside our frame
      debugger;
    }
    // center of the element
    const {
      top,
      left,
      width,
      height,
    } = getCoords(videoElem);
    const layedElems = document.elementsFromPoint(Math.round(left + (width / 2)),
                                                  Math.round(top + (height / 2)));

    // we walk down the layers checking to see if it's a video and if it's visible.
    const match = layedElems.find((eachLayer) => {
      if (!["video", "iframe"].includes(eachLayer.nodeName.toLowerCase())) {
        return false;
      }
      return isVisible(eachLayer);
    });

    const result = videoElem.isSameNode(match);
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
  const updateSpeedFromAttr = (evt) => {
    setTimeout(() => {
      try {
        const videoElem = evt.currentTarget || evt.target;

        if (!isVisible(videoElem)) {
          // we only need to do something if it's visible.
          trace(
            `updateSpeedFromAttr not running because video isn't visible ${PrintNode(videoElem)}`);
          return;
        }
        // do we update speed on ALL visible videos or only the one we think it the frontmost?
        // this can happen when ads cover or are behind the main video.
        const speedStr = document.body.getAttribute(PLAYBACK_SPEED_ATTR);
        const speedFloat = safeParseFloat(speedStr);
        if (!videoElem.paused && !videoElem.ended && speedFloat > 0 && videoElem.playbackRate !==
            speedFloat) {
          const isTopItem = isTopVisibleVideoElem(videoElem);
          trace(
            `updateSpeedFromAttr video: isTopVisibleVideoElem:${isTopItem} speedStr:${speedStr} \n\t\t ${PrintNode(
              videoElem)}`);
          videoElem.playbackRate = Math.abs(speedFloat);
        } else if (videoElem.playbackRate !== speedFloat && speedFloat === 1.0) {
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
  };

  const videoCanPlayBufferingInit = () => {
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
  };


// <editor-fold defaultstate="collapsed" desc="UndoZoom">
  class UndoZoom {
    /**
     * @param doc {Document}
     */
    static recurseIFrameUndoAll(doc) {
      try {
        if (typeof (doc?.querySelectorAll) !== "function") {
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
            // probably iframe boundry security related
          }
        }
      } catch (err) {
        // probably security related
      }
    }

    /**
     * @param doc {Document}
     */
    static removeAllClassStyles(doc) {
      if (typeof (doc?.querySelectorAll) !== "function") {
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
    }


    /**
     *
     * @param doc {Document}
     */
    static undoStyleSheetChanges(doc) {
      try {
        if (typeof (doc?.getElementsByTagName) !== "function") {
          // some iframes block access for security reasons
          return;
        }
        const cssNode = doc.getElementById(CSS_STYLE_HEADER_ID);
        if (parentNode(cssNode) && cssNode?.parentNode?.removeChild) {
          parentNode(cssNode)
            ?.removeChild(cssNode);
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

    /**
     *
     * @param doc {Document}
     */
    static undoAttribChange(doc) {
      if (typeof (doc?.querySelectorAll) !== "function") {
        // security can block
        return;
      }
      // we tag all elements that have saved attributes by adding the VIDEO_MAX_DATA_ATTRIB_UNDO_TAG
      const hasAttrTags = doc.querySelectorAll(`[${VIDEO_MAX_DATA_ATTRIB_UNDO_TAG}]`);
      for (const elem of hasAttrTags) {
        try {
          restoreAllSavedAttr(elem);
          //  try and make the element realizes it needs to redraw. Fixes
          // progress bar
          elem.dispatchEvent(new Event("resize"));
          elem.dispatchEvent(new Event("visabilitychange"));
        } catch (err) {
          logerr(err, elem);
        }
      }
    }

    /**
     * @param doc {Document}
     */
    static undoAll(doc) {
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

      UndoZoom.undoStyleSheetChanges(doc);
      UndoZoom.removeAllClassStyles(doc);
      UndoZoom.undoAttribChange(doc);
    }

    static touchDocBodyToTriggerUpdate() {
      document.body.width = "99%";
      setTimeout(() => {
        document.body.width = "100%";
      }, 1);
    }

    static forceRefresh(optionalElem) {
      // we now need to force the flash to reload by resizing... easy thing is to
      // adjust the body
      setTimeout(() => {
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

        // remove the video "data-videomax-" attributes
        const ALL_DOCS = [document, window.document];
        for (const eachAttr of REMOVE_ATTR_LIST) {
          for (const eachDoc of ALL_DOCS) {
            try {
              if (typeof (eachDoc?.querySelectorAll) !== "function") {
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
          // fallback - find ALL elements that have a videomax class and remove. PREFIX_CSS_CLASS
          // matches prep, too
          const missedRemoved1 = document.querySelectorAll(`[class*="${PREFIX_CSS_CLASS}"]`);
          if (missedRemoved1.length) {
            // undo didn't remove all "videomax-ext" classes from this doc (maybe iframe)
            // eslint-disable-next-line no-debugger
            debugger;
          }

          if (videomaxGlobals.matchedVideo?.ownerDocument &&
              typeof (videomaxGlobals.matchedVideo.ownerDocument) === "function") {
            const notRemoved2 = videomaxGlobals?.matchedVideo?.ownerDocument.querySelectorAll(
              `[class*="${PREFIX_CSS_CLASS}"]`);
            if (notRemoved2.length) {
              // undo didn't remove all "videomax-ext" classes from document where video was found
              // eslint-disable-next-line no-debugger
              debugger;
            }
          }
        }
        // clear if we have var saved in window/document
        if (!isRunningInIFrame() && window?._VideoMaxExt) {
          window._VideoMaxExt = undefined;
        } else if (document._VideoMaxExt) {
          document._VideoMaxExt = undefined;
        }
        UndoZoom.forceRefresh(document);
        UndoZoom.forceRefresh(savedVideo);
      } catch (ex) {
        logerr(ex);
      }
    }

  }

// </editor-fold>

// look at the command set by the first injected file
  trace(`
    ***
    videmax_cmd: window.videmax_cmd:'${window.videmax_cmd}'  document.videmax_cmd:'${document.videmax_cmd}'
    ***`);
  switch (window.videmax_cmd || document.videmax_cmd) {
    case "unzoom":
      UndoZoom.mainUnzoom();
      break;

    case "tagonly":
      // this is for sites that already zoom correctly, but we'd like to do speed control
      mainZoom(true);
      break;

    default:
      mainZoom();
      break;
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("videomax extension error", err, err.stack);
}
