// @ts-check
import {
  BETA_UPDATE_NOTIFICATION_VERISON,
  CSS_FILE,
  CSS_STYLE_HEADER_ID,
  DEAULT_SPEED,
  DEFAULT_SETTINGS,
  getSettings,
  logerr,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  trace,
} from "./common.js";

const ALWAYS_SHOW_SPEED = true; // forces to always be enabled

// "What's the current state of a tab?" is a serious problem when trying to be a secure extension.
// When the user clicks our extensions icon, the background can get permissions it needs to
// get information it needs to run (like the url so it can see if the site is a "no zoom needed").
// BUT when the popup UI is used and the user clicks on a button inside this UI to change speed.
// BUT the kground doesn't have all the same permissions when it gets a message from the popup.
// The popup also doesn't really have access to all the information about the target page constent
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
  RESET:              {
    badge:     BADGES.NONE,
    title:     "Click to zoom video",
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
    title:     "Permissions check complete. Click again.",
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
    showpopup: false,
    zoomed:    false,
    color:     "#FCD2D2F7",
  },
};

// this is used to pass the domain to the popup, it WILL be unloaded, but
// that shouldn't happen while the popup is displayed
let g_domain = "";

// there will be sites that request this extension NOT work with them.
// still building out this feature, but this is used for testing
const NOPE_DOMAINS_LIST = ["rt.com", "kremlin.ru", "prageru.com", "prage.ru"];
const NOPE_URL_LIST     = ["prageru"];  // maybe block all .ru propaganda related domains?

/** used by unit tests **/
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
  for (let frameresult of injectionResults) {
    if (frameresult.result !== defaultVal) {
      return frameresult.result;
    }
  }
  return defaultVal;
}

/**
 * This speeds up all <videos> not just the one zoomed.
 * Could just select the zoomed videos, but maybe useful when unzooming?
 * @param newspeed {string}
 */
function injectVideoSpeedAdjust(newspeed) {
  const PLAYBACK_SPEED_ATTR = "data-videomax-playbackspeed";

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
      console.log(`_loadStart err`, err);
    }
  };
  const _speedUpFoundVideos = (doc, speed) => {
    try {
      for (let eachVideo of doc.querySelectorAll("video")) {
        try {
          eachVideo.defaultPlaybackRate = speed;
          eachVideo.playbackRate        = speed;

          eachVideo.setAttribute(PLAYBACK_SPEED_ATTR, `${speed}`);
          eachVideo.removeEventListener("loadstart", _loadStart);
          eachVideo.addEventListener("loadstart", _loadStart);
        } catch (err) {
          console.warn(`VideoMax speed error _speedUpFoundVideos for "video"`, eachVideo, err);
        }
      }
    } catch (err) {
      console.warn(`doc.querySelectorAll("video") error cross iframe issue?`, doc, err);
    }
  };

  const speadNumber = parseFloat(newspeed);
  _speedUpFoundVideos(document, speadNumber);

  const allIFrames = document.querySelectorAll("iframe");
  for (let frame of [...allIFrames]) {
    try {
      const framedoc = frame?.contentDocument || frame?.contentWindow?.document;
      if (!framedoc) {
        console.log(`VideoMax speed no contentDocument frame:`, frame);
        continue;
      }
      _speedUpFoundVideos(framedoc, speadNumber);
    } catch (err) {
      console.warn(`VideoMax speed error for "frame"`, frame, err);
    }
  }
  return false;
}

function injectGetIFrameSrc() {
  const allIFrames = document.querySelectorAll("iframe");
  for (let frame of [...allIFrames]) {
    try {
      const framedoc = frame?.contentDocument || frame?.contentWindow?.document;
      if (!framedoc) {
        console.log(`VideoMax speed no contentDocument frame:`, frame);
        continue;
      }
      // we're looking for this to throw.
      framedoc.querySelectorAll("video");
    } catch (err) {
      debugger;
      return frame?.src || "";
    }
  }
}


/**
 *
 * @param tabId {number}
 * @returns {Promise<string>}
 * @constructor
 */
async function GetIFrameSrc(tabId) {
  try {
    /** @var {InjectionResult[]} */
    const injectionresult = await chrome.scripting.executeScript({
      target: { tabId },
      func:   injectGetIFrameSrc,
      world:  "MAIN",
    });

    trace(`GetIFrameSrc result`, injectionresult);
    if (injectionresult.length === 1) {
      return injectionresult[0]?.result || "";
    }
    return "";
  } catch (err) {
    logerr(err);
    return "";
  }
}

function injectSupportsSpeedChange() {
  const matched = document.querySelectorAll(`video[class*="videomax-ext-video-matched"]`);
  return matched.length > 0;
}

/**
 * @param skipSecondsStr {string}  negative numbers backwards
 */
function injectVideoSkip(skipSecondsStr) {
  const skipSeconds = parseFloat(skipSecondsStr);
  for (let eachVideo of document.querySelectorAll("video")) {
    try {
      // restore playback speed after we skip
      const savedSpeed       = eachVideo.playbackRate || 1.0;
      // don't go negative;
      eachVideo.currentTime  = Math.max(0, eachVideo.currentTime + skipSeconds);
      eachVideo.playbackRate = savedSpeed;
    } catch (err) {
      console.warn(`injectVideoSkip err for video`, err, eachVideo);
    }
  }
}

/**
 * @param speedStr {string}  negative numbers backwards
 */
async function injectVideoPlaybackToggle(speedStr) {
  const speedNumber = parseFloat(speedStr);
  for (let eachVideo of document.querySelectorAll("video")) {
    try {
      const isVideoPlaying = eachVideo => !!(eachVideo.currentTime > 0 && !eachVideo.paused &&
                                             !eachVideo.ended && eachVideo.readyState > 2);
      if (isVideoPlaying) {
        console.trace(`
        Playing -> pause 
      `);
        await eachVideo.pause();
      } else {
        console.trace(`
        Paused -> play 
      `);
        await eachVideo.play();
        eachVideo.playbackRate = speedNumber;
      }
    } catch (err) {
      console.warn(`injectVideoPlaybackToggle err for video`, err, eachVideo);
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
      console.log("VideoMax Native Inject. Style header already injected");
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
  const cssHeaderNode = document.getElementById(styleId);
  cssHeaderNode?.parentNode?.removeChild(cssHeaderNode);
}

/**
 * Just check the style element was injected into the header
 * @param styleId {string}
 * @returns {boolean}
 */
function injectIsCssHeaderInjectedFast(styleId) {
  // warning runs inside context of page
  return (document.getElementById(styleId) !== null);
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
        } catch (_err) {
        }
        break;
      }
    }
  } catch (_err) {
  }
  if (isBlocked) {
    console.log("VideoMaxExt css include file blocked.");
  }
  return isBlocked;
}

/**
 *
 * @param tabId {number}
 * @param state {BackgroundState}
 * @param speed {String}
 * @return {Promise<void>}
 */
async function setCurrentState(tabId, state, speed = DEAULT_SPEED) {
  try {
    // map state to another state
    switch (state) {
      case "ZOOMING":
        trace(`setCurrentState "${state}"`);
        const featureShowSpeedPopup = (await getSettingOldToggleBehavior()) === false;
        if (featureShowSpeedPopup) {
          // we have a case where "speed only" the check will fail.
          const supportsSpeedChange = await CheckSupportsSpeedChange(tabId);
          if (supportsSpeedChange) {
            state = "ZOOMED_SPEED";
          } else {
            state = "ZOOMED_NOSPEED";
          }
        }
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
    const popup = showpopup ? `popup.html#tabId=${tabId}&speed=${speed}&domain=${g_domain}` : "";

    // don't think the order matters, just set them all and wait for them to complete.
    Promise.all([chrome.action.setBadgeText({
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
async function getTabCurrentState(tabId) {
  try {
    const title = await chrome.action.getTitle({ tabId });
    // DEFAULT will be the `name` string from our manifest
    // e.g. "Universal Video Maximizer BETA v3"

    // Normally, would could test if the string is in BackgroundState
    // but typescript doesn't support string unions as of 2023
    const key = /** @type {[BackgroundState]} */ Object.keys(STATE_DATA)
      .filter(key => STATE_DATA[key].title === title);
    if (!key?.length) {
      trace(`getTabCurrentState NO MATCH "${key}"`);
      return /** @type {BackgroundState} */  "RESET";
    }
    trace(`getTabCurrentState "${key}"`);
    return key[0];
  } catch (err) {
    logerr("GetStateErr", err);
    return /** @type {BackgroundState} */ "RESET";
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
 * @param url {string}
 * @return {string}
 */
const getDomain = (url) => (new URL(url)).host.toLowerCase();

/**
 * Returns true if there are any overlaps between two arrays of strings.
 * @param arrA {string[]}
 * @param arrB {string[]}
 * @return {boolean}
 */
const intersection = (arrA, arrB) => arrA.filter(x => arrB.includes(x)).length > 0;

/**
 * @param url {string | undefined}
 * @return {Promise<boolean>}
 */
const isPageExcluded = async (url) => {
  if (!url?.length) {
    // we don't have access to the url, check our current state
    trace("isPageExcluded url is EMPTY");
    return false;
  }
  g_domain = getDomain(url);
  if (!g_domain?.length) {
    // can happen for file:// uris
    return false;
  }
  // domains are comma delimited string list, just look for `domain,` in the list.
  const settings = await getSettings();
  if (settings.zoomExclusionListStr.indexOf(`${g_domain},`) !== -1) {
    trace(`Excluded from zooming ${g_domain}`);
    return true;
  }
  return false;
};

/**
 *
 * @param url {string | undefined}
 * @returns {boolean}
 */
const isABigFatNope = (url) => {
  if (!url?.length) {
    return false;
  }
  const domain = getDomain(url);
  for (let elem of NOPE_DOMAINS_LIST) {
    if (domain.indexOf(elem) >= 0) { // substring so www. prefix matches
      logerr(`NOPE_DOMAINS_LIST match for "${url}"`);
      return true;
    }
  }
  const parts = url.toLowerCase()
    .split(/[^A-Za-z]/);
  if (intersection(parts, NOPE_URL_LIST)) {
    logerr(`NOPE_URL_LIST match for "${url}"`);
    return true;
  }

  return false;
};

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
      },
      world:  "MAIN",  // this breaks dailymotion
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
      },
      world:  "MAIN",  // this breaks dailymotion
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
      },
      world:  "MAIN",
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
      },
      world:  "MAIN",
      func:   uninjectCssHeader,
      args:   [CSS_STYLE_HEADER_ID],
    });
    trace("DoUndoInjectCSS leave");
  } catch (err) {
    logerr(err);
  }
}

/**
 * Deep check to see if page is currently zoomed. Fast because it only checks the ID.
 * @param tabId {number}
 * @returns {Promise<boolean>}
 */
async function DoCheckCSSInjectedFast(tabId) {
  try {
    trace("DoCheckCSSInjectedFast enter");
    /** @var {InjectionResult[]} */
    const injectionresult = await chrome.scripting.executeScript({
      target: {
        tabId, // frameIds: [0],
        allFrames: true,
      },
      world:  "MAIN",
      func:   injectIsCssHeaderInjectedFast,
      args:   [CSS_STYLE_HEADER_ID],
    });

    const result = injectionResultCheck(injectionresult);
    trace(`DoCheckCSSInjectedFast result: ${result}`, injectionresult);
    return result;
  } catch (err) {
    logerr("DoCheckCSSInjectedFast result FAILED, returning false", err);
    return false;
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
      args:   [cssFilePath],
      world:  "MAIN",
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
 * @returns {Promise<boolean>}
 * @constructor
 */
async function CheckSupportsSpeedChange(tabId) {
  try {
    if (ALWAYS_SHOW_SPEED) {
      return true;
    }
    trace("CheckSupportsSpeedChange enter");
    /** @var {InjectionResult[]} */
    const injectionresult = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      func:   injectSupportsSpeedChange,
      world:  "MAIN",
    });

    const result = injectionResultCheck(injectionresult);
    trace(`CheckSupportsSpeedChange result: ${result}`, injectionresult);
    return result;
  } catch (err) {
    logerr(err);
    return false;
  }
}

/**
 *
 * @param tabId {number}
 * @return {Promise<void>}
 */
async function unZoom(tabId) {
  try {
    trace("unZoom");
    await setCurrentState(tabId, "RESET");
    await DoUndoInjectCSS(tabId);
    await setTabSpeed(tabId, DEAULT_SPEED);
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      world:  "MAIN",
      files:  ["cmd_unzoom_inject.js", "videomax_main_inject.js"],
    });
  } catch (err) {
    logerr(err);
  }
}

/**
 *
 * @param tabId {number}
 * @param state {BackgroundState}
 * @param url {string | undefined}
 * @returns {Promise<void>}
 * @constructor
 */
async function DoZoom(tabId, state, url = undefined) {
  try {
    if (isABigFatNope(url)) {
      return;
    }
    const excluded_zoom = await isPageExcluded(url);
    if (excluded_zoom || state === "SPEED_ONLY") {
      Promise.all([DoInjectTagOnlyJS(tabId),
                   DoInjectZoomCSS(tabId, true),
                   setCurrentState(tabId, "ZOOMING_SPEED_ONLY")]);
    } else {
      Promise.all([DoInjectZoomJS(tabId), DoInjectZoomCSS(tabId)]);

      // now verify the css wasn't blocked by CSP.
      const isBlocked = await DoCheckCSSInjectedIsBlocked(tabId);
      if (isBlocked) {
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
      await setCurrentState(tabId, "ZOOMING"); // will check if page can speed up and refresh state
    }
  } catch (err) {
    logerr(err);
  }
}

/**
 *
 * @param tabId {number}
 * @param speedStr {string}
 * @returns {Promise<null|chrome.scripting.InjectionResult[]>}
 */
async function setTabSpeed(tabId, speedStr = DEAULT_SPEED) {
  try {
    trace("setTabSpeed", tabId, speedStr);

    if (typeof parseFloat(speedStr) !== "number") {
      logerr(`Speed NOT valid number '${speedStr}'`);
      return null;
    }
    // "allFrames" is broken unless manifest requests permissions
    // `"optional_host_permissions": ["<all_urls>"]`
    const results = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      world:  "MAIN",
      func:   injectVideoSpeedAdjust,
      args:   [speedStr],
    });
    return results;
  } catch (err) {
    logerr(err);
    return null;
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

    const result = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      world:  "MAIN",
      func:   injectVideoSkip,
      args:   [secondToSkipStr],
    });
    return result;
  } catch (err) {
    logerr(err);
    return null;
  }
}

/**
 *
 * @param tabId {number}
 * @param speedStr {string}
 * @returns {Promise<null|chrome.scripting.InjectionResult[]>}
 */
async function togglePlayback(tabId, speedStr) {
  try {
    trace("togglePlayback", tabId, speedStr);
    if (typeof parseFloat(speedStr) !== "number") {
      logerr(`speed NOT valid number '${speedStr}'`);
      return null;
    }

    const result = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      world:  "MAIN",  // this breaks dailymotion
      func:   injectVideoPlaybackToggle,
      args:   [speedStr],
    });
    return result;
  } catch (err) {
    logerr(err);
    return null;
  }
}


/**
 *
 * @returns {Promise<boolean|any>}
 */
const getSettingOldToggleBehavior = async () => {
  try {
    const settings = await getSettings();
    trace("getFeatureShowZoomPopup settings:", JSON.stringify(settings, null, 2));
    return (settings.useToggleZoomBehavior || DEFAULT_SETTINGS.useToggleZoomBehavior);
  } catch (err) {
    logerr(err);
    return DEFAULT_SETTINGS.useToggleZoomBehavior;
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

    const url = chrome?.runtime?.getURL("help.html") || "";
    if (!url) {
      return;
    }

    await chrome.tabs.create({
      url,
      active: false,
    });
  } catch (err) {
    logerr(err);
  }
}

/**
 *
 * @param tabId {number}
 * @param url {string}
 * @returns {Promise<boolean>}
 */
async function toggleZoomState(tabId, url) {
  const state = await getTabCurrentState(tabId);
  if (!isActiveState(state)) {
    await DoZoom(tabId, state, url);
    return true;
  }

  // we are zoomed but
  if (state === "ZOOMED_NOSPEED") { // toggle behavior otherwise message unzooms
    await unZoom(tabId);
    return false;
  }
  return true;
}

chrome.action.onClicked.addListener((tab) => {
  trace("chrome.action.onClicked - checking permissions");
  const tabId = tab.id;
  // keep in sync with manifest.json `optional_permissions`
  try {
    if (!(tab?.url?.startsWith("https://") || tab?.url?.startsWith("http://") ||
          tab?.url?.startsWith("file:"))) {
      // do not run on chrome: or about: urls.
      (async () => await setCurrentState(tabId, "ERR_URL"))();
      trace("ERR_URL");
      return;
    }

    // can't use async... which really sucks and is annoying
    chrome.storage.local.get((resultSettings) => {
      /** @type {SettingsType} */
      const settingsSaved = JSON.parse(resultSettings[SETTINGS_STORAGE_KEY] || "{}");
      const settings      = { ...DEFAULT_SETTINGS, ...settingsSaved };
      const origins       = [tab?.url];
      const permissions   = ["scripting"];

      if (settings.allSitesAccess) {
        // cross-domain videos in iframes with CSP fails without this.
        // There is no better security model that works in Chrome.
        // See https://bugs.chromium.org/p/chromium/issues/detail?id=826433
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
      }
      chrome.permissions.request({
        permissions,
        origins,
      }, async (granted) => {
        if (!granted) {
          await setCurrentState(tabId, "REFRESH");
          logerr(`permissions to run were denied for "${tab?.url}", so extension is not injecting`);
          return;
        }
        trace("permissions granted");
        await showUpgradePageIfNeeded();

        // tab?.url could be null, so we need to query to get the current tab
        if (!tab?.url) {
          // now we have to go back and get the url since it wasn't passed to us
          // simple thing is to ask the user to click the button again.
          await setCurrentState(tabId, "REFRESH");
          return;
        }

        await toggleZoomState(tabId, tab?.url);
      });
    });
  } catch (err) {
    logerr(err);
  }
});

// handle popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const cmd   = /** @type CmdType*/ request?.message?.cmd || "";
  const tabId = parseFloat(request?.message?.tabId || "0");
  const speed = request?.message?.speed || DEAULT_SPEED;
  if (!tabId) {
    logerr("something wrong with message", request);
    sendResponse && sendResponse({ success: false });
    return;
  }

  trace(`chrome.runtime.onMessage '${cmd}' '${speed}'`, request, sender);

  // use timeout to get async scope. listener callbacks can't be async.
  setTimeout(async () => {
    try {
      switch (cmd) {
        case "UNZOOM_CMD":
          await unZoom(tabId);
          // await setTabSpeed(tabId, speed);
          break;

        case "SET_SPEED_CMD":
          await Promise.all(
            [setCurrentState(tabId, "ZOOMED_SPEED", speed), setTabSpeed(tabId, speed)]);
          break;

        case "REZOOM_CMD":
          // the popup is about to display and thinks the page is zoomed, but it's may not be
          // (e.g. if escape key was pressed.)
          // in theory, re-injecting should be fine
          const currentState = await getTabCurrentState(tabId);
          if (currentState === "ZOOMING_SPEED_ONLY") {
            trace("REZOOM_CMD - Speed only, not rezooming");
            await setTabSpeed(tabId, speed);
          } else {
            trace("REZOOM_CMD -- Zooming");
            // a full zoom isn't needed, just the css reinjected.

            // we need to see if we're in "SPEED_ONLY" mode because
            // we don't have access to the url to see if it's a site like hulu
            const currentState = await getTabCurrentState(tabId);
            const nextState    = currentState === "SPEED_ONLY" ? "ZOOMING_SPEED_ONLY" : "ZOOMING";
            await Promise.all([setCurrentState(tabId, nextState, speed),
                               DoZoom(tabId, currentState), // we don't have access to url
                               setTabSpeed(tabId, speed)]);
            trace("REZOOM_CMD -- Zooming -- COMPLETE");
          }
          break;

        case "SKIP_PLAYBACK_CMD":
          await skipPlayback(tabId, speed);
          break;

        case "TOGGLE_PLAYBACK_CMD":
          await togglePlayback(tabId, speed);
          break;

      }
    } catch (err) {
      logerr(err);
    }
  }, 0);

  sendResponse && sendResponse({ success: true }); // used to close popup.
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  try {
    trace(`tabs.onUpdated event tabId=${tabId}
    changeInfo:`, changeInfo);
    if (tabId && changeInfo?.status === "loading") {
      setTimeout(async () => {
        const state = await getTabCurrentState(tabId);
        if (isActiveState(state)) {
          trace("chrome.tabs.onUpdated loading so starting unzoom. likely SPA nav");
          // some SPA won't do a clean refetch, we need to uninstall.
          await unZoom(tabId);
        } else {
          trace(`tabId not currently zoomed ${tabId}`);
        }
      }, 0);
    }
  } catch (err) {
    logerr(err);
  }
});
