// @ts-check
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
 * @type {TabToSpeedMap} */
const g_SpeedByTabData = {};

/**
 * @param tabId {number}
 * @param domain {string}
 * @param speed {string}
 * @return {boolean}
 */
function setSpeedGlobalData(tabId, domain, speed) {
  const wasSet                           = g_SpeedByTabData[`${tabId}-${domain}`] !== undefined;
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
function injectVideoSpeedAdjust(newspeed) {
  const PLAYBACK_SPEED_ATTR = "data-videomax-playbackspeed";
  /** @type {Set<string>} */
  const result              = new Set(); // use Set to dedup

  /** nested local function * */
  const _loadStart          = (event) => {
    try {
      const video_elem    = event?.target;
      const playbackSpeed = video_elem?.getAttribute(PLAYBACK_SPEED_ATTR);
      if (playbackSpeed) {
        const speedNumber = parseFloat(playbackSpeed);
        if (video_elem?.playbackRate !== speedNumber) {
          // auto-playing next video can reset speed. Need to hook into content change
          video_elem.playbackRate = speedNumber;
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`_loadStart err`, err);
    }
  };
  const _speedUpFoundVideos = (doc, speed) => {
    try {
      /** @type {NodeListOf<HTMLVideoElement>} */
      const videos = doc.querySelectorAll("video");
      for (const eachVideo of videos) {
        try {
          eachVideo.defaultPlaybackRate = speed;
          eachVideo.playbackRate        = speed;

          eachVideo.setAttribute(PLAYBACK_SPEED_ATTR, `${speed}`);
          eachVideo.removeEventListener("loadstart", _loadStart);
          eachVideo.addEventListener("loadstart", _loadStart);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`VideoMaxExt: speed error _speedUpFoundVideos for "video"`, eachVideo, err);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`VideoMaxExt: doc.querySelectorAll("video") blocked cross iframe?`, doc, err);
    }
  };
  if (window._VideoMaxExt?.playbackSpeed) {
    window._VideoMaxExt.playbackSpeed = newspeed;
  }
  const speadNumber = parseFloat(newspeed);
  _speedUpFoundVideos(document, speadNumber);

  const allIFrames = document.querySelectorAll("iframe");
  for (const frame of [...allIFrames]) {
    try {
      const framedoc = frame?.contentDocument || frame?.contentWindow?.document;
      if (!framedoc) {
        // console.log(`VideoMax speed no contentDocument frame:`, frame);
        continue;
      }
      _speedUpFoundVideos(framedoc, speadNumber);
    } catch (err) {
      // in theory, we could try to record this url and add it to the request?
      // but this is run in the context of the page see GET_IFRAME_PERMISSIONS
      // console.warn(`Possible VideoMax speed error for "frame" probably cross-domain-frame`,
      // frame, err);
      if (frame?.src?.length && window?._VideoMaxExt?.matchedVideo?.nodeName === "IFRAME") {
        const url = frame?.src;
        if (url.startsWith("https://")) {
          const domain    = (new URL(url)).host.toLowerCase();
          const iframeUrl = window._VideoMaxExt.matchedVideo.src?.toLowerCase() || "";
          if (iframeUrl.indexOf(domain) !== -1) {
            result.add(domain);
            // console.warn(`VideoMax speed error Need access to ${domain}`);
          }
        }
      }
    }
  }
  return [...result]; // Set->array
}

/**
 *
 * @return {string}
 */
function injectGetPlaypackSpeed() {
  try {
    return window._VideoMaxExt?.playbackSpeed || DEFAULT_SPEED;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`VideoMaxExt: injectGetPlaypackSpeed err for video`, err);
  }
}

/**
 * @param skipSecondsStr {string}  negative numbers backwards
 */
function injectVideoSkip(skipSecondsStr) {
  const skipSeconds = parseFloat(skipSecondsStr);
  for (const eachVideo of document.querySelectorAll("video")) {
    try {
      // restore playback speed after we skip
      const savedSpeed       = eachVideo.playbackRate || 1.0;
      // don't go negative;
      eachVideo.currentTime  = Math.max(0, eachVideo.currentTime + skipSeconds);
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
    styleLink.id    = styleId;
    styleLink.href  = cssHRef;
    styleLink.type  = "text/css";
    styleLink.rel   = "stylesheet";
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
    console.log("VideoMaxExt: css include file blocked.");
  }
  return isBlocked;
}


/**
 *
 * @param tabId {number}
 * @param state {BackgroundState|""}
 * @param domain {String}
 * @param speed {String}
 * @return {Promise<void>}
 */
async function setCurrentTabState(tabId, state, domain = "", speed = DEAULT_SPEED) {
  try {
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
        const useAdvFeatures = await getSettingUseAdvFeatures();
        state                = useAdvFeatures ? "ZOOMED_SPEED" : "ZOOMED_NOSPEED";
        break;

      case "ZOOMING_SPEED_ONLY":
        trace(`setCurrentState "${state}"`);
        state = "SPEED_ONLY";
        break;
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
    }), chrome.action.setPopup({
      tabId,
      popup,
    }), chrome.action.setTitle({
      tabId,
      title,
    }), chrome.action.setBadgeBackgroundColor({
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
      const manifest            = await getManifestJson();
      STATE_DATA.UNZOOMED.title = manifest?.action?.default_title || "Click to zoom";
    }

    // Normally, would could test if the string is in BackgroundState
    // but typescript doesn't support string unions as of 2023
    const key = /** @type {[BackgroundState]} */ Object.keys(STATE_DATA)
      .filter(key => STATE_DATA[key].title === title);
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
      files:  ["cmd_zoom_inject.js", "videomax_main_inject.js"],
    });

    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,  // false doesn't hide some content.
      }, // world:  "MAIN",
      files:  ["cmd_zoom_inject.js", "videomax_main_inject.js"],
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
      files:  ["cmd_tagonly_inject.js", "videomax_main_inject.js"],
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
    const cssFilePath     = chrome.runtime.getURL(CSS_FILE);
    /** @var {InjectionResult[]} */
    const injectionresult = await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func:   injectIsCssHeaderIsBlocked,
      args:   [cssFilePath], // world:  "MAIN",
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
                         files:  ["cmd_unzoom_inject.js", "videomax_main_inject.js"],
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
      excluded_zoom  = isPageExcluded(domain, settings.zoomExclusionListStr);
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
  } else {
    return false;
  }
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
    trace(`setSpeed enter tabId:${tabId} speed:${speedStr}`);

    if (typeof parseFloat(speedStr) !== "number") {
      logerr(`Speed NOT valid number '${speedStr}'`);
      return false;
    }
    const wasSet = setSpeedGlobalData(tabId, domain, speedStr);

    if (!wasSet && speedStr === DEAULT_SPEED) {
      trace("NOT setting video speed since it doesn't seem required (max compatability mode)");
      return false;
    }
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
    trace(`setSpeed leave tabId:${tabId} speed:${speedStr}`);
    return processIFrameExtraPermissionsResult(results, tabId, domain);
  } catch (err) {
    logerr(err);
    return false;
  }
}


async function getSpeed(tabId, domain) {
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
      return DEAULT_SPEED;
    }
    return results[0].result;
  } catch (err) {
    trace("getSpeed error", err);
  }
}

/**
 * @param tabId {number}
 * @param secondToSkipStr {string} Neg skips backwards
 * @returns {Promise<chrome.scripting.InjectionResult[]>}
 */
async function skipPlayback(tabId, secondToSkipStr) {
  try {
    trace("skipPlayback", tabId, secondToSkipStr);
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
    const result   = (BETA_UPDATE_NOTIFICATION_VERISON === settings.lastBetaVersion);

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
      // TODO: show limited popup to access config/settings ux
      (async () => await setCurrentTabState(tabId, "ERR_URL"))();
      trace("ERR_URL");
      return;
    }

    // can't use async... which really sucks and is annoying
    chrome.storage.local.get((resultSettings) => {
      /** @type {SettingsType} */
      const settingsSaved = JSON.parse(resultSettings[SETTINGS_STORAGE_KEY] || "{}");
      const settings      = { ...DEFAULT_SETTINGS, ...settingsSaved };
      const origins       = [];
      const permissions   = ["scripting"];

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
            // todo: open special help page
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
      });
    });
  } catch (err) {
    logerr(err);
  }
});

// handle popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const cmd    = /** @type CmdType*/ request?.message?.cmd || "";
  const tabId  = parseFloat(request?.message?.tabId || "0");
  const speed  = request?.message?.speed || DEAULT_SPEED;
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
        case "OPTIONS_CMD":
          const url = chrome?.runtime?.getURL("options.html") || "";
          if (!url) {
            return;
          }

          await chrome.tabs.create({
            url,
            active: true,
          });
          break;

        case "UNZOOM_CMD":
          await unZoom(tabId, domain);
          break;

        case "SET_SPEED_CMD":
          await Promise.all([setCurrentTabState(tabId, "ZOOMED_SPEED", domain, speed),
                             setSpeed(tabId, domain, speed)]);
          break;

        case "REZOOM_CMD":
          // the popup is about to display and thinks the page is zoomed, but it's may not be
          // (e.g. if escape key was pressed.)
          // in theory, re-injecting should be fine
          const currentState = await getCurrentTabState(tabId);
          // ignore the speed sent in. For rezoom, the popup has been deleted, so it can't
          // send the speed, we have to reget it.
          const currentSpeed = await getSpeed(tabId, domain);
          if (currentState === "ZOOMING_SPEED_ONLY") {
            trace("REZOOM_CMD - Speed only, not rezooming");
            await setSpeed(tabId, domain, currentSpeed);
          } else {
            trace("REZOOM_CMD -- Zooming");
            // a full zoom isn't needed, just the css reinjected.

            // we need to see if we're in "SPEED_ONLY" mode because
            // we don't have access to the url to see if it's a site like hulu
            const currentState = await getCurrentTabState(tabId);
            const nextState    = currentState === "SPEED_ONLY" ? "ZOOMING_SPEED_ONLY" : "ZOOMING";
            await Promise.all([setCurrentTabState(tabId, nextState, currentSpeed),
                               DoZoom(tabId, currentState, currentSpeed),
                               setSpeed(tabId, domain, currentSpeed)]);
            trace("REZOOM_CMD -- Zooming -- COMPLETE");
          }
          break;

        case "SKIP_PLAYBACK_CMD":
          await skipPlayback(tabId, speed);
          break;

        case "FIRST_USE_SET":
          // this is from
          await setCurrentTabState(tabId, "", domain);
          break;
      }
    } catch (err) {
      logerr(err);
    }
  }, 0);

  sendResponse && sendResponse({ success: true }); // used to close popup.
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
  try {
    const domain = getDomain(changeInfo.url);
    trace(`tabs.onUpated event tabId=${tabId} changeInfo:`, changeInfo);
    if (tabId && changeInfo?.status === "loading") {
      setTimeout(async () => {
        const state = await getCurrentTabState(tabId);
        if (isActiveState(state)) {
          trace("chrome.tabs.onUpdated loading so starting unzoom. likely SPA nav");
          // some SPA won't do a clean refetch, we need to uninstall.
          await unZoom(tabId, domain);
        } else {
          trace(`tabId not currently zoomed ${tabId}`);
        }
      }, 0);
    }
  } catch (err) {
    logerr(err);
  }
});
