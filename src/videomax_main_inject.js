try { // scope and prevent errors from leaking out to page.
  const FULL_DEBUG          = true;
  const DEBUG_ENABLED       = FULL_DEBUG;
  const TRACE_ENABLED       = FULL_DEBUG;
  const ERR_BREAK_ENABLED   = FULL_DEBUG;
  const BREAK_ON_BEST_MATCH = false;

  // this will put add the score as an attribute for
  // elements across revisions, the zoomed page's html can
  // be diffed. This is for debugging and unit testing.
  const EMBED_SCORES = true;

  // experiments - keep these settings to regress check if various fixes for one site
  // breaks another site. Eventually, these can go away as we verify no adverse interactions with
  // more obscure sites.
  const RUN_OLD_VIDEO_MATCH                = true; // no longer needed with security enhancements
  const DO_NOT_MATCH_ADS                   = true;
  const OBSERVER_DIV_REAPPLY               = false;
  const OBSERVER_CLASSES_REAPPLY           = false;
  const FIX_UP_STYLES_ON_PLAYBACK_CNTLS    = false;
  const SKIP_REHIDE                        = false;
  const ALWAYS_MAX_BODY                    = true;
  const SCROLL_TO_VIDEO                    = true;
  const STOP_NODE_DISABLE                  = true;
  const PLAY_CNTL_SMELL                    = true;
  const NO_REHIDE_HIDDEN_CNTL              = false;
  const FALLBACK_SEARCH_FOR_PLAYBACk_CNTLS = true;
  const NO_NESTED_PLAYBACK_CNTLS           = true;
  const REHIDE_RETRY_UNTIL_NONE            = true; // tictok popups


  // when walking dom how many levels up to check when looking for controls?
  // too low and we miss some playback position controls (vimeo)
  // too high an we find non-controls like ads
  const CHECK_PARENTS_LEVELS_UP_MAX = 6;

  const START_WEIGHT             = 1000;
  const RATIO_WEIGHT             = 0.25;
  const SIZE_WEIGHT              = 5.0;
  const ORDER_WEIGHT             = 10.0;
  const TAB_INDEX_WEIGHT         = 6.0;
  const VIDEO_OVER_IFRAME_WEIGHT = 2000.0;
  const HIDDEN_VIDEO_WEIGHT      = -10; // downgrades
  const ZINDEX_WEIGHT            = 0.5;
  const MAIN_FRAME_WEIGHT        = 5.0;
  const VIDEO_PLAYING_WEIGHT     = 10.0;
  const VIDEO_DURATION_WEIGHT    = 10.0;
  const MAX_DURATION_SECS        = 60 * 60 * 2; // 2hrs - live videos skew results
  const VIDEO_NO_LOOP_WEIGHT     = 1.0;
  const VIDEO_HAS_SOUND_WEIGHT   = 10.0;

  // used to save off attributes that are modified on iframes/flash
  const VIDEO_MAX_DATA_ATTRIB_UNDO = "data-videomax-saved";

  // found element <... data-videomax-target="zoomed-video">
  // also see class="... videomax-ext-video-matched ..."
  const VIDEO_MAX_ATTRIB_FIND = "data-videomax-target";
  const VIDEO_MAX_ATTRIB_ID   = "zoomed-video";

  // debug scores <... data-videomax-weights="#" >
  const VIDEO_MAX_EMBEDDED_SCORE_ATTR = "data-videomax-weights";

  // smp-toucan-player is some random bbc player
  const VIDEO_NODES       = ["object", "embed", "video", "iframe", "smp-toucan-player"];
  const ALWAYS_HIDE_NODES = ["footer", "header"];  // aside needed for 9anime
  const STOP_NODES        = ["head", "body", "html"];  // stop when walking up parents
  const STOP_NODES_FRAME  = ["head", "body", "html", "frame", "iframe"];  // stop when walking up
  const AVOID_ZOOMING     = ["a"];  // can be hidden but NEVER a control or video
  const IGNORE_NODES      = ["noscript", "script", "head", "html", "link"];
  const IGNORE_CNTL_NODES = [...IGNORE_NODES, ...STOP_NODES_FRAME];

  const CSS_STYLE_HEADER_ID = "maximizier-css-inject";

  // we use the prop class then flip all the classes at the end.
  // The reason for this is that the clientRect can get confused on rezoom if
  //     the background page couldn't inject the css as a header.
  const PREFIX_CSS_CLASS             = "videomax-ext";
  const PREFIX_CSS_CLASS_PREP        = "videomax-ext-prep";
  // adding ANY new elements should be added to inject_undo
  const OVERLAP_CSS_CLASS            = `${PREFIX_CSS_CLASS_PREP}-overlap`;
  const HIDDEN_CSS_CLASS             = `${PREFIX_CSS_CLASS_PREP}-hide`;
  const MAX_CSS_CLASS                = `${PREFIX_CSS_CLASS_PREP}-max`;
  const PLAYBACK_CNTLS_CSS_CLASS     = `${PREFIX_CSS_CLASS_PREP}-playback-controls`;
  const PLAYBACK_VIDEO_MATCHED_CLASS = `${PREFIX_CSS_CLASS_PREP}-video-matched`;
  const EMBEDED_SCORES               = `${PREFIX_CSS_CLASS_PREP}-scores`;
  const REHIDE_DEBUG_CSS_CLASS       = `${PREFIX_CSS_CLASS_PREP}-rehide`;

  // eslint-disable-next-line no-unused-vars
  const ALL_CLASSNAMES_TO_REMOVE = [OVERLAP_CSS_CLASS, // -prop-
                                    `${PREFIX_CSS_CLASS}-overlap`,
                                    HIDDEN_CSS_CLASS,
                                    `${PREFIX_CSS_CLASS}-hide`,
                                    MAX_CSS_CLASS,
                                    `${PREFIX_CSS_CLASS}-max`,
                                    PLAYBACK_CNTLS_CSS_CLASS,
                                    `${PREFIX_CSS_CLASS}-playback-controls`,
                                    PLAYBACK_VIDEO_MATCHED_CLASS,
                                    `${PREFIX_CSS_CLASS}-video-matched`,
                                    EMBEDED_SCORES,
                                    `${PREFIX_CSS_CLASS}-scores`,
                                    REHIDE_DEBUG_CSS_CLASS, // debug only
  ];

  //  const SPEED_CONTROLS     = `${PREFIX_CSS_CLASS}-speed-control`;
  const SCALESTRING_WIDTH  = "100%"; // "calc(100vw)";
  const SCALESTRING_HEIGHT = "100%"; // "calc(100vh)";
  const SCALESTRING        = "100%";

  const OBSERVE_ATTRIB_OPTIONS = {
    attributes:      true,
    attributeFilter: ["class"],
    childList:       true,
    subtree:         true,
  };

  // const videomaxGlobals = window._VideoMaxExt ? window._VideoMaxExt : {
  const videomaxGlobals = {
    elemMatcher:      null,
    foundOverlapping: false,
    /** @var {HTMLElement | Node} */
    matchedVideo: null,
    /** @var {boolean} */
    matchedIsHtml5Video: false,
    /** @var {MutationObserver} */
    observerDomMod: null,
    /** @var {MutationObserver} */
    observerClassMod: null,

    injectedCss: false,
    cssToInject: "",

    /** @var {RetryTimeoutClass} */
    findVideoRetryTimer: null,
    /** @var {RetryTimeoutClass} */
    hideEverythingTimer: null,

    isMaximized: false,

    tagonly: false,

    match_counter: 0,
  };

  const runningInIFrame = () => window !== window?.parent;

  const logerr = (...args) => {
    if (DEBUG_ENABLED === false) {
      return;
    }
    const inIFrame = runningInIFrame() ? "iframe" : "main";
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
    const inIFrame = runningInIFrame() ? "iframe" : "main";
    // blue color , no break
    // eslint-disable-next-line no-console
    console.log(`%c VideoMax ${inIFrame}`,
      "color: white; font-weight: bold; background-color: blue", ...args);
  };

  // const sliceFn = [].slice; // used to shallow copy params
  //
  // /** @type {DebounceMap} */
  // const data = {}; // mapping of function name to data
  //
  // const debounce=(fn, interval) => {
  //   const fnName = fn?.name; // we keep a global map for each function
  //   if (data[fnName] === undefined) {
  //     // if entry doesn't exist create it
  //     data[fnName] = {
  //       timeoutId: 0,
  //       isRunning: false,
  //       nextArgs: []
  //     }
  //   }
  //   return function() {
  //     const args = sliceFn.call(arguments); // copy params
  //     args.push(function() {
  //       data[fnName].isRunning = false;
  //       if (data[fnName].nextArgs) {
  //         run(data[fnName].nextArgs);
  //         data[fnName].nextArgs = null;
  //       }
  //     });
  //
  //     if (data[fnName].isRunning) {
  //       data[fnName].nextArgs = args;
  //       return data[fnName].nextArgs;
  //     }
  //     if (data[fnName].timeoutId) {
  //       clearTimeout(data[fnName].timeoutId);
  //     }
  //
  //     data[fnName].timeoutId = setTimeout(function() {
  //       run(data[fnName].nextArgs);
  //       data[fnName].timeoutId = null;
  //     }, interval);
  //
  //     function run(args) {
  //       fn.apply(null, args);
  //       data[fnName].isRunning = true;
  //     }
  //   }
  // };


  /**
   * We want to SAVE these results somewhere that automated unit tests can e
   * asily extract the scores to measure changes across revisions
   * append it to the attribute data-videomax-weights
   * @param newStr {string}
   */
  const appendUnitTestResultInfo = (newStr) => {
    if (!EMBED_SCORES) {
      return;
    }
    try {
      if (runningInIFrame()) {
        return;
      }

      // const startingAttr = window.document.body.parentNode.getAttribute(
      //   VIDEO_MAX_EMBEDDED_SCORE_ATTR) || "";
      // window.document.body.parentNode.setAttribute(VIDEO_MAX_EMBEDDED_SCORE_ATTR,
      //   [startingAttr, newStr].join("\n\n"));
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
      return result.substring(0, 1024);// don't allow it to be too big.
    } catch (err) {
      return " - ";
    }
  };

  /**
   * @param strMessage {string}
   * @param strSelector {string}
   */
  const appendSelectorItemsToResultInfo = (strMessage, strSelector) => {
    const results = [strMessage];
    const matches = document.querySelectorAll(strSelector);
    for (let match of matches) {
      results.push(PrintNode(match));
    }
    appendUnitTestResultInfo(`${results.join(`\n`)}\n`);
  };

  const removeObservers = () => {
    if (videomaxGlobals.observerDomMod) {
      videomaxGlobals.observerDomMod.disconnect();
      videomaxGlobals.observerDomMod = null;
    }
    if (videomaxGlobals.observerClassMod) {
      videomaxGlobals.observerClassMod.disconnect();
      videomaxGlobals.observerClassMod = null;
    }
  };

  const clearResultInfo = () => {
    try {
      window.document.body.parentNode.setAttribute(VIDEO_MAX_EMBEDDED_SCORE_ATTR, "");
    } catch (err) {
      trace(err);
    }
  };

  const documentLoaded = () => ["complete", "interactive"].includes(document.readyState);

  /**
   * Node does not have getAttributes or classList. Elements do
   * @param nodeOrElem {Node || HTMLElement}
   * @return {boolean}
   */
  const isElem = (nodeOrElem) => (nodeOrElem instanceof HTMLElement);
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
      if (elem && elem.setAttribute) {
        elem.setAttribute(attr, value);
      }
    } catch (err) {
      logerr(`error setting attribute ${attr}`, elem, err);
    }
  };


  /**
   *
   * @param elem {Node}
   * @param stopAtFrame {boolean}
   * @returns {boolean}
   */
  const isStopNodeType = (elem, stopAtFrame = true) => {
    if (STOP_NODE_DISABLE) {
      return false;
    }
    const nodeType = elem?.nodeName?.toLowerCase() || "";
    // if (stopAtFrame) { return STOP_NODES_FRAME.includes(nodeType); }
    return STOP_NODES.includes(nodeType);
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
        for (let eachvido of allvideos) {
          videomaxGlobals.elementMatcher.checkIfBest(eachvido);
        }
      }
      // now go into frames
      const frames = doc.querySelectorAll("iframe");
      for (let frame of frames) {
        try {
          videomaxGlobals.elementMatcher.checkIfBest(frame);

          const allvideos = frame?.contentWindow?.document.querySelectorAll("video");
          for (let eachvido of allvideos) {
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

      return (videomaxGlobals.elementMatcher.getBestMatchCount() > 0);
    } catch (err) {
      trace(err);
      return false;
    }
  };

  /**
   * returns true if a new video match was found.
   * @param doc {HTMLDocument}
   * @return {boolean}
   */
  const checkVidsInDoc = (doc) => {
    if (!doc) {
      return false;
    }
    let matchedNew = false;
    for (let tagname of VIDEO_NODES.reverse()) {
      try {
        const elemSearch = [...doc.getElementsByTagName(tagname)];
        if (elemSearch) {
          for (let eachElem of elemSearch) { // .reverse()
            matchedNew |= videomaxGlobals.elementMatcher.checkIfBest(eachElem);
          }
        }
      } catch (err) {
        logerr(err);
      }
    }
    return matchedNew;
  };

  /**
   *
   * @param node {Node || HTMLElement}
   * @return {Window}
   */
  const getElemsDocumentView = (node) => {
    // this can probably be simplified
    if (node.ownerDocument !== null && node.ownerDocument !== document &&
        node.ownerDocument.defaultView !== null) {
      return node.ownerDocument.defaultView;
    }
    return document.defaultView;
  };

  /**
   *
   * @param node {Node || HTMLElement}
   * @returns {CSSStyleDeclaration}
   */
  function getElemComputedStyle(node) {
    const view = getElemsDocumentView(node);
    return view.getComputedStyle(node, null);
  }

  /**
   * checks if item is hidden or visible
   * @param node {Node || HTMLElement}
   * @return {boolean}
   */
  function isElementHidden(node) {
    if (!isElem(node)) {
      return true;
    }
    const compstyle = getElemComputedStyle(node);

    // make sure the ratio is reasonable for a video.
    return (safeParseInt(compstyle?.width) === 0 || safeParseInt(compstyle?.height) === 0);
  }

  /**
   * @param rect {Rect}
   * @return {boolean}
   */
  function isEmptyRect(rect) {
    return (rect.width === 0 && rect.width === 0);
  }

  /**
   * @param str {string}
   * @return {number|number}
   */
  function safeParseInt(str) {
    const result = parseInt(str, 10);
    return Number.isNaN(result) ? 0 : result;
  }

  /**
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function isIgnoredNode(elem) {
    return IGNORE_NODES.includes(elem?.nodeName?.toLowerCase() || "");
  }

  /**
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function isIngoredCntlNode(elem) {
    return IGNORE_CNTL_NODES.includes(elem?.nodeName?.toLowerCase() || "");
  }

  /**
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function IsAlwaysHideNode(elem) {
    return ALWAYS_HIDE_NODES.includes(elem?.nodeName?.toLowerCase() || "");
  }

  /**
   * skip-ads button we want to keep.
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function isOnlyHide(elem) {
    const isLink = AVOID_ZOOMING.includes(elem?.nodeName?.toLowerCase() || "");
    return isLink;
  }

  /**
   *
   * @param optionalElem {Node || HTMLElement || undefined}
   */
  function forceRefresh(optionalElem) {
    // we now need to force the flash to reload by resizing... easy thing is to
    // adjust the body
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("visabilitychange"));
      if (optionalElem) {
        optionalElem?.dispatchEvent(new Event("visabilitychange"));
      } else {
        // touchDocBodyToTriggerUpdate();
      }
    }, 50);
  }

  /**
   * we going to work our way up looking for some element that
   * has a bunch of children but few siblings.
   * We're only going to search up 6 elements, then give up.
   * @param elem {HTMLElement}
   * @return {Node || HTMLElement}
   */
  function findCommonContainerFromElem(elem) {
    let bestMatch = elem;
    let bestRatio = 1;

    let checkParents = CHECK_PARENTS_LEVELS_UP_MAX;
    while (elem?.parentElement && checkParents-- && !isStopNodeType(elem)) {
      const siblingCount  = elem.parentElement.children.length; // always at least 1.
      const childrenCount = elem.children.length;
      // Idea: could search class for "container" and increase that score
      // so the more children vs siblings is better match
      const matchRatio = childrenCount / siblingCount;
      if (matchRatio > bestRatio) {
        bestRatio = matchRatio;
        bestMatch = elem;
      }
      elem = elem.parentElement;
    }
    return bestMatch;
  }

  /**
   * Start at child and to up parent until it matches.
   * Used to show hidden video playback bar on some sites that get
   * missed by other techniques
   * @param topElem {HTMLElement}
   * @param childElem {HTMLElement}
   * @param classToAdd {string}
   */
  function replaceVideoMaxClassInTree(topElem, childElem, classToAdd) {
    let checkParents = CHECK_PARENTS_LEVELS_UP_MAX;
    let elem         = childElem;
    while (!elem.isSameNode(topElem) && checkParents--) {
      elem.classList.add(classToAdd);
      elem.classList.remove(HIDDEN_CSS_CLASS);
      elem = elem.parentElement;
    }
  }

  /**
   * @param childElem {HTMLElement}
   * @param ancestorElem {HTMLElement}
   * @return {boolean}
   */
  function isADecendantElem(childElem, ancestorElem) {
    let checkParents = 100;
    let elem         = childElem;
    while (elem.parentElement && checkParents-- && !isStopNodeType(elem)) {
      if (elem === ancestorElem) {
        return true;
      }
      elem = elem.parentElement;
    }
    return false;
  }

  /**
   *
   * @param childElem {HTMLElement}
   * @return {boolean}
   */
  function anyParentsAlreadyPlayback(childElem) {
    let checkParents = 100;
    let elem         = childElem;
    while (elem.parentElement && checkParents-- && !isStopNodeType(elem)) {
      const match = elem.classList?.contains(PLAYBACK_CNTLS_CSS_CLASS) ||
                    elem.classList?.contains(`${PREFIX_CSS_CLASS}-playback-controls`) || false;
      if (match) {
        trace("anyParentsAlreadyPlayback is True", childElem);
        return true;
      }
      elem = elem.parentElement;
    }
    return false;
  }


  /**
   *
   * @param elem {HTMLElement}
   * @return {HTMLElement}
   */
  function getTopmostElem(elem) {
    let lastmatch = elem;
    for (var safetyloop = 0; safetyloop < 500; safetyloop++) {
      if (isStopNodeType(elem)) {
        return lastmatch;
      }
      lastmatch = elem;
      elem      = elem.parentElement;
    }
  }

  /**
   * hiding elements in dom that aren't in tree for this element.
   * @param videoElem {Node}
   */
  function maximizeVideoDom(videoElem) {
    if (!videoElem) {
      return;
    }
    trace("maximizeVideoDom");

    const containerElem      = findCommonContainerFromElem(videoElem);
    // let compstyle = getElemComputedStyle(videoElem); // used to resize divs
    const elemForBindingRect = shouldUseContainerDivForDockedCheckYoutube(videoElem) ?
                               containerElem :
                               videoElem;
    const boundingVidRect    = getBoundingClientRectWhole(elemForBindingRect);

    let saftyLoops = 1000;
    let elemUp     = videoElem;
    while (elemUp?.parentNode && saftyLoops--) {
      try {
        siblingsCheckHideOrPlaybackCntls(elemUp, boundingVidRect, containerElem);
        // as we go up, we mark all the parents maximized
        addMaximizeClassToElem(elemUp);
      } catch (ex) {
        logerr("maximizeVideoDom exception", ex);
      }
      elemUp = elemUp.parentNode;
    }
    if (DEBUG_ENABLED && saftyLoops === 0) {
      logerr("*** maximizeVideoDom while loop ran too long ***");
    }

    if (FALLBACK_SEARCH_FOR_PLAYBACk_CNTLS) {
      // see if we've tagged an element as a playback control
      const currentDoc = videoElem.ownerDocument;
      if (((currentDoc.querySelectorAll(`.${PLAYBACK_CNTLS_CSS_CLASS}`)?.length || 0) !== 0)) {
        trace(`====\nDid NOT find playback controls - searching for sliders\n====`);
        // this is a VERY basic fallback.
        for (let eachslider of containerElem.querySelectorAll("[role=\"slider\"]")) {
          // volumes are sliders too. English specific term search isn't great
          if (eachslider.className.toLowerCase()
                .indexOf("volume") === -1) {
            replaceVideoMaxClassInTree(containerElem, eachslider, PLAYBACK_CNTLS_CSS_CLASS);
          } else {
            trace("Possible volume slider, skipping");
          }
        }
      }

      const allPlaybackControls = currentDoc.querySelectorAll(`.${PLAYBACK_CNTLS_CSS_CLASS}`);
      if (FIX_UP_STYLES_ON_PLAYBACK_CNTLS && allPlaybackControls?.length) {
        // we're going to remove the style= attributes
        for (let eachPlaybackCntlElem of allPlaybackControls) {
          saveAttribute(eachPlaybackCntlElem, "style");
          // clearing causes the audio volume control to display.
          safeSetAttribute(eachPlaybackCntlElem, "style", "");
        }
      } else {
        // some sites (pluto.tv) have full width controls but the video is not full width, so the
        // slider doesn't fit inside the video
        trace(`====\nSTILL did NOT find playback controls - searching for larger\n====`);
      }
    }

    if (ALWAYS_MAX_BODY) {
      document.body.classList.add(MAX_CSS_CLASS);
    }
  }

  /**
   * @param doc {HTMLDocument}
   * @param iframeTree {HTMLCollectionOf<HTMLElement>}
   * @param level {number}
   * @return {boolean}
   */
  function findLargestVideoOld(doc, iframeTree, level = 0) {
    if (iframeTree.length > 8) {
      trace(`hit max iframe depth, returning ${iframeTree.length}`);
      return false;
    }
    if (typeof (doc?.getElementsByTagName) !== "function") {
      trace("getElementsByTagName is not function for sub doc, bailing", doc);
      return false;
    }
    trace(`findLargestVideoOld Depth: ${level} length: ${iframeTree.length}`);

    checkVidsInDoc(doc);

    try {
      const iframes     = [...doc.getElementsByTagName("iframe")];
      let foundnewmatch = false;
      for (let eachframe of iframes) {
        try {
          foundnewmatch = checkVidsInDoc(eachframe.contentDocument);
          if (foundnewmatch) {
            trace("found a good video match in an iframe, stopping search");
            iframeTree.push(eachframe);
            videomaxGlobals.elementMatcher.setNestedFrameTree(iframeTree);
            // we found a good match, just return?
            // trace("returning from findLargestVideoOld level:" +
            // iframeTree.length);
          } else {
            /// / recursive nesting!!!
            // many sites (e.g. bing video search) buries frames inside of
            // frames
            trace("found nested iframes, going deeper");
            const deeper_iframe = arrayClone(iframeTree);
            deeper_iframe.push(eachframe);
            if (findLargestVideoOld(foundnewmatch, deeper_iframe, level + 1)) {
              trace(
                `  returning from findLargestVideoOld Depth: ${level} length: ${iframeTree.length}`);
              return true;
            }
          }
        } catch (ex) {
          // common exception because iframes can be protected if
          // they cross domains
          trace("security exception expected: ", ex);
        }

        if (!foundnewmatch) {
          try {
            foundnewmatch = videomaxGlobals.elementMatcher.checkIfBest(eachframe);
            if (foundnewmatch) {
              trace(`  Found iframe correct ratio. cannot go deeper because of XSS. 
                               Depth: ${level}
                               Length: ${iframeTree.length + 1}
                               frame`, eachframe);
              iframeTree.push(eachframe);
              videomaxGlobals.elementMatcher.setNestedFrameTree(iframeTree);
              return true; // new
            }
            // }
          } catch (ex) {
            trace("findLargestVideoOld exception in loop", ex);
          }
        }
      }
    } catch (ex) {
      // probably a security exception for trying to access frames.
      logerr("findLargestVideoOld. probably security issue", ex);
    }
    trace(`returning from findLargestVideoOld Depth: ${iframeTree.length}`);
    return false;
  }

  /**
   * @param elem {HTMLElement}
   */
  function tagElementAsMatch(elem) {
    // set the data-videomax-id = "zoomed" so undo can find it.
    safeSetAttribute(elem, `${VIDEO_MAX_ATTRIB_FIND}`, VIDEO_MAX_ATTRIB_ID);
    elem?.classList?.add(PLAYBACK_VIDEO_MATCHED_CLASS, MAX_CSS_CLASS);
  }

  /**
   *
   * @param node {Node || HTMLElement}
   * @return {Node}
   */
  function FixUpAttribs(node) {
    trace(`FixUpAttribs for elem type ${node.nodeName}`, node);

    // this may not be an Element, but we still want to walk children below
    if (isElem(node)) {
      tagElementAsMatch(node);
      const attribs = node.attributes;

      trace(`attrib count = ${attribs.length}`);
      for (let eachattrib of attribs) {
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
              newValue = newValue.replace(/width[\s]*:[\s]*[^;&]+/i, `width: ${SCALESTRING_WIDTH}`);
              newValue = newValue.replace(/height[\s]*:[\s]*[^;&]+/i,
                `height: ${SCALESTRING_HEIGHT}`);
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
      for (let eachnode of node.childNodes) {
        try {
          if (eachnode.nodeName.toUpperCase() !== "PARAM") {
            continue;
          }
          if (!isElem(eachnode)) { // 22May2022 fixed risky
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
      for (let eachnode of node.childNodes) {
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
  }

  /**
   * @param flashletsval {string}
   * @return {string}
   */
  function grepFlashlets(flashletsval) {
    let result = flashletsval;
    if (result !== "" && result?.match(/[=%]/i) !== null) {
      const rejoinedResult = [];
      const params         = parseParams(flashletsval);
      if (params) {
        for (let key of params) {
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
  }

  /**
   * @param urlformat {string}
   * @return {{[key: string]: string}}
   */
  function parseParams(urlformat) {
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
  }

  /**
   * Returns true if any css classname starts with our prefix.
   * @param node {Node || HTMLElement}
   * @return {boolean}
   */
  function containsAnyVideoMaxClass(node) {
    if (!isElem(node)) {
      return false;
    }
    const className = node?.className || "";
    return (className?.indexOf(PREFIX_CSS_CLASS) !== -1);  // matches PREFIX_CSS_CLASS_PREP too
  }

  /**
   * Copy over and attribute value so it can be restored by undo
   * @param node {Node || HTMLElement}
   * @param attributeName {string}
   * @return {boolean} True if attribute saved
   */
  function saveAttribute(node, attributeName) {
    if (!isElem(node)) {
      return false;
    }
    const attributeNameLower = attributeName.toLowerCase();
    const orgValue           = safeGetAttribute(node, attributeNameLower) || "";
    if (!orgValue.length) {
      // nothing to save
      trace(`saveAttribute '${attributeNameLower}' empty, nothing to save`, node);
      return false;
    }
    const startingdata = safeGetAttribute(node, VIDEO_MAX_DATA_ATTRIB_UNDO);
    const jsondata     = JSON.parse(startingdata || "{}");
    if (Object.keys(jsondata)
      .includes(attributeNameLower)) {
      // already been saved bail
      trace(`saveAttribute '${attributeNameLower}' already saved, not overwriting `, node,
        jsondata);
      return true;
    }

    // ok merge in and save
    jsondata[attributeNameLower] = orgValue;
    safeSetAttribute(node, VIDEO_MAX_DATA_ATTRIB_UNDO, JSON.stringify(jsondata));
    trace(`saveAttribute '${attributeNameLower}' old value ${orgValue}`, node);
    return true;
  }

  /**
   * @param node {Node || HTMLElement}
   */
  function addMaximizeClassToElem(node) {
    try {
      if (!isElem(node)) {
        return;
      }
      if (containsAnyVideoMaxClass(node)) {
        return;
      }
      if (isIgnoredNode(node)) {
        return;
      }
      if (IsAlwaysHideNode(node)) {
        return;
      }
      trace(`Applying MAX_CSS_CLASS to ${node.nodeName} `, node);
      // hack. This crazy thing happens on some sites (dailymotion) where our
      // resizing the video triggers scripts to run that muck with the
      // element style, so we're going to save and restore that style so the
      // undo works.
      saveAttribute(node, "style");
      node?.classList.add(MAX_CSS_CLASS);

      // some sites muck with the style
      safeSetAttribute(node, "style", "");
    } catch (ex) {
      logerr("EXCEPTION ajustElem exception: ", ex);
    }
  }

  /**
   * @param elem {Node || HTMLElement}
   * @param isRehide {boolean}
   */
  function hideNode(elem, isRehide = false) {
    if (isIgnoredNode(elem)) {
      return false;
    }
    if (NO_REHIDE_HIDDEN_CNTL && isElementHidden(elem)) {
      trace("NOT hiding node NO_REHIDE_HIDDEN_CNTL", elem);
      return false;
    }
    if (isADecendantElem(elem, videomaxGlobals.matchedVideo)) {
      trace("Not adding HIDDEN_CSS_CLASS class to hidden node NO_REHIDE_HIDDEN_CNTL", elem);
      return false;
    }
    elem?.classList?.add(HIDDEN_CSS_CLASS); // may be Node
    isADecendantElem(elem, videomaxGlobals.matchedVideo);  // debugging issue remove
    if (isRehide && TRACE_ENABLED) {
      elem?.classList?.add(REHIDE_DEBUG_CSS_CLASS); // may be Node
      return true;
    }
    return false;
  }

  /**
   * @param elem {Node || HTMLElement}
   */
  function addOverlapCtrl(elem) {
    if (isIgnoredNode(elem) || isOnlyHide(elem)) {
      return;
    }
    elem?.classList?.add(OVERLAP_CSS_CLASS);
  }

  function addPlaybackCtrl(elem) {
    if (isIngoredCntlNode(elem) || isOnlyHide(elem)) {
      return;
    }
    trace(`  Add PLAYBACK_CNTLS_CSS_CLASS ${elem.nodeName} `, elem);
    elem?.classList?.add(PLAYBACK_CNTLS_CSS_CLASS);
  }

  /**
   *
   * @param elemIn { Node || HTMLElement }
   * @param boundingclientrect {{top: number, left: number, bottom: number,
   *     width: number, right: number, height: number}}
   * @param likelyContainer { Node || HTMLElement }
   * @return {boolean}
   */
  function siblingsCheckHideOrPlaybackCntls(elemIn, boundingclientrect, likelyContainer) {
    if (!elemIn) {
      trace("siblingsCheckHideOrPlaybackCntls() elemIn is null");
      return false;
    }
    // trace("siblingsCheckHideOrPlaybackCntls for class '" + elemIn.className + "'
    // rect="+JSON.stringify(boundingclientrect));
    const elemParent = elemIn.parentNode;
    if (!elemParent) {
      return false;
    }

    const isDecendant             = isADecendantElem(elemIn, likelyContainer);
    const isPlaybackCntlDecendant = anyParentsAlreadyPlayback(elemIn);

    // could also use node.contains(elemIn) where node is the matched video?
    const parentIsVideo     = elemParent.nodeName === "VIDEO";
    const parentIsMaximized = elemIn.classList?.contains(MAX_CSS_CLASS) ||
                              elemIn.classList?.contains(PLAYBACK_CNTLS_CSS_CLASS) ||
                              elemParent.classList?.contains(MAX_CSS_CLASS) ||
                              elemParent.classList?.contains(PLAYBACK_CNTLS_CSS_CLASS);

    trace("siblingsCheckHideOrPlaybackCntls");
    const sibs = getSiblings(elemParent);
    for (let each_sib of sibs) {  // was sibs.reverse()
      // if the element is inside the video's rect, then they are probably
      // controls. don't touch them. we are looking for elements that overlap.
      if (each_sib.isEqualNode(elemIn) || isIgnoredNode(each_sib)) {
        continue;
      }
      if (!isElem(each_sib)) {
        continue;
      }
      if (containsAnyVideoMaxClass(each_sib)) {
        continue;
      }
      if (!isDecendant) {
        trace("Parent is not decendant of video container. hiding.", each_sib);
        hideNode(each_sib);
        continue;
      }

      const eachBoundingRect = getBoundingClientRectWhole(each_sib);
      trace("checking siblings\n", each_sib, eachBoundingRect);

      if (isEmptyRect(eachBoundingRect)) {
        trace(`bounding rect is empty skipping`);
        // continue;
      }

      // todo: check z-order?

      // We're trying to NOT hide the controls the video is using.
      // everyone does it slightly different
      const bounded           = isBoundedRect(boundingclientrect, eachBoundingRect);
      const bottomDocked      = isBottomDocked(boundingclientrect, eachBoundingRect);
      const hasSliderRole     = hasSliderRoleChild(each_sib);
      const hasEaseInOutTrans = hasEaseInOutTransStyle(each_sib);

      let handled = false;
      if (isSpecialCaseAlwaysHide(each_sib)) { // last ditch special case check
        trace("special case item always hide", each_sib);
        hideNode(each_sib);
        handled = true;
      }

      if (!(bounded || bottomDocked || hasSliderRole || parentIsVideo || parentIsMaximized ||
            hasEaseInOutTrans)) {
        // each_elem.style.setProperty("display", "none", "important");
        trace(`  Hidding overlapping elem ${each_sib.nodeName}`, each_sib);
        hideNode(each_sib);
        handled = true;
      }

      if (!handled) {
        videomaxGlobals.foundOverlapping = true;
        trace(`Found overlapping elem ${each_sib.nodeName}`, each_sib);

        const parentHasSliderRole = hasSliderRoleOnElem(each_sib);
        const smellsLikeAControl  = smellsLikeAPlaybackControl(each_sib);
        const isLikelyControls    = hasSliderRole || bottomDocked || parentHasSliderRole ||
                                    hasEaseInOutTrans || smellsLikeAControl ||
                                    (parentIsVideo && parentIsMaximized);

        if (!isLikelyControls) {
          trace(`  Add OVERLAP_CSS_CLASS to children ${each_sib.nodeName} `, each_sib);
          walkAllChildren(each_sib, (each_child_elem) => {
            const eachChildBoundingRect = getBoundingClientRectWhole(each_child_elem);
            if (isBoundedRect(boundingclientrect, eachChildBoundingRect) ||
                isBottomDocked(boundingclientrect, eachChildBoundingRect) ||
                hasSliderRoleChild(each_child_elem)) {
              if (!containsAnyVideoMaxClass(each_child_elem)) { // not already something else
                addOverlapCtrl(each_child_elem);
                handled = true;
              }
            }
          });
        }

        if (!handled) {
          if (isLikelyControls) {
            // We can mess up layout if a parent is already is already a playbackcontrol
            if (NO_NESTED_PLAYBACK_CNTLS && isPlaybackCntlDecendant === true) {
              trace("   Skipping adding plabackctrl to decendant - NO_NESTED_PLAYBACK_CNTLS");
            } else {
              // the maximizeVideoDom tries to find the playback controls.
              // to do this they must be visible. Sometimes they disappear before
              // the user clicks the zoom.
              addPlaybackCtrl(each_sib);
            }
            handled = true;
          } else {
            trace(`  Hidding overlapping elem ${each_sib.nodeName}`, each_sib);
            hideNode(each_sib);
            handled = true;
          }
        }
      }
    }
  }

  /**
   *
   * @param elem {Node}
   * @param actionFn {function}
   */
  function walkAllChildren(elem, actionFn) {
    const active_elems = getChildren(elem, null);
    actionFn(elem); // call the parent element
    let safty = 5000;

    while (active_elems.length > 0 && safty--) {
      const next_elem = active_elems.pop();
      active_elems.concat(getChildren(next_elem, null));
      actionFn(elem);
    }
    if (DEBUG_ENABLED && safty === 0) {
      logerr("!!! maximizeVideoDom while loop ran too long");
    }
  }

  /**
   *
   * @param node {Node}
   * @param skipMe
   * @return {*[]}
   */
  function getChildren(node, skipMe) {
    const r         = [];
    let currentNode = node;
    for (let sanityMax = 0; sanityMax < 5000; sanityMax++) {
      if (!currentNode) {
        return r;
      }
      if (currentNode?.nodeType === 1 && !currentNode.isEqualNode(skipMe)) {
        r.push(currentNode);
      }
      currentNode = currentNode.nextSibling;
    }
    logerr("Hit max children in getChildren, stopping");
    return r;
  }

  /**
   *
   * @param node {Node}
   * @return {Node[]}
   */
  function getSiblings(node) {
    if (!node.parentElement?.children) {
      return [];
    }
    return [...node.parentElement.children].filter(c => c.nodeType === 1 && c !== node);
  }


  /**
   *
   * @return {number}
   */
  function rehideUpFromVideo() {
    if (SKIP_REHIDE) {
      return 0;
    }

    /** @var {number} */
    let reHideCount = 0;
    /** @var {HTMLElement | Node | undefined} */
    let current     = videomaxGlobals.matchedVideo;
    if (videomaxGlobals.matchedIsHtml5Video) {
      // html5 videos often put controls next to the video in the dom (siblings), so we want
      // to go up a level
      current = current.parentNode;
    }

    while (current && !isStopNodeType(current, false)) {
      if (isElem(current)) {
        const siblings = getSiblings(current);
        for (let eachNode of siblings) {
          // we don't hide the tree we're walking up, just the siblings
          if (!current.isEqualNode(eachNode) && isElem(eachNode) &&
              !containsAnyVideoMaxClass(eachNode)) {
            if (hideNode(eachNode, true)) { // may not actually hide for internal reasons
              reHideCount++;
            }
          }
        }
      }
      current = current?.parentNode;
    }
    trace(`rehideUpFromVideo hid: ${reHideCount} for ${runningInIFrame() ? "IFrame" : "Main"}`);
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

  function hideCSS(id) {
    // try {
    if (id) {
      const elem = document.getElementById(id);
      if (elem) {
        saveAttribute(elem, "media");
        elem.setAttribute("media", "_all");
      }
    }
  }

  /**
   * @return {boolean}
   */
  function hasInjectedAlready() {
    const matched = document.querySelectorAll(`video[class*="${PLAYBACK_VIDEO_MATCHED_CLASS}"]`);
    return matched.length > 0;
  }

  /**
   * @param arr {Array}
   * @return {Array}
   */
  function arrayClone(arr) {
    return arr.slice(0);
  }

  /**
   * Returns whole numbers for bounding box instead of floats.
   * @param rectC {DOMRect}
   * @return {DOMRect}
   */
  function wholeClientRect(rectC) {
    return {
      top:    Math.round(rectC.top),
      left:   Math.round(rectC.left),
      bottom: Math.round(rectC.bottom),
      right:  Math.round(rectC.right),
      width:  Math.round(rectC.width),
      height: Math.round(rectC.height),
    };
  }

  /**
   *
   * @param outer {DOMRect}
   * @param inner {DOMRect}
   * @return {boolean}
   */
  function isEqualRect(outer, inner) {
    if ((inner.top === outer.top) && (inner.left >= outer.left) && (inner.bottom >= outer.bottom) &&
        (inner.right >= outer.right)) {
      return false;
    }
    return false;
  }

  /**
   *
   * @param outer {DOMRect}
   * @param inner {DOMRect}
   * @return {boolean}
   */
  function isBoundedRect(outer, inner) {
    if (isEqualRect(outer, inner)) {
      trace("isBoundedRect exact match. probably preview image.");
      return false;
    }
    return ((inner.top >= outer.top) && (inner.top <= outer.bottom) &&
            (inner.bottom >= outer.top) && (inner.bottom <= outer.bottom) &&
            (inner.left >= outer.left) && (inner.left <= outer.right) &&
            (inner.right >= outer.left) && (inner.right <= outer.right));
  }

  /**
   * @param outer {DOMRect}
   * @param inner {DOMRect}
   * @return {boolean}
   */
  function isOverlappingBottomRect(outer, inner) {
    if (isEqualRect(outer, inner)) {
      trace("isOverlappingRect exact match. probably preview image.");
      return false;
    }
    // the top bounds of "inner" is inside outter
    return (inner.top > outer.bottom) && (inner.top < outer.top);
  }

  /**
   *
   * @param node {Node || HTMLElement}
   * @return {DOMRect}
   */
  function getBoundingClientRectWhole(node) {
    if (!isElem(node)) {
      trace("getBoundingClientRectWhole failed, returning empty clientRect");
      return {
        top:    0,
        left:   0,
        bottom: 0,
        right:  0,
        width:  0,
        height: 0,
      };
    }
    return wholeClientRect(node.getBoundingClientRect());
  }

  /**
   *
   * @param parentClientRect {{top: number, left: number, bottom: number,
   *     width: number, right: number, height: number}}
   * @param targetClientRect {{top: number, left: number, bottom: number,
   *     width: number, right: number, height: number}}
   * @return {boolean}
   */
  function isBottomDocked(parentClientRect, targetClientRect) {
    if (isEqualRect(parentClientRect, targetClientRect)) {
      return false;
    }
    // ™ be same width and top must be touching bottom of parent
    const closeWidths = Math.abs(targetClientRect.width - parentClientRect.width); // widths can
    // be real
    const overlaps = isOverlappingBottomRect(parentClientRect, targetClientRect);

    // numbers (122.4)
    const result = (closeWidths < 4 && overlaps);
    if (result) {
      trace("found bottom docked element");
    }
    return result;
  }

  /**
   *  role="slider"
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function hasSliderRoleChild(elem) {
    if (!isElem(elem)) {
      return false;
    }
    const result = elem.querySelectorAll("[role=\"slider\"]").length > 1 || false;
    if (result) {
      trace(`Element has slider role elements, not hiding ${elem.nodeName}`, elem);
    }
    return result;
  }

  /**
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function hasEaseInOutTransStyle(elem) {
    if (!isElem(elem)) {
      return false;
    }
    const compstyle = getElemComputedStyle(elem);
    return compstyle.transition.includes("ease-in-out");
  }

  /**
   *  role="slider"
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function hasSliderRoleOnElem(elem) {
    if (!isElem(elem)) {
      return false;
    }
    const role   = elem.getAttribute("role") || "";
    const result = (role.toLowerCase() === "sider");
    if (result) {
      trace(`Element has slider role elements, not hiding ${elem.nodeName}`, elem);
    }
    return result;
  }

  /**
   *
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function smellsLikeAPlaybackControl(elem) {
    if (PLAY_CNTL_SMELL !== true) {
      return false;
    }
    if (!isElem(elem)) {
      return false;
    }
    const matches = [new RegExp(/controls/i),
                     new RegExp(/chrome-bottom/i),
                     new RegExp(/progress-bar/i)];
    if (elem?.className) {
      for (let eachMatch of matches) {
        if (eachMatch.test(elem.className)) {
          // hummm... this is matching elements previously
          // marked with OUR PLAYBACK_CNTLS_CSS_CLASS... probably ok.
          trace(`smellsLikeAPlaybackControl true`, elem);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * @param elem {Node || HTMLElement}
   * @return {boolean}
   */
  function isSpecialCaseAlwaysHide(elem) {
    if (!isElem(elem)) {
      return false;
    }

    const nodename = elem?.nodeName?.toLowerCase();
    if (ALWAYS_HIDE_NODES.includes(nodename)) {
      trace(`always hide node ${nodename}`);
      return true;
    }

    // fragile. Special case for soap2day site
    return ((elem.id === "t1" && elem.classList.contains("player-title-bar")) ||
            (elem.id === "t2" && elem.classList.contains("player-status-bar")));
  }

  /**
   *
   * @param videoElem {Node||HTMLElement}
   * @return {boolean}
   */
  function shouldUseContainerDivForDockedCheckYoutube(videoElem) {
    if (videoElem?.nodeName === "VIDEO") {
      // use `parent.className.contains` ?
      if (videoElem.className?.match(/html5-main-video/i) !== null) {
        return true;
      }

      // ploto.tv is an exception.
      const src = videoElem?.getAttribute("src") || "";
      if (src.includes("https://pluto.tv")) {
        return true;
      }
    }
    return false;
  }

  /**
   *
   * @param elem {Node}
   */
  function seemsLikeAd(elem) {
    const arialabel = safeGetAttribute(elem, "aria-label");
    if (arialabel.match(/^adver/i)) {
      trace(`matched aria-label for ad? '${arialabel}'. skipping`);
      return true;
    }
    const title = safeGetAttribute(elem, "title");
    if (title.match(/^adver/i)) {
      trace(`matched title for ad? '${title}'. skipping`);
      return true;
    }
  }

  /**
   * @constructor
   */
  function ElemMatcherClass() {
    this.largestElem  = null;
    this.largestScore = 0;
    this.matchCount   = 0;

    /**
     *
     * @param elem {HTMLElement}
     * @return {boolean} True means done
     */
    this.checkIfBest = (elem) => {
      if (elem.isSameNode(this.largestElem)) {
        trace("Matched element same as ideal element already");
        return true;
      }
      if (this.largestElem && elem.isSameNode(this.largestElem.parentNode)) {
        trace("Matched element same as parent.");
      }

      // try to not match ads on the page
      if (DO_NOT_MATCH_ADS && seemsLikeAd(elem)) {
        return false;
      }

      const score = this._getElemMatchScore(elem);
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
        this.largestScore = score;
        this.largestElem  = elem;
        this.matchCount   = 1;
        trace(`Making item best match: \t${elem.nodeName}\t${elem.className}\t${elem.id}`);
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

    this.nestedFrameTree = [];

    this.getBestMatch      = () => this.largestElem;
    this.getBestMatchCount = () => this.matchCount; // should be 1 for most case

    this.setNestedFrameTree = (iframeTree) => {
      this.nestedFrameTree = arrayClone(iframeTree);
    };

    this.getFrameTree = () => this.nestedFrameTree;

    /**
     *   weight for videos that are the right ratios!
     *   16:9 == 1.77_  4:3 == 1.33_  3:2 == 1.50
     * @param elem {HTMLElement}
     * @return {{width: number, height: number, compstyle: CSSStyleDeclaration}}
     * @private
     */
    this._getElemDimensions = (elem) => {
      if (!elem) {
        logerr("empty element gets score of zero");
        return {
          width:     0,
          height:    0,
          compstyle: null,
        };
      }
      let width       = 0;
      let height      = 0;
      const compstyle = getElemComputedStyle(elem);

      if (!compstyle?.width || !compstyle?.height) {
        logerr("Could NOT load computed style for element so score is zero", elem);
        return {
          width,
          height,
          compstyle,
        };
      }

      // make sure the ratio is reasonable for a video.
      width  = safeParseInt(compstyle.width);
      height = safeParseInt(compstyle.height);
      if (!width || !height) {
        trace("width or height zero. likely hidden element", elem);
        return {
          width:  0,
          height: 0,
          compstyle,
        };
      }

      if (width < 100 || height < 75) {
        trace("width or height too small so no score", elem);
        return {
          width:  0,
          height: 0,
          compstyle,
        };
      }

      trace(`Found width/height for elem. width=${width}px height=${height}px`, elem);
      return {
        width,
        height,
        compstyle,
      };
    };

    /**
     *
     * @param elem {HTMLElement}
     * @return {number}
     * @private
     */
    this._getElemMatchScore = (elem) => {
      const fmtInt = (number) => new Intl.NumberFormat("en-US", {
        useGrouping:           true,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(number);
      const fmtFlt = (number) => new Intl.NumberFormat("en-US", {
        useGrouping:           false,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(number);

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

      // const MAX_R_THRESHOLD = 0.15;
      // const MAX_R_ADJUST = 0.8;

      const {
              width,
              height,
              compstyle,
            } = this._getElemDimensions(elem);

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

      const ratio         = width / height;
      // which ever is smaller is better (closer to one of the magic ratios)
      const distances     = Object.values(VIDEO_RATIOS)
        .map((v) => Math.abs(v - ratio));
      const bestRatioComp = Math.min(...distances) + 0.00001; // +0.00001; prevents div-by-zero

      // inverse distance
      const inverseDist = 1.0 / bestRatioComp ** 1.25;  // was 1.5

      // weight that by multiplying it by the total volume (better is better)
      let weight = 0;
      weight += START_WEIGHT * inverseDist * RATIO_WEIGHT;
      weight += START_WEIGHT * Math.log2(width * height) * SIZE_WEIGHT; // bigger is worth more
      weight += START_WEIGHT * -1 * videomaxGlobals.match_counter * ORDER_WEIGHT; // further

      if (EMBED_SCORES) {
        const elemStr = PrintNode(elem);
        traceweights.push(`===========================\n${elemStr}\n`);
        traceweights.push(`START_WEIGHT: ${START_WEIGHT}`);
        traceweights.push(`  Width; ${width}  Height: ${height}  ratio: ${fmtFlt(ratio)}`);
        traceweights.push(`  Distances: ${distances.map(n => fmtFlt(n))
          .join(",")}`);
        traceweights.push(`  inverseDist: ${fmtInt(
          START_WEIGHT * inverseDist * RATIO_WEIGHT)} Weight:${RATIO_WEIGHT}`);

        traceweights.push(`  dimensions: ${fmtInt(
          START_WEIGHT * Math.log2(width * height) * SIZE_WEIGHT)} Weight:${SIZE_WEIGHT}`);
        traceweights.push(`  sequenceOrder: ${fmtInt(
          START_WEIGHT * -1 * videomaxGlobals.match_counter *
          ORDER_WEIGHT)} Order: ${videomaxGlobals.match_counter} Weight:${ORDER_WEIGHT}`);
      }

      // try to figure out if iframe src looks like a video link.
      // frame shaped like videos?
      if (elem.nodeName.toLowerCase() === "iframe" || elem.nodeName.toLowerCase() === "frame") {
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

      if (compstyle?.zIndex) {
        // espn makes the zindex for ads crazy large and breaks things, cap it.
        const zindex = Math.min(safeParseInt(compstyle?.zIndex), 100);
        if (EMBED_SCORES) {
          traceweights.push(
            `  ZIndex: ${fmtInt(START_WEIGHT * zindex * ZINDEX_WEIGHT)} Weight:${ZINDEX_WEIGHT}`);
        }
        weight += (START_WEIGHT * zindex * ZINDEX_WEIGHT); // zindex is tricky, could be "1" or
        // "1000000"
      }

      if (compstyle?.visibility.toLowerCase() === "hidden" || compstyle?.display.toLowerCase() ===
          "none" || compstyle?.opacity === "0") {
        // Vimeo hides video before it starts playing (replacing it with a
        // static image), so we cannot ignore hidden. But UStream's homepage
        // has a large hidden flash that isn't a video.
        if (EMBED_SCORES) {
          traceweights.push(` Hidden item: ${fmtInt(
            START_WEIGHT * HIDDEN_VIDEO_WEIGHT)} Weight:${HIDDEN_VIDEO_WEIGHT}`);
          traceweights.push(`    visibility: '${compstyle?.visibility}' ` +
                            `display: '${compstyle?.display}' opacity: '${compstyle?.opacity}'`);
        }
        weight = (START_WEIGHT * HIDDEN_VIDEO_WEIGHT);
      }

      const tabindex = safeGetAttribute(elem, "tabindex");
      if (tabindex !== "") {
        // this is a newer thing for accessibility, it's a good indicator
        if (EMBED_SCORES) {
          traceweights.push(
            `tabindex: ${fmtInt(-1 & START_WEIGHT * TAB_INDEX_WEIGHT)} Weight:${TAB_INDEX_WEIGHT}`);
        }
        weight += (-1 * START_WEIGHT * TAB_INDEX_WEIGHT);
      }

      // Found an html5 video tag
      if (elem.nodeName.toLowerCase() === "video") {
        /** @var {HTMLMediaElement} **/
        const videoElem = elem;
        if (EMBED_SCORES) {
          traceweights.push(`video vs iframe: ${fmtInt(
            START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT)} Weight:${VIDEO_OVER_IFRAME_WEIGHT}`);
        }
        weight += (START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT);

        // if a video, lets see if it's actively playing
        if (videoElem.paused === false) {
          if (EMBED_SCORES) {
            traceweights.push(`VIDEO_PLAYING: ${fmtInt(START_WEIGHT *
                                                       VIDEO_PLAYING_WEIGHT)} Paused:${videoElem.paused} Weight:${VIDEO_PLAYING_WEIGHT}`);
          }
          weight += (START_WEIGHT * VIDEO_PLAYING_WEIGHT);
        }

        // video length
        const duration = Math.min((videoElem.duration || 0), MAX_DURATION_SECS);
        if (EMBED_SCORES) {
          traceweights.push(`VIDEO_DURATION: ${fmtInt(
            START_WEIGHT * VIDEO_DURATION_WEIGHT * duration)} Duration:${fmtFlt(
            duration)} Weight:${VIDEO_DURATION_WEIGHT}`);
        }
        weight += (START_WEIGHT * VIDEO_DURATION_WEIGHT * duration);

        // looping
        if (videoElem.loop === false) {
          if (EMBED_SCORES) {
            traceweights.push(`VIDEO_NO_LOOP: ${fmtInt(START_WEIGHT *
                                                       VIDEO_NO_LOOP_WEIGHT)} loop:${videoElem.loop} Weight:${VIDEO_NO_LOOP_WEIGHT}`);
          }
          weight += (START_WEIGHT * VIDEO_NO_LOOP_WEIGHT);
        }

        // has audio
        if (videoElem.muted === false) {
          if (EMBED_SCORES) {
            traceweights.push(`VIDEO_HAS_SOUND: ${fmtInt(START_WEIGHT *
                                                         VIDEO_HAS_SOUND_WEIGHT)} muted:${videoElem.muted} Weight:${VIDEO_HAS_SOUND_WEIGHT}`);
          }
          weight += (START_WEIGHT * VIDEO_HAS_SOUND_WEIGHT);
        }
      }

      if (runningInIFrame()) {
        if (EMBED_SCORES) {
          traceweights.push(`main frame vs iframe: ${fmtInt(
            START_WEIGHT * MAIN_FRAME_WEIGHT)} Weight:${VIDEO_OVER_IFRAME_WEIGHT}`);
        }
        weight += (START_WEIGHT * MAIN_FRAME_WEIGHT);
      }

      weight = Math.round(weight);
      if (EMBED_SCORES) {
        traceweights.push(`FINAL WEIGHT: ${fmtInt(weight)}`);
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
   */
  function alwaysHideSomeElements(doc = document) {
    for (let eachtag of ALWAYS_HIDE_NODES) {
      for (let elem of doc.getElementsByTagName(eachtag)) {
        trace(`ALWAYS_HIDE_NODES ${eachtag}`, elem);
        hideNode(elem);
      }
    }
  }

  /**
   * The LAST step of zooming is ot flip all the "videomax-ext-prep-*" to videomax-ext-*"
   * The reason for this is that if the css is already injected, then trying to measure
   * client rects gets messed up if we're modifying classNames as we go.
   * @param doc {Document}
   */
  function flipCssRemovePrep(doc = document) {
    const allElementsToFix = doc.querySelectorAll(`[class*="${PREFIX_CSS_CLASS_PREP}"]`);
    // that matches PREFIX_CSS_CLASS_PREP
    for (let eachElem of allElementsToFix) {
      const subFrom = [];
      const subTo   = [];
      for (let [_ii, eachClassName] of eachElem.classList?.entries()) {
        if (eachClassName.startsWith(PREFIX_CSS_CLASS_PREP)) {
          // remove '-prep' from the classname, '-prep-' => '-'
          const replacementClassName = eachClassName.replace("-prep-", "-");
          // because we're iterating, don't modify until we're done
          subFrom.push(eachClassName);
          subTo.push(replacementClassName);
        }
      }
      for (let ii = 0; ii < subFrom.length; ii++) {
        eachElem.classList.add(...subTo);
        eachElem.classList.remove(...subFrom);
      }
    }
  }

  function recursiveIFrameFlipCssPrep(doc) {
    try {
      flipCssRemovePrep(doc);
      const allIFrames = doc.querySelectorAll("iframe");
      for (let frame of allIFrames) {
        try {
          const framedoc = frame.contentDocument;
          if (!framedoc) {
            continue;
          }
          flipCssRemovePrep(framedoc);
          recursiveIFrameFlipCssPrep(framedoc);
        } catch (err) {
          // probably iframe boundry security related
        }
      }
    } catch (err) {
      // probably security related
    }
  }

  function watchForChanges() {
    if (!videomaxGlobals.matchedVideo || !videomaxGlobals.isMaximized ||
        !videomaxGlobals.matchedIsHtml5Video || runningInIFrame()) {
      return;
    }

    if (OBSERVER_DIV_REAPPLY) {
      if (!videomaxGlobals.observerDomMod) {
        videomaxGlobals.observerDomMod = new MutationObserver((_mutations, observer) => {
          // called when change happens. first disconnect to avoid recursions
          observer.disconnect();
          if (videomaxGlobals.observerDomMod && videomaxGlobals.isMaximized) {
            trace("OBSERVER: changes detected. Running mainFixPage");
            fixUpPage();
            // mainFixPage(); // will recall this
          }
        });
      }
      trace("OBSERVER: installing dom observer for element changes");
      videomaxGlobals?.observerDomMod?.observe(getTopmostElem(videomaxGlobals.matchedVideo), {
        childList: true,
        subtree:   true,
      });
    }

    if (OBSERVER_CLASSES_REAPPLY) {
      const topElem = getTopmostElem(videomaxGlobals.matchedVideo);
      if (!videomaxGlobals.observerClassMod) {
        videomaxGlobals.observerClassMod = new MutationObserver((mutations, observer) => {
          trace("OBSERVER: installing class observer for element changes");
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
                if (eachMutation.startsWith(PREFIX_CSS_CLASS)) {
                  trace(
                    `OBSERVER: detected classname changes, reappling "eachMutation" to element:`,
                    eachMutation.target);
                  eachMutation.target?.classList?.add(eachMutation);
                }
              }
            }
            trace("OBSERVER: installing classname observer for our classname changed");
            observer.observe(topElem, OBSERVE_ATTRIB_OPTIONS);
          }
        });
      }
      trace("OBSERVER: installing classname observer for our classname changed");
      videomaxGlobals.observerClassMod.observe(topElem, OBSERVE_ATTRIB_OPTIONS);
    }
  }

  function fixUpPage() {
    if (!documentLoaded()) {
      return false;
    }
    if (videomaxGlobals.tagonly) {
      return false;
    }
    const videoMatchElem = videomaxGlobals.matchedVideo;
    if (!videoMatchElem) {
      logerr("maxGlobals.matchedVideo empty");
      return false;
    }

    maximizeVideoDom(videoMatchElem);

    setTimeout(() => {
      FixUpAttribs(videoMatchElem);
    }, 1);

    const embeddedFrameTree = videomaxGlobals.elementMatcher.getFrameTree();
    if (embeddedFrameTree.length) {
      trace(`hiding logic for iframe. number of frames in tree:
      ${embeddedFrameTree.length}`);
      for (let frametree of embeddedFrameTree.reverse()) {
        maximizeVideoDom(frametree);
        FixUpAttribs(frametree);
      }
    }

    // some sites re-show these elements, hide again to be safe
    const doRehideTimeoutLoop = () => {
      alwaysHideSomeElements();
      const rehideCount = rehideUpFromVideo();
      recursiveIFrameFlipCssPrep(document);
      if (REHIDE_RETRY_UNTIL_NONE && rehideCount !== 0) {
        trace("Retrying rehide until no more matches. 1000ms");
        setTimeout(() => doRehideTimeoutLoop(), 1000);
      }
    };

    doRehideTimeoutLoop();

    return true; // stop retrying
  }

  /**
   *
   * @param video_elem {HTMLVideoElement}
   * @param removeOnly {boolean}
   */
  function updateEventListeners(video_elem, removeOnly = false) {
    const _onPress = (event) => {
      try {
        // trace("window keypressed", event);
        if (event.keyCode === 27) { // esc key
          trace("esc key press detected, unzoomin");
          // unzoom here!
          videomaxGlobals.isMaximized = false;
          video_elem.playbackRate     = 1.0;
          UndoZoom.mainUnzoom();
          trace("trying to stop default event handler");
          event.stopPropagation();
          event.preventDefault();
          return true;
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
  }

  /**
   * @return {boolean}
   */
  function mainFixPage() {
    if (window.frameElement?.src === "about:blank") {
      trace("Injected into blank iframe, not running");
      return false;
    }

    if (!documentLoaded()) {
      trace(`document state not complete: '${document.readyState}'`);
      return false;
    }

    const reinstall = hasInjectedAlready();
    trace(`mainFixPage readystate = ${document.readyState}  reinstall=${reinstall}`);

    videomaxGlobals.match_counter = 0;

    const foundVideoNewAlgo = findLargestVideoNew(document);
    const foundVideoOldAlgo = RUN_OLD_VIDEO_MATCH ? findLargestVideoOld(document, []) : false;

    const getBestMatchCount = videomaxGlobals.elementMatcher.getBestMatchCount();
    if (getBestMatchCount === 0) {
      trace(`No video found, ${runningInIFrame() ? "Main" : "frame"}.
        foundVideoNewAlg=${foundVideoNewAlgo} foundVideoOldAlgo=${foundVideoOldAlgo}`);
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
    }

    // mark it with a class.
    tagElementAsMatch(bestMatch);
    videomaxGlobals.matchedVideo        = bestMatch;
    videomaxGlobals.matchedIsHtml5Video = bestMatch.nodeName.toLowerCase() === "video";

    const bestMatchCount = videomaxGlobals.elementMatcher.getBestMatchCount();
    if (bestMatchCount > 1) {
      trace(`found too many videos on page. #${bestMatchCount}`);
    }

    if (!runningInIFrame()) {
      // only install from main page once. Because we inject for each iframe, this can
      // get called multiple times. The listener is on window.document, so it only needs
      // to be installed once for the main frame.
      updateEventListeners(bestMatch);
    }
    trace("Final Best Matched Element: ", bestMatch.nodeName, bestMatch);

    window._VideoMaxExt = videomaxGlobals; // undozoom uses

    // this timer will hide everything
    if (!videomaxGlobals.tagonly) {
      videomaxGlobals?.hideEverythingTimer?.startTimer(() => {
        // BBC has some special css with lots of !importants
        hideCSS("screen-css");
        if (!fixUpPage()) {
          return false;
        }

        if (!reinstall) {
          // with no element parameter, then the whole doc is "touched"
          forceRefresh();
        } else {
          forceRefresh(videomaxGlobals.matchedVideo);
        }

        // window.scroll({
        //   top:  0,
        //   left: 0,
        // });

        videomaxGlobals.isMaximized = true;
        return true; // stop retrying - we kep trying to rehide
      });
    } else {
      recursiveIFrameFlipCssPrep(document);
      recursiveIFrameFlipCssPrep(window.document.body.parentNode);
      trace("Tag only is set. Will not modify page to zoom video");
    }

    if (EMBED_SCORES) {
      // append the final results of what was discovered.
      appendSelectorItemsToResultInfo("=Main Video=", `.${PREFIX_CSS_CLASS}-video-matched`);
      appendSelectorItemsToResultInfo("=Playback controls=",
        `.${PREFIX_CSS_CLASS}-playback-controls`);
      appendUnitTestResultInfo("==========DONE==========\n\n");
    }
    rehideUpFromVideo();
    videomaxGlobals.isMaximized = true;
    watchForChanges();
    return true;
  }

  function mainZoom(tagonly = false) {
    if (hasInjectedAlready()) {
      trace("detected already injected. something is off?");
      return;
    }
    trace("running mainVideoMaxInject");

    const retries                  = runningInIFrame() ? 2 : 8;
    videomaxGlobals.elementMatcher = new ElemMatcherClass();

    if (!tagonly) {
      videomaxGlobals.hideEverythingTimer = new RetryTimeoutClass("hideEverythingTimer", 250,
        retries);
      // don't start there, do it from mainFixPage()
    }

    videomaxGlobals.tagonly             = tagonly;
    videomaxGlobals.findVideoRetryTimer = new RetryTimeoutClass("mainFixPage", 500, retries);
    videomaxGlobals.findVideoRetryTimer.startTimer(mainFixPage);
  }

  // <editor-fold defaultstate="collapsed" desc="UndoZoom">
  class UndoZoom {
    /**
     * @param doc {Document}
     */
    static recurseIFrameUndoAll(doc) {
      try {
        const allIFrames = doc.querySelectorAll("iframe");
        for (let frame of allIFrames) {
          try {
            const framedoc = frame.contentDocument;
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
        logerr("recurseIFrameUndoAll", err);
      }
    }

    /**
     * @param doc {Document}
     */
    static removeAllClassStyles(doc) {
      const allElementsToFix = doc.querySelectorAll(`[class*="${PREFIX_CSS_CLASS}"]`);
      for (let elem of allElementsToFix) {
        elem.classList.remove(...ALL_CLASSNAMES_TO_REMOVE); // the '...' turns the array
      }
    }


    /**
     *
     * @param doc {Document}
     */
    static undoStyleSheetChanges(doc) {
      try {
        const cssNode = doc.getElementById(CSS_STYLE_HEADER_ID);
        if (cssNode?.parentNode?.removeChild) {
          cssNode.parentNode.removeChild(cssNode);
        }

        const externcsss = doc.getElementsByTagName("link");
        for (let elem of externcsss) {
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
     * @param elem {Node | HTMLElement}
     */
    static restoreAllSavedAttribute(elem) {
      if (!isElem(elem)) {
        return;
      }
      const savedAttribsJson = JSON.parse(elem.getAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO) || "{}");
      trace("restoreAllSavedAttribute for ", elem);
      for (let [key, value] of Object.entries(savedAttribsJson)) {
        trace(`  ${key}='${value}' `, elem);
        elem.setAttribute(key, String(value));
      }
      elem.removeAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO);
      trace("  final restored elem:' ", elem);
    }

    /**
     *
     * @param doc {Document}
     */
    static undoAttribChange(doc) {
      try {
        for (let elem of doc.querySelectorAll(`[${VIDEO_MAX_DATA_ATTRIB_UNDO}]`)) {
          UndoZoom.restoreAllSavedAttribute(elem);
          //  try and make the element realizes it needs to redraw. Fixes
          // progress bar
          elem.dispatchEvent(new Event("resize"));
        }
      } catch (ex) {
        logerr(ex);
      }
    }

    // static undoSpeedControls(doc) {
    //   try {
    //     const elem = doc.getElementById(SPEED_CONTROLS);
    //     elem?.parentElement?.removeChild(elem);
    //   } catch (ex) {
    //     logerr(ex);
    //   }
    // }

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

      removeObservers();

      //      UndoZoom.undoSpeedControls(doc);
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
        if (optionalElem) {
          optionalElem?.dispatchEvent(new Event("visabilitychange"));
        } else {
          UndoZoom.touchDocBodyToTriggerUpdate();
        }
      }, 1); // was 50
    }

    static mainUnzoom() {
      try {
        videomaxGlobals.isMaximized   = false;
        videomaxGlobals.playbackSpeed = 1.0;

        updateEventListeners(videomaxGlobals.matchedVideo, true);
        removeObservers();

        UndoZoom.undoAll(document);
        UndoZoom.recurseIFrameUndoAll(document);
        UndoZoom.recurseIFrameUndoAll(window.document.body.parentNode);
        // remove the video "located" attribute.
        const videoelem = document.querySelector(
          `[${VIDEO_MAX_ATTRIB_FIND}=${VIDEO_MAX_ATTRIB_ID}]`);
        if (videoelem && videoelem.removeAttribute) {
          videoelem.removeAttribute(VIDEO_MAX_ATTRIB_FIND);
        }

        if (EMBED_SCORES) {
          clearResultInfo();
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
      mainZoom(tagonly = true);
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
