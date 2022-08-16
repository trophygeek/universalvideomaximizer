try { // scope and prevent errors from leaking out to page.
  const FULL_DEBUG          = true;
  const DEBUG_ENABLED       = FULL_DEBUG;
  const TRACE_ENABLED       = FULL_DEBUG;
  const ERR_BREAK_ENABLED   = FULL_DEBUG;
  const BREAK_ON_BEST_MATCH = true;
  // this will put add the score as an attribute for
  // elements across revisions, the zoomed page's html can
  // be diffed. This is for debugging and unit testing.
  const EMBED_SCORES = true;

  // experiments
  const DO_NOT_MATCH_ADS = true;

  // used to save off attributes that are modified on iframes/flash
  const VIDEO_MAX_DATA_ATTRIB_UNDO = 'data-videomax-saved';

  // found element <... data-videomax-target="zoomed-video">
  // also see class="... videomax-ext-video-matched ..."
  const VIDEO_MAX_ATTRIB_FIND = 'data-videomax-target';
  const VIDEO_MAX_ATTRIB_ID   = 'zoomed-video';

  // debug scores <... data-videomax-weights="#" >
  const VIDEO_MAX_EMBEDDED_SCORE_ATTR = 'data-videomax-weights';

  // smp-toucan-player is some random bbc player
  const VIDEO_NODES        = ['object', 'embed', 'video', 'iframe', 'smp-toucan-player'];
  const ALWAYS_HIDE_NODES  = ['aside', 'footer', 'header'];
  const IGNORE_NODES       = [...ALWAYS_HIDE_NODES, 'noscript', 'script', 'head', 'html'];
  const AVOID_ZOOMING      = ['a'];  // can be hidden but NEVER a control or video

  const CSS_STYLE_HEADER_ID = 'maximizier-css-inject';

  // we use the prop clas then flip all the classes at the end.
  // The reason for this is that the clientRect can get confused on rezoom IFF
  // the background page couldn't inject the css as a header.
  const PREFIX_CSS_CLASS             = 'videomax-ext';
  const PREFIX_CSS_CLASS_PREP        = 'videomax-ext-prep';
  // adding ANY new elements should be added to inject_undo
  const OVERLAP_CSS_CLASS            = `${PREFIX_CSS_CLASS_PREP}-overlap`;
  const HIDDEN_CSS_CLASS             = `${PREFIX_CSS_CLASS_PREP}-hide`;
  const MAX_CSS_CLASS                = `${PREFIX_CSS_CLASS_PREP}-max`;
  const PLAYBACK_CNTLS_CSS_CLASS     = `${PREFIX_CSS_CLASS_PREP}-playback-controls`;
  const PLAYBACK_VIDEO_MATCHED_CLASS = `${PREFIX_CSS_CLASS_PREP}-video-matched`;
  const EMBEDED_SCORES               = `${PREFIX_CSS_CLASS_PREP}-scores`;

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
                                    `${PREFIX_CSS_CLASS}-scores`];

  //  const SPEED_CONTROLS     = `${PREFIX_CSS_CLASS}-speed-control`;
  const SCALESTRING_WIDTH  = '100%'; // "calc(100vw)";
  const SCALESTRING_HEIGHT = '100%'; // "calc(100vh)";
  const SCALESTRING        = '100%';

  const logerr = (...args) => {
    if (DEBUG_ENABLED === false) {
      return;
    }
    const inIFrame = (window !== window.parent) ? 'iframe' : '';
    // eslint-disable-next-line no-console
    console.trace(`%c VideoMax ${inIFrame} ERROR`,
      'color: white; font-weight: bold; background-color: red', ...args);
    if (ERR_BREAK_ENABLED) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
  };

  const trace = (...args) => {
    if (TRACE_ENABLED === false) {
      return;
    }
    const inIFrame = (window !== window.parent) ? 'iframe' : 'main';
    // blue color , no break
    // eslint-disable-next-line no-console
    console.log(`%c VideoMax ${inIFrame}`,
      'color: white; font-weight: bold; background-color: blue', ...args);
  };

  // We want to SAVE these results somewhere that automated unit tests
  // can easily extract the scores to measure changes across revisions.
  // append it to the attribute data-videomax-weights
  const appendUnitTestResultInfo = (newStr) => {
    if (!EMBED_SCORES) {
      return;
    }
    try {
      const inIFrame = (window !== window.parent);
      if (inIFrame) {
        return;
      }

      const startingAttr = window.document.body.parentNode.getAttribute(
        VIDEO_MAX_EMBEDDED_SCORE_ATTR) || '';
      window.document.body.parentNode.setAttribute(VIDEO_MAX_EMBEDDED_SCORE_ATTR,
        [startingAttr, newStr].join('\n\n'));
    } catch (err) {
      trace(err);
    }
  };

  const appendSelectorItemsToResultInfo = (strMessage, strSelector) => {
    const results = [strMessage];
    const matches = document.querySelectorAll(strSelector);
    for (const match of matches) {
      try {
        const clone = match?.cloneNode(false) || null;
        if (clone) {
          results.push(clone?.outerHTML || ' - ');
        }
      } catch (err) {
        trace(err);
      }
    }
    appendUnitTestResultInfo(`${results.join(`\n`)}\n`);
  };

  const clearResultInfo = () => {
    try {
      window.document.body.parentNode.setAttribute(VIDEO_MAX_EMBEDDED_SCORE_ATTR, '');
    } catch (err) {
      trace(err);
    }
  };

  // const videomaxGlobals = window._VideoMaxExt ? window._VideoMaxExt : {
  const videomaxGlobals = {
    elemMatcher:      null,
    foundOverlapping: false,
    /** @var {HTMLElement || Node} * */
    matchedVideo: null,

    injectedCss: false,
    cssToInject: '',

    /** @var {RetryTimeoutClass} */
    findVideoRetry: null,
    /** @var {RetryTimeoutClass} */
    hideEverythingTimer: null,

    isMaximized: false,

    tagonly: false,

    match_counter: 0,
  };

  /**
   *
   * @param id {string}
   * @return {HTMLElement}
   */
  const $              = (id) => document.getElementById(id);
  const documentLoaded = () => ['complete', 'interactive'].includes(document.readyState);
  const isInIFrame     = () => window !== window.parent;

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
      return elem?.getAttribute(attr) || '';
    } catch (err) {
      return '';
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

  /// / finding video logic. this code is a bit of a mess.
  /**
   *
   * @param doc {Document}
   * @return {boolean}
   */
  function findLargestVideoNew(doc) {
    try {
      // try top level doc
      {
        const allvideos = document.querySelectorAll('video');
        for (const eachvido of allvideos) {
          videomaxGlobals.elementMatcher.checkIfBest(eachvido);
        }
      }
      // now go into frames
      const frames = doc.querySelectorAll('iframe');
      for (const frame of frames) {
        try {
          videomaxGlobals.elementMatcher.checkIfBest(frame);

          const allvideos = frame?.contentWindow?.document.querySelectorAll('video');
          for (const eachvido of allvideos) {
            videomaxGlobals.elementMatcher.checkIfBest(eachvido);
          }
        } catch (err) {
          if (err.toString()
                .toLowerCase()
                .indexOf('blocked a frame') !== -1) {
            trace('iframe security blocked cross domain - expected');
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
  }

  // returns true if a new video match was found.
  function checkVidsInDoc(doc) {
    if (!doc) {
      return false;
    }
    let matchedNew = false;
    for (const tagname of VIDEO_NODES.reverse()) {
      try {
        const elemSearch = [...doc.getElementsByTagName(tagname)];
        if (elemSearch) {
          for (const eachElem of elemSearch) { // .reverse()
            matchedNew |= videomaxGlobals.elementMatcher.checkIfBest(eachElem);
          }
        }
      } catch (err) {
        logerr(err);
      }
    }
    return matchedNew;
  }

  function getElemsDocumentView(node) {
    // this can probably be simplified
    if (node.ownerDocument !== null && node.ownerDocument !== document &&
        node.ownerDocument.defaultView !== null) {
      return node.ownerDocument.defaultView;
    }
    return document.defaultView;
  }

  /**
   *
   * @param node
   * @returns {CSSStyleDeclaration}
   */
  function getElemComputedStyle(node) {
    const view = getElemsDocumentView(node);
    return view.getComputedStyle(node, null);
  }

  /**
   *
   * @param rect
   */
  function isEmptyRect(rect) {
    return (rect.width === 0 && rect.width === 0);
  }

  function safeParseInt(str) {
    const result = parseInt(str, 10);
    return Number.isNaN(result) ? 0 : result;
  }

  function isIgnoredNode(elem) {
    return IGNORE_NODES.includes(elem.nodeName.toLowerCase());
  }

  function isOnlyHide(elem) {
    const isLink = AVOID_ZOOMING.includes(elem.nodeName.toLowerCase());
    // ok. "skipping" ads button we want to keep.
    if (isLink) {
      debugger;
    }
    return isLink;
  }

  // function touchDocBodyToTriggerUpdate() {
  //   document.body.width = '99%';
  //   setTimeout(function() {
  //     document.body.width = '100%';
  //   }, 1);
  // }

  function forceRefresh(optionalElem) {
    // we now need to force the flash to reload by resizing... easy thing is to
    // adjust the body
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('visabilitychange'));
      if (optionalElem) {
        optionalElem?.dispatchEvent(new Event('visabilitychange'));
      } else {
        // touchDocBodyToTriggerUpdate();
      }
    }, 50);
  }

  /**
   * hiding elements in dom that aren't in tree for this element.
   * @param videoElem {Node}
   */
  function maximizeVideoDom(videoElem) {
    if (!videoElem) {
      return;
    }
    trace('maximizeVideoDom');

    // let compstyle = getElemComputedStyle(videoElem); // used to resize divs
    const elemForBindingRect = shouldUseParentDivForDockedCheckYoutube(videoElem) ?
                               videoElem.parentNode :
                               videoElem;
    const boundingVidRect    = getBoundingClientRectWhole(elemForBindingRect);

    let saftyLoops = 1000;
    let elemUp     = videoElem;
    while (elemUp?.parentNode && saftyLoops--) {
      try {
        siblingsCheckHideOrPlaybackCntls(elemUp, boundingVidRect);
        // as we go up, we mark all the parents maximized
        addMaximizeClassToElem(elemUp);
      } catch (ex) {
        logerr('maximizeVideoDom exception', ex);
      }
      elemUp = elemUp.parentNode;
    }
    if (DEBUG_ENABLED && saftyLoops === 0) {
      logerr('!!! maximizeVideoDom while loop ran too long');
    }

    if (true) {
      const currentDoc = videoElem.ownerDocument;
      // see if we've tagged an element as a playback control
      if (((currentDoc.querySelectorAll(`.${PLAYBACK_CNTLS_CSS_CLASS}`)?.length || 0) !== 0)) {
        trace(`==== new code
      Did NOT find playback controls - searching for sliders
      ====`);
        // this is a VERY basic fallback. closertotruth.com fix
        for (const eachslider of currentDoc.querySelectorAll('[role="slider"]')) {
          siblingsCheckHideOrPlaybackCntls(eachslider.parentElement, boundingVidRect);
        }
      }
    }
  }

  function findLargestVideoOld(doc, iframeTree, level = 0) {
    if (iframeTree.length > 8) {
      trace(`hit max iframe depth, returning ${iframeTree.length}`);
      return false;
    }
    if (typeof (doc?.getElementsByTagName) !== 'function') {
      trace('getElementsByTagName is not function for sub doc, bailing', doc);
      return false;
    }
    trace(`findLargestVideoOld Depth: ${level} length: ${iframeTree.length}`);

    checkVidsInDoc(doc);

    try {
      const iframes     = [...doc.getElementsByTagName('iframe')];
      let foundnewmatch = false;
      for (const eachframe of iframes) {
        try {
          foundnewmatch = checkVidsInDoc(eachframe.contentDocument);
          if (foundnewmatch) {
            trace('found a good video match in an iframe, stopping search');
            iframeTree.push(eachframe);
            videomaxGlobals.elementMatcher.setNestedFrameTree(iframeTree);
            // we found a good match, just return?
            // trace("returning from findLargestVideoOld level:" +
            // iframeTree.length);
          } else {
            /// / recursive nesting!!!
            // many sites (e.g. bing video search) buries frames inside of
            // frames
            trace('found nested iframes, going deeper');
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
          trace('security exception expected: ', ex);
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
            trace('findLargestVideoOld exception in loop', ex);
          }
        }
      }
    } catch (ex) {
      // probably a security exception for trying to access frames.
      logerr('findLargestVideoOld. probably security issue', ex);
    }
    trace(`returning from findLargestVideoOld Depth: ${iframeTree.length}`);
    return false;
  }

  function tagElementAsMatch(elem) {
    // set the data-videomax-id = "zoomed" so undo can find it.
    safeSetAttribute(elem, `${VIDEO_MAX_ATTRIB_FIND}`, VIDEO_MAX_ATTRIB_ID);
    elem?.classList?.add(PLAYBACK_VIDEO_MATCHED_CLASS, MAX_CSS_CLASS);
  }

  /**
   *
   * @param node {Node || HTMLElement}
   * @return {Node}
   * @constructor
   */
  function FixUpAttribs(node) {
    trace(`FixUpAttribs for elem type ${node.nodeName}`, node);

    // this may not be an Element, but we still want to walk children below
    if (isElem(node)) {
      tagElementAsMatch(node);
      const attribs = node.attributes;

      trace(`attrib count = ${attribs.length}`);
      for (const eachattrib of attribs) {
        try {
          const { name } = eachattrib;
          const orgValue = eachattrib.value;
          let newValue   = '';

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
              newValue = newValue.replace(/width[\s]*:[\s]*[^;&]+/i, `width: ${SCALESTRING_WIDTH}`);
              newValue = newValue.replace(/height[\s]*:[\s]*[^;&]+/i,
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
            saveAttribute(node, name);
            safeSetAttribute(node, name, newValue);
          }
        } catch (ex) {
          logerr('exception in looping over properties: ', ex);
        }
      }
    }

    {
      // collect all changes here, then apply in a single writing loop. more
      // efficient for dom update
      const newParams = {};
      for (const eachnode of node.childNodes) {
        try {
          if (eachnode.nodeName.toUpperCase() !== 'PARAM') {
            continue;
          }
          if (!isElem(eachnode)) { // 22May2022 fixed risky
            continue;
          }
          const attrName  = safeGetAttribute(eachnode, 'name');
          const attrValue = safeGetAttribute(eachnode, 'value');

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
      newParams.bgcolor  = '#000000';
      newParams.scale    = 'showAll';
      newParams.menu     = 'true';
      newParams.quality  = 'high';
      newParams.width    = SCALESTRING_WIDTH;
      newParams.height   = SCALESTRING_HEIGHT;
      newParams.quality  = 'high';
      newParams.autoplay = 'true';

      // edit in place
      for (const eachnode of node.childNodes) {
        if (eachnode.nodeName.toUpperCase() !== 'PARAM') {
          continue;
        }
        const name     = safeGetAttribute(eachnode, 'name');
        const orgValue = safeGetAttribute(eachnode, 'value');

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

  function grepFlashlets(flashletsval) {
    let result = flashletsval;
    if (result !== '' && result?.match(/[=%]/i) !== null) {
      const rejoinedResult = [];
      const params         = parseParams(flashletsval);
      if (params) {
        for (const key of params) {
          if (Object.prototype.hasOwnProperty.call(params, key)) {
            switch (key.toLocaleLowerCase()) {
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

              case 'autoplay':
                if (params[key] === '0') {
                  params[key] = '1';
                } else {
                  params[key] = 'true';
                }
                break;

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
      trace(`Replaced urls params:\n\tBefore:\t${flashletsval}\r\n\tAfter\t${result}`);
    }
    return result;
  }

  function parseParams(urlformat) {
    const pl     = /\+/g; // Regex for replacing addition symbol with a space
    const search = /([^&=]+)=?([^&]*)/g;
    const decode = (s) => decodeURIComponent(s.replace(pl, ' '));
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
    const className = node?.className || '';
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
    const orgValue           = safeGetAttribute(node, attributeNameLower) || '';
    if (!orgValue.length) {
      // nothing to save
      trace(`saveAttribute '${attributeNameLower}' empty, nothing to save`, node);
      return false;
    }
    const startingdata = safeGetAttribute(node, VIDEO_MAX_DATA_ATTRIB_UNDO);
    const jsondata     = JSON.parse(startingdata || '{}');
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
   *
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
      trace(`Applying MAX_CSS_CLASS to ${node.nodeName} `, node);
      // hack. This crazy thing happens on some sites (dailymotion) where our
      // resizing the video triggers scripts to run that muck with the
      // element style, so we're going to save and restore that style so the
      // undo works.
      saveAttribute(node, 'style');
      node?.classList.add(MAX_CSS_CLASS);

      // some sites muck with the style
      safeSetAttribute(node, 'style', '');
    } catch (ex) {
      logerr('EXCEPTION ajustElem exception: ', ex);
    }
  }

  function hideNode(elem) {
    elem?.classList?.add(HIDDEN_CSS_CLASS); // may be Node
  }

  function addOverlapCtrl(elem) {
    if (isIgnoredNode(elem) || isOnlyHide(elem)) {
      return;
    }
    elem?.classList?.add(OVERLAP_CSS_CLASS);
  }

  /**
   *
   * @param elemIn { Node || HTMLElement }
   * @param boundingclientrect {{top: number, left: number, bottom: number,
   *     width: number, right: number, height: number}}
   */
  function siblingsCheckHideOrPlaybackCntls(elemIn, boundingclientrect) {
    if (!elemIn) {
      trace('siblingsCheckHideOrPlaybackCntls() elemIn is null');
      return;
    }
    // trace("siblingsCheckHideOrPlaybackCntls for class '" + elemIn.className + "'
    // rect="+JSON.stringify(boundingclientrect));
    const elemParent = elemIn.parentNode;
    if (!elemParent) {
      return;
    }

    // could also use node.contains(elemIn) where node is the matched video?
    const parentIsVideo     = elemIn.nodeName === 'VIDEO' || elemParent.nodeName === 'VIDEO';
    const parentIsMaximized = elemIn.classList?.contains(MAX_CSS_CLASS) ||
                              elemIn.classList?.contains(PLAYBACK_CNTLS_CSS_CLASS) ||
                              elemParent.classList?.contains(MAX_CSS_CLASS) ||
                              elemParent.classList?.contains(PLAYBACK_CNTLS_CSS_CLASS);

    trace('siblingsCheckHideOrPlaybackCntls');
    const sibs = getSiblings(elemParent);
    for (const each_sib of sibs) {  // was sibs.reverse()
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

      const eachBoundingRect = getBoundingClientRectWhole(each_sib);
      trace('checking siblings\n', each_sib, eachBoundingRect);

      if (isEmptyRect(eachBoundingRect)) {
        trace(`bounding rect is empty skipping`);
        // continue;
      }

      // todo: check z-order?

      // We're trying to NOT hide the controls the video is using.
      // everyone does it slightly different, so theres
      const bounded       = isBoundedRect(boundingclientrect, eachBoundingRect);
      const bottomDocked  = isBottomDocked(boundingclientrect, eachBoundingRect);
      const hasSliderRole = hasSliderRoleChild(each_sib);

      let handled = false;
      if (isSpecialCaseAlwaysHide(each_sib)) { // last ditch special case check
        trace('special case item always hide', each_sib);
        hideNode(each_sib);
        handled = true;
      }

      if (!(bounded || bottomDocked || hasSliderRole || parentIsVideo || parentIsMaximized)) {
        // each_elem.style.setProperty("display", "none", "important");
        trace(`  Hidding overlapping elem ${each_sib.nodeName}`, each_sib);
        hideNode(each_sib);
        handled = true;
      }

      if (!handled) {
        videomaxGlobals.foundOverlapping = true;
        trace(`Found overlapping elem ${each_sib.nodeName}`, each_sib);

        const parentHasSliderRole = hasSliderRoleOnElem(each_sib);
        const isLikelyControls    = hasSliderRole || bottomDocked || parentHasSliderRole ||
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
            trace(`  Add PLAYBACK_CNTLS_CSS_CLASS ${each_sib.nodeName} `, each_sib);
            // we're going to assume it contains the playback controls and are
            // going to max with it.
            each_sib?.classList?.add(PLAYBACK_CNTLS_CSS_CLASS);
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
      logerr('!!! maximizeVideoDom while loop ran too long');
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
    logerr('Hit max children in getChildren, stopping');
    return r;
  }

  /**
   *
   * @param node {Node}
   * @return {Node[]}
   */
  function getSiblings(node) {
    if (!node?.parentNode?.firstChild) return [];
    return getChildren(node.parentNode.firstChild, node);
  }

  /**
   * @constructor
   * @param debugname {string} handy for debugging.
   * @param delay {number}
   * @param maxretries {number}
   */
  function RetryTimeoutClass(debugname = '', delay = 250, maxretries = 8) {
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

      if (!result) {
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
      const elem = $(id);
      if (elem) {
        saveAttribute(elem, 'media');
        elem.setAttribute('media', '_all');
      }
    }
  }

  function hasInjectedAlready() {
    const matched = document.querySelectorAll(`video[class*="${PLAYBACK_VIDEO_MATCHED_CLASS}"]`);
    return matched.length > 0;
  }

  function arrayClone(arr) {
    return arr.slice(0);
  }

  /**
   * Returns whole numbers for bounding box instead of floats.
   * @param rectC {DOMRect}
   * @return {{top: number, left: number, bottom: number, width: number, right:
   *     number, height: number}}
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
   * @param outer {{top: number, left: number, bottom: number, width: number,
   *     right: number, height: number}}
   * @param inner {{top: number, left: number, bottom: number, width: number,
   *     right: number, height: number}}
   * @return {boolean}
   */
  function isEqualRect(outer, inner) {
    if ((inner.top === outer.top) && (inner.left >= outer.left) && (inner.bottom >= outer.bottom) &&
        (inner.right >= outer.right)) {
      return false;
    }
    return false;
  }

  function isBoundedRect(outer, inner) {
    if (isEqualRect(outer, inner)) {
      trace('isBoundedRect exact match. probably preview image.');
      return false;
    }
    return ((inner.top >= outer.top) && (inner.top <= outer.bottom) &&
            (inner.bottom >= outer.top) && (inner.bottom <= outer.bottom) &&
            (inner.left >= outer.left) && (inner.left <= outer.right) &&
            (inner.right >= outer.left) && (inner.right <= outer.right));
  }

  function isOverlappingBottomRect(outer, inner) {
    if (isEqualRect(outer, inner)) {
      trace('isOverlappingRect exact match. probably preview image.');
      return false;
    }
    // the top bounds of "inner" is inside outter
    return (inner.top > outer.bottom) && (inner.top < outer.top);
  }

  /**
   *
   * @param node {Node || HTMLElement}
   * @return {{top: number, left: number, bottom: number, width: number, right:
   *     number, height: number}}
   */
  function getBoundingClientRectWhole(node) {
    if (!isElem(node)) { // todo: verify
      trace('getBoundingClientRectWhole failed, returning empty clientRect');
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
      trace('found bottom docked element');
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
    const result = elem.querySelectorAll('[role="slider"]').length > 1 || false;
    if (result) {
      trace(`Element has slider role elements, not hiding ${elem.nodeName}`, elem);
    }
    return result;
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
    const role   = elem.getAttribute('role') || '';
    const result = (role.toLowerCase() === 'sider');
    if (result) {
      trace(`Element has slider role elements, not hiding ${elem.nodeName}`, elem);
    }
    return result;
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
    return ((elem.id === 't1' && elem.classList.contains('player-title-bar')) ||
            (elem.id === 't2' && elem.classList.contains('player-status-bar')));
  }

  /**
   *
   * @param videoElem {Node}
   * @return {boolean}
   */
  function shouldUseParentDivForDockedCheckYoutube(videoElem) {
    if (videoElem?.nodeName === 'VIDEO') {
      // use `parent.className.contains` ?
      if (videoElem.className?.match(/html5-main-video/i) !== null) {
        if (videoElem.parentNode?.className?.match(/html5-video-container/i) !== null) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   *
   * @param elem {Node}
   */
  function seemsLikeAd(elem) {
    const arialabel = safeGetAttribute(elem, 'aria-label');
    if (arialabel.match(/^adver/i)) {
      trace(`matched aria-label for ad? '${arialabel}'. skipping`);
      return true;
    }
    const title = safeGetAttribute(elem, 'title');
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
      if (elem === this.largestElem) {
        trace('Matched element same as ideal element already');
        return true;
      }
      if (this.largestElem && elem === this.largestElem.parentNode) {
        trace('Matched element same as parent.');
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
        logerr('empty element gets score of zero');
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
        logerr('Could NOT load computed style for element so score is zero', elem);
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
        trace('width or height zero. likely hidden element', elem);
        return {
          width:  0,
          height: 0,
          compstyle,
        };
      }

      if (width < 100 || height < 75) {
        trace('width or height too small so no score', elem);
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
      const fmtInt = (number) => new Intl.NumberFormat('en-US', {
        useGrouping:           true,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(number);
      const fmtFlt = (number) => new Intl.NumberFormat('en-US', {
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
        trace('\tWidth or height not great, skipping other checks', elem);
        return 0;
      }

      // twitch allows videos to be any random size. If the width & height of
      // the window are too short, then we can't find the video.
      if (elem.id === 'live_site_player_flash') {
        trace('Matched twitch video. Returning high score.');
        return 3000000;
      }

      const traceweights = ['']; // start with blankline. turned into trace message
      videomaxGlobals.match_counter++;

      const ratio         = width / height;
      // which ever is smaller is better (closer to one of the magic ratios)
      const distances     = Object.values(VIDEO_RATIOS)
        .map((v) => Math.abs(v - ratio));
      const bestRatioComp = Math.min(...distances) + 0.00001; // +0.00001; prevents div-by-zero

      // inverse distance
      const inverseDist = 1.0 / bestRatioComp ** 1.25;  // was 1.5

      const START_WEIGHT             = 1000;
      const RATIO_WEIGHT             = 0.25;
      const SIZE_WEIGHT              = 5.0;
      const ORDER_WEIGHT             = 10.0;
      const TAB_INDEX_WEIGHT         = 6.0;
      const VIDEO_OVER_IFRAME_WEIGHT = 200.0;
      const HIDDEN_VIDEO_WEIGHT      = 0.5;
      const ZINDEX_WEIGHT            = 5.0;
      const MAIN_FRAME_WEIGHT        = 5.0;
      const VIDEO_PLAYING_WEIGHT     = 10.0;
      const VIDEO_DURATION_WEIGHT    = 10.0;
      const MAX_DURATION_SECS        = 60 * 60 * 2; // 2hrs - live videos skew results
      const VIDEO_NO_LOOP_WEIGHT     = 1.0;
      const VIDEO_HAS_SOUND_WEIGHT   = 10.0;

      // weight that by multiplying it by the total volume (better is better)
      let weight = 0;
      weight += START_WEIGHT * inverseDist * RATIO_WEIGHT;
      weight += START_WEIGHT * Math.log2(width * height) * SIZE_WEIGHT; // bigger is worth more
      weight += START_WEIGHT * -1 * videomaxGlobals.match_counter * ORDER_WEIGHT; // further

      if (EMBED_SCORES) {
        const elemStr = elem?.cloneNode(false)?.outerHTML || 'error';
        traceweights.push(`===========================\n${elemStr}\n`);
        traceweights.push(`START_WEIGHT: ${START_WEIGHT}`);
        traceweights.push(`  Width; ${width}  Height: ${height}  ratio: ${fmtFlt(ratio)}`);
        traceweights.push(`  Distances: ${distances.map(n => fmtFlt(n))
          .join(',')}`);
        traceweights.push(`  inverseDist: ${fmtInt(
          START_WEIGHT * inverseDist * RATIO_WEIGHT)} Wight:${RATIO_WEIGHT}`);

        traceweights.push(`  dimensions: ${fmtInt(
          START_WEIGHT * Math.log2(width * height) * SIZE_WEIGHT)} Wight:${SIZE_WEIGHT}`);
        traceweights.push(`  sequenceOrder: ${fmtInt(
          START_WEIGHT * -1 * videomaxGlobals.match_counter *
          ORDER_WEIGHT)} Order: ${videomaxGlobals.match_counter} Wight:${ORDER_WEIGHT}`);
      }

      // try to figure out if iframe src looks like a video link.
      // frame shaped like videos?
      if (elem.nodeName.toLowerCase() === 'iframe') {
        const src = elem.getAttribute('src') || '';
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
        const zindex = safeParseInt(compstyle?.zIndex);
        if (EMBED_SCORES) {
          traceweights.push(
            `  ZIndex: ${fmtInt(START_WEIGHT * zindex * ZINDEX_WEIGHT)} Wight:${ZINDEX_WEIGHT}`);
        }
        weight += (START_WEIGHT * zindex * ZINDEX_WEIGHT); // zindex is tricky, could be "1" or
        // "1000000"
      }

      if (compstyle?.visibility.toLowerCase() === 'hidden' || compstyle?.display.toLowerCase() ===
          'none' || compstyle?.opacity === '0') {
        // Vimeo hides video before it starts playing (replacing it with a
        // static image), so we cannot ignore hidden. But UStream's homepage
        // has a large hidden flash that isn't a video.
        if (EMBED_SCORES) {
          traceweights.push(` Hidden item: ${fmtInt(
            START_WEIGHT * HIDDEN_VIDEO_WEIGHT)} Wight:${HIDDEN_VIDEO_WEIGHT}`);
          traceweights.push(`    visibility: '${compstyle?.visibility}' ` +
                            `display: '${compstyle?.display}' opacity: '${compstyle?.opacity}'`);
        }
        weight += (START_WEIGHT * HIDDEN_VIDEO_WEIGHT);
      }

      const tabindex = safeGetAttribute(elem, 'tabindex');
      if (tabindex !== '') {
        // this is a newer thing for accessibility, it's a good indicator
        if (EMBED_SCORES) {
          traceweights.push(
            `tabindex: ${fmtInt(-1 & START_WEIGHT * TAB_INDEX_WEIGHT)} Wight:${TAB_INDEX_WEIGHT}`);
        }
        weight += (-1 * START_WEIGHT * TAB_INDEX_WEIGHT);
      }

      // Found an html5 video tag
      if (elem.nodeName.toLowerCase() === 'video') {
        /** @var {HTMLMediaElement} **/
        const videoElem = elem;
        if (EMBED_SCORES) {
          traceweights.push(`video vs iframe: ${fmtInt(
            START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT)} Wight:${VIDEO_OVER_IFRAME_WEIGHT}`);
        }
        weight += (START_WEIGHT * VIDEO_OVER_IFRAME_WEIGHT);

        // if a video, lets see if it's actively playing
        if (videoElem.paused === false) {
          if (EMBED_SCORES) {
            traceweights.push(`VIDEO_PLAYING: ${fmtInt(START_WEIGHT *
                                                       VIDEO_PLAYING_WEIGHT)} Paused:${videoElem.paused} Wight:${VIDEO_PLAYING_WEIGHT}`);
          }
          weight += (START_WEIGHT * VIDEO_PLAYING_WEIGHT);
        }

        // video length
        const duration = Math.min((videoElem.duration || 0), MAX_DURATION_SECS);
        if (EMBED_SCORES) {
          traceweights.push(`VIDEO_DURATION: ${fmtInt(
            START_WEIGHT * VIDEO_DURATION_WEIGHT * duration)} Duration:${fmtFlt(
            duration)} Wight:${VIDEO_DURATION_WEIGHT}`);
        }
        weight += (START_WEIGHT * VIDEO_DURATION_WEIGHT * duration);

        // looping
        if (videoElem.loop === false) {
          if (EMBED_SCORES) {
            traceweights.push(`VIDEO_NO_LOOP: ${fmtInt(START_WEIGHT *
                                                       VIDEO_NO_LOOP_WEIGHT)} loop:${videoElem.loop} Wight:${VIDEO_NO_LOOP_WEIGHT}`);
          }
          weight += (START_WEIGHT * VIDEO_NO_LOOP_WEIGHT);
        }

        // has audio
        if (videoElem.muted === false) {
          if (EMBED_SCORES) {
            traceweights.push(`VIDEO_HAS_SOUND: ${fmtInt(START_WEIGHT *
                                                         VIDEO_HAS_SOUND_WEIGHT)} muted:${videoElem.muted} Wight:${VIDEO_HAS_SOUND_WEIGHT}`);
          }
          weight += (START_WEIGHT * VIDEO_HAS_SOUND_WEIGHT);
        }
      }

      if (isInIFrame()) {
        if (EMBED_SCORES) {
          traceweights.push(`main frame vs iframe: ${fmtInt(
            START_WEIGHT * MAIN_FRAME_WEIGHT)} Wight:${VIDEO_OVER_IFRAME_WEIGHT}`);
        }
        weight += (START_WEIGHT * MAIN_FRAME_WEIGHT);
      }

      weight = Math.round(weight);
      if (EMBED_SCORES) {
        traceweights.push(`FINAL WEIGHT: ${fmtInt(weight)}`);
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
   */
  function alwaysHideSomeElements(doc = document) {
    for (const eachtag of ALWAYS_HIDE_NODES) {
      for (const elem of doc.getElementsByTagName(eachtag)) {
        trace(`ALWAYS_HIDE_NODES ${eachtag}`, elem);
        elem?.classList?.add(HIDDEN_CSS_CLASS); // may be Node
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
    const allElementsToFix = doc.querySelectorAll(`[class*="${PREFIX_CSS_CLASS}"]`);
    // that matches PREFIX_CSS_CLASS && PREFIX_CSS_CLASS_PREP
    for (const eachElem of allElementsToFix) {
      const subFrom = [];
      const subTo   = [];
      for (const [_ii, eachClassName] of eachElem.classList?.entries()) {
        if (eachClassName.startsWith(PREFIX_CSS_CLASS_PREP)) {
          // remove '-prep' from the classname, '-prep-' => '-'
          const replacementClassName = eachClassName.replace('-prep-', '-');
          // because we're iterating, don't modify until we're done
          subFrom.push(eachClassName);
          subTo.push(replacementClassName);
        }
      }
      for (let ii = 0; ii < subFrom.length; ii++) {
        eachElem.classList.replace(subFrom[ii], subTo[ii]);
      }
    }
  }

  function fixUpPage() {
    if (!documentLoaded()) {
      return false;
    }
    const videoMatchElem = videomaxGlobals.matchedVideo;
    if (!videoMatchElem) {
      logerr('maxGlobals.matchedVideo empty');
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
      for (const frametree of embeddedFrameTree.reverse()) {
        maximizeVideoDom(frametree);
        FixUpAttribs(frametree);
      }
    }

    alwaysHideSomeElements();

    // some sites re-show these elements (hclips), hide again to be safe
    setTimeout(() => {
      alwaysHideSomeElements();
    }, 250);

    flipCssRemovePrep();
    return true; // stop retrying
  }

  function updateEventListeners(video_elem) {
    const _onPress = (event) => {
      try {
        trace('window keypressed');
        if (event.keyCode === 27) { // esc key
          trace('esc key press detected, unzoomin');
          // unzoom here!
          videomaxGlobals.isMaximized = false;
          video_elem.playbackRate     = 1.0;
          UndoZoom.mainUnzoom();
          trace('trying to stop default event handler');
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
      trace('updateEventListeners');
      const doc = window.document || video_elem?.ownerDocument;
      doc?.removeEventListener('keydown', _onPress);
      doc?.addEventListener('keydown', _onPress);
    } catch (err) {
      logerr(err);
    }
  }

  function mainFixPage() {
    if (window.frameElement?.src === 'about:blank') {
      trace('Injected into blank iframe, not running');
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
    const foundVideoOldAlgo = findLargestVideoOld(document, []);

    const getBestMatchCount = videomaxGlobals.elementMatcher.getBestMatchCount();
    if (getBestMatchCount === 0) {
      if (DEBUG_ENABLED && !isInIFrame()) {
        logerr('No video found on Main thread');
      } else {
        trace(`No video found, will try again. 
        foundVideoNewAlg=${foundVideoNewAlgo} foundVideoOldAlgo=${foundVideoOldAlgo}`);
      }
      return false; // keep trying
    }

    const bestMatch = videomaxGlobals.elementMatcher.getBestMatch();
    trace('video found', bestMatch);

    bestMatch?.scrollIntoView({
      block:  'center',
      inline: 'center',
    });

    // mark it with a class.
    tagElementAsMatch(bestMatch);
    videomaxGlobals.matchedVideo = bestMatch;

    const bestMatchCount = videomaxGlobals.elementMatcher.getBestMatchCount();
    if (bestMatchCount > 1) {
      trace(`found too many videos on page. #${bestMatchCount}`);
    }

    if (!isInIFrame()) {
      // only install from main page once. Because we inject for each iframe, this can
      // get called multiple times. The listener is on window.document, so it only needs
      // to be installed once for the main frame.
      updateEventListeners(bestMatch);
    }
    trace('Final Best Matched Element: ', bestMatch.nodeName, bestMatch);

    window._VideoMaxExt = videomaxGlobals; // undozoom uses

    // this timer will hide everything
    if (!videomaxGlobals.tagonly) {
      videomaxGlobals?.hideEverythingTimer?.startTimer(() => {
        // BBC has some special css with lots of !importants
        hideCSS('screen-css');
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
        return true; // stop retrying
      });
    } else {
      flipCssRemovePrep();
      trace('Tag only is set. Will not modify page to zoom video');
    }

    if (EMBED_SCORES) {
      debugger;
      // append the final results of what was discovered.
      appendSelectorItemsToResultInfo('=Main Video=', `.${PREFIX_CSS_CLASS}-video-matched`);
      appendSelectorItemsToResultInfo('=Playback controls=',
        `.${PREFIX_CSS_CLASS}-playback-controls`);
    }
    videomaxGlobals.isMaximized = true;
    return true; // stop retrying
  }

  function mainZoom(tagonly = false) {
    trace('running mainVideoMaxInject');
    if (hasInjectedAlready()) {
      trace('detected already injected. something is off?');
      return;
    }

    const retries                  = isInIFrame() ? 2 : 8;
    videomaxGlobals.elementMatcher = new ElemMatcherClass();

    if (!tagonly) {
      videomaxGlobals.hideEverythingTimer = new RetryTimeoutClass('hideEverythingTimer', 250,
        retries);
    }

    videomaxGlobals.tagonly        = tagonly;
    videomaxGlobals.findVideoRetry = new RetryTimeoutClass('mainFixPage', 500, retries);
    videomaxGlobals.findVideoRetry.startTimer(mainFixPage);
  }

  // <editor-fold defaultstate="collapsed" desc="UndoZoom">
  class UndoZoom {
    /**
     * @param doc {Document}
     */
    static recurseIFrameUndoAll(doc) {
      try {
        const allIFrames = doc.querySelectorAll('iframe');
        for (const frame of allIFrames) {
          try {
            const framedoc = frame.contentDocument;
            if (!framedoc) {
              continue;
            }
            setTimeout(UndoZoom.undoAll, 1, framedoc);
            UndoZoom.recurseIFrameUndoAll(framedoc);
          } catch (err) {
            // probably security related
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
      const allElementsToFix = doc.querySelectorAll(`[class*="${PREFIX_CSS_CLASS}"]`);
      for (const elem of allElementsToFix) {
        elem.classList.remove(...ALL_CLASSNAMES_TO_REMOVE); // the '...' turns the array
        // into a bunch of individual
        // params
        if (elem.getAttribute('class') === '') {
          elem.removeAttribute('class');
        }
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

    /**
     *
     * @param elem {Node | HTMLElement}
     */
    static restoreAllSavedAttribute(elem) {
      if (!isElem(elem)) {
        return;
      }
      const savedAttribsJson = JSON.parse(elem.getAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO) || '{}');
      trace('restoreAllSavedAttribute for ', elem);
      for (const [key, value] of Object.entries(savedAttribsJson)) {
        trace(`  ${key}='${value}' `, elem);
        elem.setAttribute(key, String(value));
      }
      elem.removeAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO);
      trace('  final restored elem:\' ', elem);
    }

    /**
     *
     * @param doc {Document}
     */
    static undoAttribChange(doc) {
      try {
        for (const elem of doc.querySelectorAll(`[${VIDEO_MAX_DATA_ATTRIB_UNDO}]`)) {
          UndoZoom.restoreAllSavedAttribute(elem);
          //  try and make the element realizes it needs to redraw. Fixes
          // progress bar
          elem.dispatchEvent(new Event('resize'));
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
      //      UndoZoom.undoSpeedControls(doc);
      UndoZoom.removeAllClassStyles(doc);
      UndoZoom.undoAttribChange(doc);
      UndoZoom.undoStyleSheetChanges(doc);
    }

    static touchDocBodyToTriggerUpdate() {
      document.body.width = '99%';
      setTimeout(() => {
        document.body.width = '100%';
      }, 1);
    }

    static forceRefresh(optionalElem) {
      // we now need to force the flash to reload by resizing... easy thing is to
      // adjust the body
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('visabilitychange'));
        if (optionalElem) {
          optionalElem?.dispatchEvent(new Event('visabilitychange'));
        } else {
          UndoZoom.touchDocBodyToTriggerUpdate();
        }
      }, 50);
    }

    static mainUnzoom() {
      try {
        UndoZoom.undoAll(document);
        UndoZoom.recurseIFrameUndoAll(document);
        // remove the video "located" attribute.
        const videoelem = document.querySelector(
          `[${VIDEO_MAX_ATTRIB_FIND}=${VIDEO_MAX_ATTRIB_ID}]`);
        if (videoelem && videoelem.removeAttribute) {
          videoelem.removeAttribute(VIDEO_MAX_ATTRIB_FIND);
        }
        videomaxGlobals.playbackSpeed = 1.0;
        videomaxGlobals.isMaximized   = false;
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
    case 'unzoom':
      UndoZoom.mainUnzoom();
      break;

    case 'tagonly':
      // this is for sites that already zoom correctly, but we'd like to do speed control
      mainZoom(tagonly = true);
      break;

    default:
      mainZoom();
      break;
  }
  window.videmax_cmd   = ''; // clear it.
  document.videmax_cmd = '';
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('videomax extension error', err, err.stack);
}
