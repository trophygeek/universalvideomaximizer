const DEBUG_ENABLED            = false;
const TRACE_ENABLED            = false;
const ERR_BREAK_ENABLED        = false;
// feature flags
const FEATURE_SHOW_SPEED_POPUP = true;

const UNZOOM_CMD    = 'UNZOOM';
const SET_SPEED_CMD = 'SET_SPEED';
const REZOOM_CMD    = 'REZOOM';

const DEAULT_SPEED = '1.0';

const CSS_FILE            = 'inject.css';
const CSS_STYLE_HEADER_ID = 'maximizier-css-inject';

const SETTINGS_STORAGE_KEY             = 'settings';
const OLD_TOGGLE_ZOOM_BEHAVIOR         = 'use_toggle_zoom_behavior';
const DEFAULT_OLD_TOGGLE_ZOOM_BEHAVIOR = false;

const BETA_UPDATE_NOTIFICATION         = 'beta_notification';
// bumping this will cause the notification to show again. keep it pinned unless some major feature
const BETA_UPDATE_NOTIFICATION_VERISON = '3.0.29';

const BADGES = {
  NONE:      '',
  ZOOMED:    '←  →',
  SPEEDONLY: '▶️',
  REFRESH:   '⟳',
  WARNING:   '⚠',
};

const STATES = {
  RESET:     'RESET',
  ZOOMED:    'ZOOMED',
  SPEEDONLY: 'SPEEDONLY',
  REFRESH:   'REFRESH',
  WARNING:   'WARNING',
};

const ACTIVE_BADGES = [BADGES.ZOOMED, BADGES.SPEEDONLY];

// todo: move to localize
const TOOLTIP = {
  ZOOMED:                'Video Maximized: click to change speed or undo',
  UNZOOMED:              'Click to maximize video',
  SPEEDONLY:             'Site cannot be zoomed, but Speed controls available',
  REFRESH:               'Permissions check complete. Try again.',
  SECURITY_CHECK_FAILED: 'Permission denied by user',
  UNSUPPORTED_URL:       'Extension only works on https sites',
};

/* these are sites that are already zoomed, but playback speed is kind of nice
 * todo: move to options dialog so user can edit.*/
const ZOOM_EXCLUSION_LIST = ['amazon.com',
                             'hbomax.com',
                             'disneyplus.com',
                             'hulu.com',
                             'netflix.com',
                             'tv.youtube.com'];

const logerr = (...args) => {
  if (DEBUG_ENABLED === false) {
    return;
  }
  // eslint-disable-next-line no-console
  console.trace('%c VideoMax BK ERROR', 'color: white; font-weight: bold; background-color: red',
    ...args);
  if (ERR_BREAK_ENABLED) {
    // eslint-disable-next-line no-debugger
    debugger;
  }
};

const trace = (...args) => {
  if (TRACE_ENABLED) {
    // blue color , no break
    // eslint-disable-next-line no-console
    console.log('%c VideoMax BK ', 'color: white; font-weight: bold; background-color: blue',
      ...args);
  }
};

/**
 *
 * @param newspeed {string}
 */
function injectVideoSpeedAdjust(newspeed) {
  const PLAYBACK_SPEED_ATTR = 'data-videomax-playbackspeed';

  const _loadStart = (event) => {
    const playbackSpeed = video_elem?.getAttribute(PLAYBACK_SPEED_ATTR);
    if (playbackSpeed) {
      const speedNumber = parseFloat(playbackSpeed);
      if (video_elem?.playbackRate !== speedNumber) {
        // auto-playing next video can reset speed. So annoying.
        video_elem.playbackRate = speedNumber;
      }
    }
  };

  const speadNumber = parseFloat(newspeed);
  let result        = false;

  for (let eachVideo of document.querySelectorAll('video')) {
    eachVideo.defaultPlaybackRate = speadNumber;
    eachVideo.playbackRate        = speadNumber;

    eachVideo.setAttribute(PLAYBACK_SPEED_ATTR, newspeed);
    eachVideo.removeEventListener('loadstart', _loadStart);
    eachVideo.addEventListener('loadstart', _loadStart);

    result = true;
  }
  return result;
}

function injectCssHeader(cssHRef, styleId) {
  try {
    if (document.getElementById(styleId)) {
      return;
    }
    let styleLink   = document.createElement('link');
    styleLink.id    = styleId;
    styleLink.href  = cssHRef;
    styleLink.type  = 'text/css';
    styleLink.rel   = 'stylesheet';
    styleLink.media = 'all';
    document.getElementsByTagName('head')[0].appendChild(styleLink);
    return (document.getElementById(styleId) !== null);
  } catch (err) {
    console.error('Injecting style header failed. CSP?', err);
    return false;
  }
}

function uninjectCssHeader(styleId) {
  // warning run inside context of page
  const cssHeaderNode = document.getElementById(styleId);
  cssHeaderNode?.parentNode?.removeChild(cssHeaderNode);
}

function isCssHeaderInjected(styleId) {
  // warning runs inside context of page
  return (document.getElementById(styleId) !== null);
}

function isVideoFoundInject() {
  return document.querySelectorAll('video').length > 0;
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
    const featureShowSpeedPopup = (await getSettingOldToggleBehavior()) === false;

    // some states need to know if the video is in an iframe
    const videofound = [STATES.ZOOMED, STATES.SPEEDONLY].includes(state) ?
                       await CheckVideoFound(tabId) :
                       0;


    const States = {
      [STATES.RESET]:     {
        text:   BADGES.NONE,   // badge text
        title:  TOOLTIP.UNZOOMED,    // tooltip
        popup:  '',
        zoomed: false,
      },
      [STATES.ZOOMED]:    {
        text:   BADGES.ZOOMED,
        title:  TOOLTIP.ZOOMED,
        popup:  featureShowSpeedPopup ?
                `popup.html#tabId=${tabId}&speed=${speed}&videofound=${videofound}` :
                '',
        zoomed: true,
      },
      [STATES.SPEEDONLY]: {
        text:   (speed === DEAULT_SPEED) ? BADGES.ZOOMED : BADGES.SPEEDONLY,
        title:  TOOLTIP.SPEEDONLY,
        popup:  featureShowSpeedPopup ?
                `popup.html#tabId=${tabId}&speed=${speed}&videofound=${videofound}` :
                '',
        zoomed: true,
      },
      [STATES.REFRESH]:   {
        text:   BADGES.REFRESH,
        title:  TOOLTIP.REFRESH,
        popup:  '',
        zoomed: false,
      },
      [STATES.WARNING]:   {
        text:   BADGES.WARNING,
        title:  TOOLTIP.SECURITY_CHECK_FAILED,
        popup:  '',
        zoomed: false,
      },
    };
    const {
            text,
            title,
            popup,
            zoomed,
          }      = States[state];


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
  const domain = getDomain(url);
  for (const elem of ZOOM_EXCLUSION_LIST) {
    if (domain.indexOf(elem) >= 0) {
      return true;
    }
  }
  return false;
};


async function DoInjectJS(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      files:  [`inject.js`],
    });
  } catch (err) {
    logerr(err);
  }
}

async function DoInjectCSS(tabId) {
  try {
    const cssFilePath     = chrome.runtime.getURL(CSS_FILE);
    // we inject this way because we can undo it by deleting the element.
    const injectionresult = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      func:   injectCssHeader,
      args:   [cssFilePath, CSS_STYLE_HEADER_ID],
      world:  'MAIN',
    });
    return injectionresult[0]?.result || false;
  } catch (err) {
    logerr(err);
    return false;
  }
}

async function UndoInjectCSS(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func:   uninjectCssHeader,
      args:   [CSS_STYLE_HEADER_ID],
      world:  'MAIN',
    });
  } catch (err) {
    logerr(err);
  }
}

async function CheckCSSInjected(tabId) {
  try {
    const injectionresult /* :InjectionResult[] */ = await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func:   isCssHeaderInjected,
      args:   [CSS_STYLE_HEADER_ID],
      world:  'MAIN',
    });
    return injectionresult[0]?.result || false;
  } catch (err) {
    logerr(err);
    return false;
  }
}

async function CheckVideoFound(tabId) {
  try {
    const injectionresult /* :InjectionResult[] */ = await chrome.scripting.executeScript({
      target: {
        tabId,
        frameIds: [0],
      },
      func:   isVideoFoundInject,
      args:   [],
      world:  'MAIN',
    });

    const result = injectionresult[0]?.result ? 1 : 0;
    trace(`CheckVideoFound: ${result}`);
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
      await UndoInjectCSS(tabId);
      await chrome.scripting.executeScript({
        target: {
          tabId:     tabId,
          allFrames: true,
        },
        files:  ['inject_undo.js'],
      });
    }
  } catch (err) {
    logerr(err);
  }
}

async function zoom(tabId, url) {
  try {
    const excluded_zoom = isPageExcluded(url);
    await setState(tabId, STATES.ZOOMED);
    if (!excluded_zoom) {
      await DoInjectJS(tabId);
      await DoInjectCSS(tabId);
    } else {
      trace(`zooming, excluded_zoom for ${url}`);
    }
    await setTabSpeed(tabId, DEAULT_SPEED);
  } catch (err) {
    logerr(err);
  }
}

async function setTabSpeed(tabId, speed = DEAULT_SPEED) {
  try {
    trace('setTabSpeed', tabId, speed);

    if (typeof parseFloat(speed) !== 'number') {
      logerr(`Speed NOT valid number '${speed}'`);
      return;
    }
    // "allFrames" is broken unless manifest requests permissions to EVERYTHING. From 2018
    // see https://bugs.chromium.org/p/chromium/issues/detail?id=826433
    const injectionresult = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      func:   injectVideoSpeedAdjust,
      args:   [speed],
    });
    trace('setTabSpeed result', injectionresult[0]?.result);
    return injectionresult[0]?.result || false;
  } catch (err) {
    logerr(err);
    return false;
  }
}

async function getTabIsZoomed(tabId) {
  try {
    const tabText = await chrome.action.getBadgeText({ tabId });
    if (!ACTIVE_BADGES.includes(tabText)) {
      trace(`getTabIsZoomed false`);
      return false;
    }
    // user may have hit escape key to unzoom. check that.
    const injectedHeader = await CheckCSSInjected(tabId);
    trace(`getTabIsZoomed ${injectedHeader}`);
    return injectedHeader;
  } catch (err) {
    logerr(err);
    return false;
  }
}

const getSettingOldToggleBehavior = async () => {
  try {
    const settings = await chrome.storage.local.get(SETTINGS_STORAGE_KEY) || {};
    trace('getFeatureShowZoomPopup settings:', settings);
    return settings[OLD_TOGGLE_ZOOM_BEHAVIOR] || DEFAULT_OLD_TOGGLE_ZOOM_BEHAVIOR;
  } catch (err) {
    logerr(err);
    return DEFAULT_OLD_TOGGLE_ZOOM_BEHAVIOR;
  }
};

const getSettingBetaIntroAlreadyShown = async () => {
  try {
    const data = await chrome.storage.local.get(BETA_UPDATE_NOTIFICATION) || {};
    const result   = (BETA_UPDATE_NOTIFICATION_VERISON === data[BETA_UPDATE_NOTIFICATION]);

    // now update it to expected version
    await chrome.storage.local.set({[BETA_UPDATE_NOTIFICATION]:  BETA_UPDATE_NOTIFICATION_VERISON});

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

    chrome.tabs.create({
      url,
      active: false,
    });
  } catch (err) {
    logerr(err);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  trace('chrome.action.onClicked');
  const tabId = tab.id;
  chrome.permissions.request({ permissions: ['activeTab', 'scripting', 'storage'] },
    async (granted) => {
      try {
        if (!granted) {
          await setState(STATES.REFRESH);
          logerr('permissions to run were denied, so extension is not injecting');
          return;
        }

        await showUpgradePageIfNeeded();

        // tab?.url could be null, so we need to query to get the current tab
        if (!tab?.url) {
          // now we have to go back and get the url since it wasn't passed to us
          // simple thing is to ask the user to click the button again.
          await setState(tabId, STATES.REFRESH);
          logerr(STATES.REFRESH);
          return;
        }

        if (!(tab?.url?.startsWith('https://') || tab?.url?.startsWith('http://') ||
              tab?.url?.startsWith('file:'))) {
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

        const zoomed = await getTabIsZoomed(tabId);
        if (!zoomed) {
          await zoom(tabId, tab?.url);
          return;
        }
        const oldToggleBehavior = await getSettingOldToggleBehavior();
        if (oldToggleBehavior) {
          // toggle
          await unZoom(tabId);
          return;
        }

        await setState(tabId, STATES.ZOOMED);
      } catch (err) {
        logerr(err);
      }
    });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  try {
    if (tabId && changeInfo?.status === 'loading') {
      trace('chrome.tabs.onUpdated loading');
      if (await getTabIsZoomed(tabId)) {
        // some SPA won't do a clean refetch, we need to uninstall.
        await unZoom(tabId, false);
      }
    }
  } catch (err) {
    logerr(err);
  }
});

// handle popup messages
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  const cmd   = request?.message?.cmd || '';
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
          await setTabSpeed(tabId, speed);
          break;

        case SET_SPEED_CMD:
          await setState(tabId, STATES.SPEEDONLY, speed);
          await setTabSpeed(tabId, speed);
          break;

        case REZOOM_CMD:
          // the popup is about to display and thinks the page is zoomed, but it's may not be
          // if escape key was pressed.
          const zoomed = await getTabIsZoomed(tabId);
          if (!zoomed) {
            // a full zoom isn't needed, just the css reinjected.
            await DoInjectCSS(tabId);
            await setState(tabId, STATES.SPEEDONLY, speed);
            await setTabSpeed(tabId, speed);
          }
          break;
      }
    } catch (err) {
      logerr(err);
    }
  }, 1);

  sendResponse && sendResponse({});  // used to close popup.
  return false;
});


// in theory, it would be nice to save globals onSuspend, and reload onStartup,
// But the chrome api for saving is async and onSuspend doesn't like async operations...
// the whole extensions v3 api are such a hot mess.
// From the api docs:
//  > onSuspend:
//  > Sent to the event page just before it is unloaded. This gives the extension opportunity
//  > to do some clean up. Note that since the page is unloading, any asynchronous operations
//  > started while handling this event are not guaranteed to complete. If more activity for
//  > the event page occurs before it gets unloaded the onSuspendCanceled event will be sent
//  > and the page won't be unloaded.
// chrome.runtime.onStartup.addListener(async (details) => {
//   trace('chrome.runtimee.onStartup');
// });
// chrome.runtime.onSuspend.addListener(async (details) => {
//   trace('chrome.runtime.onSuspend');
// });
