/**
 * There should be NO exernal includes.
 * Each function is injected into the page from the background script via executeScript
 * Any function abstraction needs to be inlined within the function.
 */

/**
 * This speeds up ALL <videos> not just the one zoomed.
 * Could just select the zoomed videos, but maybe useful when unzooming?
 * Also, while we try to set the speed, we'll get crossDomain errors that we can use
 * to requests more permissions so we can actually control the speed next time.
 *
 * @param newspeed {string}
 * @return {string[]}
 */
export const injectVideoSpeedAdjust = async (newspeed) => {
  const DEBUG_INJECT = false;
  /** @type {Set<string>} */
  const resultCrossDomainErrs = new Set(); // use Set to dedup

  if (DEBUG_INJECT) {
    /** @type {NodeListOf<HTMLVideoElement>} */
    const allVids = document.querySelectorAll("video");
    let count = 0;
    for (const eachVid of allVids) {
      count++;
      // skip videos that aren't loaded. mlb.com will play ads and video in the background
      // overlapping!
      if (!eachVid?.src?.length || eachVid.readyState < HTMLVideoElement.HAVE_CURRENT_DATA) {
        console.log(`
    VideoMaxExt injectVideoSpeedAdjust: 
      Video(${count} of ${allVids.length})
        src: "${eachVid.src}"
        readyState: ${eachVid.readyState} 
      Skipping
      `);
        continue;
      }
    //   console.log(`
    // VideoMaxExt injectVideoSpeedAdjust:
    //   Video(${count} of ${allVids.length})
    //     src: "${eachVid.src}"
    //     currentSrc: "${eachVid.currentSrc}"
    //     readyState: ${eachVid.readyState}
    //       (0=HAVE_NOTHING,1=HAVE_METADATA,2=HAVE_CURRENT_DATA,3=HAVE_FUTURE_DATA,4=HAVE_ENOUGH_DATA)
    //     playsInline: ${eachVid.playsInline}
    //     playbackRate: ${eachVid.playbackRate}
    //     defaultPlaybackRate: ${eachVid.defaultPlaybackRate}
    //     paused: ${eachVid.paused}
    //     played.length: ${eachVid.played.length} (TimeRange)
    //     preservesPitch: ${eachVid.preservesPitch}
    //     muted: ${eachVid.muted}
    //     defaultMuted: ${eachVid.defaultMuted}
    //     volumne: ${eachVid.volume}
    //     crossOrigin: ${eachVid.crossOrigin}
    //     controls: ${eachVid.controls}
    //     currentTime: ${eachVid.currentTime}
    //     preload: ${eachVid.preload}
    //     duration: ${eachVid.duration}
    //     ended: ${eachVid.ended}
    //     error: ${eachVid.error}
    //     loop: ${eachVid.loop}
    //     mediaKeys: ${eachVid.mediaKeys}
    //     networkState: ${eachVid.networkState}
    //       (NETWORK_EMPTY, NETWORK_IDLE, NETWORK_LOADING, NETWORK_NO_SOURCE)
    //     seekable.lenth: ${eachVid.seekable.length}
    //     seeking: ${eachVid.seeking}
    //     srcObject: ${eachVid.srcObject} (null?)
    //     textTracks: ${eachVid.textTracks}
    //   `, eachVid);
    }
  }

  if (document?.body) {
    try {
      document.body.setAttribute("data-videomax-playbackspeed", newspeed);
    } catch (err) {
      // could be cross frame error?
      // eslint-disable-next-line no-debugger
      debugger;
    }
  }

  /**
   * This is called when more data is loaded by the video.
   * When the video comes out of "spinner while loading more data" sometimes the speed gets reset
   * @param event {Event}
   * @private
   */
  const _loadStartFn = (event) => {
    try {
      // check to see if we're still injected into page.
      const runningAttr = document?.body?.getAttribute("data-videomax-running") || "";
      if (runningAttr.length <= 0) {
        if (DEBUG_INJECT) {
          // eslint-disable-next-line no-console
          console.log(`VideoMaxExt: loadStart injectVideoSpeedAdjust No longer injected, bailing`);
        }
        return;
      }
      const video_elem = event?.target;

      if (!!video_elem?.src?.length || video_elem.readyState < HTMLVideoElement.HAVE_CURRENT_DATA) {
        if (DEBUG_INJECT) {
          // eslint-disable-next-line no-console
          console.log(`VideoMaxExt: loadStart injectVideoSpeedAdjust not running since video not in correct state. 
          src:"${video_elem?.src}"
          readyState:${video_elem.readyState}`);
        }
        return;
      }


      const isVis = video_elem?.checkVisibility({
                                                  checkOpacity:       true,
                                                  checkVisibilityCSS: true,
                                                }) || false;
      const speedNumber = Math.abs(parseFloat(newspeed));
      if (DEBUG_INJECT) {
        // eslint-disable-next-line no-console
        console.log(
          `VideoMaxExt: loadStart injectVideoSpeedAdjust
          isVis: ${isVis} (false means won't set speed) 
          speedNumber: ${speedNumber}
          video_elem.playbackRate: ${video_elem?.playbackRate}, video_elem`);
      }
      if (isVis && video_elem && video_elem?.playbackRate !== speedNumber) { // it's changed
        video_elem.playbackRate = speedNumber;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`VideoMaxExt: loadStart err`, err);
    }
  };

  /**
   *
   * @param doc {Document}
   * @param newPlaybackRate {number} Neg means paused, but the speed is the "toggle back to speed"
   * @private
   */
  const _injectSetSpeedForVideosFn = async (doc, newPlaybackRate) => {
    /** @param el {HTMLVideoElement} * */
    const _isVisibleFnFn = (el) => el?.checkVisibility({
                                                         checkOpacity:       true,
                                                         checkVisibilityCSS: true,
                                                       }) || false;
    const _getCenterCoordsFnFn = () => {
      // we hide scrollbars as part of zoom, so body element should be good enough?
      try {
        return {
          centerX: Math.round(window.innerWidth / 2),
          centerY: Math.round(window.innerHeight / 2),
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(`VideoMaxExt: _injectSetSpeedForVideosFn doc size empty`, doc);
        return {
          centerX: 0,
          centerY: 0,
        };
      }
    };

    /** @return {HTMLVideoElement || undefined} * */
    const _getTopVisibleVideoElemFnFn = () => {

      const {
        centerX,
        centerY,
      } = _getCenterCoordsFnFn(doc);

      if (centerX < 50 || centerY < 50) {
        return undefined;
      }
      const layedElems = doc.elementsFromPoint(centerX, centerY);

      // we walk down the layers checking to see if it's a video and if it's visible.
      const matches = layedElems.filter((eachLayer) => {
        if (eachLayer?.nodeName.toLowerCase() === "video") {
          return _isVisibleFnFn(eachLayer);
        }
        return false;
      });

      if (DEBUG_INJECT) {
        // eslint-disable-next-line no-console
        console.log(`VideoMaxExt: _injectSetSpeedForVideosFn 
        centerX:${centerX}
        centerY:${centerY}
        layedElems.length: ${layedElems.length}
        matches.length: ${matches.length}
        layedElems:
        `, layedElems);
      }
      if (matches.length) {
        return matches[0];
      }
      // can happen when page NOT tagonly like amazon.
      const matchedVideo = doc.querySelectorAll(`[data-videomax-target]`);
      if (DEBUG_INJECT) {
        // eslint-disable-next-line no-console
        console.log(`VideoMaxExt: _injectSetSpeedForVideosFn
        elementsFromPoint failed to find video. directly searching
        matchedVideo: ${matchedVideo.length}
        `, matchedVideo[0] || "undefined");
      }
      return matchedVideo[0] || undefined;
    };

    // Always remove possible loadstart listeners since ads may be on top of older videos
    // v108 filter out any videos that don't have a src or data to play. mba.com
    /** @type {HTMLVideoElement[]} */
    const videos = [...doc.querySelectorAll("video")]
      .filter((eachVid) => !eachVid?.src?.length && eachVid.readyState >=
                           HTMLVideoElement.HAVE_CURRENT_DATA);

    for (const eachVideo of videos) {
      eachVideo.removeEventListener("loadstart", _loadStartFn);
    }

    const topVisVideo = _getTopVisibleVideoElemFnFn();
    if (!topVisVideo) {
      // this happens a lot when injected into a iframe that's not a video one
      return;
    }
    // if the speed is negative, then we pause
    if (newPlaybackRate <= 0) {
      await topVisVideo.pause();
    } else if (topVisVideo?.paused && !topVisVideo?.ended) {
      await topVisVideo.play();
    }
    // topVisVideo.defaultPlaybackRate = speed;
    topVisVideo.playbackRate = Math.abs(newPlaybackRate);
    topVisVideo.addEventListener("loadstart", _loadStartFn);
  };

  const speadNumber = parseFloat(newspeed);
  await _injectSetSpeedForVideosFn(document, speadNumber);

  const allIFrames = document.querySelectorAll("iframe");
  for (const frame of [...allIFrames]) {
    try {
      const framedoc = frame?.contentDocument || frame?.contentWindow?.document;
      if (!framedoc) {
        continue;
      }
      // We WANT to await in a loop because we EXPECT to get errors thrown for cross-frame security
      // eslint-disable-next-line no-await-in-loop
      await _injectSetSpeedForVideosFn(framedoc, speadNumber);
    } catch (err) {
      // in theory, we could try to record this url and add it to the request?
      // but this is run in the context of the page see GET_IFRAME_PERMISSIONS
      // console.warn(`Possible VideoMax speed error for "frame" probably cross-domain-frame`,
      // frame, err);
      if (frame?.src?.length && window?._VideoMaxExt?.matchedVideo?.nodeName === "IFRAME") {
        const url = frame?.src;
        if (url.startsWith("https://")) {
          const domain = (new URL(url)).host.toLowerCase();
          const iframeUrl = window._VideoMaxExt.matchedVideo.src?.toLowerCase() || "";
          if (iframeUrl.indexOf(domain) !== -1) {
            resultCrossDomainErrs.add(domain);
            // console.trace(`VideoMax speed error Need access to ${domain}`);
          }
        }
      }
    }
  }
  return [...resultCrossDomainErrs]; // Set->array
};

/** @return {string} * */
export const injectGetPlaypackSpeed = () => {
  try {
    // we stash the current injected speed in the body as an attr.
    const attrValue = document?.body?.getAttribute("data-videomax-playbackspeed");
    if (attrValue?.length) {
      return attrValue;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`VideoMaxExt: injectGetPlaypackSpeed err for video`, err);
  }
  return "1.0";
};

/**
 * @param skipSecondsStr {string}  negative numbers backwards
 */
export const injectVideoSkip = (skipSecondsStr) => {
  const skipSeconds = parseFloat(skipSecondsStr);
  for (const eachVideo of document.querySelectorAll("video")) {
    try {
      if (!eachVideo.checkVisibility({
                                       checkOpacity:       true,
                                       checkVisibilityCSS: true,
                                     })) {
        // eslint-disable-next-line no-console
        // console.log(`VideoMaxExt: injectVideoSkip checkVisibility=false, skipping`, eachVideo);
        continue;
      }
      if (!eachVideo?.seekable?.length > 0) {
        // eslint-disable-next-line no-console
        // console.log(`VideoMaxExt: injectVideoSkip not seekable, skipping`, eachVideo?.seekable);
        continue;
      }
      // restore playback speed after we skip
      const savedSpeed = eachVideo.playbackRate || 1.0;

      // eachVideo.pause(); // pause/play trigger controls to briefly show. (doesn't rehide on some
      // sites)

      // don't go negative;
      eachVideo.currentTime = Math.max(0, eachVideo.currentTime + skipSeconds);
      eachVideo.playbackRate = savedSpeed;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`VideoMaxExt: injectVideoSkip err for video`, err, eachVideo);
    }
  }
};

/**
 *
 * @param cssHRef {string}
 * @param styleId {string}
 * @returns {boolean}
 */
export const injectCssHeader = (cssHRef, styleId) => {
  const MIN_IFRAME_WIDTH = 320;
  const MIN_IFRAME_HEIGHT = 240;

  try {
    if (document.getElementById(styleId)) {
      // eslint-disable-next-line no-console
      // console.log(`VideoMax Native Inject. Style header already injected "${styleId}"`);
      return true;
    }
    if (window.innerWidth < MIN_IFRAME_WIDTH || window.innerHeight < MIN_IFRAME_HEIGHT) {
      // eslint-disable-next-line no-console
      // console.log(`VideoMax Native Inject. Style header already injected "${styleId}"`);
      return true;
    }
    const styleLink = document.createElement("link");
    styleLink.id = styleId;
    styleLink.href = cssHRef;
    styleLink.type = "text/css";
    styleLink.rel = "stylesheet";
    styleLink.media = "all";
    document.getElementsByTagName("head")[0]?.appendChild(styleLink);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`****** VideoMax ERROR Native Inject
        Injecting style header failed. CSP?
        ******`, err);
    return false;
  }
};

/**
 * Remove the style element from the header
 * @param styleId {String}
 */
export const uninjectCssHeader = (styleId) => {
  // warning run inside context of page
  try {
    const cssHeaderNode = document.getElementById(styleId);
    cssHeaderNode?.parentNode?.removeChild(cssHeaderNode);
  } catch (_err) { }
};

/**
 * needed because we cannot include a chrome reference css for a file:// or
 * if the CSP is too strict. Fallback it to inject from background task.
 * @param cssHRef {String}
 * @returns {boolean}
 */
export const injectIsCssHeaderIsBlocked = (cssHRef) => {
  let isBlocked = true; // default to failed.
  try {
    for (let ii = document.styleSheets?.length || 0; ii >= 0; ii--) {
      // we loop backward because our is most likely last.
      if (document.styleSheets[ii]?.href === cssHRef) {
        // try to access the rules to see if it loaded correctly
        try {
          isBlocked = (document.styleSheets[ii].cssRules?.length) === 0;
        } catch (_err) { }
        break;
      }
    }
  } catch (_err) {
  }
  if (isBlocked) {
    // eslint-disable-next-line no-console
    console.log("VideoMaxExt: css include file blocked?");
  }
  return isBlocked;
};
