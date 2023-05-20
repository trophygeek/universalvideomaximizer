// @ts-check
// useful reference for exports https://web.dev/es-modules-in-sw/
import { DEFAULT_SETTINGS, DEFAULT_SPEED, getSettings, logerr, trace } from "./common.js";

const BLOCKED_SKIP_DOMAINS = ["netflix."];

try {
  const UNZOOM_LABEL = "[]";
  const UNZOOM_ICON  = "./icons/icon19undo.png";

  const MENU         = [{
    label: "⚙️️",
    value: "OPTIONS_BTN_CMD",
  }, {
    label: "🖐️",
    value: "0.00",
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
  const MIN_SPEED = "0.0";
  const MAX_SPEED = "16.0";
  const globals   = {
    url: new URL(document.location.href),
    /** @type {String} */
    currentSpeed: DEFAULT_SPEED,
    /** @type {SettingsType} */
    settings:   DEFAULT_SETTINGS, // onload will overwrite.
    tabId:      "",
    videofound: "",
  };

  /**
   * @param ii {number}
   * @returns {string}
   */
  const itemId = (ii) => `speed-${ii}`;

  const checkItem = (itemValue) => {
    itemValue   = String(itemValue);
    const group = document.getElementById("speedBtnGroup");
    for (let eachElem of group.children) {
      if (eachElem.type !== "checkbox") {
        continue;
      }
      eachElem.checked = (eachElem.dataset.value === itemValue);
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
   * @param parent {HTMLElement}
   * @param tabId {string}
   */
  const addSpeedControlUI = (doc, parent, tabId) => {
    const htmlArr = [];
    MENU.map((item, ii) => {
      const id    = itemId(ii);
      const label = (item.label === UNZOOM_LABEL) ?
                    `<img src='${UNZOOM_ICON}' class='closeicon'>` :
                    `${item.label}`;
      // we use checkboxes vs radio so we can intercept the arrow keys.
      // radio buttons grabs the arrows keys to move between items.
      // but the checkboxes' "role" is more like radio buttons
      // (only one selected at a time)
      const elemhtml = `
      <input type="checkbox"
             role="radio"
             name="${id}"
             id="${id}"
             data-value="${item.value}" />
      <label for="${id}">${label}</label>`;
      htmlArr.push(elemhtml);
    });
    parent.innerHTML = htmlArr.join("\n");
    parent.classList.add("control-container");

    // could also interate by item id
    for (let radioItem of parent.children) {
      radioItem.addEventListener("keydown", (evt) => {
        trace("document.addEventListener keydown", evt);
        switch (evt.code) {
          case "Space":
            chrome.runtime.sendMessage({
              message: {
                cmd:   "TOGGLE_PLAYBACK_CMD",
                speed: globals.currentSpeed,
                tabId: globals.tabId,
              },
            });
            evt.stopImmediatePropagation();
            break;
        }
      });

      radioItem.addEventListener("click", (evt) => {
        try {
          if (evt?.target?.dataset?.value === undefined) {
            // user clicked on a child and we ignore that
            return;
          }

          const value = /** @type {CmdType} */ evt?.target?.dataset?.value;

          trace(`click '${value}' currentspeed='${globals.currentSpeed}'`);
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
              speed,
              tabId,
            },
          }, (_response) => {
            if (cmd === "UNZOOM_CMD") {
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
        cmd:   "REZOOM_CMD", // SET_SPEED_CMD
        speed: globals.currentSpeed,
        tabId: globals.tabId,
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
        window.close();
        break;

      case "ArrowLeft":
        trace("ArrowLeft");
        if (globals.domain?.length && BLOCKED_SKIP_DOMAINS.includes(globals.domain)) {
          console.trace("netflix can't skip");
          return;
        }
        const skipSecBack      = evt.shiftKey ?
                                 globals.settings.longSkipSeconds :
                                 globals.settings.regSkipSeconds;
        // currentSpeed could be zero, so floor it to 0.25
        const relativeTimeBack = skipSecBack * (Math.max(globals.currentSpeed, 0.25)) * -1;
        chrome.runtime.sendMessage({
          message: {
            cmd:   "SKIP_PLAYBACK_CMD",
            speed: String(relativeTimeBack),
            tabId: globals.tabId,
          },
        });
        evt.stopImmediatePropagation();
        break;

      case "ArrowRight":
        trace("ArrowRight");
        if (globals.domain?.length && BLOCKED_SKIP_DOMAINS.includes(globals.domain)) {
          console.trace("netflix can't skip");
          return;
        }
        const skipSecFwd      = evt.shiftKey ?
                                globals.settings.longSkipSeconds :
                                globals.settings.regSkipSeconds;
        // currentSpeed could be zero, so floor it to 0.25
        const relativeTimeFwd = skipSecFwd * (Math.max(globals.currentSpeed, 0.25));
        chrome.runtime.sendMessage({
          message: {
            cmd:   "SKIP_PLAYBACK_CMD",
            speed: String(relativeTimeFwd),
            tabId: globals.tabId,
          },
        });
        evt.stopImmediatePropagation();
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
      const params         = new URLSearchParams(globals.url.hash.replace("#", ""));
      globals.tabId        = params.get("tabId");
      globals.videofound   = params.get("videofound");
      globals.currentSpeed = params.get("speed");
      globals.domain       = params.get("domain"); // needed because Netflix errs on skip
      const container      = window.document.getElementById("speedBtnGroup");

      trace(`DOMContentLoaded params
          tabId:'${globals.tabId}'
          currentSpeed:'${globals.currentSpeed}'
          videofound:'${globals.videofound}'`);

      // if the user pressed escape in the page, then our zoom was lost, reapply it.
      RefreshSpeed();

      const settings   = await getSettings();
      globals.settings = { ...globals.settings, ...settings };
      addSpeedControlUI(window.document, container, globals.tabId);

      // update the selected checkbox
      checkItem(globals.currentSpeed);
      document.querySelector("input[name=\"speedChoice\"]:checked")
        ?.focus();

      document.addEventListener("keydown", (evt) => {
        console.trace(`DOCUMENT.addEventListener("keydown")...`);
        HandleKeydown(evt);
      });

      container.addEventListener("keydown", (evt) => {
        console.trace(`CONTAINER.addEventListener("keydown")...`);
        HandleKeydown(evt);
      });

      // window.addEventListener('blur', function() {
      //   window.close();
      // });

    } catch (err) {
      logerr(err);
    }
  });
} catch (e) {
  console.error(e);
}
