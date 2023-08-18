// @ts-check
/*

 Video Maximizer
 Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

 Copyright (C) 2023 trophygeek@gmail.com
 www.videomaximizer.com

 Creative Commons Share Alike 4.0
 To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/

 */
import {
  BETA_UPDATE_NOTIFICATION_VERISON,
  CSS_FILE,
  CSS_STYLE_HEADER_ID,
  DEAULT_SPEED,
  DEFAULT_SETTINGS,
  DEFAULT_SPEED,
  domainToSiteWildcard,
  getDomain,
  getManifestJson,
  getSettings,
  isPageExcluded,
  logerr,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  trace,
} from "./common.js";

// "What's the current state of a tab?" is a serious problem when trying to be a secure extension.
// When the user clicks our extensions icon, the background can get permissions it needs to
// get information it needs to run (like the url so it can see if the site is a "no zoom needed").
// BUT when the popup UI is used and the user clicks on a button inside this UI to change speed.
// BUT the background doesn't have all the same permissions when it gets a message from the popup.
// The popup also doesn't really have access to all the information about the target page content
// either.
//
// The solution is to keep track of the various states of each tab that has had VidMax injected
// in memory (like a map of {[TabId]: currentState} )
// BUT background services in v3 can be unloaded at any time (and oh they are)
// so this global data is often just lost.
// So it must be persisted somehow... often this is done using local storage, but that immediately
// hits some snags:
//   Saving state in localStorage is basically impossible because the storage API is async (used
//   to save off the current state), BUT chrome Unloading message is NOT async friendly, so it's
//   async writing ALL the time.
//
// The most robust and low overhead approach is to get CHROME to store information about each
// tab for the background service. There are only a few ways to do this and NONE of them
// are intended for this purpose:
//   chrome.action.enable/chrome.action.disable state
//   chrome.action.getBadgeBackgroundColor
//   chrome.action.getBadgeText
//   chrome.action.getPopup
//   chrome.action.getTitle
//
// We don't need much data since we have < 8 possible states.
//  getBadgeBackgroundColor is an rgba()... so if we could use the alpha bit
//  getBadgeText: if we have unique "text" for each state, then this works nicely
//                BUT ZOOM+SPEED and just SPEED (sites that already zoom) overlap
//  getPopup: This is the url for our popup. But it's current SET based on state.
//  getTitle: If each title should/could be unique, so it should work. But localizing
//            will become harder later. There are multiple titles per state for
//            errors: UNSUPPORTED_URL, SECURITY_CHECK_FAILED
//
// Is it too much to ask to have a simple chrome.action.setStateData()/getStateData() that only
// has the same lifetime as tab badge data and limit it to 4k or something.

// Badges show state to user
const BADGES = {
  NONE:    "",
  ZOOMED:  "←  →",
  SPEED:   "▶️",
  REFRESH: "↺",
  WARNING: "!",
};

const DEFAULT_COLOR = "#FFFFFF00";

/** @type {BackgroundStateMap} */
const STATE_DATA = {
  // each title MUST be unique! Reverse lookup uses the title to
  // map chrome.action.getTitle back to state.
  // titles need localization support
  UNZOOMED:           {
    badge:     BADGES.NONE,
    title:     "", // if empty, reloaded from manifest
    showpopup: false,
    zoomed:    false,
    color:     DEFAULT_COLOR,
  },
  ZOOMING:            {
    badge:     BADGES.ZOOMED,
    title:     "Searching for videos to zoom",
    showpopup: false,
    zoomed:    true,
    color:     DEFAULT_COLOR,
  },
  ZOOMING_SPEED_ONLY: {
    badge:     BADGES.ZOOMED,
    title:     "Searching for videos enhance",
    showpopup: true,
    zoomed:    true,
    color:     DEFAULT_COLOR,
  },
  ZOOMED_NOSPEED:     {
    badge:     BADGES.SPEED,
    title:     "Click to unzoom\nNo speed change allowed by this site.",
    showpopup: false,
    zoomed:    true,
    color:     DEFAULT_COLOR,
  },
  ZOOMED_SPEED:       {
    badge:     BADGES.SPEED,
    title:     "Click to change speed or unzoom",
    showpopup: true,
    zoomed:    true,
    color:     DEFAULT_COLOR,
  },
  SPEED_ONLY:         {
    badge:     BADGES.SPEED,
    title:     "Click to change speed",
    showpopup: true,
    zoomed:    true,
    color:     DEFAULT_COLOR,
  },
  REFRESH:            {
    badge:     BADGES.REFRESH,
    title:     "Permissions check complete.\nClick again more permissions might be needed..",
    showpopup: false,
    zoomed:    false,
    color:     "#03FC80F4",
  },
  ERR_PERMISSION:     {
    badge:     BADGES.WARNING,
    title:     "Permission denied by user",
    showpopup: false,
    zoomed:    false,
    color:     "#FCD2D2F7",
  },
  ERR_URL:            {
    badge:     BADGES.WARNING,
    title:     "Extension only works on https sites\n or files dragged+dropped into chrome tab",
    showpopup: true,
    zoomed:    false,
    color:     "#FCD2D2F7",
  },
};

// REALLY trying to not require full permissions, but sometime iframes are
// cross-domain and need more permissions. Try to collect iframe domains
// and ask user's ADDITIONAL permission, but it STILL requires a full page
// refresh to re-prompt?!?
const GET_IFRAME_PERMISSIONS = true;

const BLOCKED_SKIP_DOMAINS = ["netflix."]; // skipping breaks these sites

// holds subframe urls so we can request access to them. no GC because chrome frees this
// background service pretty aggressively.
/** @type {SubFramePermMatching} */
const g_globalAccessSubframeData = {};

/** @type SubFrameParamData */
const EMPTY_ACCESS_SUBFRAME = {
  tabId:       0, // also key
  domain:      "",
  subFrameStr: "",
};

/**
 *
 * @param tabId {number}
 * @param domainMatch {string}
 * @return {SubFrameParamData || false}
 */
function getSubframeData(tabId, domainMatch) {
  if (domainMatch === "") {
    return false;
  }
  const match = g_globalAccessSubframeData[tabId] || EMPTY_ACCESS_SUBFRAME;
  if (match.domain.indexOf(domainMatch) !== -1) {
    trace(`getSubframeData match tabId: "${tabId}"  ${domainMatch} result: `, match);
    return match;
  }
  return false;
}

function setSubframeData(tabId, domain, subFrameStr) {
  trace(`setSubframeData tabId:"${tabId}", domain:"${domain}", subFrameStr: "${subFrameStr}"`);
  g_globalAccessSubframeData[tabId] = {
    tabId,
    domain,
    subFrameStr,
  };
}

/**
 * This will get GC deleted often, but if the background knows it, it saves
 * an async call into the page to re-get the last playback speed.
 * @type {KeyValuePair} */
const g_SpeedByTabData = {};

/**
 * @param tabId {number}
 * @param domain {string}
 * @param speed {string}
 * @return {boolean}
 */
function setSpeedGlobalData(tabId, domain, speed) {
  const wasSet = g_SpeedByTabData[`${tabId}-${domain}`] !== undefined;
  g_SpeedByTabData[`${tabId}-${domain}`] = speed;
  return wasSet;
}

/**
 * @param tabId {number}
 * @param domain {string}
 * @return {string}
 */
function getGlobalSpeedData(tabId, domain) {
  return g_SpeedByTabData[`${tabId}-${domain}`] || DEAULT_SPEED;
}

/** @type {number[]} */
let g_PopupOpenedForTabs = [];

/**
 * Some sites (hampster) will trigger an
 * @type {KeyValuePair} */
let g_LastUrlFromOnUpdated = {};

/**
 * @param tabId {number}
 * @param url {string}
 * @return {boolean}
 */
function setLastUrlFromOnUpdated(tabId, url) {
  const wasSet = g_LastUrlFromOnUpdated[`${tabId}`] !== undefined;
  g_LastUrlFromOnUpdated[`${tabId}`] = url;
  return wasSet;
}

/**
 * @param tabId {number}
 * @return {string}
 */
function getLastUrlFromOnUpdated(tabId) {
  return g_LastUrlFromOnUpdated[`${tabId}`] || "";
}

/**
 * Injection returns an array of results, this aggregates them into a single result.
 * @param injectionResults {InjectionResult[]}
 * @param defaultVal {boolean} Assume default is true or false. If any result in array is different
 *                              then it that's the result of all of the values.
 * @returns {boolean}
 */
function injectionResultCheck(injectionResults, defaultVal = false) {
  if ((injectionResults?.length || 0) === 0) {
    return defaultVal;
  }
  for (const frameresult of injectionResults) {
    if (frameresult.result !== defaultVal) {
      return frameresult.result;
    }
  }
  return defaultVal;
}

/**
 * This speeds up ALL <videos> not just the one zoomed.
 * Could just select the zoomed videos, but maybe useful when unzooming?
 * @param newspeed {string}
 * @return {string[]}
 */
const injectVideoSpeedAdjust = async (newspeed) => {
  const PLAYBACK_SPEED_ATTR = "data-videomax-playbackspeed";
  const PLAYBACK_PAUSED_ATTR = "data-videomax-paused";
  /** @type {Set<string>} */
  const result = new Set(); // use Set to dedup

  /** nested local function * */
  const _loadStart = (event) => {
    try {
      console.log(`VideoMaxExt: loadStart\n`, event);
      const video_elem = event?.target;
      const isVis = video_elem?.checkVisibility({
                                                  checkOpacity:       true,
                                                  checkVisibilityCSS: true,
                                                }) || false;
      // we only mess with the playback speed if we set it.
      const playbackSpeed = video_elem?.getAttribute(PLAYBACK_SPEED_ATTR);
      if (!!playbackSpeed) {
        // eslint-disable-next-line no-console
        console.log(
          `VideoMaxExt: loadStart injectVideoSpeedAdjust Attr"${PLAYBACK_SPEED_ATTR}": undefined skipping`);
        return;
      }
      const speedNumber = Math.abs(parseFloat(playbackSpeed));
      if (video_elem?.playbackRate !== speedNumber) { // it's changed
        // eslint-disable-next-line no-console
        console.log(
          `VideoMaxExt: loadStart injectVideoSpeedAdjust 
          speedNumber: ${speedNumber}
          isVis: ${isVis}
          Attr"${PLAYBACK_SPEED_ATTR}": ${playbackSpeed} !== video_elem.playbackRate: ${video_elem?.playbackRate}`);
        video_elem.playbackRate = speedNumber;
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `VideoMaxExt: loadStart injectVideoSpeedAdjust
          speedNumber: ${speedNumber}
          isVis: ${isVis}
          Attr"${PLAYBACK_SPEED_ATTR}": ${playbackSpeed} === video_elem.playbackRate: ${video_elem?.playbackRate}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`VideoMaxExt: loadStart err`, err);
    }
  };

  /**
   *
   * @param doc {Document}
   * @param speed {number} Neg means paused, but the speed is the "toggle back to speed"
   * @private
   */
  const _injectSetSpeedForVideos = async (doc, speed) => {
    const _isVisible = (el) => el?.checkVisibility({
                                                     checkOpacity:       true,
                                                     checkVisibilityCSS: true,
                                                   }) || false;
    const _getCoords = (el) => { // crossbrowser version
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
        console.error(err);
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
    const _isTopVisibleVideoElem = (videoElem) => {
      const {
        top,
        left,
        width,
        height,
      } = _getCoords(videoElem);
      const layedElems = document.elementsFromPoint(Math.round(left + (width / 2)),
                                                    Math.round(top + (height / 2)));

      // we walk down the layers checking to see if it's a video and if it's visible.
      const matches = layedElems.filter((eachLayer) => {
        if (eachLayer.nodeName.toLowerCase() !== "video") {
          return false;
        }
        return _isVisible(eachLayer);
      });
      if (matches.length === 0) {
        return false;
      }
      return videoElem.isSameNode(matches[0]);
    };

    const PLAYBACK_SPEED_ATTR = "data-videomax-playbackspeed";
    try {
      /** @type {NodeListOf<HTMLVideoElement>} */
      const videos = doc.querySelectorAll("video");
      for (const eachVideo of videos) {
        try {
          eachVideo.removeEventListener("loadstart", _loadStart);
          const isVisible = _isVisible(eachVideo);
          if (!isVisible) {
            // eslint-disable-next-line no-console
            console.log(
              "VideoMaxExt: injectVideoSpeedAdjust: eachVideo.checkVisibility is false for ",
              eachVideo);
            continue;
          }
          const wantsToBePaused = speed <= 0;
          const videoMaxSavedSpeed = eachVideo.getAttribute(PLAYBACK_SPEED_ATTR);
          const weSetSpeed = !!videoMaxSavedSpeed;
          const isTopVisible = _isTopVisibleVideoElem(eachVideo);
          if (!isTopVisible) {
            console.log(`VideoMaxExt: injectVideoSpeedAdjust: not top visible video, skipping`,
                        eachVideo);
            continue;
          }

          // not paused, but should be.
          if (eachVideo?.paused === false && // should not already be paused.
              eachVideo.defaultPlaybackRate !== 0 &&
              wantsToBePaused) {
            // don't worry about setting the speed, since we're about to pause?
            console.log(`VideoMaxExt: injectVideoSpeedAdjust: pausing
                eachVideo?.paused ${eachVideo?.paused}
                eachVideo.defaultPlaybackRate: "${eachVideo.defaultPlaybackRate}"
                wantsToBePaused: ${wantsToBePaused}
                isTopVisible: ${isTopVisible}
                elem:`, eachVideo);
            eachVideo.pause();
            eachVideo.setAttribute(PLAYBACK_SPEED_ATTR, String(speed));
            continue;
          }

          // the user clicked a speed.
          // problem... crunchyroll AGAIN. If there are ads and the main video on the page,
          // this this can trigger BOTH of them playing. so we check PLAYBACK_PAUSED_ATTR so
          // we ONLY unpause videos we paused. In theory, we could try to check if this is the
          // topmost video, but because of ad iframes on different sites cover videos - but both
          // are
          // // technically "visible" (AND the iframes having videos in them, but are on different
          // domains with cross-frame security blocking coodinations), it gets really really tricky
          // fast. Experimented with just setting playback speed to zero and not pausing, but then
          // it can get confusing to unpause.
          if (wantsToBePaused === false &&
              eachVideo?.paused === true &&
              weSetSpeed) {
            // don't worry about setting the speed, since we're about to pause?
            console.log(`VideoMaxExt: injectVideoSpeedAdjust: UNpausing
                eachVideo?.paused ${eachVideo?.paused}
                eachVideo.defaultPlaybackRate: "${eachVideo.defaultPlaybackRate}"
                wantsToBePaused: ${wantsToBePaused}
                weSetSpeed: ${weSetSpeed}
                isTopVisible: ${isTopVisible}
                elem:`, eachVideo);


            eachVideo.removeAttribute(PLAYBACK_PAUSED_ATTR);
            await eachVideo.play();
            eachVideo.defaultPlaybackRate = speed;
            eachVideo.playbackRate = speed;
            continue;
          }

          // finally just a boring "set the new speed"
          if (speed > 0 && speed !== eachVideo.defaultPlaybackRate) {
            console.log(`VideoMaxExt: injectVideoSpeedAdjust: Just setting speed
                speed >0 && speed !==eachVideo.defaultPlaybackRate 
                speed: ${speed}
                eachVideo.defaultPlaybackRate: ${eachVideo?.defaultPlaybackRate}
                eachVideo?.paused: ${eachVideo?.paused}
                weSetSpeed: ${weSetSpeed}
                isTopVisible: ${isTopVisible}
                elem:`, eachVideo);


            eachVideo.defaultPlaybackRate = speed;
            eachVideo.playbackRate = speed;
            eachVideo.setAttribute(PLAYBACK_SPEED_ATTR, `${speed}`);
            eachVideo.addEventListener("loadstart", _loadStart);
            continue;
          }
          console.log(`VideoMaxExt: injectVideoSpeedAdjust: No rules applied, not doing anything
                eachVideo.defaultPlaybackRate: ${eachVideo?.defaultPlaybackRate}
                eachVideo?.paused: ${eachVideo?.paused}
                speed: ${speed}
                wantsToBePaused: ${wantsToBePaused}
                weSetSpeed: ${weSetSpeed}
                isTopVisible: ${isTopVisible}
                elem:`, eachVideo);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`VideoMaxExt: injectVideoSpeedAdjust _speedUpFoundVideos for "video"`,
                        eachVideo, err);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`VideoMaxExt: doc.querySelectorAll("video") blocked cross iframe?`, doc, err);
    }
  };

  if (document._VideoMaxExt?.playbackSpeed) {
    document._VideoMaxExt.playbackSpeed = newspeed;
  }
  const speadNumber = parseFloat(newspeed);
  await _injectSetSpeedForVideos(document, speadNumber);

  const allIFrames = document.querySelectorAll("iframe");
  for (const frame of [...allIFrames]) {
    try {
      const framedoc = frame?.contentDocument || frame?.contentWindow?.document;
      if (!framedoc) {
        continue;
      }
      await _injectSetSpeedForVideos(framedoc, speadNumber);
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
            result.add(domain);
            // console.trace(`VideoMax speed error Need access to ${domain}`);
          }
        }
      }
    }
  }
  return [...result]; // Set->array
};

/**
 *
 * @return {string}
 */
function injectGetPlaypackSpeed() {
  try {
    return document._VideoMaxExt?.playbackSpeed || DEFAULT_SPEED;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`VideoMaxExt: injectGetPlaypackSpeed err for video`, err);
    return DEFAULT_SPEED;
  }
}

/**
 * @param skipSecondsStr {string}  negative numbers backwards
 */
function injectVideoSkip(skipSecondsStr) {
  const skipSeconds = parseFloat(skipSecondsStr);
  for (const eachVideo of document.querySelectorAll("video")) {
    try {
      if (!eachVideo.checkVisibility({
                                       checkOpacity:       true,
                                       checkVisibilityCSS: true,
                                     })) {
        console.log(`VideoMaxExt: injectVideoSkip checkVisibility=false, skipping`, eachVideo);
        continue;
      }
      if (!eachVideo?.seekable?.length > 0) {
        console.log(`VideoMaxExt: injectVideoSkip not seekable, skipping`, eachVideo?.seekable);
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
}

/**
 *
 * @param cssHRef {string}
 * @param styleId {string}
 * @returns {boolean}
 */
function injectCssHeader(cssHRef, styleId) {
  try {
    if (document.getElementById(styleId)) {
      // eslint-disable-next-line no-console
      console.log(`VideoMax Native Inject. Style header already injected "${styleId}"`);
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
}

/**
 * Remove the style element from the header
 * @param styleId {String}
 */
function uninjectCssHeader(styleId) {
  // warning run inside context of page
  try {
    const cssHeaderNode = document.getElementById(styleId);
    cssHeaderNode?.parentNode?.removeChild(cssHeaderNode);
  } catch (_err) { }
}

/**
 * needed because we cannot include a chrome reference css for a file:// or
 * if the CSP is too strict. Fallback it to inject from background task.
 * @param cssHRef {String}
 * @returns {boolean}
 */
function injectIsCssHeaderIsBlocked(cssHRef) {
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
    console.log("VideoMaxExt: css include file blocked.");
  }
  return isBlocked;
}


/**
 *
 * @param tabId {number}
 * @param startingState {BackgroundState|""}
 * @param domain {String}
 * @param speed {String}
 * @return {Promise<void>}
 */
async function setCurrentTabState(tabId, startingState, domain = "", speed = DEAULT_SPEED) {
  try {
    let state = startingState;
    // map state to another state.
    if (state === "") {  // means "preserve state"
      trace(`setCurrentState "" => preserve state`);
      // kind of a hack. Means don't change state.
      state = await getCurrentTabState(tabId);
      if (state === "REFRESH") { // Exception
        state = "ZOOMING"; // remapped again below
      }
    }

    switch (state) {
      case "ZOOMING":
        trace(`setCurrentState "${state}"`);
        state = await getSettingUseAdvFeatures() ? "ZOOMED_SPEED" : "ZOOMED_NOSPEED";
        break;

      case "ZOOMING_SPEED_ONLY":
        trace(`setCurrentState "${state}"`);
        state = "SPEED_ONLY";
        break;

      default:
      // no-op
    }

    const {
      badge,
      title,
      showpopup,
      color,
    } = STATE_DATA[state];
    trace(`setCurrentState "${state}"
    badge: "${badge}"
    title: "${title}"
    showpopup: "${showpopup}"
    color: "${color}"`, STATE_DATA[state]);

    // we need to pass in the tab id because the popup js can't get it and the
    // the message sent to background is missing it.
    let popup = showpopup ?
                `popup.html#tabId=${tabId}&speed=${speed}&domain=${domain}&badge=${badge}` :
                "";

    const settings = await getSettings();
    if (settings.firstUseShown === false) {
      trace("showing first_use.html");
      popup = `first_use.html#tabId=${tabId}&speed=${speed}&domain=${domain}&badge=${badge}`;
    }

    trace(`popup url "${popup}"`);
    // don't think the order matters, just set them all and wait for them to complete.
    await Promise.all([chrome.action.setBadgeText({
                                                    tabId,
                                                    text: badge,
                                                  }),
                       chrome.action.setPopup({
                                                tabId,
                                                popup,
                                              }),
                       chrome.action.setTitle({
                                                tabId,
                                                title,
                                              }),
                       chrome.action.setBadgeBackgroundColor({
                                                               tabId,
                                                               color,
                                                             })]);
  } catch (err) {
    logerr(err);
  }
}

/**
 *
 * @param tabId
 * @return {Promise<BackgroundState>}
 */
async function getCurrentTabState(tabId) {
  try {
    const title = await chrome.action.getTitle({ tabId });
    // DEFAULT will be the `default_title` string from our manifest.
    // Remember to keep in sync is fragile, and doesn't localize, just load it
    if (STATE_DATA.UNZOOMED.title === "") {
      const manifest = await getManifestJson();
      STATE_DATA.UNZOOMED.title = manifest?.action?.default_title || "Click to zoom";
    }

    // Normally, would could test if the string is in BackgroundState
    // but typescript doesn't support string unions as of 2023
    const key = /** @type {[BackgroundState]} */ Object.keys(STATE_DATA)
      .filter(k => STATE_DATA[k].title === title);
    if (!key?.length) {
      trace(`getTabCurrentState NO MATCH "${key}"`);
      return /** @type {BackgroundState} */  "UNZOOMED";
    }
    trace(`getTabCurrentState "${key}"`);
    return key[0];
  } catch (err) {
    logerr("GetStateErr", err);
    return /** @type {BackgroundState} */ "UNZOOMED";
  }
}

/**
 * @param state {BackgroundState}
 * @return {boolean}
 */
function isActiveState(state) {
  return STATE_DATA[state]?.zoomed || false;
}


/**
 *
 * @param tabId {number}
 * @returns {Promise<void>}
 * @constructor
 */
async function DoInjectZoomJS(tabId) {
  try {
    // The script will be run at document_end
    trace("DoInjectZoomJS enter");
    await chrome.scripting.executeScript({
                                           target: {
                                             tabId,
                                             allFrames: true,  // false doesn't hide some content.
                                           }, // world:  "MAIN",
                                           files:  ["cmd_zoom_inject.js",
                                                    "videomax_main_inject.js"],
                                         });

    await chrome.scripting.executeScript({
                                           target: {
                                             tabId,
                                             allFrames: true,  // false doesn't hide some content.
                                           }, // world:  "MAIN",
                                           files:  ["cmd_zoom_inject.js",
                                                    "videomax_main_inject.js"],
                                         });
    trace("DoInjectZoomJS leave");
  } catch (err) {
    logerr(err);
  }
}

/**
 * Tag only is for when we're dealing with sites that already zoom correctly
 * but we want to be able to change playback control
 * @param tabId {number}
 * @returns {Promise<void>}
 * @constructor
 */
async function DoInjectTagOnlyJS(tabId) {
  try {
    trace("DoInjectTagOnlyJS enter");
    // The script will be run at document_end
    await chrome.scripting.executeScript({
                                           target: {
                                             tabId,
                                             allFrames: true,
                                           }, // world:  "MAIN",
                                           files:  ["cmd_tagonly_inject.js",
                                                    "videomax_main_inject.js"],
                                         });
    trace("DoInjectTagOnlyJS leave");
  } catch (err) {
    logerr(err);
  }
}

/**
 *
 * @param tabId {number}
 * @param isDummy {boolean} - for JS only injection (no zoom), we still inject a dummy css header
 *   as a marker that we injected
 * @returns {Promise<chrome.scripting.InjectionResult[]>}
 * @constructor
 */
async function DoInjectZoomCSS(tabId, isDummy = false) {
  try {
    trace("DoInjectZoomCSS enter");
    const cssFilePath = isDummy ? "" : chrome.runtime.getURL(CSS_FILE);
    // we inject this way because we can undo it by deleting the style element.
    // The script will be run at document_end
    await chrome.scripting.executeScript({
                                           target: {
                                             tabId,
                                             allFrames: true,
                                           }, // world:  "MAIN",
                                           func:   injectCssHeader,
                                           args:   [cssFilePath, CSS_STYLE_HEADER_ID],
                                         });
    trace("DoInjectZoomCSS leave");
  } catch (err) {
    logerr(err);
  }
}

/**
 *
 * @param tabId {number}
 * @returns {Promise<void>}
 * @constructor
 */
async function DoUndoInjectCSS(tabId) {
  try {
    trace("DoUndoInjectCSS enter");
    await chrome.scripting.executeScript({
                                           target: {
                                             tabId, // frameIds: [0],
                                             allFrames: true,
                                           }, // world:  "MAIN",
                                           func:   uninjectCssHeader,
                                           args:   [CSS_STYLE_HEADER_ID],
                                         });
    trace("DoUndoInjectCSS leave");
  } catch (err) {
    logerr(err);
  }
}

/**
 * The stylesheet may have been injected, but the chrome-extension:// blocked
 *  This can happen on file:// or if there's a strict CSP.
 * @param tabId {number}
 * @returns {Promise<boolean>}  true means it's blocked.
 * @constructor
 */
async function DoCheckCSSInjectedIsBlocked(tabId) {
  try {
    trace("DoCheckCSSInjectedIsBlocked enter");
    const cssFilePath = chrome.runtime.getURL(CSS_FILE);
    /** @var {InjectionResult[]} */
    const injectionresult = await chrome.scripting.executeScript({
                                                                   target: {
                                                                     tabId,
                                                                     frameIds: [0],
                                                                   },
                                                                   func:   injectIsCssHeaderIsBlocked,
                                                                   args:   [cssFilePath], // world:
                                                                                          //  "MAIN",
                                                                 });

    const result = injectionResultCheck(injectionresult);
    trace(`DoCheckCSSInjectedIsBlocked result: ${result}`, injectionresult);
    return result;
  } catch (err) {
    logerr("DoCheckCSSInjectedIsBlocked failed, returning false", err);
    return true;
  }
}

/**
 *
 * @param tabId {number}
 * @param domain {string}
 * @return {Promise<void>}
 */
async function unZoom(tabId, domain) {
  try {
    trace("unZoom enter");
    await Promise.all([setCurrentTabState(tabId, "UNZOOMED"),
                       DoUndoInjectCSS(tabId),
                       setSpeed(tabId, domain, DEAULT_SPEED),
                       chrome.scripting.executeScript({
                                                        target: {
                                                          tabId,
                                                          allFrames: true,
                                                        }, // world:  "MAIN",
                                                        files:  ["cmd_unzoom_inject.js",
                                                                 "videomax_main_inject.js"],
                                                      })]);
    trace("unZoom leave");
  } catch (err) {
    logerr(err);
  }
}

/**
 *
 * @param tabId {number}
 * @param state {BackgroundState}
 * @param domain {string}
 * @returns {Promise<void>}
 * @constructor
 */
async function DoZoom(tabId, state, domain) {
  trace("DoZoom enter");
  try {
    let excluded_zoom = false; // assume not excluded
    if (domain?.length) {
      const settings = await getSettings();
      excluded_zoom = isPageExcluded(domain, settings.zoomExclusionListStr);
    }

    if (excluded_zoom || state === "SPEED_ONLY") {
      await Promise.all([DoInjectTagOnlyJS(tabId),
                         DoInjectZoomCSS(tabId, true),
                         setCurrentTabState(tabId, "ZOOMING_SPEED_ONLY", domain)]);
    } else {
      await Promise.all([DoInjectZoomJS(tabId),
                         DoInjectZoomCSS(tabId),
                         setCurrentTabState(tabId, "ZOOMING", domain)]);

      // now verify the css wasn't blocked by CSP.
      const wasCSSBlocked = await DoCheckCSSInjectedIsBlocked(tabId);
      if (wasCSSBlocked) {
        trace("CSS loading file BLOCKED. directly adding css. undo/redo may fail");
        // ok. we just need to inject in a way that cannot be easily undone.
        await chrome.scripting.insertCSS({
                                           target: {
                                             tabId,
                                             allFrames: true,
                                           },
                                           origin: "AUTHOR",
                                           files:  [CSS_FILE],
                                         });
      }
    }
  } catch (err) {
    logerr(err);
  }
  trace("DoZoom leave");
}

/**
 *
 * @param results {InjectionResult[]}
 * @param tabId {number}
 * @param domain {string}
 * @return {boolean}
 */
function processIFrameExtraPermissionsResult(results, tabId, domain) {
  if (!GET_IFRAME_PERMISSIONS || results.length === 0) {
    return false;
  }
  const extraDomainsArry = results.map(o => o.result)
    .flat()
    .filter(str => str?.length > 0);
  if (extraDomainsArry.length) {
    setSubframeData(tabId, domain, extraDomainsArry.join(","));
    return true;
  }
  return false;

}

/**
 *
 * @param tabId {number}
 * @param domain {string}
 * @param speedStr {string}
 * @returns {Promise<{boolean}>}
 */
async function setSpeed(tabId, domain, speedStr = DEAULT_SPEED) {
  try {
    trace(`setSpeed: enter tabId:${tabId} speed:${speedStr}`);

    if (typeof parseFloat(speedStr) !== "number") {
      logerr(`setSpeed: Speed NOT valid number '${speedStr}'`);
      return false;
    }
    const wasSet = setSpeedGlobalData(tabId, domain, speedStr);

    if (!wasSet && speedStr === DEAULT_SPEED) {
      trace(
        "setSpeed: NOT setting video speed since it doesn't seem required (max compatability mode)");
      return false;
    }
    trace(`setSpeed: executeScript: injectVideoSpeedAdjust with arg [${speedStr}]`);
    // "allFrames" is broken unless manifest requests permissions
    // `"optional_host_permissions": ["<all_urls>"]`
    const results = await chrome.scripting.executeScript({
                                                           target: {
                                                             tabId,
                                                             allFrames: true,
                                                           }, // world:  "MAIN",
                                                           func:   injectVideoSpeedAdjust,
                                                           args:   [speedStr],
                                                         });
    trace(`setSpeed: leave tabId:${tabId} speed:${speedStr}`);
    return processIFrameExtraPermissionsResult(results, tabId, domain);
  } catch (err) {
    logerr(err);
    return false;
  }
}

/**
 *
 * @param tabId {number}
 * @param domain {string}
 * @param defaultSpeed {string}
 * @return {Promise<string>}
 */
async function getSpeed(tabId, domain, defaultSpeed = DEFAULT_SPEED) {
  try {
    const speed = getGlobalSpeedData(tabId, domain);
    if (speed) {
      // sweet, background service not purged yet
      return speed;
    }
    trace("getSpeed enter", tabId, domain);
    const results = await chrome.scripting.executeScript({
                                                           target: {
                                                             tabId,
                                                             allFrames: true,
                                                           }, // world:  "MAIN",
                                                           func:   injectGetPlaypackSpeed,
                                                           args:   [],
                                                         });
    trace("getSpeed leave", tabId, speed);
    if (!results?.length) {
      return defaultSpeed;
    }
    return results[0].result;
  } catch (err) {
    trace("getSpeed error", err);
    return defaultSpeed;
  }
}

/**
 * @param tabId {number}
 * @param secondToSkipStr {string} Neg skips backwards
 * @param domain {string}
 * @returns {Promise<chrome.scripting.InjectionResult[]>}
 */
async function skipPlayback(tabId, secondToSkipStr, domain) {
  try {
    trace("skipPlayback", tabId, secondToSkipStr);
    if (domain?.length && BLOCKED_SKIP_DOMAINS.filter((d) => domain.includes(d)).length > 0) {
      trace("netflix fails if we skip");
      return null;
    }
    if (typeof parseFloat(secondToSkipStr) !== "number") {
      logerr(`secondToSkipStr NOT valid number '${secondToSkipStr}'`);
      return null;
    }

    return await chrome.scripting.executeScript({
                                                  target: {
                                                    tabId,
                                                    allFrames: true,
                                                  }, // world:  "MAIN",
                                                  func:   injectVideoSkip,
                                                  args:   [secondToSkipStr],
                                                });
  } catch (err) {
    logerr(err);
    return null;
  }
}

/**
 *
 * @returns {Promise<boolean|any>}
 */
const getSettingUseAdvFeatures = async () => {
  try {
    const settings = await getSettings();
    trace("getFeatureShowZoomPopup settings:", JSON.stringify(settings, null, 2));
    return (settings.useAdvancedFeatures || DEFAULT_SETTINGS.useAdvancedFeatures);
  } catch (err) {
    logerr(err);
    return DEFAULT_SETTINGS.useAdvancedFeatures;
  }
};

/**
 * @returns {Promise<boolean>}
 */
const getSettingBetaIntroAlreadyShown = async () => {
  try {
    const settings = await getSettings();
    const result = (BETA_UPDATE_NOTIFICATION_VERISON === settings.lastBetaVersion);

    // now update it to expected version
    settings.lastBetaVersion = BETA_UPDATE_NOTIFICATION_VERISON;
    await saveSettings(settings);
    return result;
  } catch (err) {
    logerr(err);
    return true;
  }
};

/** Fired when the extension is first installed, when the extension is updated to a new version,
 * and when Chrome is updated to a new version. */
async function showUpgradePageIfNeeded() {
  try {
    trace("chrome.runtime.onInstalled");
    // checked saved state and see if we've opened the page about v3 update.
    const shown = await getSettingBetaIntroAlreadyShown();
    if (shown) {
      return;
    }

    await chrome.tabs.create({
                               url:    chrome?.runtime?.getURL("help.html"),
                               active: false,
                             });
  } catch (err) {
    logerr(err);
  }
}

/**
 *
 * @param tabId {number}
 * @param domain {string}
 * @returns {Promise<boolean>}
 */
async function toggleZoomState(tabId, domain) {
  const state = await getCurrentTabState(tabId);
  if (!isActiveState(state)) {
    await DoZoom(tabId, state, domain);
    // the following dance is to see if we need more permissions
    await setSpeed(tabId, domain);  // iframe on diff domain will set g_globalAccessSubframeData
                                    // to get more permissions on next click event
    await setCurrentTabState(tabId, "", domain);
    return true;
  }

  // we are zoomed but
  if (state === "ZOOMED_NOSPEED") { // toggle behavior otherwise message unzooms
    await unZoom(tabId, domain);
    await setCurrentTabState(tabId, "UNZOOMED", domain);
    return false;
  }

  await setCurrentTabState(tabId, "", domain);
  return true;
}

chrome.action.onClicked.addListener((tab) => {
  trace("chrome.action.onClicked - checking permissions");
  const tabId = tab.id;
  // keep in sync with manifest.json `optional_permissions`
  try {
    // noinspection HttpUrlsUsage
    if (!(tab?.url?.startsWith("https://") || tab?.url?.startsWith("http://") ||
          tab?.url?.startsWith("file:"))) {
      // do not run on chrome: or about: urls.
      (async () => await setCurrentTabState(tabId, "ERR_URL"))();
      trace("ERR_URL");
      return;
    }

    // can't use async... which really sucks and is annoying
    chrome.storage.local.get((resultSettings) => {
      /** @type {SettingsType} */
      const settingsSaved = JSON.parse(resultSettings[SETTINGS_STORAGE_KEY] || "{}");
      const settings = { ...DEFAULT_SETTINGS, ...settingsSaved };
      const origins = [];
      const permissions = ["scripting"];

      if (settings.allSitesAccess) {
        // Many cross-domain iframed videos without "<all_urls>". BBC, NBC, etc.
        // There appears to be NO way to get a list of iframe domains on a page to request access
        // without FIRST HAVING ACCESS to the parent page. ಠ_ಠ
        // There is no better security model that works in Chrome, yet.
        // See https://bugs.chromium.org/p/chromium/issues/detail?id=826433
        // VERY frustrating when trying to build a secure extension.
        trace("Adding <all_urls> permissions");
        origins.push("<all_urls>");
        if (!settings.allSitesAccessNeedsRevoke) {
          // we attempt to undo permissions if the user ever toggles it off
          trace("Enabling allSitesAccessNeedsRevoke setting");
          settings.allSitesAccessNeedsRevoke = true;
          (async () => await saveSettings(settings))();
        }
      } else {
        // revoke all_sites permissions if the user disabled it in the options
        if (settings.allSitesAccessNeedsRevoke) {
          trace("Revoking <all_urls> permissions");
          settings.allSitesAccessNeedsRevoke = false; // clear so we don't run every time
          (async () => await saveSettings(settings))();
          chrome.permissions.remove({
                                      permissions,
                                      origins: ["<all_urls>"],
                                    });
        }

        // push a tld domain wide request. Often videos are in iframes on different sub domains
        // like www.example.com and static.example.com
        let domain = "";
        if (tab.url.startsWith("https://")) {
          domain = getDomain(tab.url);
          origins.push(domainToSiteWildcard(domain, settings.wholeDomainAccess));
        } else {
          origins.push(tab.url);
        }

        const subFrameData = getSubframeData(tabId, domain);
        if (GET_IFRAME_PERMISSIONS && subFrameData !== false) {
          const iframeDomains = subFrameData.subFrameStr
            .split(",")
            .map(d => domainToSiteWildcard(d, settings.wholeDomainAccess));
          origins.push(...iframeDomains);
          trace("Requesting extra domains that blocked speedup", iframeDomains);
        }
      }

      chrome.permissions.request({
                                   permissions,
                                   origins,
                                 }, async (granted) => {
        if (!granted) {
          await setCurrentTabState(tabId, "ERR_PERMISSION");
          logerr(`permissions to run were denied for "${tab?.url}", so extension is not injecting`);
          const fileAccessEnabledForExtention = await chrome.extension.isAllowedFileSchemeAccess();
          if (!fileAccessEnabledForExtention) {
            await chrome.tabs.create({
                                       url:    chrome?.runtime?.getURL("help.html#localfile"),
                                       active: false,
                                     });
          }
          return;
        }
        trace("permissions granted for ", origins?.join(" ") || "");
        await showUpgradePageIfNeeded();
        // tab?.url could be undefined, so we need to query to get the current tab
        if (!tab?.url) {
          // now we have to go back and get the url since it wasn't passed to us
          // simple thing is to ask the user to click the button again.
          await setCurrentTabState(tabId, "REFRESH");
          return;
        }
        // domain will be empty for "file://"
        await toggleZoomState(tabId, getDomain(tab.url));
        // used to detect SPA nav. Clip anchor
        setLastUrlFromOnUpdated(tabId, tab.url.split("#")[0]);
      });
    });
  } catch (err) {
    logerr(err);
  }
});

/**
 * Called when we're zoomed but the popup is redisplayed.
 * @param tabId {number}
 * @param domain {string}
 * @param speed {string}
 * @return {Promise<void>}
 */
const ReZoom = async (tabId, domain, speed) => {
  // the popup is about to display and thinks the page is zoomed, but it's may not be
  // (e.g. if escape key was pressed.)
  // in theory, re-injecting should be fine
  const currentState = await getCurrentTabState(tabId);
  // ignore the speed sent in. For rezoom, the popup has been deleted, so it can't
  // send the speed, we have to reget it.
  const currentSpeed = await getSpeed(tabId, domain, speed);
  if (currentState === "ZOOMING_SPEED_ONLY") {
    trace("REZOOM_CMD - Speed only, not rezooming");
    await setSpeed(tabId, domain, currentSpeed);
  } else {
    trace("REZOOM_CMD -- Zooming");
    // a full zoom isn't needed, just the css reinjected.

    // we need to see if we're in "SPEED_ONLY" mode because
    // we don't have access to the url to see if it's a site like hulu
    const nextState = currentState === "SPEED_ONLY" ? "ZOOMING_SPEED_ONLY" : "ZOOMING";
    await Promise.all([setCurrentTabState(tabId, nextState, currentSpeed),
                       DoZoom(tabId, currentState, currentSpeed),
                       setSpeed(tabId, domain, currentSpeed)]);
    trace("REZOOM_CMD -- Zooming -- COMPLETE");
  }
};

// handle popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const cmd = /** @type CmdType */ request?.message?.cmd || "";
  const tabId = parseFloat(request?.message?.tabId || "0");
  const speed = request?.message?.speed || DEAULT_SPEED;
  const domain = request?.message?.domain || "";
  if (!tabId) {
    logerr("something wrong with message", request);
    if (sendResponse) {
      sendResponse({ success: false });
    }
    return;
  }

  trace(`chrome.runtime.onMessage '${cmd}' '${speed}'`, request, sender);

  // use timeout to get async scope. listener callbacks can't be async.
  setTimeout(async () => {
    try {
      switch (cmd) {
        case "OPTIONS_CMD": {
          const url = chrome?.runtime?.getURL("options.html") || "";
          if (!url) {
            return;
          }

          await chrome.tabs.create({
                                     url,
                                     active: true,
                                   });

          // also, the popup is closing
        }
          break;

        case "UNZOOM_CMD":
          await unZoom(tabId, domain);
          break;

        case "SET_SPEED_CMD":
          await Promise.all([setCurrentTabState(tabId, "ZOOMED_SPEED", domain, speed),
                             setSpeed(tabId, domain, speed)]);
          break;

        case "REZOOM_CMD":
          await ReZoom(tabId, domain, speed);
          break;

        case "SKIP_PLAYBACK_CMD":
          await skipPlayback(tabId, speed, domain);
          break;

        case "FIRST_USE_SET":
          // this is from
          await setCurrentTabState(tabId, "", domain);
          break;

        case "POPUP_CLOSING":
          // stop controlling pause.
          debugger;
          break;

        default:
          logerr(`Unknown command: "${cmd}"`);
      }
    } catch (err) {
      logerr(err);
    }
  }, 0);

  if (sendResponse) {
    trace("closing popup");
    sendResponse({ success: true }); // used to close popup.
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    const domain = getDomain(changeInfo.url);
    trace(`tabs.onUpated event tabId=${tabId} changeInfo:`, changeInfo);
    if (tabId && changeInfo?.status === "loading") {
      setTimeout(async () => {
        const state = await getCurrentTabState(tabId);
        if (isActiveState(state)) {
          trace(`tabs.onUpdated event likely SPA nav: 
          changeInfo: ${JSON.stringify(changeInfo, null, 2)}}
          tab: ${JSON.stringify(tab, null, 2)} `);

          // some sites (hampster) will set an anchor in url when progress clicked near end.
          const newUrl = (changeInfo?.url || "").split("#")[0].toLowerCase(); // trim off after
                                                                              // anchor?
          const lastUrl = getLastUrlFromOnUpdated(tabId);
          // some SPA won't do a clean refetch, we need to uninstall.
          if (g_PopupOpenedForTabs.includes(tabId)) {
            // popup is open, so keep zoomed
            trace("tabs.onUpdated: Popup UI Open so REzooming");
            await ReZoom(tabId, domain, DEFAULT_SPEED);
          } else if (newUrl !== lastUrl) {
            setLastUrlFromOnUpdated(tabId, newUrl);
            trace(`tabs.onUpdated: Popup UI CLOSED so UNzooming. 
              newUrl: "${newUrl}"
              lastUrl: "${lastUrl}
              `);
            await unZoom(tabId, domain);
          }
        } else {
          trace(`tabs.onUpdated event tabId not currently zoomed ${tabId}`);
        }
      }, 0);
    }
  } catch (err) {
    logerr(err);
  }
});

chrome.runtime.onConnect.addListener((externalPort) => {
  {
    const popupUrl = externalPort.sender.url;
    const url = new URL(popupUrl);
    const params = new URLSearchParams(url.hash.replace("#", ""));
    const tabId = Number(params.get("tabId") || "0");

    if (!g_PopupOpenedForTabs.includes(tabId)) {
      g_PopupOpenedForTabs = [...g_PopupOpenedForTabs, tabId];
      trace(
        `Popup opened. Added tabId:'${tabId}' g_PopupOpenedForTabs: [${g_PopupOpenedForTabs.join(
          ",")}]`);
    }
  }
  externalPort.onMessage((message, port) => {
    // todo: while popup is open, allow it to query the playback speed (and if the video is paused)?
  });
  // called when disconnected.
  externalPort.onDisconnect.addListener((portDisconnectEvent) => {
    // we can get the tab by looking at the url.
    const popupUrl = portDisconnectEvent.sender.url;
    const url = new URL(popupUrl);
    const params = new URLSearchParams(url.hash.replace("#", ""));
    const tabId = Number(params.get("tabId") || "0");

    if (g_PopupOpenedForTabs.includes(tabId)) {
      trace(
        `Popup closed. Removed tabId:'${tabId}' g_PopupOpenedForTabs: [${g_PopupOpenedForTabs.join(
          ",")}]`);
      g_PopupOpenedForTabs = g_PopupOpenedForTabs.filter((eachId) => tabId !== eachId);
    }

    // we track the popup open/closed, if it's open for a tab and there's a url-only "navigate",
    // don't unzoom.

    try {
      const ignoreError = chrome.runtime.lastError;
    } catch (err) {
      trace(err);
    }
  });
});

