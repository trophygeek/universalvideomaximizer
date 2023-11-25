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
} from "./common";

import {
  injectVideoSpeedAdjust,
  injectGetPlaypackSpeed,
  injectVideoSkip,
  injectCssHeader,
  uninjectCssHeader,
  injectIsCssHeaderIsBlocked,
} from "./background_executescripts";

import InjectionResult = chrome.scripting.InjectionResult;
/**
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
    title:
      "Permissions check complete.\nClick again more permissions might be needed..",
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
    title:
      "Extension only works on https sites\n or files dragged+dropped into chrome tab",
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

const BLOCKED_SKIPFEATURE_DOMAINS = ["netflix."]; // skipping breaks these sites

// holds sub iframe urls so we can request access to them.
// We set but no need for delete because chrome frees this memory for the
// background service pretty aggressively.
const g_globalAccessSubframeData: SubFramePermMatching = {};

const EMPTY_ACCESS_SUBFRAME: SubFrameParamData = {
  tabId: 0, // also key
  domain: "",
  subFrameStr: "",
};

/**
 * Used to track extra domains that iframes might be using so we can prompt for
 * permissions
 */
function getSubframeData(
  tabId: number,
  domainMatch: string
): SubFrameParamData | false {
  if (domainMatch === "") {
    return false;
  }
  const match = g_globalAccessSubframeData[tabId] || EMPTY_ACCESS_SUBFRAME;
  if (match.domain.indexOf(domainMatch) !== -1) {
    trace(
      `getSubframeData match tabId: "${tabId}"  ${domainMatch} result: `,
      match
    );
    return match;
  }
  return false;
}

/**
 * See comments above. Set iframe domain that needs extra permissions to inject
 * speed changes into. No delete data because it's just in memory and is short
 * lived.
 */
function setSubframeData(tabId: number, domain: string, subFrameStr: string) {
  trace(
    `setSubframeData tabId:"${tabId}", domain:"${domain}", subFrameStr: "${subFrameStr}"`
  );
  g_globalAccessSubframeData[tabId] = {
    tabId,
    domain,
    subFrameStr,
  };
}

async function setSpeedGlobalData(
  tabId: number,
  domain: string,
  speed: string
): Promise<boolean> {
  try {
    const key = `speed.${tabId}.${domain}`;
    const orgValue = await chrome.storage.session.get(key);
    if (orgValue[key] === `${speed}`) {
      return true; // call quota, so don't update unless it changes.
    }
    await chrome.storage.session.set({ [`${key}`]: `${speed}` }); // key syntax
    // is silly but
    // seems
    // required?
    return !!orgValue[key]?.length;
  } catch (err) {
    logerr(`setSpeedGlobalData failed`, err);
    await chrome.storage.session.clear(); // we may have run out of quota if
    // user never closes their browser
    return false;
  }
}

async function getGlobalSpeedData(
  tabId: number,
  domain: string
): Promise<string> {
  try {
    const key = `speed.${tabId}.${domain}`;
    const orgValue = await chrome.storage.session.get(key);
    return orgValue[key] || DEAULT_SPEED;
  } catch (err) {
    logerr(`getGlobalSpeedData failed`, err);
    return DEAULT_SPEED;
  }
}

/**
 * List of tabIds for actively opened popups. OK to be in memory because we
 * shouldn't be unloaded while the socket is open
 */
let g_PopupOpenedForTabs: number[] = [];

async function setLastUrlTitleFromOnUpdated(
  tabId: number,
  url: string,
  title: string
): Promise<void> {
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
// Remember to keep in sync is fragile, and doesn't localize, just load it
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
  domain: string = "",
  speed: string = DEAULT_SPEED
): Promise<void> {
  try {
    let state: BackgroundState = startingState;
    // map state to another state.
    if (state === "") {
      // means "preserve state"
      trace(`setCurrentState "" => preserve state`);
      // kind of a hack. Means don't change state.
      state = await getCurrentTabState(tabId);
      if (state === "REFRESH") {
        // Exception
        state = "ZOOMING"; // remapped again below
      }
    }

    switch (state) {
      case "ZOOMING":
        trace(`setCurrentState "${state}"`);
        state = (await getSettingUseAdvFeatures())
          ? "ZOOMED_SPEED"
          : "ZOOMED_NOSPEED";
        break;

      case "ZOOMING_SPEED_ONLY":
        trace(`setCurrentState "${state}"`);
        state = "SPEED_ONLY";
        break;

      default:
      // no-op
    }

    let { badge, title, showpopup, color } = STATE_DATA[state];
    if (state === "UNZOOMED") {
      title = await getUnzoomTitle();
    }
    trace(
      `setCurrentState "${state}"
    badge: "${badge}"
    title: "${title}"
    showpopup: "${showpopup}"
    color: "${color}"`,
      STATE_DATA[state]
    );

    // we need to pass in the tab id because the popup js can't get it and the
    // the message sent to background is missing it.
    const popup = showpopup
      ? `popup.html#tabId=${tabId}&speed=${speed}&domain=${domain}&badge=${badge}`
      : "";

    trace(`popup url "${popup}"`);
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
    const keys: BackgroundState[] = backgroundStates.filter(
      (k) => STATE_DATA[k].title === title
    );
    if (!keys?.length) {
      trace(`getTabCurrentState NO MATCH "${keys}"`);
      return "UNZOOMED";
    }
    trace(`getTabCurrentState "${keys}"`);
    return keys[0];
  } catch (err) {
    logerr("GetStateErr", err);
    return "UNZOOMED";
  }
}

function isActiveState(state: BackgroundState): boolean {
  return STATE_DATA[state]?.zoomed || false;
}

/**
 * Injection returns an array of results, this aggregates them into a single
 * result.
 * @param injectionResults {}
 * @param defaultVal {} Assume default is true or false. If any result in array
 *   is different then it that's the result of all of the values.
 * @returns {boolean}
 */
const injectionResultCheckBool = (
  injectionResults: InjectionResult<boolean>[],
  defaultVal: boolean = false
): boolean => {
  if ((injectionResults?.length || 0) === 0) {
    return defaultVal;
  }
  for (const frameresult of injectionResults) {
    if (frameresult.result !== defaultVal) {
      return frameresult.result;
    }
  }
  return defaultVal;
};

async function DoInjectZoomJS(tabId: number): Promise<void> {
  try {
    // The script will be run at document_end
    trace("DoInjectZoomJS enter");
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true, // false doesn't hide some content.
      }, // world:  "MAIN",
      files: ["cmd_zoom_inject.js", "videomax_main_inject.js"],
    });

    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true, // false doesn't hide some content.
      }, // world:  "MAIN",
      files: ["cmd_zoom_inject.js", "videomax_main_inject.js"],
    });
    trace("DoInjectZoomJS leave");
  } catch (err) {
    logerr(err);
  }
}

/**
 * Tag only is for when we're dealing with sites that already zoom correctly
 * but we want to be able to change playback control
 */
async function DoInjectTagOnlyJS(tabId: number): Promise<void> {
  try {
    trace("DoInjectTagOnlyJS enter");
    // The script will be run at document_end
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, // world:  "MAIN",
      files: ["cmd_tagonly_inject.js", "videomax_main_inject.js"],
    });
    trace("DoInjectTagOnlyJS leave");
  } catch (err) {
    logerr(err);
  }
}

async function DoInjectZoomCSS(
  tabId: number,
  isDummy: boolean = false // for JS only injection (no zoom), we
  // still inject a dummy css header as
  // a
  // marker that we injected
): Promise<void> {
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
      func: injectCssHeader,
      args: [cssFilePath, CSS_STYLE_HEADER_ID],
    });
    trace("DoInjectZoomCSS leave");
  } catch (err) {
    logerr(err);
  }
}

async function DoUndoInjectCSS(tabId: number): Promise<void> {
  try {
    trace("DoUndoInjectCSS enter");
    await chrome.scripting.executeScript({
      target: {
        tabId, // frameIds: [0],
        allFrames: true,
      }, // world:  "MAIN",
      func: uninjectCssHeader,
      args: [CSS_STYLE_HEADER_ID],
    });
    trace("DoUndoInjectCSS leave");
  } catch (err) {
    logerr(err);
  }
}

async function DoCheckCSSInjectedIsBlocked(tabId: number): Promise<boolean> {
  try {
    trace("DoCheckCSSInjectedIsBlocked enter");
    const cssFilePath = chrome.runtime.getURL(CSS_FILE);
    /** @var {InjectionResult[]} */
    const injectionresult = await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func: injectIsCssHeaderIsBlocked,
      args: [cssFilePath], // world:
      //  "MAIN",
    });

    const result = injectionResultCheckBool(injectionresult);
    trace(`DoCheckCSSInjectedIsBlocked result: ${result}`, injectionresult);
    return result;
  } catch (err) {
    logerr("DoCheckCSSInjectedIsBlocked failed, returning false", err);
    return true; // true means it's blocked
  }
}

async function unZoom(tabId: number, domain: string): Promise<void> {
  try {
    trace("unZoom enter");
    await Promise.all([
      setCurrentTabState(tabId, "UNZOOMED"),
      DoUndoInjectCSS(tabId),
      setSpeed(tabId, domain, DEAULT_SPEED, false),
      chrome.scripting.executeScript({
        target: {
          tabId,
          allFrames: true,
        }, // world:  "MAIN",
        files: ["cmd_unzoom_inject.js", "videomax_main_inject.js"],
      }),
    ]);
    trace("unZoom leave");
  } catch (err) {
    logerr(err);
  }
}

async function DoZoom(
  tabId: number,
  state: BackgroundState,
  domain: string
): Promise<void> {
  trace("DoZoom enter");
  try {
    let excluded_zoom = false; // assume not excluded
    if (domain?.length) {
      const settings = await getSettings();
      excluded_zoom = isPageExcluded(domain, settings.zoomExclusionListStr);
    }

    if (excluded_zoom || state === "SPEED_ONLY") {
      await Promise.all([
        DoInjectTagOnlyJS(tabId), // DoInjectZoomCSS(tabId, true),
        setCurrentTabState(tabId, "ZOOMING_SPEED_ONLY", domain),
      ]);
    } else {
      await Promise.all([
        DoInjectZoomJS(tabId),
        DoInjectZoomCSS(tabId),
        setCurrentTabState(tabId, "ZOOMING", domain),
      ]);

      // now verify the css wasn't blocked by CSP.
      const wasCSSBlocked = await DoCheckCSSInjectedIsBlocked(tabId);
      if (wasCSSBlocked) {
        trace(
          "CSS loading file BLOCKED. directly adding css. undo/redo may fail"
        );
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
  trace("DoZoom leave");
}

function processIFrameExtraPermissionsResult(
  results: InjectionResult<string[]>[],
  tabId: number,
  domain: string
): boolean {
  if (!GET_IFRAME_PERMISSIONS || results.length === 0) {
    return false;
  }
  const extraDomainsArry = results
    .map((o) => o.result)
    .flat()
    .filter((str) => str?.length > 0);
  if (extraDomainsArry.length) {
    setSubframeData(tabId, domain, extraDomainsArry.join(","));
    return true;
  }
  return false;
}

async function setSpeed(
  tabId: number,
  domain: string,
  speedStr: string = DEAULT_SPEED,
  allowPlaybackToggle: boolean = true
): Promise<boolean> {
  try {
    trace(`setSpeed: enter tabId:${tabId} speed:${speedStr}`);

    if (typeof parseFloat(speedStr) !== "number") {
      logerr(`setSpeed: Speed NOT valid number '${speedStr}'`);
      return false;
    }
    const wasSetBefore = await setSpeedGlobalData(tabId, domain, speedStr);

    if (!wasSetBefore && speedStr === DEAULT_SPEED) {
      trace(
        "setSpeed: NOT setting video speed since it doesn't seem required (max compatability mode)"
      );
      return false;
    }
    trace(`setSpeed: executeScript: injectVideoSpeedAdjust 
      tabId:${tabId} speed:${speedStr} allowPlaybackToggle:${allowPlaybackToggle}`);
    // "allFrames" is broken unless manifest requests permissions
    // `"optional_host_permissions": ["<all_urls>"]`
    const results = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, // world:  "MAIN",
      func: injectVideoSpeedAdjust,
      args: [speedStr, allowPlaybackToggle],
    });
    trace(`setSpeed: leave`);
    return processIFrameExtraPermissionsResult(results, tabId, domain);
  } catch (err) {
    logerr(err);
    return false;
  }
}

async function getSpeed(
  tabId: number,
  domain: string,
  defaultSpeed: string = DEFAULT_SPEED
): Promise<string> {
  try {
    const speed = await getGlobalSpeedData(tabId, domain);
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
      func: injectGetPlaypackSpeed,
      args: [],
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

async function skipPlayback(
  tabId: number,
  secondToSkipStr: string,
  domain: string
): Promise<void> {
  try {
    trace("skipPlayback", tabId, secondToSkipStr);
    if (
      domain?.length &&
      BLOCKED_SKIPFEATURE_DOMAINS.filter((d) => domain.includes(d)).length > 0
    ) {
      trace("netflix fails if we skip");
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
    });
  } catch (err) {
    logerr(err);
  }
}

const getSettingUseAdvFeatures = async (): Promise<boolean | any> => {
  try {
    const settings = await getSettings();
    trace(
      "getFeatureShowZoomPopup settings:",
      JSON.stringify(settings, null, 2)
    );
    return settings.useAdvancedFeatures;
  } catch (err) {
    logerr(err);
    return DEFAULT_SETTINGS.useAdvancedFeatures;
  }
};

const getSettingIntroAlreadyShown = async (): Promise<boolean> => {
  try {
    const settings = await getSettings();
    const wasAlreadyShown =
      UPDATE_NOTIFICATION_VERISON === settings.lastBetaVersion;
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
};

/** Fired when the extension is first installed, when the extension is updated to a new version,
 * and when Chrome is updated to a new version. */
async function showUpgradePageIfNeeded(): Promise<void> {
  try {
    trace("chrome.runtime.onInstalled");
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

async function toggleZoomState(
  tabId: number,
  domain: string
): Promise<boolean> {
  const state = await getCurrentTabState(tabId);
  if (!isActiveState(state)) {
    await DoZoom(tabId, state, domain);
    // the following dance is to see if we need more permissions
    await setSpeed(tabId, domain, DEAULT_SPEED, false); // iframe on diff
    // domain will set
    // g_globalAccessSubframeData
    // to get more permissions on next click event
    await setCurrentTabState(tabId, "", domain);
    return true;
  }

  // we are zoomed but
  if (state === "ZOOMED_NOSPEED") {
    // toggle behavior otherwise message unzooms
    await unZoom(tabId, domain);
    await setCurrentTabState(tabId, "UNZOOMED", domain);
    return false;
  }

  await setCurrentTabState(tabId, "", domain);
  return true;
}

chrome.action.onClicked.addListener((tab) => {
  trace("chrome.action.onClicked - checking permissions");
  const tabId = tab.id || 0;
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
      trace("ERR_URL");
      return;
    }

    // can't use async... which really sucks and is annoying
    chrome.storage.local.get((resultSettings) => {
      const settingsSaved: SettingsType = JSON.parse(
        resultSettings[SETTINGS_STORAGE_KEY] || "{}"
      );
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
          origins.push(
            domainToSiteWildcard(domain, settings.wholeDomainAccess)
          );
        } else if (tab.url?.length) {
          origins.push(tab.url);
        }

        const subFrameData = getSubframeData(tabId, domain);
        if (GET_IFRAME_PERMISSIONS && subFrameData !== false) {
          const iframeDomains = subFrameData.subFrameStr
            .split(",")
            .map((d) => domainToSiteWildcard(d, settings.wholeDomainAccess));
          origins.push(...iframeDomains);
          trace(
            "Requesting extra iframe domains that blocked speedup",
            iframeDomains
          );
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
              `permissions to run were denied for "${tab?.url}", so extension is not injecting`
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
          trace("permissions granted for ", origins?.join(" ") || "");
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
          await setLastUrlTitleFromOnUpdated(tabId, url, tab?.title || "");
        }
      );
    });
  } catch (err) {
    logerr(err);
  }
});

/**
 * Called when we're zoomed but the popup is redisplayed.
 */
const ReZoom = async (
  tabId: number,
  domain: string,
  speed: string
): Promise<void> => {
  // the popup is about to display and thinks the page is zoomed, but it's may
  // not be (e.g. if escape key was pressed.) in theory, re-injecting should be
  // fine
  const currentState = await getCurrentTabState(tabId);
  // ignore the speed sent in. For rezoom, the popup has been deleted, so it
  // can't send the speed, we have to reget it.
  const currentSpeed = await getSpeed(tabId, domain, speed);
  if (currentState === "ZOOMING_SPEED_ONLY") {
    trace("REZOOM_CMD - Speed only, not rezooming");
    await setSpeed(tabId, domain, currentSpeed, false);
  } else {
    trace("REZOOM_CMD -- Zooming");
    // a full zoom isn't needed, just the css reinjected.

    // we need to see if we're in "SPEED_ONLY" mode because
    // we don't have access to the url to see if it's a site like hulu
    const nextState =
      currentState === "SPEED_ONLY" ? "ZOOMING_SPEED_ONLY" : "ZOOMING";
    await Promise.all([
      setCurrentTabState(tabId, nextState, currentSpeed),
      DoZoom(tabId, currentState, currentSpeed),
      setSpeed(tabId, domain, currentSpeed, false),
    ]);
    trace("REZOOM_CMD -- Zooming -- COMPLETE");
  }
};

// handle popup messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const cmd: CmdType = request?.message?.cmd || "";
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
        case "OPTIONS_CMD":
          {
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
          if (IS_BETA_CHANNEL) {
            const settings = await getSettings();
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
          await Promise.all([
            setCurrentTabState(tabId, "ZOOMED_SPEED", domain, speed),
            setSpeed(tabId, domain, speed, true),
          ]);
          break;

        case "REZOOM_CMD":
          await ReZoom(tabId, domain, speed);
          break;

        case "SKIP_PLAYBACK_CMD":
          await skipPlayback(tabId, speed, domain);
          break;

        case "POPUP_CLOSING":
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
    trace(`tabs.onUpated event tabId=${tabId} 
      changeInfo: 
${JSON.stringify(changeInfo, null, 2)}}
      tab:
${JSON.stringify(tab, null, 2)}`);
    if (tabId && ["loading", "completed"].includes(changeInfo?.status || "")) {
      trace(`tabs.onUpdated event likely SPA nav`);

      setTimeout(async () => {
        // async calls needed
        const popupUIActive = g_PopupOpenedForTabs.includes(tabId);
        if (popupUIActive || isActiveState(await getCurrentTabState(tabId))) {
          // some SPA won't do a clean refetch, we need to uninstall.
          if (popupUIActive) {
            // popup is open, so keep zoomed
            trace("tabs.onUpdated: Popup UI Open so REzooming");
            await ReZoom(tabId, domain, DEFAULT_SPEED);
            return;
          }
          // some sites (hampster) will set an anchor in url when progress
          // clicked near end.
          const { url: lastUrl, title: lastTitle } =
            await getLastUrlTitleFromOnUpdated(tabId);

          const newUrl = (changeInfo?.url || "").split("?")[0].toLowerCase();
          const newTitle = (changeInfo?.title || "").toLowerCase();

          // these conditions could be combined, but the trace is useful
          if (newTitle.length && lastTitle === newTitle) {
            trace("tabs.onUpdated: Page title is the same so REzooming");
            await ReZoom(tabId, domain, DEFAULT_SPEED);
            return;
          }

          if (newUrl.length && lastUrl === newUrl) {
            trace("tabs.onUpdated: Page URL is the same so REzooming");
            await ReZoom(tabId, domain, DEFAULT_SPEED);
            return;
          }
          // it's different, so save updated information.
          await setLastUrlTitleFromOnUpdated(tabId, newUrl, newTitle);
          trace(`tabs.onUpdated: Popup UI CLOSED so UNzooming. 
              lastUrl: "${lastUrl}"
              lastTitle: "${lastTitle}"
              newUrl: "${newUrl}"
              newTitle: "${newTitle}"
              `);
          trace("removed unzoom - breaks instagram");
          // await unZoom(tabId, domain);
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
  if (!externalPort.sender?.url?.length) {
    return;
  }
  {
    const url = new URL(externalPort.sender.url);
    const params = new URLSearchParams(url.hash.replace("#", ""));
    const tabId = Number(params.get("tabId") || "0");

    if (!g_PopupOpenedForTabs.includes(tabId)) {
      g_PopupOpenedForTabs = [...g_PopupOpenedForTabs, tabId];
      trace(
        `Popup opened. Added tabId:'${tabId}' g_PopupOpenedForTabs: [${g_PopupOpenedForTabs.join(
          ","
        )}]`
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
    const tabId = Number(params.get("tabId") || "0");

    if (g_PopupOpenedForTabs.includes(tabId)) {
      trace(
        `Popup closed. Removed tabId:'${tabId}' g_PopupOpenedForTabs: [${g_PopupOpenedForTabs.join(
          ","
        )}]`
      );
      g_PopupOpenedForTabs = g_PopupOpenedForTabs.filter(
        (eachId) => tabId !== eachId
      );
    }
  });
});
