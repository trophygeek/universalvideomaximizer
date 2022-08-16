const FULL_DEBUG = true;
const DEBUG_ENABLED = FULL_DEBUG;
const TRACE_ENABLED = FULL_DEBUG;
const ERR_BREAK_ENABLED = FULL_DEBUG;

const ALWAYS_SHOW_SPEED = false; // forces to always be enabled

const UNZOOM_CMD = 'UNZOOM';
const SET_SPEED_CMD = 'SET_SPEED';
const REZOOM_CMD = 'REZOOM';

const DEAULT_SPEED = '1.0';

const CSS_FILE = 'inject.css';
const CSS_STYLE_HEADER_ID = 'maximizier-css-inject';

const SETTINGS_STORAGE_KEY = 'settings';
const OLD_TOGGLE_ZOOM_BEHAVIOR = 'use_toggle_zoom_behavior';
const DEFAULT_OLD_TOGGLE_ZOOM_BEHAVIOR = false;

const BETA_UPDATE_NOTIFICATION = 'beta_notification';
// bumping this will cause the notification to show again. keep it pinned unless some major feature
const BETA_UPDATE_NOTIFICATION_VERISON = '3.0.40';

// Badges show state to user bug are also used to KEEP TRACK OF THE STATE for a given tabId.
// This approach to state storage is required because v3 extensions are unloaded unexpected.
// Saving state in localStorage is basically impossible because the storage API is async (used
// to save off the current state), BUT chrome Unloading message is NOT async friendly.
const BADGES = {
  NONE: '',
  ZOOMED: '←  →',
  SPEED: '▶️',
  REFRESH: '⟳',
  WARNING: '⚠',
};

const STATES = {
  RESET: 'RESET',
  ZOOMING: 'ZOOMING',
  ZOOMED_NOSPEED: 'ZOOMED_NOSPEED',
  ZOOMED_SPEED: 'ZOOMED_SPEED',
  REFRESH: 'REFRESH',
  WARNING: 'WARNING',
};

const ACTIVE_STATES = [STATES.ZOOMING, STATES.ZOOMED_NOSPEED, STATES.ZOOMED_SPEED];

// todo: move to localize
const TOOLTIP = {
  ZOOMED: 'Click to zoom video',
  CANNOT_SPEED_CHANGE: 'Click ot unzoom\nNo speed change allowed by this site.',
  SPEED_CHANGE: 'Click to change speed or unzoom',
  SPEED: 'Click to change speed',
  REFRESH: 'Permissions check complete. Click again.',
  SECURITY_CHECK_FAILED: 'Permission denied by user',
  UNSUPPORTED_URL: 'Extension only works on https sites',
};

/* these are sites that are already zoomed, but playback speed is kind of nice
 * todo: move to options dialog so user can edit. */
const ZOOM_EXCLUSION_LIST = ['amazon.com',
  'hbomax.com',
  'disneyplus.com',
  'hulu.com',
  'netflix.com',
  'tv.youtube.com',
  'youku.com',
  'bet.plus',
  'tv.apple.com',
  'play.google.com'];

const logerr = (...args) => {
  if (DEBUG_ENABLED === false) {
    return;
  }
  // eslint-disable-next-line no-console
  console.trace(
    '%c VideoMax BK ERROR',
    'color: white; font-weight: bold; background-color: red',
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
      '%c VideoMax BK ',
      'color: white; font-weight: bold; background-color: blue',
      ...args,
    );
  }
};

/** used by unit tests **/
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 *
 * @param injectionResults {InjectionResult[]}
 * @param defaultVal {boolean}
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
 *
 * @param newspeed {string}
 */
function injectVideoSpeedAdjust(newspeed) {
  const PLAYBACK_SPEED_ATTR = 'data-videomax-playbackspeed';

  /** nested local function * */
  const _loadStart = (event) => {
    const video_elem = event?.target;
    const playbackSpeed = video_elem?.getAttribute(PLAYBACK_SPEED_ATTR);
    if (playbackSpeed) {
      const speedNumber = parseFloat(playbackSpeed);
      if (video_elem?.playbackRate !== speedNumber) {
        // auto-playing next video can reset speed. Need to hook into content change
        video_elem.playbackRate = speedNumber;
      }
    }
  };
  /** nested local function * */

  const speadNumber = parseFloat(newspeed);
  const result = false;

  for (const eachVideo of document.querySelectorAll('video')) {
    eachVideo.defaultPlaybackRate = speadNumber;
    eachVideo.playbackRate = speadNumber;

    eachVideo.setAttribute(PLAYBACK_SPEED_ATTR, newspeed);
    eachVideo.removeEventListener('loadstart', _loadStart);
    eachVideo.addEventListener('loadstart', _loadStart);
  }
  return result;
}

function injectCssHeader(cssHRef, styleId) {
  try {
    if (document.getElementById(styleId)) {
      console.log('VideoMax Native Inject. Style header already injected');
      return;
    }
    const styleLink = document.createElement('link');
    styleLink.id = styleId;
    styleLink.href = cssHRef;
    styleLink.type = 'text/css';
    styleLink.rel = 'stylesheet';
    styleLink.media = 'all';
    document.getElementsByTagName('head')[0].appendChild(styleLink);
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
function isCssHeaderInjectedFast(styleId) {
  // warning runs inside context of page
  return (document.getElementById(styleId) !== null);
}

/**
 * needed because we cannot include a chrome reference css for a file:// or
 * if the CSP is too strict. Fallback it to inject from background task.
 * @param cssHRef {String}
 * @returns {boolean}
 */
function isCssHeaderIsBlocked(cssHRef) {
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
    console.log('VideoMaxExt css include file blocked.');
  }
  return isBlocked;
}

function supportsSpeedChange() {
  const matched = document.querySelectorAll('video[class*="videomax-ext-video-matched"]');
  return matched.length > 0;
}

/**
 *
 * @param tabId {Number}
 * @param state {STATES}
 * @param speed {String}
 * @return {Promise<void>}
 */
async function setState(tabId, state, speed = DEAULT_SPEED) {
  try {
    // map state to another state
    switch (state) {
      case STATES.ZOOMING:
        const featureShowSpeedPopup = (await getSettingOldToggleBehavior()) === false;
        if (featureShowSpeedPopup) {
          // we have a case where "speed only" the check will fail.
          const supportsSpeedChange = await CheckSupportsSpeedChange(tabId);
          if (supportsSpeedChange) {
            state = STATES.ZOOMED_SPEED;
          } else {
            state = STATES.ZOOMED_NOSPEED;
          }
        }
        break;
    }

    const States = {
      [STATES.RESET]: {
        text: BADGES.NONE, // badge text
        title: TOOLTIP.ZOOMED, // tooltip
        popup: '',
        zoomed: false,
      },
      [STATES.ZOOMING]: {
        text: BADGES.ZOOMED,
        title: TOOLTIP.ZOOMED,
        popup: '',
        zoomed: true,
      },
      [STATES.ZOOMED_SPEED]: {
        text: BADGES.SPEED,
        title: TOOLTIP.SPEED_CHANGE,
        popup: `popup.html#tabId=${tabId}&speed=${speed}`,
        zoomed: true,
      },
      [STATES.ZOOMED_NOSPEED]: {
        text: BADGES.ZOOMED,
        title: TOOLTIP.CANNOT_SPEED_CHANGE,
        popup: '',
        zoomed: true,
      },
      [STATES.REFRESH]: {
        text: BADGES.REFRESH,
        title: TOOLTIP.REFRESH,
        popup: '',
        zoomed: false,
      },
      [STATES.WARNING]: {
        text: BADGES.WARNING,
        title: TOOLTIP.SECURITY_CHECK_FAILED,
        popup: '',
        zoomed: false,
      },
    };

    const {
      text,
      title,
      popup, // zoomed,
    } = States[state];

    // featureShowSpeedPopup
    await chrome.action.setBadgeText({
      tabId,
      text,
    });
    await chrome.action.setPopup({
      tabId,
      popup,
    });
    await chrome.action.setTitle({
      tabId,
      title,
    });
  } catch (err) {
    logerr(err);
  }
}

const getDomain = (url) => (new URL(url)).host.toLowerCase();

const isPageExcluded = (url) => {
  if (!url) {
    return false;
  }
  const domain = getDomain(url);
  for (const elem of ZOOM_EXCLUSION_LIST) {
    if (domain.indexOf(elem) >= 0) {
      return true;
    }
  }
  return false;
};

async function DoInjectZoomJS(tabId) {
  try {
    // The script will be run at document_end
    trace('DoInjectZoomJS enter');
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,  // false doesn't hide some content.
      }, //      world: 'MAIN',  // this breaks dailymotion
      files: ['cmd_zoom_inject.js', 'videomax_main_inject.js'],
    });
    trace('DoInjectZoomJS enter');
  } catch (err) {
    logerr(err);
  }
}

async function DoInjectTagOnlyJS(tabId) {
  try {
    trace('DoInjectTagOnlyJS enter');
    // The script will be run at document_end
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, //      world: 'MAIN',  // this breaks dailymotion
      files: ['cmd_tagonly_inject.js', 'videomax_main_inject.js'],
    });
    trace('DoInjectTagOnlyJS leave');
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
    trace('DoInjectZoomCSS enter');
    const cssFilePath = isDummy ? '' : chrome.runtime.getURL(CSS_FILE);
    // we inject this way because we can undo it by deleting the style element.
    // The script will be run at document_end
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      func: injectCssHeader,
      args: [cssFilePath, CSS_STYLE_HEADER_ID], // world:  'MAIN',
    });
    trace('DoInjectZoomCSS leave');
  } catch (err) {
    logerr(err);
  }
}

async function DoUndoInjectCSS(tabId) {
  try {
    trace('DoUndoInjectCSS enter');
    await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func: uninjectCssHeader,
      args: [CSS_STYLE_HEADER_ID], // world:  'MAIN',
    });
    trace('DoUndoInjectCSS leave');
  } catch (err) {
    logerr(err);
  }
}

/**
 * Deep check to see if page is currently zoomed. Fast because it only checks the ID.
 * @param tabId {number}
 * @returns {Promise<boolean>}
 * @constructor
 */
async function DoCheckCSSInjectedFast(tabId) {
  try {
    trace('DoCheckCSSInjectedFast enter');
    const injectionresult /* :InjectionResult[] */ = await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func: isCssHeaderInjectedFast,
      args: [CSS_STYLE_HEADER_ID],
      world: 'MAIN',
    });

    const result = injectionResultCheck(injectionresult);
    trace(`DoCheckCSSInjectedFast result: ${result}`, injectionresult);
    return result;
  } catch (err) {
    logerr('DoCheckCSSInjectedFast failed, returning false', err);
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
    trace('DoCheckCSSInjectedIsBlocked enter');
    const cssFilePath = chrome.runtime.getURL(CSS_FILE);

    const injectionresult /* :InjectionResult[] */ = await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func: isCssHeaderIsBlocked,
      args: [cssFilePath],
      world: 'MAIN',
    });
    const result = injectionResultCheck(injectionresult);
    trace(`DoCheckCSSInjectedIsBlocked result: ${result}`, injectionresult);
    return result;
  } catch (err) {
    logerr('DoCheckCSSInjectedIsBlocked failed, returning false', err);
    return true;
  }
}

async function CheckSupportsSpeedChange(tabId) {
  try {
    if (ALWAYS_SHOW_SPEED) {
      return true;
    }
    trace('CheckSupportsSpeedChange enter');
    const injectionresult /* :InjectionResult[] */ = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      func: supportsSpeedChange,
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
 * @param uninject {boolean}
 * @return {Promise<void>}
 */
async function unZoom(tabId, uninject = true) {
  try {
    trace('unZoom');
    await setState(tabId, STATES.RESET);
    if (uninject) {
      const promise1 = DoUndoInjectCSS(tabId);
      const promise2 = chrome.scripting.executeScript({
        target: {
          tabId,
          allFrames: true,
        },
        files: ['cmd_unzoom_inject.js', 'videomax_main_inject.js'],
      });
      await Promise.all([promise1, promise2]);
    }
    await setTabSpeed(tabId, DEAULT_SPEED);
  } catch (err) {
    logerr(err);
  }
}

async function Zoom(tabId, url) {
  try {
    const excluded_zoom = isPageExcluded(url);
    if (!excluded_zoom) {
      const promise1 = DoInjectZoomJS(tabId);
      const promise2 = DoInjectZoomCSS(tabId);
      await Promise.all([promise1, promise2]);

      // now verify the css wasn't blocked by CSP.
      const isBlocked = await DoCheckCSSInjectedIsBlocked(tabId);
      if (isBlocked) {
        trace('css loading file blocked. directly adding css. undo/redo may fail');
        // ok. we just need to inject in a way that cannot be easily undone.
        await chrome.scripting.insertCSS({
          target: {
            tabId,
            allFrames: true,
          }, //      world: 'MAIN',  // this breaks dailymotion
          origin: 'AUTHOR',
          files: [CSS_FILE],
        });
      }
    } else {
      trace(`EXCLUDED_ZOOM for site '${url}'`);
      const promise1 = DoInjectTagOnlyJS(tabId);
      const promise2 = DoInjectZoomCSS(tabId, true);
      await Promise.all([promise1, promise2]);
    }

    await setState(tabId, STATES.ZOOMING); // will check if page can speed up and refresh state
  } catch (err) {
    logerr(err);
  }
}

async function setTabSpeed(tabId, speed = DEAULT_SPEED) {
  try {
    trace('setTabSpeed', tabId, speed);

    if (typeof parseFloat(speed) !== 'number') {
      logerr(`Speed NOT valid number '${speed}'`);
      return null;
    }
    // "allFrames" is broken unless manifest requests permissions
    // to EVERYTHING on every site, all the time!?!
    // see https://bugs.chromium.org/p/chromium/issues/detail?id=826433
    return chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      }, //      world: 'MAIN',  // this breaks dailymotion
      func: injectVideoSpeedAdjust,
      args: [speed],
    });
  } catch (err) {
    logerr(err);
    return null;
  }
}

/**
 *
 * @param tabId {number}
 * @returns {Promise<string>}
 */
async function getTabCurrentState(tabId) {
  try {
    const badgeText = await chrome.action.getBadgeText({ tabId });
    // map badgeText back to state
    const state = {
      [BADGES.NONE]: STATES.RESET,
      [BADGES.ZOOMED]: STATES.ZOOMED_NOSPEED,
      [BADGES.SPEED]: STATES.ZOOMED_SPEED,
      [BADGES.REFRESH]: STATES.REFRESH,
      [BADGES.WARNING]: STATES.WARNING,
    }[badgeText] || STATES.RESET;

    if (ACTIVE_STATES.includes(state)) {
      // user may have hit escape key to unzoom so we're in a weird state.
      // by reinjecting the CSS, we rezoom.
      trace('getTabCurrentState reinjecting css just in case');
      await DoInjectZoomCSS(tabId);
    }

    return state;
  } catch (err) {
    logerr(err);
    return STATES.RESET;
  }
}

/**
 *
 * @param tabId {number}
 * @returns {Promise<boolean>}
 */
const getIsCurrentlyZoomed = async (tabId) => {
  const state = await getTabCurrentState(tabId);
  const result = ACTIVE_STATES.includes(state);
  trace(`getIsCurrentlyZoomed: ${result}`);
  return result;
};

const getSettingOldToggleBehavior = async () => {
  try {
    const data = await chrome.storage.local.get(SETTINGS_STORAGE_KEY) || {};
    trace('getFeatureShowZoomPopup settings:', JSON.stringify(data, null, 2));
    return (data?.settings && data?.settings[OLD_TOGGLE_ZOOM_BEHAVIOR]) || DEFAULT_OLD_TOGGLE_ZOOM_BEHAVIOR;
  } catch (err) {
    logerr(err);
    return DEFAULT_OLD_TOGGLE_ZOOM_BEHAVIOR;
  }
};

const getSettingBetaIntroAlreadyShown = async () => {
  try {
    const data = await chrome.storage.local.get(BETA_UPDATE_NOTIFICATION) || {};
    const result = (BETA_UPDATE_NOTIFICATION_VERISON === data[BETA_UPDATE_NOTIFICATION]);

    // now update it to expected version
    await chrome.storage.local.set(
      { [BETA_UPDATE_NOTIFICATION]: BETA_UPDATE_NOTIFICATION_VERISON },
    );

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
    trace('chrome.runtime.onInstalled');
    // checked saved state and see if we've opened the page about v3 update.
    const shown = await getSettingBetaIntroAlreadyShown();
    if (shown) {
      return;
    }

    const url = chrome?.runtime?.getURL('help.html') || '';
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

async function toggleZoomState(tabId, url) {
  const state = await getTabCurrentState(tabId);
  if (!ACTIVE_STATES.includes(state)) {
    await Zoom(tabId, url);
    return;
  }

  // we are zoomed
  if (state === STATES.ZOOMED_NOSPEED) { // toggle behavior otherwise message unzooms
    await unZoom(tabId);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  trace('chrome.action.onClicked - checking permissions');
  const tabId = tab.id;
  chrome.permissions.request(
    { permissions: ['activeTab', 'scripting', 'storage'] },
    async (granted) => {
      try {
        if (!granted) {
          await setState(tabId, STATES.REFRESH);
          logerr('permissions to run were denied, so extension is not injecting');
          return;
        }
        trace('permissions granted');
        await showUpgradePageIfNeeded();

        // tab?.url could be null, so we need to query to get the current tab
        if (!tab?.url) {
          // now we have to go back and get the url since it wasn't passed to us
          // simple thing is to ask the user to click the button again.
          await setState(tabId, STATES.REFRESH);
          logerr(STATES.REFRESH);
          return;
        }

        if (!(tab?.url?.startsWith('https://') || tab?.url?.startsWith('http://')
              || tab?.url?.startsWith('file:'))) {
          // do not run on chrome: or about: urls.
          await setState(tabId, STATES.WARNING);
          trace(STATES.WARNING);
          return;
        }

        // "all frames" feature in v3 manifest doesn't REALLY work.
        // https://bugs.chromium.org/p/chromium/issues/detail?id=826433

        // {
        //   let frames = await chrome?.webNavigation?.getAllFrames({ tabId }) || [];
        //   const getDomain = (url) => (new URL(url)).host;
        //   const tld = getDomain(tab?.url);
        //
        //   filtered = frames.filter(
        //       eachframe => (tld === getDomain(eachframe.url)))
        //     .map(eachframe => eachframe.frameId);
        //
        //   lame_global_test.frameIds = filtered;
        // }

        await toggleZoomState(tabId, tab?.url);
      } catch (err) {
        logerr(err);
      }
    },
  );
});

// handle popup messages
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  const cmd = request?.message?.cmd || '';
  const tabId = parseFloat(request?.message?.tabId || '0');
  const speed = request?.message?.speed || DEAULT_SPEED;
  if (!tabId) {
    logerr('something wrong with message', request);
    sendResponse && sendResponse({ success: false });
    return false;
  }

  trace(`chrome.runtime.onMessage '${cmd}' '${speed}'`, request, sender);

  // use timeout to get async scope. listener callbacks can't be async.
  setTimeout(async () => {
    try {
      switch (cmd) {
        case UNZOOM_CMD:
          await unZoom(tabId);
          // await setTabSpeed(tabId, speed);
          break;

        case SET_SPEED_CMD:
          await setState(tabId, STATES.ZOOMED_SPEED, speed);
          await setTabSpeed(tabId, speed);
          break;

        case REZOOM_CMD:
          // the popup is about to display and thinks the page is zoomed, but it's may not be
          // if escape key was pressed.
          const zoomed = await DoCheckCSSInjectedFast(tabId);
          if (!zoomed) {
            // a full zoom isn't needed, just the css reinjected.
            const promise1 = Zoom(tabId);
            const promise2 = setState(tabId, STATES.ZOOMING, speed);
            const promise3 = setTabSpeed(tabId, speed);
            await Promise.all([promise1, promise2, promise3]);
          }
          break;
      }
    } catch (err) {
      logerr(err);
    }
  }, 1);

  sendResponse && sendResponse({}); // used to close popup.
  return false;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  try {
    trace(`tabs.onUpdated event tabId=${tabId}
    changeInfo:`, changeInfo);
    if (tabId && changeInfo?.status === 'loading') {
      if (await getIsCurrentlyZoomed(tabId)) {
        trace('chrome.tabs.onUpdated loading so starting unzoom. likely SPA nav');
        // some SPA won't do a clean refetch, we need to uninstall.
        await unZoom(tabId, true);
      } else {
        trace(`tabId not currently zoomed ${tabId}`);
      }
    }
  } catch (err) {
    logerr(err);
  }
});
