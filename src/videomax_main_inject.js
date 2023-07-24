try { // scope and prevent errors from leaking out to page.
  const FULL_DEBUG          = false;
  const DEBUG_ENABLED       = FULL_DEBUG;
  const TRACE_ENABLED       = FULL_DEBUG;
  const ERR_BREAK_ENABLED   = FULL_DEBUG;
  const BREAK_ON_BEST_MATCH = false;

  // this will put add the score as an attribute for
  // elements across revisions, the zoomed page's html can
  // be diffed. This is for debugging and unit testing.
  const EMBED_SCORES = false;

  // experiments - keep these settings to regression check various fixes across sites
  // What fixes one site often breaks another.
  // Eventually, these can go away as we verify no adverse interactions.
  const DO_NOT_MATCH_ADS            = false;
  const DO_REHIDE                   = true;
  const ALWAYS_MAX_BODY             = true;
  const SCROLL_TO_VIDEO             = true;
  const STOP_NODE_DISABLE           = true;
  const STOP_NODE_COMMON_CONTAINER  = true;
  const REHIDE_RETRY_UNTIL_NONE     = true; // tictok popups
  const NEVER_HIDE_SMELLS_LIKE_TEST = true;
  const FLIP_STYLE_ATOMICALLY       = true;
  const ADJUST_PLAYBACK_CNTL_HEIGHT = true;
  const USE_URL_OVERLAP_WEIGHT      = true;
  const USE_TITLE_OVERLAP_WEIGHT    = true;
  const ONLY_RUN_AFTER_DOC_LOADED   = true; // set to false and test
  const IFRAME_PARENT_NODE_WORKS    = true;
  const USE_MUTATION_OBSERVER_ATTR  = true;


  const MIN_IFRAME_WIDTH  = 320;
  const MIN_IFRAME_HEIGHT = 240;

  // when walking dom how many levels up to check when looking for controls?
  // too low and we miss some playback position controls (vimeo)
  // too high an we find non-controls like ads
  const CHECK_PARENTS_LEVELS_UP_MAX = 8; // was 6

  const START_WEIGHT             = 1000;
  const RATIO_WEIGHT             = 0.50;
  const SIZE_WEIGHT              = 5.0;
  const ORDER_WEIGHT             = -10.0; // was 10
  const TAB_INDEX_WEIGHT         = -6.0;
  const HIDDEN_VIDEO_WEIGHT      = -10; // downgrades
  const ZINDEX_WEIGHT            = 0.5;
  const VIDEO_OVER_IFRAME_WEIGHT = 0; // video gets VIDEO_PLAYING_WEIGHT, VIDEO_DURATION_WEIGHT,
                                      // VIDEO_NO_LOOP_WEIGHT, etc
  const MAIN_FRAME_WEIGHT       = 5.0;
  const VIDEO_PLAYING_WEIGHT    = 10.0;
  const VIDEO_DURATION_WEIGHT   = 5.0; // was 10
  const MAX_DURATION_SECS       = 60 * 60 * 2; // 2hrs max - live videos skew results
  const VIDEO_NO_LOOP_WEIGHT    = 1.0;
  const VIDEO_HAS_SOUND_WEIGHT  = 10.0;
  const URL_OVERLAP_WEIGHT      = 500.0;
  const TITLE_OVERLAP_WEIGHT    = 100;
  const ALLOW_FULLSCREEN_WEIGHT = 10.0;

  // used to save off attributes that are modified on iframes/flash
  const VIDEO_MAX_DATA             = "data-videomax";
  const VIDEO_MAX_DATA_ATTRIB_UNDO = `${VIDEO_MAX_DATA}-saved`;

  // found in background script.
  const PLAYBACK_SPEED_ATTR = "data-videomax-playbackspeed";

  // found element <... data-videomax-target="zoomed-video">
  // also see class="... videomax-ext-video-matched ..."

  const VIDEO_MAX_ATTRIB_FIND = `${VIDEO_MAX_DATA}-target`;
  const VIDEO_MAX_ATTRIB_ID   = "zoomed-video";
  const EMBEDED_SCORES        = `${VIDEO_MAX_DATA}-scores`;

  const REMOVE_ATTR_LIST = [VIDEO_MAX_DATA_ATTRIB_UNDO,
                            VIDEO_MAX_DATA_ATTRIB_UNDO,
                            PLAYBACK_SPEED_ATTR,
                            VIDEO_MAX_ATTRIB_FIND,
                            EMBEDED_SCORES,
    // old videomax for comparision. remove them too
                            `data-videomax-weights`,
                            `videomax-ext-prep-scores`];


  // smp-toucan-player is some random bbc player. object is the old flash player.
  const VIDEO_NODES                 = ["video", "object", "embed", "iframe", "smp-toucan-player"];
  /** @type {HtmlElementTypes} */
  const ALWAYS_HIDE_NODES           = ["footer", "header", "nav"];  // aside needed for 9anime
  /** @type {HtmlElementTypes} */
  const STOP_NODES                  = ["head", "body", "html"];  // stop when walking up parents
  /** @type {HtmlElementTypes} */
  const IGNORE_NODES                = ["noscript", "script", "head", "link", "style", "hmtl", "ul"];
  /** @type {HtmlElementTypes} */
  const IGNORE_CNTL_NODES           = [...IGNORE_NODES,
                                       ...ALWAYS_HIDE_NODES,
                                       "head",
                                       "body",
                                       "html",
                                       "iframe"];
  /** @type {HtmlElementTypes} */
  const STOP_NODES_COMMON_CONTAINER = [...IGNORE_CNTL_NODES, "main"];

  const CSS_STYLE_HEADER_ID = "maximizier-css-inject";

  // we use the prop class then flip all the classes at the end.
  // The reason for this is that the clientRect can get confused on rezoom if
  //     the background page couldn't inject the css as a header.
  const PREFIX_CSS_CLASS                     = "videomax-ext";
  const PREFIX_CSS_CLASS_PREP                = "videomax-ext-prep";
  // adding ANY new elements should be added to inject_undo
  const OVERLAP_CSS_CLASS                    = `${PREFIX_CSS_CLASS_PREP}-overlap`;
  const HIDDEN_CSS_CLASS                     = `${PREFIX_CSS_CLASS_PREP}-hide`;
  const MAX_CSS_CLASS                        = `${PREFIX_CSS_CLASS_PREP}-max`;
  const PLAYBACK_CNTLS_CSS_CLASS             = `${PREFIX_CSS_CLASS_PREP}-playback-controls`;
  const PLAYBACK_CNTLS_FULL_HEIGHT_CSS_CLASS = `${PLAYBACK_CNTLS_CSS_CLASS}-fullheight`;
  const PLAYBACK_VIDEO_MATCHED_CLASS         = `${PREFIX_CSS_CLASS_PREP}-video-matched`;
  const MARKER_COMMON_CONTAINER_CLASS        = `${PREFIX_CSS_CLASS_PREP}-container-common`;


  const SCALESTRING_WIDTH  = "100%"; // "calc(100vw)";
  const SCALESTRING_HEIGHT = "100%"; // "calc(100vh)";
  const SCALESTRING        = "100%";

  // per doc globals (e.g. inside iframes from background inject gets it's own)
  let videomaxGlobals = {
    /** @type {ElemMatcherClass | null} */
    elementMatcher: null,

    /** @type {HTMLElement | Node} */
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
    observerClassMod: null,

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
    const color  = `color: white; font-weight: bold; background-color: blue`;
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
    const path   = url.split("://")[1] || url;
    const noArgs = path.split("?")[0] || path;
    return noArgs.split(/[^A-Z0-9]+/i)
      .filter(s => s.length > 0);
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
   * @param urlformat {string}
   * @return {{[key: string]: string}}
   */
  const parseParams = (urlformat) => {
    const pl     = /\+/g; // Regex for replacing addition symbol with a space
    const search = /([^&=]+)=?([^&]*)/g;
    const decode = (s) => decodeURIComponent(s.replace(pl, " "));
    const query  = urlformat;

    const urlParamsResult = {};
    let match             = search.exec(query);
    while (match) {
      urlParamsResult[decode(match[1])] = decode(match[2]);
      match                             = search.exec(query);
    }
    return urlParamsResult;
  };

  /**
   * Returns the document of an IFrame and tries to handle security
   * @param iframe {HTMLFrameElement | HTMLIFrameElement | undefined}
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
    if (!docElem) {
      return undefined;
    }
    const w      = docElem.defaultView || docElem.parentWindow;
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

  // const getFramedWindow = (f) => {
  //   if (!f?.parentNode) {
  //     f = document.body.appendChild(f); // hummm.
  //   }
  //   let w = (f.contentWindow || f.contentDocument);
  //   if (w?.nodeType === 9) {
  //     w = (w.defaultView || w.parentWindow);
  //   }
  //   return w;
  // };

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
      const clone = elem?.cloneNode(false);
      if (!clone) {
        return "";
      }
      clone.innerText = "";
      if (clone?.srcdoc?.length) {
        clone.srcdoc = "";
      }
      const result = clone?.outerHTML || " - ";
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
  const PrintRect = (rect) => {
    return `tlbr:[${rect.top}, ${rect.left}, ${rect.bottom}, ${rect.right}] w=${rect.width} h=${rect.height}`;
  };

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
  const round = (value) => {
    return parseFloat(fmtFlt.format(value));
  };

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
  const isElem         = (nodeOrElem) => (nodeOrElem instanceof HTMLElement);
  // or is it (nodeOrElem.nodeType === Node.ELEMENT_NODE)?

  /**
   *
   * @param elem {Node || HTMLElement}
   * @param attr {string}
   * return {string}
   */
  const safeGetAttribute = (elem, attr) => {
    try {
      return elem?.getAttribute(attr) || "";
    } catch (err) {
      return "";
    }
  };

  /**
   *
   * @param elem {Node || HTMLElement}
   * @param attr {string}
   * @param value {string}
   */
  const safeSetAttribute = (elem, attr, value) => {
    try {
      if (elem?.setAttribute) {
        elem.setAttribute(attr, value);
      }
    } catch (err) {
      logerr(`error setting attribute ${attr}`, elem, err);
    }
  };


  /**
   *
   * @param elem {Node}
   * @returns {boolean}
   */
  const isStopNodeType = (elem) => {
    if (STOP_NODE_DISABLE) {
      // iframes, you want to keep going if possible
      return false;
    }
    const nodename = /** @type HtmlElementType */ elem?.nodeName?.toLowerCase() || "";
    return STOP_NODES.includes(nodename);
  };

  /**
   *
   * @param elem {Node}
   * @returns {boolean}
   */
  const isStopNodeForCommonContainer = (elem) => {
    if (!STOP_NODE_COMMON_CONTAINER) {
      // iframes, you want to keep going if possible
      return false;
    }
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
              trace(err);
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
   * returns true if a new video match was found.
   * @param doc {HTMLDocument}
   * @return {HTMLElement[]}
   */
  const getVidsInDoc = (doc) => {
    if (typeof (doc?.getElementsByTagName) !== "function") {
      // some iframes fail to allow access to getElementsByTagName
      return [];
    }
    const result = [];
    for (const tagname of VIDEO_NODES) {
      try {
        result.push(...doc.getElementsByTagName(tagname));
      } catch (err) {
        logerr(err);
      }
    }
    return result;
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
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  const isIFrameElem = (elem) => elem?.nodeName === "IFRAME" || elem?.nodeName === "FRAME" || false;

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
      // can throw if cross iframe boundry
      logerr(err);
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

  /**
   *
   * @param optionalElem {Node || HTMLElement || undefined}
   */
  function forceRefresh(optionalElem = undefined) {
    // we now need to force the flash to reload by resizing... easy thing is to
    // adjust the body
    if (!isRunningInIFrame()) {
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("visabilitychange"));
        if (optionalElem?.dispatchEvent) {
          optionalElem.dispatchEvent(new Event("resize"));
          optionalElem.dispatchEvent(new Event("visabilitychange"));
        }
      }, 50);
    }
  }

  /**
   * we going to work our way up looking for some element that has a bunch of children but few
   * siblings. We're only going to search up (CHECK_PARENTS_LEVELS_UP_MAX) elements, then give
   * up.
   * For <video> matching, the playback controls are "position: absolute" under a common
   * div "position: relative".
   *
   * @return {Node | HTMLElement}
   */
  function findCommonContainerFromMatched() {
    if (DEBUG_ENABLED) {
      const matches = document.querySelectorAll(`.${MARKER_COMMON_CONTAINER_CLASS}`);
      if (matches?.length) {
        trace(`Already found common container, shouldn't match two`, matches);
        debugger;
      }
    }
    if (!videomaxGlobals.matchedIsHtml5Video) {
      return videomaxGlobals.matchedVideo.parentElement;
    }
    const videoElem = videomaxGlobals.matchedVideo;
    const videoRect = videomaxGlobals.matchVideoRect;

    const countChildren = (e, recurseOnce = true) => {
      const checkChildren = [...e?.children].filter(e => !isIgnoredNode(e));
      // now we check how many are absolute positioned. These get 2x weight.
      let result          = 0;

      if (recurseOnce) {
        const matches = [...e.querySelectorAll(`[role="slider"]`),
                         ...e.querySelectorAll(`[role="presentation"]`)];
        result += matches.length;
      }

      for (const eachChild of checkChildren) {
        const compStyleElem = getElemComputedStyle(eachChild); // $$$
        const rect          = getCoords(eachChild);
        if (isBoundedRect(videoRect, rect)) {
          result++;
        }
        if (compStyleElem.position === "absolute") {
          result++;
        }
        if (compStyleElem.transform?.includes("ease")) {
          result++;
        }
        ///
        if (recurseOnce) {
          // we recurse ONCE. Youtube and plutoTV put controls one level down.
          result += countChildren(eachChild, false);
        }
      }
      // trace(`\t\tcountChildren: ${result}`, e);
      return result;
    };

    const savedWalkerCurrentNode = walker.currentNode; //restore at end
    walker.currentNode           = videoElem;
    let bestMatch                = videoElem;
    let bestMatchWeight          = 1;

    let checkParents = CHECK_PARENTS_LEVELS_UP_MAX;
    while (walker.parentNode() && checkParents > 0) {
      // these could be part of while condition, but we may want to debug/trace on them.
      checkParents--; // counting down to zero.
      if (isStopNodeForCommonContainer(walker.currentNode)) {
        trace(`  findCommonContainerFromElem stopped because hit stopping node`);
        break;
      }
      const weight = countChildren(walker.currentNode);
      trace(`findCommonContainerFromMatched ${weight > bestMatchWeight ?
                                              "NEW BEST" :
                                              ""} \n\t weight:${weight} \n\t ${PrintNode(
        walker.currentNode)} \n\t`, walker.currentNode);
      if (weight > bestMatchWeight) {
        bestMatchWeight = weight;
        bestMatch       = walker.currentNode; // we've already moved to parentNode()
      }
    }

    // todo: now we check if this div is too small, if so, we take it's parent?

    // done, restore
    walker.currentNode = savedWalkerCurrentNode;

    videomaxGlobals.matchedCommonCntl = bestMatch;

    bestMatch?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
    return bestMatch;
  }

  /**
   * Start at child and to up parent until it matches.
   * Used to show hidden video playback bar on some sites that get
   * missed by other techniques
   * @param childElem {HTMLElement}
   * @param classesToAddArr {string[]}
   * @param classesToRemoveArr {string[]}
   * @param stopParentElemOpt {HTMLElement | undefined}
   */
  function replaceVideoMaxClassInTree(childElem, classesToAddArr, classesToRemoveArr,
                                      stopParentElemOpt = undefined) {
    trace(`replaceVideoMaxClassInTree running in ${isRunningInIFrame() ? "iFrame" : "Main"}`);
    let checkSanityCount = CHECK_PARENTS_LEVELS_UP_MAX;
    let elem             = childElem;
    while (isStopNodeType(elem) && checkSanityCount--) {
      elem.classList.add(...classesToAddArr);
      if (classesToRemoveArr?.length) {
        elem.classList.remove(...classesToRemoveArr);
      }
      if (stopParentElemOpt && elem.parentElement?.isSameNode(stopParentElemOpt)) {
        break;
      }
      elem = elem.parentElement;
    }
  }

  /**
   * @param childElem {HTMLElement}
   * @param ancestorElem {HTMLElement}
   * @return {boolean}
   */
  function isADecendantElem(childElem, ancestorElem) {
    return ancestorElem?.contains(childElem) || false;
  }

  function exceptionToRuleFixup(doc, videoElem) {
    // some sites have the playback controls completely cover the video, if we don't
    // adjust the height, then they are at the top or middle of the screen.
    if (ADJUST_PLAYBACK_CNTL_HEIGHT) {
      const existingPlaybacks = doc.querySelectorAll(`.${PLAYBACK_CNTLS_CSS_CLASS}`);
      if (existingPlaybacks?.length) {
        const videoElemHeight = getOuterBoundingRect(videoElem).height || 1;
        for (const eachPlaybackCntl of existingPlaybacks) {
          const height = getOuterBoundingRect(eachPlaybackCntl).height || 1;
          const ratio  = height / videoElemHeight;
          if (height > 10 && ratio > 0.80) {
            trace(
              `=====\n\tADJUST_PLAYBACK_CNTL_HEIGHT seems like it should be full height\n=====`);
            eachPlaybackCntl.classList.add(PLAYBACK_CNTLS_FULL_HEIGHT_CSS_CLASS);
          }
        }
      }
    }
  }

  // HTMLFrameElement
  const isVisibleWalkerElem = (el) => {
    if (["#document", // iframe top element
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
         "input"].includes(el.nodeName.toLowerCase())) {
      return NodeFilter.FILTER_SKIP;
    }
    try {
      const vis = !!(el?.offsetWidth || el?.offsetHeight || el?.getClientRects()?.length);
      return vis ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    } catch (err) {
      logerr(err, el);
      return NodeFilter.FILTER_SKIP;
    }
  };

  /**
   *
   * @param elem {Element}
   * @param className {string}
   * @constructor
   */
  const ReApplyUpFromElem = (elem, className) => {
    const saveWalker   = walker.currentNode;
    walker.currentNode = elem;
    do {
      try {
        walker?.currentNode?.classList?.add(className);
      } catch (err) {
        logerr(`walker error for ${PrintNode(walker.currentNode)}`, err);
      }
    } while (walker.parentNode());
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
   * @param doc {Document|HTMLDocument}
   * @return {boolean}
   */
  function findLargestVideoDigIntoIFrames(doc) {
    if (typeof (doc?.getElementsByTagName) !== "function") {
      trace("getElementsByTagName is not function for sub doc, bailing", doc);
      return false;
    }
    try {
      // first gather all possible video elements from top doc and all sub-iframes
      let queuedVidElems = []; // iframes and <video> elems in iframes
      let queuedFrames   = [doc, ...doc.getElementsByTagName("iframe")];
      let checkedDedup   = [...queuedFrames]; // clone
      let safetyLoop     = 50;
      while (queuedFrames.length && safetyLoop--) {
        try {
          const eachFrame = queuedFrames.shift(); // fifo array
          const framedoc  = getIFrameDoc(eachFrame);
          if (!framedoc) {
            continue;
          }
          const matchedVids = getVidsInDoc(framedoc);
          for (const eachMatchedVid of matchedVids) {
            // we loop over all these below.
            if (!checkedDedup.includes(eachMatchedVid)) {
              queuedVidElems.push(eachMatchedVid);
              checkedDedup.push(eachMatchedVid);
            }
          }

          // now add any nested iframes to the queue
          // // sandboxing errors common, try to avoid errors but not really possible
          if (typeof (framedoc?.getElementsByTagName) !== "function") {
            continue;
          }
          try {
            const subframedoc = getIFrameDoc(eachFrame);
            if (!subframedoc) {
              continue;
            }
            const subframes = subframedoc.getElementsByTagName("iframe");
            if (!subframes?.length) {
              continue;
            }
            for (const eachsubframe of subframes) {
              try {
                if (checkedDedup.includes(subframes)) {
                  continue;
                }
                if (typeof (eachsubframe?.getElementsByTagName) === "function") {
                  queuedFrames.push(eachsubframe);
                  checkedDedup.push(eachsubframe);
                }
              } catch (_err) {
              }
            }
          } catch (err) {
            logerr(err);
          }

          for (const matchedVidElem of queuedVidElems) {
            try {
              const matched = videomaxGlobals.elementMatcher.checkIfBest(matchedVidElem);
              if (!matched) {
                continue;
              }
              // replace match
              videomaxGlobals.elementMatcher.addNestedFrame(eachFrame);
            } catch (err) {
              trace("findLargestVideoDigIntoIFrames looping frame:", eachFrame, "\nVideoElem:",
                matchedVidElem);
            }
          }
        } catch (err) {
          // common exception because iframes can be protected if
          // they cross domains
          trace("security exception expected as we gather subframes", err);
        }
      }
      if (DEBUG_ENABLED && safetyLoop === 0) {
        // too many loops over iframes?!?
        debugger;
      }
    } catch (ex) {
      // probably a security exception for trying to access frames.
      logerr("findLargestVideoDigIntoIFrames. probably security issue", ex);
    }
    return (videomaxGlobals.elementMatcher.getBestMatchCount() > 0);
  }

  /**
   * @param elem {HTMLElement}
   */
  function tagElementAsMatchedVideo(elem) {
    videomaxGlobals.matchedVideo        = elem;
    videomaxGlobals.matchVideoRect      = getCoords(elem);
    videomaxGlobals.matchedIsHtml5Video = elem.nodeName.toLowerCase() === "video";
    videomaxGlobals.processInFrame      = isRunningInIFrame(); // for debugging
    // set the data-videomax-id = "zoomed" so undo can find it.
    safeSetAttribute(elem, `${VIDEO_MAX_ATTRIB_FIND}`, VIDEO_MAX_ATTRIB_ID);
    elem?.classList?.add(PLAYBACK_VIDEO_MATCHED_CLASS, MAX_CSS_CLASS);
  }

  /**
   *
   * @param node {Node | HTMLElement}
   * @return {Node | HTMLElement}
   */
  const fixUpAttribs = (node) => {
    if (!node) {
      debugger;
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
          let newValue   = "";

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
            saveAttribute(node, name);
            safeSetAttribute(node, name, newValue);
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
          const attrName  = safeGetAttribute(eachnode, "name");
          const attrValue = safeGetAttribute(eachnode, "value");

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
      newParams.bgcolor  = "#000000";
      newParams.scale    = "showAll";
      newParams.menu     = "true";
      newParams.quality  = "high";
      newParams.width    = SCALESTRING_WIDTH;
      newParams.height   = SCALESTRING_HEIGHT;
      newParams.quality  = "high";
      newParams.autoplay = "true";

      // edit in place
      for (const eachnode of node.childNodes) {
        if (eachnode.nodeName.toUpperCase() !== "PARAM") {
          continue;
        }
        const name     = safeGetAttribute(eachnode, "name");
        const orgValue = safeGetAttribute(eachnode, "value");

        if (Object.prototype.hasOwnProperty.call(newParams, name)) { // is this one we care about?
          trace(`FixUpAttribs changing child param '${name}'
            old: '${orgValue}'
            new: '${newParams[name]}'`);

          saveAttribute(eachnode, name);
          safeSetAttribute(eachnode, name, newParams[name]);
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
      const params         = parseParams(flashletsval);
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

              case "autoplay":
                if (params[key] === "0") {
                  params[key] = "1";
                } else {
                  params[key] = "true";
                }
                break;

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
   * Returns true if any css classname starts with our prefix.
   * @param node {Node || HTMLElement}
   * @return {boolean}
   */
  const containsAnyVideoMaxClass = (node) => {
    try {
      // node.className for an svg element is an array not a string.
      const className = safeGetAttribute(node, "class");
      return (className?.toString()
                .indexOf(PREFIX_CSS_CLASS) !== -1);  // matches PREFIX_CSS_CLASS_PREP too
    } catch (err) {
      debugger;
    }
    return false;
  };

  /**
   * Copy over and attribute value so it can be restored by undo
   * @param node {Node || HTMLElement}
   * @param attributeName {string}
   * @return {boolean} True if attribute saved
   */
  const saveAttribute = (node, attributeName) => {
    if (!isElem(node)) {
      return false;
    }
    const attributeNameLower = attributeName.toLowerCase();
    const orgValue           = safeGetAttribute(node, attributeNameLower) || "";
    if (!orgValue.length) {
      // nothing to save
      // trace(`    saveAttribute '${attributeNameLower}' empty, nothing to save`, node);
      return false;
    }
    const startingdata = safeGetAttribute(node, VIDEO_MAX_DATA_ATTRIB_UNDO);
    const jsondata     = JSON.parse(startingdata || "{}");
    if (Object.keys(jsondata)
      .includes(attributeNameLower)) {
      // already been saved merging
      trace(`    saveAttribute '${attributeNameLower}' already saved, merging `, node, jsondata);
      restoreSavedAttribute(node); // restore merges,
    }

    // ok merge in and save
    jsondata[attributeNameLower] = orgValue;
    safeSetAttribute(node, VIDEO_MAX_DATA_ATTRIB_UNDO, JSON.stringify(jsondata));
    trace(`    saveAttribute '${attributeNameLower}' old value ${orgValue}`, node);
    return true;
  };

  /**
   *
   * @param elem {Node | HTMLElement}
   */
  const restoreSavedAttribute = (elem) => {
    const savedAttribsJson = JSON.parse(elem.getAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO) || "{}");
    trace("restoreSavedAttribute for ", elem);
    for (const [key, value] of Object.entries(savedAttribsJson)) {
      const savedAttrValue = elem.getAttribute(key);
      trace(`  ${key}='${value}' `, elem);
      elem.setAttribute(key, String(value));
      if (savedAttrValue?.length) {
        elem.setAttribute(key, savedAttrValue);
      }
    }
    elem.removeAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO);
    trace("  final restored elem:' ", elem);
  };

  /**
   * @param elem {Node || HTMLElement}
   */
  const hideNode = (elem) => {
    if (isIgnoredNode(elem)) {
      // trace("NOT HIDING isIgnoredNode:", IGNORE_NODES, elem);  / noisy
      return false;
    }

    if (containsAnyVideoMaxClass(elem)) {
      trace("NOT HIDING already contains videomax class", elem);
      return false;
    }

    if (isADecendantElem(elem, videomaxGlobals.matchedCommonCntl)) {
      trace("NOT HIDING isADecendantElem", elem);
      return false;
    }

    // some never hide elements.
    if (NEVER_HIDE_SMELLS_LIKE_TEST && isSpecialCaseNeverHide(elem)) {
      trace("NOT HIDING special case", elem);
      return false;
    }

    elem?.classList?.add(HIDDEN_CSS_CLASS); // may be Node
    return true;
  };

  /**
   * @param elem {Node || HTMLElement}
   */
  const addOverlapCtrl = (elem) => {
    if (isIgnoredNode(elem)) {
      trace("NOT addOverlapCtrl isIgnoredNode:", IGNORE_NODES, elem);
      return;
    }
    elem?.classList?.add(OVERLAP_CSS_CLASS);
  };

  /**
   * All siblings as an array, (but not the node passed)
   * @param node {Node}
   * @return {Node[]}
   */
  const getSiblings = (node) => {
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
      return ALLOWED_NODE_TYPES.includes(c.nodeName);
    });
  };

  /**
   * @return {number}
   */
  function rehideUpFromVideo() {
    if (!DO_REHIDE) {
      return 0;
    }

    /** @type {number} */
    let reHideCount = 0;
    /** @type {HTMLElement | Node | undefined} */
    let current     = videomaxGlobals.matchedVideo;
    if (videomaxGlobals.matchedIsHtml5Video) {
      // html5 videos often put controls next to the video in the dom (siblings), so we want
      // to go up a level
      current = parentNode(current);
    }

    let safetyCheck = 200;
    while (current && !isStopNodeType(current) && safetyCheck--) {
      const siblings = getSiblings(current);
      for (const eachNode of siblings) {
        // we don't hide the tree we're walking up, just the siblings
        if (!containsAnyVideoMaxClass(eachNode)) {
          if (hideNode(eachNode)) { // may not actually hide for internal reasons
            reHideCount++;
          }
        }
      }
      const loopDetect = current;
      current          = parentNode(current);
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
    this.delay   = delay; // + (Math.round((0.5 - Math.random()) * delay) / 10); //  +/-

    this.maxretries = maxretries;
    this.retrycount = 0;
    this.debugname  = debugname;
    this.func       = () => {};

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
      let timerid             = 0;
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
        saveAttribute(elem, "media");
        elem.setAttribute("media", "_all");
      }
    }
  };

  /**
   * @return {boolean}
   */
  const hasInjectedAlready = () => {
    const matched = [...document.querySelectorAll(
      `video[class*="${PLAYBACK_VIDEO_MATCHED_CLASS}"]`),
                     ...document.querySelectorAll(`video[class*="videomax-ext-video-matched"]`)];
    return matched.length > 0;
  };

  /**
   * Returns whole numbers for bounding box instead of floats.
   * @param rectC {DomRect}
   * @return {DomRect}
   */
  const wholeClientRect = (rectC) => {
    return {
      top:    Math.round(rectC.top),
      left:   Math.round(rectC.left),
      bottom: Math.round(rectC.bottom),
      right:  Math.round(rectC.right),
      width:  Math.round(rectC.width),
      height: Math.round(rectC.height),
    };
  };

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
    const result = (inRange(inner.top, outer.top, outer.bottom) &&
                    inRange(inner.bottom, outer.top, outer.bottom) &&
                    inRange(inner.left, outer.left, outer.right) &&
                    inRange(inner.right, outer.left, outer.right));
    // trace(`isBoundedRect: ${result} outer:${PrintRect(outer)} inner:${PrintRect(inner)}`);
    return result;
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
    let top      = elemIn.offsetTop,
        left     = elemIn.offsetLeft;
    let elem     = elemIn.offsetParent;

    while (elem?.offsetParent) {
      elem                = elem.offsetParent;
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
      const regex   = /(-?\d+?.\d+)px (-?\d+?.\d+)px/;
      const matches = compStyle?.transformOrigin.match(regex);
      if (matches?.length === 3) {
        top += parseFloat(matches[1]);
        left += parseFloat(matches[2]);
      }
    }
    if (compStyle?.transform) {
      // "translate(100.1px, 202.202px) ..."
      const regex   = /translate\((-?\d+?.\d+)px, (-?\d+?.\d+)px\)/;
      const matches = compStyle?.transformOrigin.match(regex);
      if (matches?.length === 3) {
        top += parseFloat(matches[1]);
        left += parseFloat(matches[2]);
      }
    }

    // result.height, result.width set already
    result.top    = top;
    result.left   = left;
    result.bottom = top + result.height;
    result.right  = left + result.width;
    return result;
  };

  // this is from a stack-overflow discussion, it's NOT 100%
  const getCoords = (elem) => { // crossbrowser version
    const box = elem.getBoundingClientRect();

    const body  = document.body;
    const docEl = document.documentElement;

    const scrollTop  = window.pageYOffset || docEl.scrollTop || body.scrollTop;
    const scrollLeft = window.pageXOffset || docEl.scrollLeft || body.scrollLeft;

    const clientTop  = docEl.clientTop || body.clientTop || 0;
    const clientLeft = docEl.clientLeft || body.clientLeft || 0;

    const top    = Math.round(box.top + scrollTop - clientTop);
    const left   = Math.round(box.left + scrollLeft - clientLeft);
    const bottom = top + box.height; // already rounded.
    const right  = left + box.width;

    return {
      top,
      left,
      bottom,
      right,
      width:  box.width,
      height: box.height,
    };
  };

  /**
   *  role="slider"
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function hasSliderRoleChild(elem) {
    const sliders      = elem.querySelectorAll(`[role="slider"]`);
    const presentation = elem.querySelectorAll(`[role="presentation"]`);

    for (const eachslider of [...sliders, ...presentation]) {
      // volumes are sliders too. English specific term search isn't great...
      const elementAttribsStr = PrintNode(eachslider)
        .toLowerCase();
      trace(`Slider check "${elementAttribsStr}"`);
      // todo: split into words?
      const foundVolumeStr = elementAttribsStr.indexOf("volume") !== -1;
      if (foundVolumeStr) {
        trace(`Possible VOLUME slider matched, skipping\n  Elem: "${elementAttribsStr}"`);
      } else {
        return true;
      }
    }
    return false;
  }

  /**
   * @param elem {HTMLElement|Node}
   * @param matches {RegExp[]}
   * @return {boolean}
   */
  const smellsLikeMatch = (elem, matches) => {
    const elementAttribsStr = PrintNode(elem)
      .toLowerCase();
    if (elementAttribsStr?.length) {
      for (const eachMatch of matches) {
        if (eachMatch.test(elementAttribsStr)) {
          trace(`smellsLikeMatch true`, elem, eachMatch);
          return true;
        }
      }
    }
    return false;
  };


  const NEVERHIDEMATCHES       = [new RegExp(/ytp-ad-module/i), // youtube skip add
                                  new RegExp(/mgp_ccContainer/i), // pornhub cc
  ];
  const isSpecialCaseNeverHide = (elem) => {
    const neverHideElem = smellsLikeMatch(elem, NEVERHIDEMATCHES);
    if (neverHideElem) {
      trace("Don't match youtube ad-skip");
      return false;
    }
  };


  /**
   * Does NOT block ads.
   * Some specific rules where ads overlap videos and when we zoom them and
   * they permanently hide the main video.
   * Most sights do it right, but there some that don't.
   * @param elem {Node}
   */
  const smellsLikeAd = (elem) => {
    const arialabel = safeGetAttribute(elem, "aria-label");
    if (arialabel.match(/^adver/i)) {
      trace(`smellsLikeAd: matched aria-label for "adver" '${arialabel}'`);
      return true;
    }
    if (arialabel.match(/^ad-/i)) {
      trace(`smellsLikeAd: matched aria-label for "ad-" '${arialabel}'`);
      return true;
    }
    const className = safeGetAttribute(elem, "class");
    if (className.match(/^adver/i)) {
      trace(`smellsLikeAd: matched classname for "adver"? '${className}'`);
      return true;
    }
    if (className.match(/^branding/i)) {
      trace(`msmellsLikeAd: atched classname for "branding"? '${className}'`);
      return true;
    }
    const title = safeGetAttribute(elem, "title");
    if (title.match(/^adver/i)) {
      trace(`smellsLikeAd: matched title for "adver" '${title}'`);
      return true;
    }
    if (title.match(/^ad-/i)) {
      trace(`smellsLikeAd: matched title for "ad-" '${title}'`);
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
   * Used when the matched video is a <video> (vs in iframe)
   */
  const maximizeVideoDom = () => {
    if (!videomaxGlobals.matchedVideo) {
      return;
    }
    trace("maximizeVideoDom");
    maximizeUpFromVideo();
    const commonContainerElem = findCommonContainerFromMatched();
    for (const elem of commonContainerElem.children) {
      if (!isIgnoredNode(elem) && !containsAnyVideoMaxClass(elem)) {
        addOverlapCtrl(elem);
      }
    }
    // ANY siblings to the <video> should always just be considered overlapping (crunchyroll's CC
    // canvas
    if (videomaxGlobals.matchedIsHtml5Video) {
      const videoSiblings = getSiblings(videomaxGlobals.matchedVideo);
      for (const elem of videoSiblings) {
        if (!isIgnoredNode(elem) && !containsAnyVideoMaxClass(elem)) {
          addOverlapCtrl(elem);
        }
      }
    }

    let videoElem = videomaxGlobals.matchedVideo; // readability
    exceptionToRuleFixup(getOwnerDoc(videoElem), videoElem);

    if (ALWAYS_MAX_BODY) {
      document.body.classList.add(MAX_CSS_CLASS);
    }

    // add a tagging-only className to help identify the "common container" when debugging DOM
    // containerElem.classList.add(COMMON_CONTAINER_DEBUG_CLASS);
  };

  /**
   * @constructor
   */
  function ElemMatcherClass() {
    /** @type {undefined | HTMLElement | HTMLFrameElement} **/
    this.largestElem = undefined;
    /** @type {number} */
    this.largestScore = 0;
    /** @type {number} */
    this.matchCount = 0;
    /** @type {CSSStyleDeclaration | null} */
    this.matchStyle = null;
    /** @type {DomRect} */
    this.matchBoundingRect = {
      top:    0,
      left:   0,
      bottom: 0,
      width:  0,
      right:  0,
      height: 0,
    };
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

      // some sites have lots of video ads playing all over the page (NOT watch-ad-before
      // playing)
      // we don't want to match them instead of the main video. But if it's in the SAME position
      // as the main video we still want to show it.
      if (DO_NOT_MATCH_ADS && smellsLikeAd(elem)) {
        return false;
      }
      const elemStyle = getElemComputedStyle(elem);
      const score     = this._getElemMatchScore(elem, elemStyle);
      if (EMBED_SCORES) {
        safeSetAttribute(elem, EMBEDED_SCORES, score.toString());
      }

      if (score === 0) {
        return false;
      }

      if (score > this.largestScore) {
        if (BREAK_ON_BEST_MATCH) {
          debugger;
        }
        trace(`setting new best: score: ${score}, elem: `, elem);
        this.largestScore      = score;
        this.largestElem       = elem;
        this.matchCount        = 1;
        this.matchStyle        = elemStyle;
        this.matchBoundingRect = cumulativePositionRect(elem, elemStyle);
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
    };

    this.getBestMatch      = () => this.largestElem;
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
      let width  = 0;
      let height = 0;

      if (!compStyle?.width || !compStyle?.height) {
        logerr("Could NOT load computed style for element so score is zero", elem);
        return {
          width,
          height,
        };
      }

      // make sure the ratio is reasonable for a video.
      width  = safeParseFloat(compStyle.width);
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

      if (width === 0 && height === 0) {
        trace("\tWidth or height not great, skipping other checks", elem);
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

      // videos may be constrained by the iframe or window.
      const doc = getElemsDocumentView(elem);

      if (EMBED_SCORES) {
        const elemStr = PrintNode(elem);
        traceweights.push(`===========================\n${elemStr}\n`);
        traceweights.push(`START_WEIGHT: ${START_WEIGHT}`);
        traceweights.push(`  Width: ${width}  Height: ${fmtInt.format(height)}`);

        const vidRect = cumulativePositionRect(elem, compStyle);
        traceweights.push(
          `  top: ${vidRect.top}  left: ${vidRect.left}   bottom: ${vidRect.bottom}    right:${vidRect.right}`);
        traceweights.push(`  doc.outerWidth: ${doc.outerWidth} ${width * 100 / doc.outerWidth}%`);
      }
      {
        // common video sizes
        // 320x180, 320x240, 640x480, 640x360, 640x480, 640x360, 768x576, 720x405, 720x576
        const ratio         = width / height;
        // which ever is smaller is better (closer to one of the magic ratios)
        const distances     = Object.values(VIDEO_RATIOS)
          .map((v) => Math.abs(v - ratio));
        const bestRatioComp = Math.min(...distances) + 0.001; // +0.001; prevents div-by-zero

        // inverse distance
        const inverseDist = round(1.0 / bestRatioComp ** 1.15);  // was 1.25
        const videoSize   = round(Math.log2(width * height));

        weight += START_WEIGHT * inverseDist * RATIO_WEIGHT;
        weight += START_WEIGHT * videoSize * SIZE_WEIGHT; // bigger is worth more
        if (EMBED_SCORES) {
          traceweights.push(`  Distances: ${distances.map(n => fmtFlt.format(n))
            .join(",")}`);
          traceweights.push(`  inverseDist: RATIO_WEIGHT:${RATIO_WEIGHT} Weight:${fmtInt.format(
            START_WEIGHT * inverseDist * RATIO_WEIGHT)}`);
          traceweights.push(`  dimensions: SIZE_WEIGHT: ${SIZE_WEIGHT} Weight:${fmtInt.format(
            START_WEIGHT * videoSize * SIZE_WEIGHT)}`);
        }
      }

      {
        weight += START_WEIGHT * -1 * videomaxGlobals.match_counter * ORDER_WEIGHT;
        if (EMBED_SCORES) {
          traceweights.push(`  ORDER_WEIGHT: ${fmtInt.format(
            START_WEIGHT * -1 * videomaxGlobals.match_counter *
            ORDER_WEIGHT)} Order: ${videomaxGlobals.match_counter} Weight:${ORDER_WEIGHT}`);
        }
      }
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
          traceweights.push(`  ZINDEX_WEIGHT: ${ZINDEX_WEIGHT} Weight:${fmtInt.format(
            START_WEIGHT * zindex * ZINDEX_WEIGHT)}`);
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
            START_WEIGHT * HIDDEN_VIDEO_WEIGHT)} Weight:${HIDDEN_VIDEO_WEIGHT}`);
          traceweights.push(`    visibility: '${compStyle?.visibility}' ` +
                            `display: '${compStyle?.display}' opacity: '${compStyle?.opacity}'`);
        }
        weight = (START_WEIGHT * HIDDEN_VIDEO_WEIGHT);
      }

      const tabindex = safeGetAttribute(elem, "tabindex");
      if (tabindex !== "") {
        // this is a newer thing for accessibility, it's a good indicator
        if (EMBED_SCORES) {
          traceweights.push(`  TAB_INDEX_WEIGHT: ${TAB_INDEX_WEIGHT} Weight:${fmtInt.format(
            -1 & START_WEIGHT * TAB_INDEX_WEIGHT)}`);
        }
        weight += (-1 * START_WEIGHT * TAB_INDEX_WEIGHT);
      }

      const allowfullscreenAttr = safeGetAttribute(elem, "allowfullscreen");
      if (allowfullscreenAttr?.length) {
        weight += (START_WEIGHT * ALLOW_FULLSCREEN_WEIGHT);
        if (EMBED_SCORES) {
          traceweights.push(
            `  ALLOW_FULLSCREEN_WEIGHT: ${ALLOW_FULLSCREEN_WEIGHT} Weight:${fmtInt.format(
              START_WEIGHT * ALLOW_FULLSCREEN_WEIGHT)}`);
        }
      }

      // Found an html5 video tag
      if (elem.nodeName.toLowerCase() === "video") {
        /** @type {HTMLMediaElement} **/
        const videoElem = elem;
        if (EMBED_SCORES) {
          traceweights.push(
            `  VIDEO_OVER_IFRAME_WEIGHT: ${VIDEO_OVER_IFRAME_WEIGHT} Weight:${fmtInt.format(
              START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT)}`);
        }
        weight += (START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT);

        // if a video, lets see if it's actively playing
        if (videoElem.paused === false) {
          if (EMBED_SCORES) {
            traceweights.push(
              `  VIDEO_PLAYING: ${VIDEO_PLAYING_WEIGHT} Paused:${videoElem.paused} Weight:${fmtInt.format(
                START_WEIGHT * VIDEO_PLAYING_WEIGHT)}`);
          }
          weight += (START_WEIGHT * VIDEO_PLAYING_WEIGHT);
        }

        // video length
        const duration = Math.min((videoElem.duration || 0), MAX_DURATION_SECS);
        if (EMBED_SCORES) {
          traceweights.push(`  VIDEO_DURATION: ${VIDEO_DURATION_WEIGHT} Duration:${fmtFlt.format(
            duration)}s Weight:${fmtFlt.format(START_WEIGHT * VIDEO_DURATION_WEIGHT * duration)}`);
        }
        weight += (START_WEIGHT * VIDEO_DURATION_WEIGHT * duration);

        // looping
        if (videoElem.loop === false) {
          if (EMBED_SCORES) {
            traceweights.push(
              `  VIDEO_NO_LOOP_WEIGHT:${VIDEO_NO_LOOP_WEIGHT} loop:${videoElem.loop} weight: ${fmtInt.format(
                START_WEIGHT * VIDEO_NO_LOOP_WEIGHT)}`);
          }
          weight += (START_WEIGHT * VIDEO_NO_LOOP_WEIGHT);
        }

        // has audio
        if (videoElem.muted === false) {
          if (EMBED_SCORES) {
            traceweights.push(
              `  VIDEO_HAS_SOUND_WEIGHT:${VIDEO_HAS_SOUND_WEIGHT} muted:${videoElem.muted}  weight: ${fmtInt.format(
                START_WEIGHT * VIDEO_HAS_SOUND_WEIGHT)}`);
          }
          weight += (START_WEIGHT * VIDEO_HAS_SOUND_WEIGHT);
        }
      }

      if (!isRunningInIFrame()) {
        if (EMBED_SCORES) {
          traceweights.push(
            `  MAIN_FRAME_WEIGHT (running in main) MAIN_FRAME_WEIGHT:${MAIN_FRAME_WEIGHT}  weight: ${fmtInt.format(
              START_WEIGHT * MAIN_FRAME_WEIGHT)} `);
        }
        weight += (START_WEIGHT * MAIN_FRAME_WEIGHT);
      }

      // does the video source url look kinda close to the page url?
      if (USE_URL_OVERLAP_WEIGHT) {
        try {
          const pageUrl = (window.location.toString() !== window.parent.location.toString()) ?
                          document.referrer :
                          document.location.href;
          if (pageUrl?.length &&
              (pageUrl.startsWith("https://") || pageUrl.startsWith("blob:https://"))) {
            // no see if we can get this video's source.
            const elemUrl = elem?.src || "";
            if (elemUrl.length &&
                (elemUrl.startsWith("https://") || elemUrl.startsWith("blob:https://"))) {
              const pageParts    = splitUrlWords(pageUrl);
              const urlParts     = splitUrlWords(elemUrl);
              const overlapCount = getOverlapCount(pageParts, urlParts);
              const count        = Math.max(1, pageParts.length);
              const avgCount     = (count + count) / 2.0;
              const overlapRatio = overlapCount / avgCount;
              if (EMBED_SCORES) {
                traceweights.push(
                  `  URL_OVERLAP_WEIGHT: ${URL_OVERLAP_WEIGHT} Count:${overlapCount} OverlapRatio:${fmtFlt.format(
                    overlapRatio)} Weight:${fmtInt.format(
                    START_WEIGHT * URL_OVERLAP_WEIGHT * overlapRatio)}`);
              }
              weight += (START_WEIGHT * URL_OVERLAP_WEIGHT * overlapRatio);

              const negOverlapCount = getOverlapCount(["disqus"], urlParts);
              if (EMBED_SCORES) {
                traceweights.push(
                  `  URL_OVERLAP_WEIGHT (neg): -${URL_OVERLAP_WEIGHT} Count:${negOverlapCount} Weight:-${fmtInt.format(
                    START_WEIGHT * URL_OVERLAP_WEIGHT * negOverlapCount)}`);
              }
              weight -= (START_WEIGHT * URL_OVERLAP_WEIGHT * negOverlapCount);
            }
          }
        } catch (err) {
          // iframes can throw when you try to read their url, just keep going and ignore
          trace("USE_URL_OVERLAP_WEIGHT failed because of security block");
        }
      }

      if (USE_TITLE_OVERLAP_WEIGHT) {
        try {
          const titleParts   = splitUrlWords(window.document?.title.toLowerCase() || "");
          const elemParts    = splitUrlWords(PrintNode(elem)
            .toLowerCase());
          const overlap      = getOverlapCount(titleParts, elemParts);
          const overlapRatio = overlap / titleParts.length;
          if (EMBED_SCORES) {
            traceweights.push(
              `USE_TITLE_OVERLAP_WEIGHT: ${USE_TITLE_OVERLAP_WEIGHT} Count:${overlap} OverlapRatio:${fmtFlt.format(
                overlapRatio)} weight: ${fmtFlt.format(
                START_WEIGHT * TITLE_OVERLAP_WEIGHT * overlapRatio)}`);
          }
          weight += (START_WEIGHT * TITLE_OVERLAP_WEIGHT * overlapRatio);
        } catch (err) {
          logerr(err);
        }
      }

      weight = Math.round(weight);
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
    for (const eachtag of ALWAYS_HIDE_NODES) {
      const elems = doc.getElementsByTagName(eachtag);
      for (const elem of elems) {
        trace(`ALWAYS_HIDE_NODES "${eachtag}"`, elem);
        hideNode(elem);
      }
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
    let count              = allElementsToFix.length;
    // that matches PREFIX_CSS_CLASS_PREP
    for (const eachElem of allElementsToFix) {
      try {
        // we are generically mapping "videomax-ext-prep-*" to videomax-ext-*"
        const subFrom            = [];
        const subTo              = [];
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
          if (FLIP_STYLE_ATOMICALLY) {
            if (subFrom.includes(MAX_CSS_CLASS)) {
              if (saveAttribute(eachElem, "style")) { // save
                safeSetAttribute(eachElem, "style", ""); // clear
              }
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
   * @return {number};
   */
  const recursiveIFrameFlipClassPrep = (doc) => {
    try {
      if (window._videomax_unzooming) {
        trace("UNZOOMING!!! - skipping recursiveIFrameFlipClassPrep");
        return 0;
      }
      flipCssRemovePrep(doc);

      if (typeof (doc?.querySelectorAll) !== "function") {
        // security can block
        return 0;
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
          // probably iframe boundary security related
        }
      }
    } catch (err) {
      // probably security related
    }
  };

  const fixUpPageZoom = () => {
    if (!documentLoaded()) {
      return false;
    }
    if (videomaxGlobals.tagonly) {
      return false;
    }
    if (window._videomax_unzooming) {
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
    const doRehideTimeoutLoop = () => {
      let rehideCount = 0;
      try {
        maximizeUpFromVideo();
        alwaysHideSomeElements();
        if (videomaxGlobals.matchedCommonCntl) {
          videomaxGlobals.matchedCommonCntl?.classList?.add(MARKER_COMMON_CONTAINER_CLASS);
        }

        rehideCount = rehideUpFromVideo();
        recursiveIFrameFlipClassPrep(document);
        recursiveIFrameFlipClassPrep(getTopElemNode());
      } catch (err) {
        console.log(err);
      }
      if (REHIDE_RETRY_UNTIL_NONE && rehideCount !== 0) {
        trace("Retrying rehide until no more matches. 1000ms");
        setTimeout(() => doRehideTimeoutLoop(), 1000);
      }
    };

    doRehideTimeoutLoop();
    return true; // stop retrying
  };

  const postFixUpPageZoom = () => {
    // some sites (mba) position a full sized overlay that needs to be centered.
    if (!isRunningInIFrame() && videomaxGlobals.matchedIsHtml5Video &&
        videomaxGlobals.matchedCommonCntl) {
      addClassObserverOnCommonCntl(videomaxGlobals.matchedCommonCntl);
      //   // see if the container is at the op
      //   const matches = document.elementsFromPoint(document.width , videoCoor.top + 1);
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
          videomaxGlobals.unzooming   = true;
          if (window._VideoMaxExt?.matchedVideo) {
            if (window._VideoMaxExt.matchedVideo.playbackRate) {
              window._VideoMaxExt.matchedVideo.playbackRate = 1.0;
            }
          }
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

    if (SCROLL_TO_VIDEO) {
      // this can triggers a hover event that shows the playback controls
      // which need to be visible to recognize them correctly
      bestMatch?.scrollIntoView({
        block:  "center",
        inline: "center",
      });


      // mark it with a class.
      tagElementAsMatchedVideo(bestMatch);

      const bestMatchCount = videomaxGlobals.elementMatcher.getBestMatchCount();
      if (bestMatchCount > 1) {
        trace(`FOUND TOO MANY VIDEOS ON PAGE? #${bestMatchCount}`);
        if (DEBUG_ENABLED) {
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
    }

    // this timer will hide everything
    if (videomaxGlobals.tagonly) {
      recursiveIFrameFlipClassPrep(document);
      recursiveIFrameFlipClassPrep(getTopElemNode());
      trace("Tag only is set. Will not modify page to zoom video");
    } else {
      videomaxGlobals.hideEverythingTimer?.startTimer(() => {
        // BBC has some special css with lots of !importants
        hideCSS("screen-css");
        if (!fixUpPageZoom()) {
          return false;
        }

        if (!reinstall) {
          // with no element parameter, then the whole doc is "touched"
          forceRefresh();
        } else {
          forceRefresh(videomaxGlobals.matchedVideo);
          forceRefresh(videomaxGlobals.match);
        }

        postFixUpPageZoom();

        videomaxGlobals.isMaximized = true;
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
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_DOCUMENT, isVisibleWalkerElem);

    videomaxGlobals.elementMatcher = new ElemMatcherClass();

    if (!tagonly) {
      videomaxGlobals.hideEverythingTimer = new RetryTimeoutClass("hideEverythingTimer", 250,
        retries);
      // don't start there, do it from doZoomPage()
    }

    videomaxGlobals.tagonly             = tagonly;
    videomaxGlobals.findVideoRetryTimer = new RetryTimeoutClass("doZoomPage", 500, retries);
    videomaxGlobals.findVideoRetryTimer.startTimer(doZoomPage);
  }

  const removeClassObserver = () => {
    if (videomaxGlobals.observerClassMod) {
      videomaxGlobals.observerClassMod.disconnect();
      videomaxGlobals.observerClassMod = null;
    }
  };

  const OBSERVE_ATTRIB_OPTIONS = {
    attributes:        true,
    attributeFilter:   ["class"],
    attributeOldValue: true,
    childList:         false,
    subtree:           true,
  };

  const addClassObserverOnCommonCntl = () => {
    const topElem = videomaxGlobals.matchedCommonCntl.parentNode;
    if (videomaxGlobals.observerClassMod || !topElem || !USE_MUTATION_OBSERVER_ATTR) {
      return;
    }

    videomaxGlobals.observerClassMod = new MutationObserver((mutations, observer) => {
      // called when change happens. first disconnect to avoid recursions
      observer.disconnect();
      // check to see if things are in the process of going away. They might be.
      if (videomaxGlobals.observerClassMod && videomaxGlobals.isMaximized) {
        for (let eachMutation of mutations) {
          if (eachMutation.type !== "attributes") {
            continue;
          }

          // is one of our classnames on the old value?
          if (!(eachMutation?.oldValue?.indexOf(PREFIX_CSS_CLASS) >= 0)) {
            // nope
            continue;
          }
          // our classname was there, but it's removed?
          const newClassName = eachMutation.target?.getAttribute("class") || "";
          if (newClassName.indexOf(PREFIX_CSS_CLASS) !== -1) {
            // nope
            continue;
          }

          // if we reach here then our classname was removed
          const oldClassNames = eachMutation.oldValue.split(" ");
          // figure out what classnames were removed and re-add it.
          for (let eachClassname of oldClassNames) {
            if (eachClassname.startsWith(PREFIX_CSS_CLASS)) {
              trace(`OBSERVER: detected classname changes, reappling "eachMutation" to element:`,
                eachMutation.target);
              eachMutation.target?.classList?.add(eachClassname);
            }
          }
        }
      }
      observer.observe(topElem, OBSERVE_ATTRIB_OPTIONS);
    });
    videomaxGlobals.observerClassMod.observe(topElem, OBSERVE_ATTRIB_OPTIONS);
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
        const remove             = [];
        const allClassNameOnElem = Object.values(elem.classList) || [];
        for (const eachClassName of allClassNameOnElem) {
          if (eachClassName.startsWith(PREFIX_CSS_CLASS)) {
            remove.push(eachClassName);
          }
        }
        elem.classList.remove(...remove);
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
      for (const elem of doc.querySelectorAll(`[${VIDEO_MAX_DATA_ATTRIB_UNDO}]`)) {
        try {
          restoreSavedAttribute(elem);
          //  try and make the element realizes it needs to redraw. Fixes
          // progress bar
          elem.dispatchEvent(new Event("resize"));
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
        videomaxGlobals.unzooming     = true;
        videomaxGlobals.isMaximized   = false;
        videomaxGlobals.playbackSpeed = 1.0;

        if (videomaxGlobals.matchedVideo) {
          updateEventListeners(videomaxGlobals.matchedVideo, true);
        }
        removeClassObserver();
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
            debugger;
          }

          if (videomaxGlobals.matchedVideo?.ownerDocument &&
              typeof (videomaxGlobals.matchedVideo.ownerDocument) === "function") {
            const notRemoved2 = videomaxGlobals?.matchedVideo?.ownerDocument.querySelectorAll(
              `[class*="${PREFIX_CSS_CLASS}"]`);
            if (notRemoved2.length) {
              // undo didn't remove all "videomax-ext" classes from document where video was found
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
  window.videmax_cmd   = ""; // clear it.
  document.videmax_cmd = "";
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("videomax extension error", err, err.stack);
}
