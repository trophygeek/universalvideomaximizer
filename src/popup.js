// @ts-check
// useful reference for exports https://web.dev/es-modules-in-sw/
import { DEFAULT_SETTINGS, DEFAULT_SPEED, getSettings, logerr, trace } from "./common.js";

/** @type {Port} */
let g_detectCloseListenerPort = null;

try {
  const UNZOOM_LABEL = "[]";
  const UNZOOM_ICON = "./icons/icon19undo.png";

  const MENU = [{
    label: "⚙️️",
    value: "OPTIONS_BTN_CMD",
  }, {
    label: "🖐️",
    value: "PAUSE_CMD",
  }, {
    label: "0.25",
    value: "0.25",
  }, {
    label: "0.50",
    value: "0.50",
  }, {
    label: "0.75",
    value: "0.75",
  }, {
    label: "1.0",
    value: DEFAULT_SPEED,
  }, {
    label: "1.25",
    value: "1.25",
  }, {
    label: "1.50",
    value: "1.50",
  }, {
    label: "1.75",
    value: "1.75",
  }, {
    label: "2x",
    value: "2.0",
  }, {
    label: "4x",
    value: "4.0",
  }, {
    label: "8x",
    value: "8.0",
  }, {
    label: "16x",
    value: "16.0",
  }, {
    label: UNZOOM_LABEL,
    value: "UNZOOM_BTN_CMD",
  }];

  // used to simplify IncreaseSpeed()/DecreaseSpeed()
  const MIN_SPEED = "0.25";
  const MAX_SPEED = "16.0";
  const globals = {
    url: new URL(document.location.href),
    /** @type {String} */
    currentSpeed: DEFAULT_SPEED,
    /** @type {SettingsType} */
    settings:        DEFAULT_SETTINGS, // onload will overwrite.
    tabId:           "",
    debounceTimerId: undefined,
  };

  /**
   * @param ii {number}
   * @returns {string}
   */
  const itemId = (ii) => `speed-${ii}`;

  /** @param speedStr {string}
   *  @return {string} */
  const toggleSpeedStr = (speedStr) => {
    if (speedStr.startsWith("-")) {
      // restore toggle speed but removing "-"
      return speedStr.substring(1);
    }
    return `-${speedStr}`;
  };

  /**
   * @param itemValue {string}
   */
  const checkItem = (itemValue) => {
    const itemValueStr = itemValue.startsWith("-") ? "PAUSE_CMD" : String(itemValue);
    const group = document.getElementById("speedBtnGroup");
    for (const eachElem of group.children) {
      if (eachElem.type !== "checkbox") {
        continue;
      }
      eachElem.checked = (eachElem.dataset.value === itemValueStr);
      if (eachElem.checked) {
        eachElem.focus();
      }
    }
  };

  /**
   * @return {string}
   */
  const IncreaseSpeed = () => {
    if (MAX_SPEED === globals.currentSpeed) {
      // already maxed
      return globals.currentSpeed;
    }
    const offset = MENU.findIndex((item) => item.value === globals.currentSpeed);
    return MENU[offset + 1]?.value || DEFAULT_SPEED;
  };

  /**
   * @return {string}
   */
  const DecreaseSpeed = () => {
    if (MIN_SPEED === globals.currentSpeed) {
      // already maxed
      return globals.currentSpeed;
    }
    const offset = MENU.findIndex((item) => item.value === globals.currentSpeed);
    return MENU[offset - 1]?.value || DEFAULT_SPEED;
  };

  /**
   * @param doc {Document}
   * @param parentElem {HTMLElement}
   * @param tabId {string}
   */
  const addSpeedControlUI = (doc, parentElem, tabId) => {
    const htmlArr = MENU.map((item, ii) => {
      const id = itemId(ii);
      const label = (item.label === UNZOOM_LABEL) ?
                    `<img src='${UNZOOM_ICON}' class='closeicon'>` :
                    `${item.label}`;
      // we use checkboxes vs radio so we can intercept the arrow keys.
      // radio buttons grabs the arrows keys to move between items.
      // but the checkboxes' "role" is more like radio buttons
      // (only one selected at a time)
      return `
      <input type="checkbox"
             role="radio"
             name="${id}"
             id="${id}"
             data-value="${item.value}" />
      <label for="${id}">${label}</label>`;
    });
    // eslint-disable-next-line  no-param-reassign
    parentElem.innerHTML = htmlArr.join("\n");
    parentElem?.classList.add("control-container");

    // could also interate by item id
    for (const radioItem of parentElem.children) {
      radioItem.addEventListener("keydown", (evt) => {
        trace("document.addEventListener keydown", evt);
        if (evt.code === "Space") {
          if (globals.debounceTimerId) {
            clearTimeout(globals.debounceTimerId);
            globals.debounceTimerId = null;
          }
          globals.debounceTimerId = setTimeout(() => {
            // we toggle between a current speed and stop.
            // neg speed means paused and the value is the "toggle"
            globals.currentSpeed = toggleSpeedStr(globals.currentSpeed);

            checkItem(globals.currentSpeed);

            /** @type {string} */
            chrome.runtime.sendMessage({
                                         message: {
                                           cmd:    "SET_SPEED_CMD",
                                           domain: globals.domain,
                                           speed:  globals.currentSpeed,
                                           tabId,
                                         },
                                       });
          }, 10);
          evt.stopImmediatePropagation();
        }
      });

      radioItem.addEventListener("click", (evt) => {
        try {
          if (evt?.target?.dataset?.value === undefined) {
            // user clicked on a child and we ignore that
            return;
          }

          let value = /** @type {CmdType} */ evt?.target?.dataset?.value;

          trace(`click '${value}' currentspeed='${globals.currentSpeed}'`);

          if (value === "OPTIONS_BTN_CMD") {
            chrome.runtime.sendMessage({
                                         message: {
                                           cmd:    "OPTIONS_CMD",
                                           domain: globals.domain,
                                           speed:  globals.currentSpeed,
                                           tabId,
                                         },
                                       }, (_response) => {
              window.close();
            });
            return;
          }
          if (value === "PAUSE_CMD") {
            // we overload the speed. Neg means paused, the value it the "toggle back to value"
            value = toggleSpeedStr(globals.currentSpeed);
            trace(`replacing PAUSE_CMD with negative speed: ${value}`);
          }

          let speed = DEFAULT_SPEED;
          if (!(value === "UNZOOM_BTN_CMD" || value === globals.currentSpeed)) { // toggle speed
            speed = value;
          }

          globals.currentSpeed = speed;
          checkItem(speed);
          /** @type {string} */
          const cmd = (value === "UNZOOM_BTN_CMD") ? "UNZOOM_CMD" : "SET_SPEED_CMD";
          chrome.runtime.sendMessage({
                                       message: {
                                         cmd,
                                         domain: globals.domain,
                                         speed,
                                         tabId,
                                       },
                                     }, (_response) => {
            if (cmd === "UNZOOM_CMD") {
              chrome.runtime.sendMessage({
                                           message: {
                                             cmd:    "POPUP_CLOSING",
                                             domain: globals.domain,
                                             tabId,
                                           },
                                         });
              window.close();
            }
          });
        } catch (err) {
          logerr(err);
        }
      });
    }
  };

  const RefreshSpeed = () => {
    // The page could have been UNZOOMED by the escape key and everything could be out of sync
    chrome.runtime.sendMessage({
                                 message: {
                                   cmd:    "SET_SPEED_CMD",
                                   domain: globals.domain,
                                   speed:  globals.currentSpeed,
                                   tabId:  globals.tabId,
                                 },
                               });
  };

  /**
   *
   * @param evt {KeyboardEvent}
   * @constructor
   */
  const HandleKeydown = (evt) => {
    trace("document.addEventListener keydown", evt);
    switch (evt.code) {
      case "Escape":
        chrome.runtime.sendMessage({
                                     message: {
                                       cmd:    "POPUP_CLOSING",
                                       domain: globals.domain,
                                       tabId:  globals.tabId,
                                     },
                                   });
        window.close();
        break;

      case "ArrowLeft": {
        trace("ArrowLeft");
        const skipSecBack = evt.shiftKey ?
                            globals.settings.longSkipSeconds :
                            globals.settings.regSkipSeconds;
        // currentSpeed could be zero, so floor it to 0.25
        const relativeTimeBack = skipSecBack * (Math.max(parseFloat(globals.currentSpeed), 0.25)) *
                                 -1;
        chrome.runtime.sendMessage({
                                     message: {
                                       cmd:    "SKIP_PLAYBACK_CMD",
                                       domain: globals.domain,
                                       speed:  String(relativeTimeBack),
                                       tabId:  globals.tabId,
                                     },
                                   });
        evt.stopImmediatePropagation();
      }
        break;

      case "ArrowRight": {
        trace("ArrowRight");
        const skipSecFwd = evt.shiftKey ?
                           globals.settings.longSkipSeconds :
                           globals.settings.regSkipSeconds;
        // currentSpeed could be zero, so floor it to 0.25
        const relativeTimeFwd = skipSecFwd * (Math.max(parseFloat(globals.currentSpeed), 0.25));
        chrome.runtime.sendMessage({
                                     message: {
                                       cmd:    "SKIP_PLAYBACK_CMD",
                                       domain: globals.domain,
                                       speed:  String(relativeTimeFwd),
                                       tabId:  globals.tabId,
                                     },
                                   });
        evt.stopImmediatePropagation();
      }
        break;

      case "ArrowUp":
        trace("ArrowUp");
        globals.currentSpeed = IncreaseSpeed();
        checkItem(globals.currentSpeed);
        RefreshSpeed();
        evt.stopImmediatePropagation();
        break;

      case "ArrowDown":
        trace("ArrowDown");
        globals.currentSpeed = DecreaseSpeed();
        checkItem(globals.currentSpeed);
        RefreshSpeed();
        evt.stopImmediatePropagation();
        break;

      default:
        RefreshSpeed();
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const params = new URLSearchParams(globals.url.hash.replace("#", ""));
      globals.tabId = params.get("tabId");
      globals.currentSpeed = params.get("speed") || DEFAULT_SPEED;
      globals.domain = params.get("domain"); // needed because Netflix errs on skip
      const container = window.document.getElementById("speedBtnGroup");

      trace(`DOMContentLoaded params
          tabId:'${globals.tabId}'
          currentSpeed:'${globals.currentSpeed}'
          `);

      // if the user pressed escape in the page, then our zoom was lost, reapply it.
      RefreshSpeed();

      const settings = await getSettings();
      globals.settings = { ...globals.settings, ...settings };
      addSpeedControlUI(window.document, container, globals.tabId);

      // update the selected checkbox
      checkItem(globals.currentSpeed);
      document.querySelector("input[name=\"speedChoice\"]:checked")
        ?.focus();

      document.addEventListener("keydown", (evt) => {
        trace(`DOCUMENT.addEventListener("keydown")...`);
        HandleKeydown(evt);
      });

      container.addEventListener("keydown", (evt) => {
        trace(`CONTAINER.addEventListener("keydown")...`);
        HandleKeydown(evt);
      });

      // to know when the popup has closed, we have to open a socket and watch for it to be closed.
      // Seriously?!? WTF!
      g_detectCloseListenerPort = chrome.runtime.connect();
    } catch (err) {
      logerr(err);
    }
  });

  window.addEventListener("close", (_e) => {
    trace("close");
    chrome.runtime.sendMessage({
                                 message: {
                                   cmd:    "POPUP_CLOSING",
                                   domain: globals.domain,
                                   speed:  DEFAULT_SPEED,
                                   tabId:  globals.tabId,
                                 },
                               });
  });

  document.addEventListener("close", () => {
    trace("popup closing via visibilitychange");
    chrome.runtime.sendMessage({
                                 message: {
                                   cmd:    "POPUP_CLOSING",
                                   domain: globals.domain,
                                   speed:  DEFAULT_SPEED,
                                   tabId:  globals.tabId,
                                 },
                               });
  });


} catch (e) {
  logerr(e);
}
