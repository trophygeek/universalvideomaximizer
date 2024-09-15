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
  IS_BETA_CHANNEL,
  UPDATE_NOTIFICATION_VERISON,
  CSS_FILE,
  CSS_STYLE_HEADER_ID,
  DEFAULT_SETTINGS,
  DEFAULT_SPEED_STR,
  domainToSiteWildcard,
  getDomain,
  getManifestJson,
  getSettings,
  isPageExcluded,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  BLOCKED_SKIPFEATURE_DOMAINS,
  logerr,
  logtrace,
  logwarn,
} from "./common";

import { injectCssHeaderRemove } from "./injectCssHeaderRemove";
import { injectIsCssHeaderIsBlocked } from "./injectIsCssHeaderIsBlocked";
import { injectCssHeader } from "./injectCssHeader";
import { injectVideoSpeedAdjust } from "./injectVideoSpeedAdjust";
import { injectGetPlaypackSpeed } from "./injectGetPlaypackSpeed";
import { injectGetVideoZoomedState } from "./injectGetVideoZoomedState";
import { injectVideoSkip } from "./injectVideoSkip";
import { injectCheckPermissions } from "./injectCheckPermissions";

import InjectionResult = chrome.scripting.InjectionResult;

/**
 *
 "What's the current state of a tab?" is a serious problem when trying to be
 a secure extension.
 When the user clicks our extensions icon, the background
 can get permissions it needs to get information it needs to run (like the
 url so it can see if the site is a "no zoom needed").
 BUT
 when the popup UI is used and the user clicks on a button inside this
 UI to change speed, the background doesn't have all the same permissions
 when it gets a message from the popup as it does when the button is pressed.
 The popup also doesn't really have access to all the
 information about the target page content either.
 The solution is to keep track of the various states of each tab that
 has had VidMax injected in memory (like a map of {[TabId]: currentState} )
 BUT background services in v3 can be unloaded at any time (and oh they are)
 so this global data is often just lost.
 So it must be persisted somehow... often this is done using
 local storage, but that immediately hits some snags: Saving state in
 localStorage is basically impossible because the storage API is async (used
 to save off the current state), BUT chrome Unloading message is NOT async
 friendly, so it's async writing ALL the time.
 The most robust and low overhead approach is to get CHROME to store information
 about each tab for the background service.

 There are only a few ways to do this and NONE of them are intended for this purpose:
 chrome.action.enable/chrome.action.disable
 chrome.action.getBadgeBackgroundColor
 chrome.action.getBadgeText
 chrome.action.getPopup
 chrome.action.getTitle

 We don't need much data since we have < 8 possible states.
 getBadgeBackgroundColor is an rgba()... so if we could use
 the alpha bit getBadgeText: if we have unique "text" for each state,
 then this works nicely BUT ZOOM+SPEED and just SPEED (sites that already zoom)
 overlap getPopup: This is the url for our popup. But it's current SET based on
 state. getTitle: If each title should/could be unique, so it should work.
 But localizing will become harder later.

 There are multiple titles per state for errors: UNSUPPORTED_URL, SECURITY_CHECK_FAILED
 Is it too much to ask to have a simple chrome.action.setStateData()/getStateData()
 that only has the same lifetime as tab badge data and limit it to 4k or something.

 Notes on serviceworker and lifetime.
 The background gets shut down VERY aggressively.
 To try and keep some state, we use chrome.storage.session.
 We could use chrome.storage.local but then we'd need to
 garbage collect and worry about privacy about what's being stored.
 But chrome.storage.session has different issues.
 A VERY strict quotas about how many times it can be called and max data it can store.
 If a user NEVER closes their browser, then the we WILL hit data max eventually.
 **/

// Badges show state to user
const BADGES = {
  NONE: "",
  ZOOMED: "←  →",
  SPEED: "▶️",
  REFRESH: "↺",
  WARNING: "!",
};

const DEFAULT_COLOR = "#FFFFFF00";

type BackgroundState =
  | "UNZOOMED"
  | "ZOOMING" // maps to ZOOMED_NOSPEED or ZOOMED_SPEED
  | "ZOOMING_SPEED_ONLY" // maps to SPEED_ONLY
  | "ZOOMED_NOSPEED"
  | "ZOOMED_SPEED"
  | "SPEED_ONLY"
  | "REFRESH"
  | "ERR_PERMISSION"
  | "ERR_URL"
  | ""; // means
// preserve
// state
type BackgroundStateValue = {
  readonly badge: string;
  readonly title: string;
  readonly showpopup: boolean;
  readonly zoomed: boolean;
  readonly color: string;
};

type BackgroundStateMap = {
  [key in BackgroundState]: BackgroundStateValue;
};

type SubFrameParamData = {
  tabId: number;
  domain: string;
  subFrameStr: string;
  playbackSpeed?: string; // store here so no async required, so we can reply to messages.
};

type SubFramePermMatching = {
  [tabId: number]: SubFrameParamData;
};

const STATE_DATA: BackgroundStateMap = {
  // each title MUST be unique! Reverse lookup uses the title to
  // map chrome.action.getTitle back to state.
  // titles need localization support
  UNZOOMED: {
    badge: BADGES.NONE,
    title: "", // if empty, reloaded from manifest
    showpopup: false,
    zoomed: false,
    color: DEFAULT_COLOR,
  },
  ZOOMING: {
    badge: BADGES.ZOOMED,
    title: "Searching for videos to zoom",
    showpopup: false,
    zoomed: true,
    color: DEFAULT_COLOR,
  },
  ZOOMING_SPEED_ONLY: {
    badge: BADGES.ZOOMED,
    title: "Searching for videos enhance",
    showpopup: true,
    zoomed: true,
    color: DEFAULT_COLOR,
  },
  ZOOMED_NOSPEED: {
    badge: BADGES.SPEED,
    title: "Click to unzoom\nNo speed change allowed by this site.",
    showpopup: false,
    zoomed: true,
    color: DEFAULT_COLOR,
  },
  ZOOMED_SPEED: {
    badge: BADGES.SPEED,
    title: "Click to change speed or unzoom",
    showpopup: true,
    zoomed: true,
    color: DEFAULT_COLOR,
  },
  SPEED_ONLY: {
    badge: BADGES.SPEED,
    title: "Click to change speed",
    showpopup: true,
    zoomed: true,
    color: DEFAULT_COLOR,
  },
  REFRESH: {
    badge: BADGES.REFRESH,
    title: "Permissions check complete.\nClick again more permissions might be needed..",
    showpopup: false,
    zoomed: false,
    color: "#03FC80F4",
  },
  ERR_PERMISSION: {
    badge: BADGES.WARNING,
    title: "Permission denied by user",
    showpopup: false,
    zoomed: false,
    color: "#FCD2D2F7",
  },
  ERR_URL: {
    badge: BADGES.WARNING,
    title: "Extension only works on https sites\n or files dragged+dropped into chrome tab",
    showpopup: true,
    zoomed: false,
    color: "#FCD2D2F7",
  },
  [""]: {
    // not used
    badge: BADGES.SPEED,
    title: "",
    showpopup: false,
    zoomed: false,
    color: DEFAULT_COLOR,
  },
};

// REALLY trying to not require full permissions, but sometime iframes are
// cross-domain and need more permissions. Try to collect iframe domains
// and ask user's ADDITIONAL permission, but it STILL requires a full page
// refresh to re-prompt?!?
const GET_IFRAME_PERMISSIONS = true;

let g_cachedSettings: SettingsType | undefined;

// some places CAN do async, so we refresh the global settings when we can.
// Places that cannot do async just try to use g_cachedSettings directly.
// m3 API REALLY needs some "onload" function (that runs async), to allow
// data to be loaded for background scripts.
async function refreshSettings() {
  const g_cachedSettings = await getSettings();
  return g_cachedSettings;
}

// holds sub iframe urls so we can request access to them.
// We set but no need for delete because chrome frees this memory for the
// background service pretty aggressively.
const g_globalAccessSubframeData: SubFramePermMatching = {};

const EMPTY_ACCESS_SUBFRAME: SubFrameParamData = {
  tabId: 0, // also key
  domain: "",
  subFrameStr: "",
  playbackSpeed: DEFAULT_SPEED_STR,
};

/**
 * Used to track extra domains that iframes might be using so we can prompt for
 * permissions
 */
function getSubframeData(tabId: number, domainMatch: string): SubFrameParamData | false {
  if (domainMatch === "") {
    return false;
  }
  const match = g_globalAccessSubframeData[tabId] || EMPTY_ACCESS_SUBFRAME;
  if (match.domain.indexOf(domainMatch) !== -1) {
    logtrace(`getSubframeData match tabId: "${tabId}"  ${domainMatch} result: `, match);
    return match;
  }
  return false;
}

/**
 * See comments above. Set iframe domain that needs extra permissions to inject
 * speed changes into. No delete data because it's just in memory and is short
 * lived.
 */
function setSubframeData(
  tabId: number,
  domain: string,
  subFrameStr: string,
  playbackSpeed = DEFAULT_SPEED_STR,
) {
  logtrace(
    `setSubframeData tabId:"${tabId}", domain:"${domain}", subFrameStr: "${subFrameStr}", playbackSpeed: "${playbackSpeed}"`,
  );
  g_globalAccessSubframeData[tabId] = {
    tabId,
    domain,
    subFrameStr,
    playbackSpeed,
  };
}

// speed is read by GET_SPEED_COMPLETE_CMD
async function setSpeedGlobalData(tabId: number, domain: string, speed: string) {
  try {
    // the popup sends message to get the speed, it doesn't support async, so we also store
    // in VERY a shorterm global.
    const matched = getSubframeData(tabId, domain);
    setSubframeData(tabId, domain, matched ? matched.subFrameStr : "", speed);

    const key = `speed.${tabId}.${domain}`;
    const orgValue = await chrome.storage.session.get(key);
    if (orgValue[key] === `${speed}`) {
      return true; // call quota, so don't update unless it changes.
    }
    await chrome.storage.session.set({ [`${key}`]: `${speed}` }); // key syntax

    return speed === "1.0"; // true if not speed change required.
  } catch (err) {
    logerr(`setSpeedGlobalData failed`, err);
    await chrome.storage.session.clear(); // we may have run out of quota if
    // user never closes their browser
    return false;
  }
}

/**
 * List of tabIds for actively opened popups. OK to be in memory because we
 * shouldn't be unloaded while the socket is open
 */
let g_PopupOpenedForTabs: number[] = [];

async function setLastUrlTitleFromOnUpdated(tabId: number, url: string, title: string) {
  try {
    const key = `lasturlandtitle.${tabId}`;
    const concatval = `${url}\t${title}`;
    // there is a write quota, so we do extra work to make sure it's actually
    // changing before we rewrite
    const orgValue = await chrome.storage.session.get(key);
    if (orgValue[key] === concatval) {
      return;
    }
    await chrome.storage.session.set({ [`${key}`]: concatval }); // key syntax is
    // silly but
    // seems
    // required?
  } catch (err) {
    logerr(`setLastUrlFromOnUpdated err`, err);
    await chrome.storage.session.clear(); // we may have run out of quota if
    // user never closes their browser
  }
}

async function getLastUrlTitleFromOnUpdated(tabId: number): Promise<{
  url: string;
  title: string;
}> {
  try {
    const key = `lasturlandtitle.${tabId}`;
    const result = await chrome.storage.session.get(key);
    const resulstStr = result[key] || "\t";
    const parts = resulstStr.split("\t");
    return {
      url: parts[0] || "",
      title: parts[1] || "",
    };
  } catch (err) {
    logerr("", err);
    return { url: "", title: "" };
  }
}

// DEFAULT will be the `default_title` string from our manifest.
// Remembering to keep in sync is fragile, and doesn't localize, just load it
let g_UnzoomedTitle = "";

async function getUnzoomTitle() {
  if (g_UnzoomedTitle !== "") {
    return g_UnzoomedTitle;
  }

  try {
    const manifest = await getManifestJson();
    g_UnzoomedTitle = manifest?.action?.default_title || "Click to zoom";
  } catch (err) {}
  return g_UnzoomedTitle;
}

async function setCurrentTabState(
  tabId: number,
  startingState: BackgroundState,
  domain = "",
  speed = DEFAULT_SPEED_STR,
) {
  try {
    let state = startingState;
    // map state to another state.
    if (state === "") {
      // means "preserve state"
      logtrace(`setCurrentState "" => preserve state`);
      // kind of a hack. Means don't change state.
      state = await getCurrentTabState(tabId);
      if (state === "REFRESH") {
        // Exception
        state = "ZOOMING"; // remapped again below
        logtrace(`setCurrentState empty state inital case state: "REFRESH" => "ZOOMING"`);
      }
    }

    switch (state) {
      case "ZOOMING":
        state = (await getSettingUseAdvFeatures()) ? "ZOOMED_SPEED" : "ZOOMED_NOSPEED";
        logtrace(`setCurrentState precheck from "ZOOMING" => "${state}"`);
        break;

      case "ZOOMING_SPEED_ONLY":
        state = "SPEED_ONLY";
        logtrace(`setCurrentState precheck from "ZOOMING_SPEED_ONLY" => "SPEED_ONLY"`);
        debugger;
        break;

      default:
      // no-op
    }

    let { badge, title, showpopup, color } = STATE_DATA[state];
    if (state === "UNZOOMED") {
      title = await getUnzoomTitle();
    }
    logtrace(
      `setCurrentState "${state}"
    badge: "${badge}"
    title: "${title}"
    showpopup: "${showpopup}"
    color: "${color}"`,
      STATE_DATA[state],
    );

    // we need to pass in the tab id because the popup js can't get it and the
    // the message sent to background is missing it.
    const popup = showpopup
      ? `popup.html#tabId=${tabId}&speed=${speed}&domain=${domain}&badge=${badge}`
      : "";

    logtrace(`popup url "${popup}"`);
    // don't think the order matters, just set them all and wait for them to
    // complete.
    await Promise.all([
      chrome.action.setBadgeText({ tabId, text: badge }),
      chrome.action.setPopup({ tabId, popup }),
      chrome.action.setTitle({ tabId, title }),
      chrome.action.setBadgeBackgroundColor({ tabId, color }),
    ]);
  } catch (err) {
    logerr(err);
  }
}

async function getCurrentTabState(tabId: number): Promise<BackgroundState> {
  try {
    const title = await chrome.action.getTitle({ tabId });
    // Normally, would could test if the string is in BackgroundState
    // but typescript doesn't support string unions as of 2023
    const backgroundStates = Object.keys(STATE_DATA) as BackgroundState[];
    const keys = backgroundStates.filter((k) => STATE_DATA[k].title === title);
    if (!keys?.length) {
      logtrace(`getTabCurrentState NO MATCH "${keys}" -> UNZOOMED`);
      return "UNZOOMED";
    }
    logtrace(`getTabCurrentState "${keys}" -> ${keys[0]}`);
    return keys[0];
  } catch (err) {
    logerr("GetStateErr", err);
    return "UNZOOMED";
  }
}

function isActiveState(state: BackgroundState) {
  return STATE_DATA[state]?.zoomed || false;
}

/**
 * Injection returns an array of results, this aggregates them into a single
 * result.
 * Assume default is true or false. If any result in array
 *   is different then it that's the result of all of the values.
 */
function injectionResultCheckBool(
  injectionResults: InjectionResult<boolean>[],
  defaultVal = false,
) {
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
 * Injection returns an array of results, this aggregates them into a single
 * result.
 * Assume default is a string. The first result in array
 *   is different then it that, then it's considered result for all of the values.
 */
function injectionResultCheckString(
  injectionResults: InjectionResult<string | null>[],
  defaultVal: string,
): string {
  if (injectionResults == null || (injectionResults?.length || 0) === 0) {
    return defaultVal;
  }
  for (const frameresult of injectionResults) {
    if (frameresult?.result !== defaultVal && frameresult?.result) {
      return frameresult.result;
    }
  }
  return defaultVal;
}

/**
 * Injection returns an array of results, this aggregates them into a single
 * result.
 * Assume default is a string. The first result in array
 *   is different then it that, then it's considered result for all of the values.
 */
function injectionResultCheckZoomState(
  injectionResults: InjectionResult<CheckVideoZoomedState | null>[],
  defaultVal: CheckVideoZoomedState,
): CheckVideoZoomedState {
  if (injectionResults == null || (injectionResults?.length || 0) === 0) {
    return defaultVal;
  }
  const counts: { [key in CheckVideoZoomedState]: number } = {
    UNZOOMED: 0,
    ZOOMED: 0,
    NEEDS_REZOOM: 0,
  };
  for (const frameresult of injectionResults) {
    const result = frameresult?.result ?? defaultVal;
    counts[result]++;
  }
  // now we have all the counts. If there are any NEEDS_REZOOM then use that.
  if (counts["NEEDS_REZOOM"] > 0) {
    return "NEEDS_REZOOM";
  }
  if (counts["ZOOMED"] > 0) {
    return "ZOOMED";
  }
  if (counts["UNZOOMED"] > 0) {
    return "UNZOOMED";
  }
  return defaultVal;
}

async function doInjectZoom(tabId: number) {
  try {
    // The script will be run at document_end
    logtrace("doInjectZoom enter");
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true, // false doesn't hide some content.
      }, // world:  "MAIN",
      files: ["cmd_zoom_inject.js", "injectVideomaxMain.js"],
      injectImmediately: true,
    });

    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true, // false doesn't hide some content.
      }, // world:  "MAIN",
      files: ["cmd_zoom_inject.js", "injectVideomaxMain.js"],
      injectImmediately: true,
    });
    logtrace("doInjectZoom leave");
  } catch (err) {
    logerr(err);
  }
}

/**
 * Tag only is for when we're dealing with sites that already zoom correctly
 * but we want to be able to change playback control
 */
async function doInjectTagOnlyJS(tabId: number) {
  try {
    logtrace("doInjectTagOnlyJS enter");
    // The script will be run at document_end
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, // world:  "MAIN",
      files: ["cmd_tagonly_inject.js", "injectVideomaxMain.js"],
      injectImmediately: true,
    });
    logtrace("doInjectTagOnlyJS leave");
  } catch (err) {
    logerr(err);
  }
}

async function doInjectZoomCSS(
  tabId: number,
  isDummy = false, // for JS only injection (no zoom), we
  // still inject a dummy css header as
  // a
  // marker that we injected
) {
  try {
    logtrace("doInjectZoomCSS enter");
    const cssFilePath = isDummy ? "" : chrome.runtime.getURL(CSS_FILE);
    // we inject this way because we can undo it by deleting the style element.
    // The script will be run at document_end
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, // world:  "MAIN",
      func: injectCssHeader,
      args: [cssFilePath, CSS_STYLE_HEADER_ID],
      injectImmediately: true,
    });
    logtrace("doInjectZoomCSS leave");
  } catch (err) {
    logerr(err);
  }
}

async function doInjectUndoCSS(tabId: number) {
  try {
    logtrace("doInjectUndoCSS enter");
    await chrome.scripting.executeScript({
      target: {
        tabId, // frameIds: [0],
        allFrames: true,
      }, // world:  "MAIN",
      func: injectCssHeaderRemove,
      args: [CSS_STYLE_HEADER_ID],
      injectImmediately: true,
    });
    logtrace("doInjectUndoCSS leave");
  } catch (err) {
    logerr(err);
  }
}

async function doInjectCheckCSSIsBlocked(tabId: number) {
  try {
    logtrace("doInjectCheckCSSIsBlocked enter");
    const cssFilePath = chrome.runtime.getURL(CSS_FILE);
    const injectionresult = await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func: injectIsCssHeaderIsBlocked,
      args: [cssFilePath], // world:
      injectImmediately: true,
      //  "MAIN",
    });

    const result = injectionResultCheckBool(injectionresult);
    logtrace(`DoCheckCSSInjectedIsBlocked result: ${result}`, injectionresult);
    return result;
  } catch (err) {
    logerr("doInjectCheckCSSIsBlocked failed, returning false", err);
    return true; // true means it's blocked
  }
}

async function doInjectUnZoom(tabId: number, domain: string) {
  try {
    logtrace("doInjectUnZoom enter");
    await Promise.all([
      setCurrentTabState(tabId, "UNZOOMED"),
      doInjectUndoCSS(tabId),
      doInjectSetSpeed(tabId, domain, DEFAULT_SPEED_STR, false),
      chrome.scripting.executeScript({
        target: {
          tabId,
          allFrames: true,
        }, // world:  "MAIN",
        files: ["cmd_unzoom_inject.js", "injectVideomaxMain.js"],
        injectImmediately: true,
      }),
    ]);
    logtrace("doInjectUnZoom leave");
  } catch (err) {
    logerr(err);
  }
}

async function DoZoom(tabId: number, state: BackgroundState, domain?: string) {
  logtrace("DoZoom enter");
  try {
    let excluded_zoom = false; // assume not excluded
    if (domain?.length) {
      const settings = await refreshSettings();
      excluded_zoom = isPageExcluded(domain, settings.zoomExclusionListStr);
    }

    if (excluded_zoom || state === "SPEED_ONLY") {
      await setCurrentTabState(tabId, "ZOOMING_SPEED_ONLY", domain);
      await doInjectTagOnlyJS(tabId); // doInjectZoomCSS(tabId, true)
    } else {
      await setCurrentTabState(tabId, "ZOOMING", domain);
      await doInjectZoom(tabId);
      await doInjectZoomCSS(tabId);

      // now verify the css wasn't blocked by CSP.
      const wasCSSBlocked = await doInjectCheckCSSIsBlocked(tabId);
      if (wasCSSBlocked) {
        logtrace("CSS loading file BLOCKED. directly adding css. undo/redo may fail");
        // ok. we just need to inject in a way that cannot be easily undone.
        await chrome.scripting.insertCSS({
          target: {
            tabId,
            allFrames: true,
          },
          origin: "AUTHOR",
          files: [CSS_FILE],
        });
      }
    }
  } catch (err) {
    logerr(err);
  }
  logtrace("DoZoom leave");
}

async function doInjectSetSpeed(
  tabId: number,
  domain: string,
  speedStr = DEFAULT_SPEED_STR,
  allowPlaybackToggle = true,
) {
  try {
    logtrace(`doInjectSetSpeed: enter tabId:${tabId} new speed:${speedStr}`);

    if (typeof parseFloat(speedStr) !== "number") {
      logerr(`doInjectSetSpeed: Speed NOT valid number '${speedStr}'`);
      return;
    }
    const currentSpeed = await doInjectGetSpeed(tabId, domain);

    if (currentSpeed === speedStr) {
      logtrace(
        `doInjectSetSpeed: NOT setting video speed since currentSpeed === speedStr "${currentSpeed}"`,
      );
      return;
    }

    await setSpeedGlobalData(tabId, domain, speedStr);
    logtrace(`doInjectSetSpeed: executeScript: injectVideoSpeedAdjust 
      tabId:${tabId} speed:${speedStr} allowPlaybackToggle:${allowPlaybackToggle}`);
    // "allFrames" is broken unless manifest requests permissions
    // `"optional_host_permissions": ["<all_urls>"]`
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, // world:  "MAIN",
      func: injectVideoSpeedAdjust,
      args: [speedStr, allowPlaybackToggle],
      injectImmediately: true,
    });
    logtrace(`doInjectSetSpeed: leave`);
  } catch (err) {
    logerr(err);
    return;
  }
}

async function doInjectGetVideoZoomed(
  tabId: number,
  domain: string,
): Promise<CheckVideoZoomedState> {
  try {
    const results = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, // world:  "MAIN",
      func: injectGetVideoZoomedState,
      args: [],
      injectImmediately: true,
    });
    logtrace(`injectGetVideoZoomedState:`, results);
    // only injected into the single main, no iframes, so should be a single result.
    const result = injectionResultCheckZoomState(results, "UNZOOMED");
    logtrace(`injectGetVideoZoomedState "${result}" for tabId:${tabId} domain: ${domain}`);
    return result;
  } catch (err) {
    logtrace("injectGetVideoZoomedState error", err);
    return "UNZOOMED";
  }
}

async function doInjectGetSpeed(tabId: number, domain: string) {
  try {
    const results = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, // world:  "MAIN",
      func: injectGetPlaypackSpeed,
      args: [],
      injectImmediately: true,
    });

    const speed = injectionResultCheckString(results, DEFAULT_SPEED_STR);
    logtrace(`doInjectGetSpeed returned "${speed}" for tabId:${tabId} domain: ${domain}`, results);
    if (speed) {
      await setSpeedGlobalData(tabId, domain, speed);
      return speed;
    } else {
      // no videos in any frame had non-default 1.0 speed, so reset our assumption
      await setSpeedGlobalData(tabId, domain, DEFAULT_SPEED_STR);
      return DEFAULT_SPEED_STR;
    }
  } catch (err) {
    logtrace("doInjectGetSpeed error", err);
    return DEFAULT_SPEED_STR;
  }
}

async function doInjectSkipPlayback(tabId: number, secondToSkipStr: string, domain: string) {
  try {
    logtrace("doInjectSkipPlayback", tabId, secondToSkipStr);
    if (
      domain?.length &&
      BLOCKED_SKIPFEATURE_DOMAINS.filter((d) => domain.includes(d)).length > 0
    ) {
      logtrace("netflix fails if we skip");
      return;
    }
    if (typeof parseFloat(secondToSkipStr) !== "number") {
      logerr(`secondToSkipStr NOT valid number '${secondToSkipStr}'`);
      return;
    }

    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, // world:  "MAIN",
      func: injectVideoSkip,
      args: [secondToSkipStr],
      injectImmediately: true,
    });
  } catch (err) {
    logerr(err);
  }
}

function processIFrameExtraPermissionsResult(
  results: InjectionResult<string[]>[],
  tabId: number,
  domain: string,
  playbackSpeed: string = DEFAULT_SPEED_STR,
) {
  if (!GET_IFRAME_PERMISSIONS || results.length === 0) {
    return false;
  }
  const extraDomainsArry = results
    .map((o) => o.result)
    .flat()
    .filter((str) => str && str?.length > 0);
  if (extraDomainsArry.length) {
    // add to existing data
    const matched = getSubframeData(tabId, domain);
    if (matched) {
      const combinedDomainParts = [...matched.subFrameStr.split(","), extraDomainsArry];
      setSubframeData(tabId, domain, combinedDomainParts.join(","), matched.playbackSpeed);
    } else {
      setSubframeData(tabId, domain, extraDomainsArry.join(","), playbackSpeed);
    }
    return true;
  }
  return false;
}

async function doInjectCheckPermissions(tabId: number, domain: string) {
  try {
    logtrace(`doInjectCheckPermissions: enter`);
    const results = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, // world:  "MAIN",
      func: injectCheckPermissions,
      args: [],
      injectImmediately: true,
    });
    logtrace(`doInjectCheckPermissions: leave`);
    return processIFrameExtraPermissionsResult(results, tabId, domain);
  } catch (err) {
    logerr(err);
    return false;
  }
}

async function getSettingUseAdvFeatures() {
  try {
    const settings = await refreshSettings();
    logtrace("getFeatureShowZoomPopup settings:", JSON.stringify(settings, null, 2));
    return settings.useAdvancedFeatures;
  } catch (err) {
    logerr(err);
    return DEFAULT_SETTINGS.useAdvancedFeatures;
  }
}

async function getSettingIntroAlreadyShown() {
  try {
    const settings = await refreshSettings();
    const wasAlreadyShown = UPDATE_NOTIFICATION_VERISON === settings.lastBetaVersion;
    if (wasAlreadyShown) {
      return true;
    }

    // now update it to expected version
    settings.lastBetaVersion = UPDATE_NOTIFICATION_VERISON;
    await saveSettings(settings);
    return wasAlreadyShown;
  } catch (err) {
    logerr(err);
    return true;
  }
}

/** Fired when the extension is first installed, when the extension is updated to a new version,
 * and when Chrome is updated to a new version. */
async function showUpgradePageIfNeeded() {
  try {
    logtrace("showUpgradePageIfNeeded");
    // checked saved state and see if we've opened the page about v3 update.
    const shown = await getSettingIntroAlreadyShown();
    if (shown || !IS_BETA_CHANNEL) {
      return;
    }

    await chrome.tabs.create({
      url: chrome?.runtime?.getURL("help.html"),
      active: false,
    });
  } catch (err) {
    logerr(err);
  }
}

async function toggleZoomState(tabId: number, domain: string) {
  const state = await getCurrentTabState(tabId);
  if (!isActiveState(state)) {
    // await setCurrentTabState(tabId, "", domain);
    await DoZoom(tabId, state, domain);
    // the following dance is to see if we need more permissions
    // domain will set
    // g_globalAccessSubframeData
    // to get more permissions on next click event
    await doInjectCheckPermissions(tabId, domain); // iframe on diff
    return true;
  }

  // we are zoomed but
  if (state === "ZOOMED_NOSPEED") {
    await Promise.all([
      // toggle behavior otherwise message unzooms
      doInjectUnZoom(tabId, domain),
      setCurrentTabState(tabId, "UNZOOMED", domain),
    ]);
    return false;
  }

  await setCurrentTabState(tabId, "", domain);
  return true;
}

chrome.action.onClicked.addListener((tab) => {
  logtrace("chrome.action.onClicked - checking permissions");
  const tabId = tab.id ?? 0;
  // keep in sync with manifest.json `optional_permissions`
  try {
    // noinspection HttpUrlsUsage
    if (
      !(
        tab?.url?.startsWith("https://") ||
        tab?.url?.startsWith("http://") ||
        tab?.url?.startsWith("file:")
      )
    ) {
      // do not run on chrome: or about: urls.
      (async () => await setCurrentTabState(tabId, "ERR_URL"))();
      logtrace("ERR_URL");
      return;
    }

    // can't use async... which really sucks and is annoying
    chrome.storage.local.get((resultSettings) => {
      const settingsSaved: SettingsType = JSON.parse(resultSettings[SETTINGS_STORAGE_KEY] || "{}");
      const settings = { ...DEFAULT_SETTINGS, ...settingsSaved };
      const origins: string[] = [];
      const permissions = ["scripting"];

      if (settings.allSitesAccess) {
        // Many cross-domain iframed videos without "<all_urls>". BBC, NBC,
        // etc.
        // There appears to be NO way to get a list of iframe domains on a page
        // to request access without FIRST HAVING ACCESS to the parent page.
        // ಠ_ಠ There is no better security model that works in Chrome, yet. See
        // https://bugs.chromium.org/p/chromium/issues/detail?id=826433 VERY
        // frustrating when trying to build a secure extension.
        logtrace("Adding <all_urls> permissions");
        origins.push("<all_urls>");
        if (!settings.allSitesAccessNeedsRevoke) {
          // we attempt to undo permissions if the user ever toggles it off
          logtrace("Enabling allSitesAccessNeedsRevoke setting");
          settings.allSitesAccessNeedsRevoke = true;
          (async () => await saveSettings(settings))();
        }
      } else {
        // revoke all_sites permissions if the user disabled it in the options
        if (settings.allSitesAccessNeedsRevoke) {
          logtrace("Revoking <all_urls> permissions");
          settings.allSitesAccessNeedsRevoke = false; // clear so we don't run
          // every time
          (async () => {
            await saveSettings(settings);
            await chrome.permissions.remove({
              permissions,
              origins: ["<all_urls>"],
            });
          })();
        }

        // push a tld domain wide request. Often videos are in iframes on
        // different sub domains like www.example.com and static.example.com
        let domain = "";
        if (tab?.url?.startsWith("https://")) {
          domain = getDomain(tab.url);
          origins.push(domainToSiteWildcard(domain, settings.wholeDomainAccess));
        } else if (tab.url?.length) {
          origins.push(tab.url);
        }

        const subFrameData = getSubframeData(tabId, domain);
        if (GET_IFRAME_PERMISSIONS && subFrameData !== false) {
          const iframeDomains = subFrameData.subFrameStr
            .split(",")
            .map((d) => domainToSiteWildcard(d, settings.wholeDomainAccess))
            .filter((d) => d.length);
          origins.push(...iframeDomains);
          logtrace("Requesting extra iframe domains that blocked speedup", iframeDomains);
        }
      }

      chrome.permissions.request(
        {
          permissions,
          origins,
        },
        async (granted) => {
          if (!granted) {
            await setCurrentTabState(tabId, "ERR_PERMISSION");
            logerr(
              `permissions to run were denied for "${tab?.url}", so extension is not injecting`,
            );
            const fileAccessEnabledForExtention =
              await chrome.extension.isAllowedFileSchemeAccess();
            if (!fileAccessEnabledForExtention) {
              await chrome.tabs.create({
                url: chrome?.runtime?.getURL("help.html#localfile"),
                active: false,
              });
            }
            return;
          }
          logtrace("permissions granted for ", origins?.join(" ") || "");
          await showUpgradePageIfNeeded();
          // tab?.url could be undefined, so we need to query to get the current
          // tab
          if (!tab?.url) {
            // now we have to go back and get the url since it wasn't passed to us
            // simple thing is to ask the user to click the button again.
            await setCurrentTabState(tabId, "REFRESH");
            return;
          }
          // domain will be empty for "file://"
          await toggleZoomState(tabId, getDomain(tab.url));
          // used to detect SPA nav. Clip anchor
          const url = tab.url.split("#")[0];
          await setLastUrlTitleFromOnUpdated(tabId, url, tab?.title ?? "");
        },
      );
    });
  } catch (err) {
    logerr(err);
  }
});

/**
 * Called when we're zoomed but the popup is redisplayed.
 */
async function ReZoom(tabId: number, domain: string) {
  // the popup is about to display and thinks the page is zoomed, but it's may
  // not be (e.g. if escape key was pressed.) in theory, re-injecting should be
  // fine
  const currentState = await getCurrentTabState(tabId);

  if (currentState === "ZOOMING_SPEED_ONLY") {
    logtrace("REZOOM_CMD - Speed only, not rezooming");
    // 6/2024 We now read speed back from page on load
    // await doInjectSetSpeed(tabId, domain, currentSpeed, false);
  } else {
    logtrace("REZOOM_CMD -- Zooming");
    // a full zoom isn't needed, just the css reinjected.

    // ignore the speed sent in. For rezoom, the popup has been deleted, so it
    // can't send the speed, we have to reget it.
    const currentSpeed = await doInjectGetSpeed(tabId, domain);

    // we need to see if we're in "SPEED_ONLY" mode because
    // we don't have access to the url to see if it's a site like hulu
    const nextState = currentState === "SPEED_ONLY" ? "ZOOMING_SPEED_ONLY" : "ZOOMING";
    await setCurrentTabState(tabId, nextState, currentSpeed);
    await DoZoom(tabId, currentState, domain);
    // 6/2024 We now read speed back from page on load
    // doInjectSetSpeed(tabId, domain, currentSpeed, false)
    logtrace("REZOOM_CMD -- Zooming -- COMPLETE");
  }
}

// handle popup messages
chrome.runtime.onMessage.addListener((request: BackgroundMessage, sender, sendResponse) => {
  const cmd = request?.message?.cmd ?? "";
  const tabId = request?.message?.tabId ?? 0;
  const speed = request?.message?.speed ?? DEFAULT_SPEED_STR;
  const domain = request?.message?.domain ?? "";
  if (!tabId) {
    logerr("something wrong with message", request);
    if (sendResponse) {
      sendResponse({ success: false });
    }
    return;
  }

  logtrace(
    `chrome.runtime.onMessage cmd:"${cmd}" tabId:"${tabId}" domain:"${domain}"`,
    request,
    sender,
  );

  if (cmd === "GET_SPEED_COMPLETE_CMD") {
    // return immediately. Use prior value from "GET_SPEED_PREP_CMD"
    const match = getSubframeData(tabId, domain);
    const success = match !== false;
    const playbackSpeed = success ? match.playbackSpeed : DEFAULT_SPEED_STR;
    sendResponse({ success, playbackSpeed });
    logtrace(
      `GET_SPEED_COMPLETE_CMD: sendResponse({success: ${success}, playbackSpeed: ${playbackSpeed} })
        subvrameParamData:`,
      match,
    );
  }

  // use timeout to get async scope. listener callbacks can't be async.
  setTimeout(async () => {
    try {
      switch (cmd) {
        case "UNZOOM_CMD":
          await doInjectUnZoom(tabId, domain);
          if (IS_BETA_CHANNEL) {
            const settings = await refreshSettings();
            if (!settings.beta3EndingShown) {
              await chrome.tabs.create({
                url: chrome?.runtime?.getURL("beta_ending.html"),
                active: false,
              });
              settings.beta3EndingShown = true;
              await saveSettings(settings);
            }
          }

          break;

        case "SET_SPEED_CMD":
          await setCurrentTabState(tabId, "ZOOMED_SPEED", domain, speed);
          await doInjectSetSpeed(tabId, domain, speed, true);
          break;

        case "REZOOM_CMD":
          await ReZoom(tabId, domain);
          break;

        case "SKIP_PLAYBACK_CMD":
          await doInjectSkipPlayback(tabId, speed, domain);
          break;

        case "OPTIONS_CMD":
          {
            const url = chrome?.runtime?.getURL("options.html") || "";
            if (!url) {
              return;
            }
            await chrome.tabs.create({ url, active: true });
            // also, the popup is closing
          }
          break;

        case "GET_SPEED_PREP_CMD":
          // this saves result and the GET_SPEED_COMPLETE_CMD will read it.
          // it is NOT in this switch because it has a response that cannot be async
          // and since it cannot be async, we have this two-part request.
          await doInjectGetSpeed(tabId, domain);

          setTimeout(async () => {
            const zoomedstate = await doInjectGetVideoZoomed(tabId, domain);
            if (zoomedstate === "NEEDS_REZOOM") {
              logtrace(`doInjectGetVideoZoomed says zoom was lost, Unzooming first`);
              await doInjectUnZoom(tabId, domain);
            }
          }, 0);
          break;

        case "":
        case "GET_SPEED_COMPLETE_CMD":
          // mostly handled above
          setTimeout(async () => {
            const zoomedstate = await doInjectGetVideoZoomed(tabId, domain);
            if (zoomedstate !== "ZOOMED") {
              logtrace(`doInjectGetVideoZoomed says zoom was lost, rezooming`);
              await doInjectZoom(tabId);
            }
          }, 0);

          break;
      }
    } catch (err) {
      logerr(err);
    }
  }, 0);

  if (sendResponse) {
    logtrace("closing popup");
    sendResponse({ success: true }); // used to close popup.
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    const domain = getDomain(changeInfo.url);
    logtrace(`tabs.onUpated event tabId=${tabId} 
      changeInfo: 
          ${JSON.stringify(changeInfo, null, 2)}}
      tab:
        ${JSON.stringify(tab, null, 2)}`);
    if (tabId && ["loading", "completed"].includes(changeInfo?.status || "")) {
      logtrace(`tabs.onUpdated event likely SPA nav`);

      setTimeout(async () => {
        // async calls needed
        const popupUIActive = g_PopupOpenedForTabs.includes(tabId);
        if (popupUIActive || isActiveState(await getCurrentTabState(tabId))) {
          // some SPA won't do a clean refetch, we need to uninstall.
          if (popupUIActive) {
            // popup is open, so keep zoomed
            logtrace("tabs.onUpdated: Popup UI Open so REzooming");
            await ReZoom(tabId, domain);
            return;
          }
          // todo: make sticky spa nav based on domain list
          if (!g_cachedSettings?.noStickySPANav) {
            logtrace("tabs.onUpdated: g_cachedSettings?.noStickySPANav so REzooming");
            await ReZoom(tabId, domain);
            return;
          }

          // some sites (hampster) will set an anchor in url when progress
          // clicked near end.
          const { url: lastUrl, title: lastTitle } = await getLastUrlTitleFromOnUpdated(tabId);

          const newUrl = (changeInfo?.url ?? "").split("?")[0].toLowerCase();
          const newTitle = (changeInfo?.title ?? "").toLowerCase();

          // these conditions could be combined, but the logtrace is useful
          if (newTitle.length && lastTitle === newTitle) {
            logtrace("tabs.onUpdated: Page title is the same so REzooming");
            await ReZoom(tabId, domain);
            return;
          }

          if (newUrl.length && lastUrl === newUrl) {
            logtrace("tabs.onUpdated: Page URL is the same so REzooming");
            await ReZoom(tabId, domain);
            return;
          }
          // it's different, so save updated information.
          await setLastUrlTitleFromOnUpdated(tabId, newUrl, newTitle);
          logtrace(`tabs.onUpdated: Popup UI CLOSED so UNzooming. 
              lastUrl: "${lastUrl}"
              lastTitle: "${lastTitle}"
              newUrl: "${newUrl}"
              newTitle: "${newTitle}"
              `);
          // removed unzoom - breaks instagram"
          // await doInjectUnZoom(tabId, domain);
        } else {
          logtrace(`tabs.onUpdated event tabId not currently zoomed ${tabId}`);
        }
      }, 0);
    }
  } catch (err) {
    logerr(err);
  }
});

chrome.runtime.onConnect.addListener((externalPort) => {
  if (!externalPort.sender?.url?.length) {
    return;
  }
  {
    const url = new URL(externalPort.sender.url);
    const params = new URLSearchParams(url.hash.replace("#", ""));
    const tabId = Number(params.get("tabId") ?? "0");

    if (!g_PopupOpenedForTabs.includes(tabId)) {
      g_PopupOpenedForTabs = [...g_PopupOpenedForTabs, tabId];
      logtrace(
        `Popup opened. Added tabId:'${tabId}' g_PopupOpenedForTabs: [${g_PopupOpenedForTabs.join(
          ",",
        )}]`,
      );
    }
  }

  externalPort.onDisconnect.addListener((portDisconnectEvent) => {
    // we can get the tab by looking at the url.
    if (!portDisconnectEvent.sender?.url?.length) {
      return;
    }
    const url = new URL(portDisconnectEvent.sender.url);
    const params = new URLSearchParams(url.hash.replace("#", ""));
    const tabId = Number(params.get("tabId") ?? "0");

    if (g_PopupOpenedForTabs.includes(tabId)) {
      logtrace(
        `Popup closed. Removed tabId:'${tabId}' g_PopupOpenedForTabs: [${g_PopupOpenedForTabs.join(
          ",",
        )}]`,
      );
      g_PopupOpenedForTabs = g_PopupOpenedForTabs.filter((eachId) => tabId !== eachId);
    }
  });
});
