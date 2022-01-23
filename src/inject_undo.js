try { // scope and prevent errors from leaking out to page.
  const DEBUG_ENABLED = false;
  const TRACE_ENABLED = false;
  const ERR_BREAK_ENABLED = false;

  const STYLE_ID = 'maximizier-css-inject';

  const VIDEO_MAX_DATA_ATTRIB_UNDO = 'data-videomax-saved';
  const VIDEO_MAX_ATTRIB_FIND = 'data-videomax-target';
  const VIDEO_MAX_ATTRIB_ID = 'zoomed-video';

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
    PLAYBACK_VIDEO_MATCHED_CLASS,
  ];
  const SPEED_CONTROLS = `${PREFIX_CSS_CLASS}-speed-control'}`;

  /* eslint-disable: no-console no-undef no-octal-escape no-octal */
  const logerr = (...args) => {
    if (DEBUG_ENABLED === false) {
      return;
    }
    // eslint-disable-next-line no-console
    console.trace(
      '%c VideoMax Undo ',
      'color: white; font-weight: bold; background-color: blue',
      ...args,
    );
    if (ERR_BREAK_ENABLED) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
  };

  const trace = (...args) => {
    if (TRACE_ENABLED) {
      // blue color , no break
      // eslint-disable-next-line no-console
      console.log(
        '%c VideoMax ',
        'color: white; font-weight: bold; background-color: blue',
        ...args,
      );
    }
  };

  if (DEBUG_ENABLED) {
    // eslint-disable-next-line no-debugger
    debugger;
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

  function main() {
    setTimeout(() => {
      try {
        undoAll(document);
        recurseIFrameUndoAll(document);
        // remove the video "located" attribute.
        const videoelem = document.querySelector(
          `[${VIDEO_MAX_ATTRIB_FIND}=${VIDEO_MAX_ATTRIB_ID}]`,
        );
        if (videoelem && videoelem.removeAttribute) {
          videoelem.removeAttribute(VIDEO_MAX_ATTRIB_FIND);
        }
        forceRefresh(document);
      } catch (ex) {
        logerr(ex);
      }
    }, 1);
  }

  /**
   * @param doc {Document}
   */
  function recurseIFrameUndoAll(doc) {
    try {
      const allIFrames = doc.querySelectorAll('iframe');
      for (const frame of allIFrames) {
        try {
          const framedoc = frame.contentDocument;
          if (!framedoc) {
            continue;
          }
          setTimeout(undoAll, 1, framedoc);
          recurseIFrameUndoAll(framedoc);
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
  function removeAllClassStyles(doc) {
    const allElementsToFix = doc.querySelectorAll(
      `[class*="${PREFIX_CSS_CLASS}"]`,
    );
    for (const elem of allElementsToFix) {
      elem.classList.remove(...ALL_CLASSNAMES); // the '...' turns the array
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
  function undoStyleSheetChanges(doc) {
    try {
      const cssNode = doc.getElementById(STYLE_ID);
      if (cssNode?.parentNode?.removeChild()) {
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
  function restoreAllSavedAttribute(elem) {
    if (!isElem(elem)) {
      return;
    }
    const savedAttribsJson = JSON.parse(
      elem.getAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO) || '{}',
    );
    trace('restoreAllSavedAttribute for ', elem);
    for (const [key, value] of Object.entries(savedAttribsJson)) {
      trace(`  ${key}='${value}' `, elem);
      elem.setAttribute(key, value);
    }
    elem.removeAttribute(VIDEO_MAX_DATA_ATTRIB_UNDO);
    trace('  final restored elem:\' ', elem);
  }

  /**
   *
   * @param doc {Document}
   */
  function undoAttribChange(doc) {
    try {
      for (const elem of doc.querySelectorAll(
        `[${VIDEO_MAX_DATA_ATTRIB_UNDO}]`,
      )) {
        restoreAllSavedAttribute(elem);
        //  try and make the element realizes it needs to redraw. Fixes
        // progress bar
        elem.dispatchEvent(new Event('resize'));
      }
    } catch (ex) {
      logerr(ex);
    }
  }

  function undoSpeedControls(doc) {
    try {
      const elem = document.getElementById(SPEED_CONTROLS);
      elem?.parentElement?.removeChild(elem);
    } catch(ex) {
      logerr(ex);
    }
  }

  /**
   * @param doc {Document}
   */
  function undoAll(doc) {
    if (!doc) {
      return;
    }
    undoSpeedControls(doc);
    removeAllClassStyles(doc);
    undoAttribChange(doc);
    undoStyleSheetChanges(doc);
  }

  function touchDocBodyToTriggerUpdate() {
    document.body.width = '99%';
    setTimeout(() => {
      document.body.width = '100%';
    }, 1);
  }

  function forceRefresh(optionalElem) {
    // we now need to force the flash to reload by resizing... easy thing is to
    // adjust the body
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('visabilitychange'));
      if (optionalElem) {
        optionalElem?.dispatchEvent(new Event('visabilitychange'));
      } else {
        touchDocBodyToTriggerUpdate();
      }
    }, 50);
  }

  main();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('videomax extension error', err, err.stack);
}
