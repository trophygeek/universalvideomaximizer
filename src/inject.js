'use strict';
try {   // scope and prevent errors from leaking out to page.
  const DEBUG_ENABLED = false;
  const TRACE_ENABLED = false;
  const ERR_BREAK_ENABLED = false;

  const VIDEO_MAX_DATA_ATTRIB_UNDO = 'data-videomax-saved';
  const VIDEO_MAX_ATTRIB_FIND = 'data-videomax-target';
  const VIDEO_MAX_ATTRIB_ID = 'zoomed-video';

  const OBJ_TAGS = ['object', 'embed', 'video'];

  const CSS_FILE = 'inject.css';
  const STYLE_ID = 'maximizier-css-inject';

  const PREFIX_CSS_CLASS = 'videomax-ext';
  // adding ANY new elements should be added to inject_undo
  const OVERLAP_CSS_CLASS = `${PREFIX_CSS_CLASS}-overlap`;
  const HIDDEN_CSS_CLASS = `${PREFIX_CSS_CLASS}-hide`;
  const MAX_CSS_CLASS = `${PREFIX_CSS_CLASS}-max`;
  const PLAYBACK_CNTLS_CSS_CLASS = `${PREFIX_CSS_CLASS}-playback-controls`;
  const PLAYBACK_VIDEO_MATCHED_CLASS = `${PREFIX_CSS_CLASS}-video-matched`;
  const ALL_CLASSNAMES = [
    OVERLAP_CSS_CLASS,
    HIDDEN_CSS_CLASS,
    MAX_CSS_CLASS,
    PLAYBACK_CNTLS_CSS_CLASS,
    PLAYBACK_VIDEO_MATCHED_CLASS];

  const SCALESTRING_WIDTH = '100%'; // "calc(100vw)";
  const SCALESTRING_HEIGHT = '100%'; // "calc(100vh)";
  const SCALESTRING = '100%';

  const logerr = (...args) => {
    if (DEBUG_ENABLED === false) {
      return;
    }
    console.trace('%c VideoMax ',
        'color: white; font-weight: bold; background-color: blue', ...args);
    if (ERR_BREAK_ENABLED) {
      debugger;
    }
  };

  const trace = (...args) => {
    if (TRACE_ENABLED) {
      // blue color , no break
      console.log('%c VideoMax ',
          'color: white; font-weight: bold; background-color: blue', ...args);
    }
  };

  if (window._VideoMaxExt) {
    trace('Found globals from prior run', window._VideoMaxExt);
  }

  const g_global = window._VideoMaxExt ? window._VideoMaxExt : {
    elemMatcher: null,
    foundOverlapping: false,
    /** @var {HTMLElement || Node} **/
    matchedVideo: null,

    injectedCss: false,
    cssToInject: '',

    findVideoRetry: null,

    hideEverythingTimer: null,
  };

  // experimental. save prior run into window if zooming/unzooming
  window._VideoMaxExt = g_global;

  /**
   *
   * @param id {string}
   * @return {HTMLElement}
   */
  function $(id) {
    return document.getElementById(id);
  }

  /**
   * Node does not have getAttributes or classList. Elements do
   * @param nodeOrElem {Node || HTMLElement}
   * @return {boolean}
   */
  function isElem(nodeOrElem) {
    // return (nodeOrElem.nodeType === Node.ELEMENT_NODE);
    return (nodeOrElem instanceof HTMLElement);
  }

  main();

  function main() {
    trace('running main');
    if (hasInjectedAlready()) {
      trace('detected already injected. something is off?');
      return;
    }

    g_global.elementMatcher = new ElemMatcherClass();

    g_global.hideEverythingTimer = new RetryTimeoutClass(500, 10);

    g_global.findVideoRetry = new RetryTimeoutClass(1000, 10);
    g_global.findVideoRetry.startTimer(mainFixPage);
  }

  function mainFixPage() {
    trace('running mainFixPage');
    if (document.readyState !== 'complete') {    //  || document.readyState == "interactive"
      trace(`document state not complete: '${document.readyState}'`);
      return false;
    }

    trace('mainFixPage readystate = ' + document.readyState);
    const reinstall = hasInjectedAlready();

    findLargestVideoNew(document);
    findLargestVideoOld(document, []);

    const bestMatch = g_global.elementMatcher.getBestMatch();
    if (!bestMatch) {
      logerr('no video found, will try again');
      return false; // keep trying
    }

    // mark it with a class. Not really used for anything other than
    // debugging problems, but might be useful?
    bestMatch.classList.add(PLAYBACK_VIDEO_MATCHED_CLASS, MAX_CSS_CLASS);
    g_global.matchedVideo = bestMatch;

    const bestMatchCount = g_global.elementMatcher.getBestMatchCount();
    if (bestMatchCount > 1) {
      trace('found too many videos on page. #' + bestMatchCount);
      messageDisplay(`Found multiple, large videos. 
          Couldn't figure out which was the main one. Trying the most likely`,
          bestMatch);
    }

    injectCssHeader();

    trace('Final Best Matched Element: ', bestMatch.nodeName, bestMatch);
    g_global.hideEverythingTimer.startTimer(function() {
      // BBC has some special css with lots of !importants
      // TODO: fragile! We could hide all stylesheets, but then we'd be screwed
      // for html5 floating controls.
      hideCSS('screen-css');
      hideEverythingThatIsntLargestVideo();

      if (!reinstall) {
        // with no element parameter, then the whole doc is "touched"
        forceRefresh();
      } else {
        forceRefresh(g_global.matchedVideo);
      }
    });

    return true;  // stop retrying
  }

  function hideEverythingThatIsntLargestVideo() {
    if (document.readyState !== 'complete') {
      return false;
    }
    const videoMatchElem = g_global.matchedVideo;
    if (!videoMatchElem) {
      logerr('g_global.matchedVideo empty');
      return false;
    }

    trace('hideEverythingThatIsntLargestVideo');
    hideDomNotInTree(videoMatchElem);

    setTimeout(function() {
      FixUpAttribs(videoMatchElem);
    }, 1);

    const embeddedFrameTree = g_global.elementMatcher.getFrameTree();
    if (embeddedFrameTree.length) {
      trace('hiding logic for iframe. number of frames in tree:' +
            embeddedFrameTree.length);
      for (const frametree of embeddedFrameTree.reverse()) {
        hideDomNotInTree(frametree);
        FixUpAttribs(frametree);
      }
    }
    return true;  // stop retrying
  }

//// finding video logic. this code is a bit of a mess.
  /**
   *
   * @param doc {Document}
   * @return {boolean}
   */
  function findLargestVideoNew(doc) {
    try {
      for (const frame of doc.querySelectorAll('iframe')) {
        try {
          const allvideos = frame.contentWindow.document.querySelectorAll(
              'video');
          for (const eachvido of allvideos) {
            g_global.elementMatcher.checkIfBest(eachvido);
          }
        } catch (err) {
          trace(err);
        }
      }
      return (g_global.elementMatcher.getBestMatchCount() > 0);
    } catch (err) {
      trace(err);
      return false;
    }
  }

  function findLargestVideoOld(doc, iframe_tree, level = 0) {
    if (iframe_tree.length > 8) {
      trace('hit max iframe depth, returning');
      return false;
    }
    if (typeof (doc?.getElementsByTagName) !== 'function') {
      trace('getElementsByTagName is not function, bailing');
      return false;
    }
    trace(`findLargestVideoOld Depth: ${level} length: ${iframe_tree.length}`);

    checkVidsInDoc(doc);

    try {
      const iframes = [...doc.getElementsByTagName('iframe')];
      let foundnewmatch = false;
      for (const eachframe of iframes) {
        try {
          foundnewmatch = checkVidsInDoc(eachframe.contentDocument);
          if (foundnewmatch) {
            trace('found a good video match in an iframe, stopping search');
            iframe_tree.push(eachframe);
            g_global.elementMatcher.setNestedFrameTree(iframe_tree);
            // we found a good match, just return?
            // trace("returning from findLargestVideoOld level:" +
            // iframe_tree.length);
          } else {
            //// recursive nesting!!!
            // many sites (e.g. bing video search) buries frames inside of
            // frames
            trace('found nested iframes, going deeper');
            let deeper_iframe = arrayClone(iframe_tree);
            deeper_iframe.push(eachframe);
            if (findLargestVideoOld(foundnewmatch, deeper_iframe, level + 1)) {
              trace(
                  `  returning from findLargestVideoOld Depth: ${level} length: ${iframe_tree.length}`);
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
            foundnewmatch = g_global.elementMatcher.checkIfBest(eachframe);
            if (foundnewmatch) {
              trace(`  Found iframe correct ratio. cannot go deeper because of security. 
                               Depth: ${level}
                               Length: ${iframe_tree.length + 1}
                               frame`, eachframe);
              iframe_tree.push(eachframe);
              g_global.elementMatcher.setNestedFrameTree(iframe_tree);
              return true;  // new
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
    trace(`returning from findLargestVideoOld Depth: ${iframe_tree.length}`);
    return false;
  }

// returns true if a new video match was found.
  function checkVidsInDoc(doc) {
    if (!doc) {
      return false;
    }
    let matchedNew = false;
    for (const tagname of OBJ_TAGS.reverse()) {
      try {
        const elem_search = [...doc.getElementsByTagName(tagname)];
        if (elem_search) {
          for (const each_elem of elem_search) {    // .reverse()
            matchedNew |= g_global.elementMatcher.checkIfBest(each_elem);
          }
        }
      } catch (err) {
        logerr(err);
      }
    }
    return matchedNew;
  }

  function getElemComputedStyle(node) {
    let view = getElemsDocumentView(node);
    return view.getComputedStyle(node, null);
  }

  function getElemsDocumentView(node) {
    // this can probably be simplified
    if (node.ownerDocument !== null && node.ownerDocument !== document &&
        node.ownerDocument.defaultView !== null) {
      return node.ownerDocument.defaultView;
    }
    return document.defaultView;
  }

  function safeParseInt(str) {
    let result = parseInt(str, 10);
    return isNaN(result) ? 0 : result;
  }

  // function touchDocBodyToTriggerUpdate() {
  //   document.body.width = '99%';
  //   setTimeout(function() {
  //     document.body.width = '100%';
  //   }, 1);
  // }

  function forceRefresh(optional_elem) {
    // we now need to force the flash to reload by resizing... easy thing is to
    // adjust the body
    setTimeout(function() {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('visabilitychange'));
      if (optional_elem) {
        optional_elem?.dispatchEvent(new Event('visabilitychange'));
      } else {
        // touchDocBodyToTriggerUpdate();
      }
    }, 50);
  }

  /**
   * hiding elements in dom that aren't in tree for this element.
   * @param videoElem {Node}
   */
  function hideDomNotInTree(videoElem) {
    if (!videoElem) {
      return;
    }
    trace('hideDomNotInTree');
    let elemUp = videoElem;

    // let compstyle = getElemComputedStyle(videoElem); // used to resize divs
    let boundingclientrect = getBoundingClientRectWhole(videoElem);
    if (shouldUseParentDivForDockedCheck(videoElem)) {
      boundingclientrect = getBoundingClientRectWhole(videoElem.parentNode);
    }

    // todo: fix loop
    let saftyLoops = 1000;
    while (elemUp?.parentNode && saftyLoops--) {
      try {
        if (elemUp.nodeName.toUpperCase() !== 'SCRIPT') {
          addMaximizeClassToElem(elemUp);
        }
        hideSiblings(elemUp, boundingclientrect);
      } catch (ex) {
        logerr('hideDomNotInTree exception', ex);
      }
      elemUp = elemUp.parentNode;
    }
    if (DEBUG_ENABLED && saftyLoops === 0) {
      logerr('!!! hideDomNotInTree while loop ran too long');
    }
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
      // set the data-videomax-id = "zoomed" so undo can find it.
      node.setAttribute(`${VIDEO_MAX_ATTRIB_FIND}`, VIDEO_MAX_ATTRIB_ID);
      const attribs = node.attributes;

      trace('attrib count = ' + attribs.length);
      for (const eachattrib of attribs) {
        try {
          const name = eachattrib.name;
          const orgValue = eachattrib.value;
          let newValue = null;

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
              newValue = orgValue + ';'; // remove at end. needed for parsing
              newValue = newValue.replace(/width[\s]*:[\s]*[^;&]+/i,
                  `width: ${SCALESTRING_WIDTH}`);
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

              //default:
            case 'flashlets':
            case 'data':
              newValue = grepFlashlets(orgValue);
              break;
          }

          // replace only if set and not different
          if (newValue && newValue !== orgValue) {
            trace(`FixUpAttribs changing attribute: '${name}'
            old: '${orgValue}'
            new: '${newValue}'`, node);
            saveAttribute(node, name);
            node.setAttribute(name, newValue);
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
          if (!isElem(eachnode.setAttribute)) {
            debugger; // new
            continue;
          }
          const attrName = eachnode.getAttribute('name');
          const attrValue = eachnode.getAttribute('value');

          trace(`  FixUpAttribs found param '${attrName}': '${attrValue}'`);
          if (['flashlets', 'data'].includes(attrName.toLowerCase())) {
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
      newParams['bgcolor'] = '#000000';
      newParams['scale'] = 'showAll';
      newParams['menu'] = 'true';
      newParams['quality'] = 'high';
      newParams['width'] = SCALESTRING_WIDTH;
      newParams['height'] = SCALESTRING_HEIGHT;
      newParams['quality'] = 'high';
      newParams['autoplay'] = 'true';

      // edit in place
      for (const eachnode of node.childNodes) {
        if (eachnode.nodeName.toUpperCase() !== 'PARAM') {
          continue;
        }
        const name = eachnode.getAttribute('name');
        const orgValue = eachnode.getAttribute('value');

        if (newParams.hasOwnProperty(name)) { // is this one we care about?
          trace(`FixUpAttribs changing child param '${name}'
            old: '${orgValue}'
            new: '${newParams[name]}'`);

          saveAttribute(eachnode, name);
          eachnode.setAttribute(name, newParams[name]);
        }
      }
    }
    forceRefresh(node);
    return node;
  }

  function grepFlashlets(flashletsval) {
    let result = flashletsval;
    if (result !== '' && result?.match(/[\=\%]/i) !== null) {
      let rejoinedResult = [];
      let params = parseParams(flashletsval);
      if (params) {
        for (const key of params) {
          if (params.hasOwnProperty(key)) {
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
                let value = params[key];
                if (value?.match(/[\=\%]/i) !== null) {
                  params[key] = grepFlashlets(value);
                }
              }
                break;
            }

            rejoinedResult.push(
                '' + key + '=' + encodeURIComponent(params[key]));
          }
        }

        result = rejoinedResult.join('&');
        if (flashletsval.search(/\?/i) === 0) { // startswith
          result = '?' + result;
        }
      }
      trace('Replaced urls params:\n\tBefore:\t' + flashletsval +
            '\r\n\tAfter\t' + result);
    }
    return result;
  }

  function parseParams(urlformat) {
    let match, pl = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g, decode = function(s) {
          return decodeURIComponent(s.replace(pl, ' '));
        }, query = urlformat;

    let urlParamsResult = {};
    while (match = search.exec(query)) {
      urlParamsResult[decode(match[1])] = decode(match[2]);
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
    return (className?.indexOf(PREFIX_CSS_CLASS) !== -1);
  }

  /**
   * Copy over and attribute value so it can be restored by undo
   * @param node {Node || HTMLElement}
   * @param attributeName {string}
   */
  function saveAttribute(node, attributeName) {
    if (!isElem(node)) {
      return;
    }
    attributeName = attributeName.toLowerCase();
    const orgValue = node.getAttribute(attributeName) || '';
    if (!orgValue.length) {
      // nothing to save
      trace(`saveAttribute '${attributeName}' empty, nothing to save`, node);
      return false;
    }
    const startingdata = node.getAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO);
    const jsondata = JSON.parse(startingdata || '{}');
    if (Object.keys(jsondata).includes(attributeName)) {
      // already been saved bail
      trace(`saveAttribute '${attributeName}' already saved, not overwriting `,
          node, jsondata);
      return false;
    }

    // ok merge in and save
    jsondata[attributeName] = orgValue;
    node.setAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO, JSON.stringify(jsondata));
    trace(`saveAttribute '${attributeName}' old value ${orgValue}`, node);
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
      if (!containsAnyVideoMaxClass(node)) {
        trace(`Applying MAX_CSS_CLASS to ${node.nodeName} `, node);
        // hack. This crazy thing happens on some sites (dailymotion) where our
        // resizing the video triggers scripts to run that muck with the
        // element style, so we're going to save and restore that style so the
        // undo works.
        saveAttribute(node, 'style');
        node?.classList.add(MAX_CSS_CLASS);
      }
    } catch (ex) {
      logerr('EXCEPTION ajustElem exception: ', ex);
    }
  }

  /**
   *
   * @param elemIn { Node || HTMLElement }
   * @param boundingclientrect {{top: number, left: number, bottom: number,
   *     width: number, right: number, height: number}}
   */
  function hideSiblings(elemIn, boundingclientrect) {
    if (!elemIn) {
      trace('hideSiblings() elemIn is null');
      return;
    }
    // trace("hideSiblings for class '" + elemIn.className + "'
    // rect="+JSON.stringify(boundingclientrect));
    let elemParent = elemIn.parentNode;
    if (!elemParent) {
      return;
    }

    // could also use node.contains(elemIn) where node is the matched video?
    const parentIsVideo = elemIn.nodeName === 'VIDEO' || elemParent.nodeName ===
                          'VIDEO';
    const parentIsMaximized = elemIn.classList?.contains(MAX_CSS_CLASS) ||
                              elemIn.classList?.contains(
                                  PLAYBACK_CNTLS_CSS_CLASS) ||
                              elemParent.classList?.contains(MAX_CSS_CLASS) ||
                              elemParent.classList?.contains(
                                  PLAYBACK_CNTLS_CSS_CLASS);

    trace('hideSiblings');
    let sibs = getSiblings(elemParent);
    for (const each_sib of sibs.reverse()) {
      // if the element is inside the video's rect, then they are probably
      // controls. don't touch them. we are looking for elements that overlap.
      if (each_sib.isEqualNode(elemIn) || each_sib.nodeName.toUpperCase() ===
          'SCRIPT') {
        continue;
      }
      if (!isElem(each_sib)) {
        continue;
      }
      if (containsAnyVideoMaxClass(each_sib)) {
        continue;
      }

      let eachBoundingRect = getBoundingClientRectWhole(each_sib);
      trace('checking siblings\n', each_sib, eachBoundingRect);

      // todo: check z-order?

      // We're trying to NOT hide the controls the video is using.
      // everyone does it slightly different, so theres
      const bounded = isBoundedRect(boundingclientrect, eachBoundingRect);
      const bottomDocked = isBottomDocked(boundingclientrect, eachBoundingRect);
      const hasSliderRole = hasSliderRoleChild(each_sib);

      let handled = false;
      if (!(bounded || bottomDocked || hasSliderRole || parentIsVideo ||
            parentIsMaximized)) {
        // each_elem.style.setProperty("display", "none", "important");
        trace(`  Add HIDDEN_CSS_CLASS overlapping elem ${each_sib.nodeName}`,
            each_sib);
        each_sib.classList?.add(HIDDEN_CSS_CLASS);    // may be Node
        handled = true;
      }

      if (!handled) {
        g_global.foundOverlapping = true;
        trace(`Found overlapping elem ${each_sib.nodeName}`, each_sib);

        const isLikelyControls = hasSliderRole || bottomDocked ||
                                 (parentIsVideo && parentIsMaximized);

        if (!isLikelyControls) {
          trace(`  Add OVERLAP_CSS_CLASS to children ${each_sib.nodeName} `,
              each_sib);
          walkAllChildren(each_sib, function(each_child_elem) {
            let eachChildBoundingRect = getBoundingClientRectWhole(
                each_child_elem);
            if (isBoundedRect(boundingclientrect, eachChildBoundingRect) ||
                isBottomDocked(boundingclientrect, eachChildBoundingRect) ||
                hasSliderRoleChild(each_child_elem)) {
              if (!containsAnyVideoMaxClass(each_child_elem)) { // not already something else
                each_child_elem.classList.add(OVERLAP_CSS_CLASS);
                handled = true;
              }
            }
          });
        }

        if (!handled && isLikelyControls) {
          trace(`  Add PLAYBACK_CNTLS_CSS_CLASS ${each_sib.nodeName} `,
              each_sib);
          // we're going to assume it contains the playback controls and are
          // going to max with it.
          each_sib.classList?.add(PLAYBACK_CNTLS_CSS_CLASS);
          // todo: we don't undo this modification yet.
          // each_sib.setAttribute ? each_sib.setAttribute('width',
          // 'calc(100vw)') : '';
        } else {
          trace(`  Add HIDDEN_CSS_CLASS overlapping elem ${each_sib.nodeName}`,
              each_sib);
          each_sib.classList?.add(HIDDEN_CSS_CLASS);
          handled = true;
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
    let active_elems = getChildren(elem, null);
    actionFn(elem);  // call the parent element
    let safty = 5000;

    while (active_elems.length > 0 && safty--) {
      let next_elem = active_elems.pop();
      active_elems.concat(getChildren(next_elem, null));
      actionFn(elem);
    }
    if (DEBUG_ENABLED && safty === 0) {
      logerr('!!! hideDomNotInTree while loop ran too long');
    }
  }

  /**
   *
   * @param node {Node}
   * @param skipMe
   * @return {*[]}
   */
  function getChildren(node, skipMe) {
    let r = [];
    for (let sanityMax = 0; sanityMax < 10000; sanityMax++) {
      if (!node) {
        return r;
      }
      if (node?.nodeType === 1 && !node.isEqualNode(skipMe)) {
        r.push(node);
      }
      node = node.nextSibling;
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
   */
  function RetryTimeoutClass(delay, maxretries) {
    this.timerid = 0;
    // delay is dithered to for situations when inject happens twice.
    this.delay = delay + Math.round((0.5 - Math.random()) * delay / 10); //  +/-
                                                                         // 5%
                                                                         // dither.
    this.maxretries = maxretries;
    this.retrycount = 0;

    // func() returning true means done
    this.startTimer = function(func) {
      this.func = func;
      this.retryFunc(this);
    };

    this.retryFunc = function(self) {
      trace('RetryTimeoutClass.retryFunc');
      let result = false;
      let delay = self.delay;

      if (self.startdelay === 0) {
        result = self.func();
      } else {
        delay = self.startdelay;
        self.startdelay = 0;
      }
      if (result === false) {
        // returns true if we're done
        self.retrycount++;
        if (self.retrycount < self.maxretries) {
          self.cleartimeout();
          self.timerid = setTimeout(function g() {
            self.retryFunc(self);
          }, delay);
        }
      } else {
        self.cleartimeout();
      }
    };

    this.cleartimeout = function() {
      if (this.timerid) {
        clearTimeout(this.timerid);
        this.timerid = 0;
      }
    };
  }

  function injectCssHeader() {
    try {
      if (document.getElementById(STYLE_ID)) {
        trace('already injected css header skipping');
        return;
      }

      let link = document.createElement('link');
      link.href = chrome?.extension?.getURL(CSS_FILE);
      link.id = STYLE_ID;
      link.type = 'text/css';
      link.rel = 'stylesheet';
      link.media = 'all';
      document.getElementsByTagName('head')[0].appendChild(link);
    } catch (ex) {
      logerr('injectCssHeader ', ex);
    }
  }

//
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
    return ($(STYLE_ID) !== null);
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
      top: Math.round(rectC.top),
      left: Math.round(rectC.left),
      bottom: Math.round(rectC.bottom),
      right: Math.round(rectC.right),
      width: Math.round(rectC.width),
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
    if ((inner.top === outer.top) && (inner.left >= outer.left) &&
        (inner.bottom >= outer.bottom) && (inner.right >= outer.right)) {
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

  /**
   *
   * @param node {Node || HTMLElement}
   * @return {{top: number, left: number, bottom: number, width: number, right:
   *     number, height: number}}
   */
  function getBoundingClientRectWhole(node) {
    if (!isElem(node)) {  //todo: verify
      trace('getBoundingClientRectWhole failed, returning empty clientRect');
      return {top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0};
    } else {
      return wholeClientRect(node.getBoundingClientRect());
    }
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
    // must be same width and top must be touching bottom of parent
    let closeWidths = Math.abs(targetClientRect.width - parentClientRect.width); // widths can be real numbers (122.4)
    let result = (closeWidths < 4 && targetClientRect.top >=
                  parentClientRect.top && targetClientRect.top <=
                  parentClientRect.bottom + 5); // fudge
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
      trace(`Element has slider role elements, not hiding ${elem.nodeName}`,
          elem);
    }
    return result;
  }

  /**
   *
   * @param videoElem {Node}
   * @return {boolean}
   */
  function shouldUseParentDivForDockedCheck(videoElem) {
    if (videoElem.nodeName === 'VIDEO') {
      if (videoElem.className?.match(/html5\-main\-video/i) !== null) {
        let parent = videoElem.parentNode;
        if (parent && parent.className.match(/html5\-video\-container/i) !=
            null) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * @constructor
   */
  function ElemMatcherClass() {
    this.largestElem = null;
    // let g_LargestVideoClientRect = null;
    this.largestScore = 0; // width x height
    this.matchCount = 1;
    this.nestedFrameTree = [];

    /**
     *
     * @param elem {HTMLElement}
     * @return {boolean} True means done
     */
    this.checkIfBest = function(elem) {
      if (elem === this.largestElem) {
        trace('Matched element same as ideal element already');
        return true;
      } else if (this.largestElem && elem === this.largestElem.parentNode) {
        trace('Matched element same as parent.');
      }
      let replacedBest = false;
      let score = this._getElemMatchScore(elem);
      if (score > this.largestScore) {
        this.largestScore = score;
        this.largestElem = elem;
        this.matchCount = 1;
        // g_LargestVideoClientRect = getBoundingClientRectWhole(each_elem);
        replacedBest = true;
        trace('Making item best match: \t' + elem.nodeName + '\t' +
              elem.className + '\t' + elem.id);
      } else if (score === this.largestScore) {
        this.matchCount++;
      }

      return replacedBest;
    };

    this.getBestMatch = function() {
      return this.largestElem;
    };

    this.getBestMatchCount = function() {
      return this.matchCount;  // should be 1 for most cases
    };

    this.setNestedFrameTree = function(iframeTree) {
      this.nestedFrameTree = arrayClone(iframeTree);
    };

    this.getFrameTree = function() {
      return this.nestedFrameTree;
    };

    /**
     *   weight for videos that are the right ratios!
     *   16:9 == 1.77_  4:3 == 1.33_  3:2 == 1.50
     * @param elem {HTMLElement}
     * @return {number}
     * @private
     */
    this._getElemMatchScore = function(elem) {
      if (!elem) {
        return 0;
      }
      let width = 0, height = 0;
      let compstyle = getElemComputedStyle(elem);

      if (compstyle && compstyle.width && compstyle.height) {
        // make sure the ratio is reasonable for a video.
        width = safeParseInt(compstyle.width);
        height = safeParseInt(compstyle.height);
        if (width > 0 && height > 0) {
          trace('\t' + elem.nodeName + '\t' + width + '\t' + height + '\t' +
                (width / height) + '\t' + elem.className + '\t' + elem.id +
                '\t ', elem);
        }

        if (width >= 100 && height >= 75) {

          let ratio = width / height;
          if (ratio > 1.3 && ratio < 1.8) {
            trace('Found good ratio for.\t Ratio is: width=' + width +
                  ' height=' + height);
            return width * height;
          }
        }
      }
      trace('Ratio is wrong:\twidth:' + width + 'px\t height=' + height + 'px');
      return 0;
    };

    /**
     *
     * @param elem {HTMLElement}
     * @return {number}
     * @private
     */
    this._getElemMatchScore = function(elem) {
      if (!elem) {
        return 0;
      }
      // 16:9 == 1.77_  4:3 == 1.33_  3:2 == 1.50
      const VIDEO_RATIO_16_9 = (16.0 / 9.0);
      const VIDEO_RATIO_4_3 = (4.0 / 3.0);
      // const MAX_R_THRESHOLD = 0.15;
      // const MAX_R_ADJUST = 0.8;

      let width = 0, height = 0;
      let compstyle = getElemComputedStyle(elem);
      if (compstyle && compstyle.width && compstyle.height) {
        // make sure the ratio is reasonable for a video.
        width = safeParseInt(compstyle.width);
        height = safeParseInt(compstyle.height);

        if (width > 0 && height > 0) {
          trace('\tWidth:\t' + width + '\tHeight:\t' + height + '\tRatio:\t' +
                (width / height), elem);
        }

        // twitch allows videos to be any random size. If the width & height of
        // the window are too short, then we can't find the video.
        if (elem.id === 'live_site_player_flash') {
          trace('Matched twitch video. Returning high score.');
          return 300000;
        }

        if (width <= 100 || height <= 75) {  // Min size
          return 0;
        }

        let ratio = width / height;

        // which ever is smaller is better
        let bestRatioComp = Math.min((Math.abs(VIDEO_RATIO_16_9 - ratio)),
            (Math.abs(VIDEO_RATIO_4_3 - ratio)));

        if (bestRatioComp === 0) {
          bestRatioComp = 0.00000001;
        }

        // now invert the value so better values are closer to 1.0
        let logRatio = Math.log(bestRatioComp / 1.5);

        if (logRatio > 0) {
          return 0;
        }

        // weight that by multiplying it by the total volume (better is better)
        let weight = logRatio * width * height * -1;

        // try to figure out if iframe src looks like a video link.
        // frame shaped like videos?
        // todo: make a single grep?
        if (elem.nodeName.toUpperCase() === 'IFRAME') {
          let src = elem.getAttribute('src') || '';
          if (src.match(/\.facebook\.com/i)) {
            trace('demoting facebook plugin iframe. \tOld weight=' + weight +
                  '\tNew Weight=0');
            weight = 0;
          } else if (src.match(/javascript\:/i)) {
            trace('demoting :javascript iframe. \tOld weight=' + weight +
                  '\tNew Weight=0');
            weight = 0;
          } else if (src.match(/platform\.tumblr\.com/i)) {
            trace('demoting platform.tumbr.com \tOld weight=' + weight +
                  '\tNew Weight=0');
            weight = 0;
          } else if (src.match(/platform\.tumblr\.com/i)) {
            trace('demoting platform.tumbr.com \tOld weight=' + weight +
                  '\tNew Weight=0');
            weight = 0;
          }
          if (weight === 0) {
            return 0;
          }
        }

        // todo: now we need to figure in z-order? but we don't want to
        // overweight it.
        trace('Found good ratio weight:' + weight + '\t Ratio is: width=' +
              width + ' height=' + height + ' for ', elem);

        if ((compstyle.visibility && compstyle.visibility === 'hidden') ||
            ((compstyle.display && compstyle.display === 'none'))) {
          // Vimeo hides video before it starts playing (replacing it with a
          // static image), so we cannot ignore hidden. But UStream's homepage
          // has a large hidden flash that isn't a video.
          trace(' Hidden item. Reducing score by 50% ', elem);
          weight = weight * 0.5;
        }

        const tabindex = elem?.getAttribute('tabindex') || -1;
        if (tabindex !== -1) {
          // this is a newer thing for accessibility, it's a good indicator
          trace('tabindex = -1 increasing weight');
          weight = weight * 1.25;
        }

        if (elem.nodeName.toUpperCase() === 'VIDEO') {
          weight = weight * 1.50;
        }

        return weight;
      }

      trace(
          'Ratio is wrong:\t width:' + width + 'px\t height=' + height + 'px');
      return 0;
    };
  }

  function messageDisplay(...msg) {
    // todo: show a popup under out extension with a message. means
    // sending a message to the background task or injecting html into the page
    trace(...msg);
  }

} catch
    (err) {
  console.error('videomax extension error', err, err.stack);
  debugger;
}
