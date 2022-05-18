try {
  const DEBUG_ENABLED            = false;
  const TRACE_ENABLED            = false;
  const ERR_BREAK_ENABLED        = false;

  const logerr = (...args) => {
    if (DEBUG_ENABLED === false) {
      return;
    }
    // eslint-disable-next-line no-console
    console.trace('%c VideoMax Popup ERROR', 'color: white; font-weight: bold; background-color: red',
      ...args);
    if (ERR_BREAK_ENABLED) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
  };

  const trace = (...args) => {
    if (TRACE_ENABLED) {
      // eslint-disable-next-line no-console
      console.log('%c VideoMax Popup ', 'color: white; font-weight: bold; background-color: blue', ...args);
    }
  };

  const UNZOOM_CMD    = 'UNZOOM';
  const SET_SPEED_CMD = 'SET_SPEED';
  const REZOOM_CMD    = 'REZOOM';
  const DEFAULT_SPEED = '1.0';
  const UNZOOM_LABEL  = '[]';
  const SVG_ICON      = './icons/icon19undo.png';
  const MENU          = [{
    label: '🖐️',
    value: '0',
  }, {
    label: '0.25',
    value: '0.25',
  }, {
    label: '0.50',
    value: '0.50',
  }, {
    label: '0.75',
    value: '0.75',
  }, {
    label: '1.0',
    value: DEFAULT_SPEED,
  }, {
    label: '1.25',
    value: '1.25',
  }, {
    label: '1.50',
    value: '1.50',
  }, {
    label: '1.75',
    value: '1.75',
  }, {
    label: '2x',
    value: '2.0',
  }, {
    label: '4x',
    value: '4.0',
  }, {
    label: '8x',
    value: '8.0',
  }, {
    label: '16x',
    value: '16.0',
  }, {
    label: UNZOOM_LABEL,
    value: UNZOOM_CMD,
  }];
  const url           = new URL(document.location.href);

  let g_currentSpeed = DEFAULT_SPEED;

  /**
   * @param doc {Document}
   * @param parent {HTMLElement}
   * @param tabId {string}
   * @param defaultValue {string}
   */
  const addSpeedControlUI = (doc, parent, tabId, defaultValue) => {
    const htmlArr = [];
    MENU.map((item, ii) => {
      const id        = `videomax.ext.${ii}`;
      const ischecked = item.value === defaultValue ? 'checked' : '';
      const label     = (item.label === UNZOOM_LABEL) ?
                        `<img src='${SVG_ICON}' class='closeicon'>` :
                        `${item.label}`;
      const elemhtml  = `
      <input type="radio"
              class="videomax-ext-speed-control-radio-button videomax-ext-speed-control-radio-button-${item.value}" 
             name="${id}" value="${item.value}" id="${id}" tabindex="${ii}"
             ${ischecked}/>
      <label for="${id}">${label}</label>`;
      htmlArr.push(elemhtml);
    });

    parent.innerHTML = htmlArr.join('\n');
    parent.classList.add('videomax-ext-speed-control-container');
    parent.addEventListener('click', async (evt) => {
      if (!evt?.target?.value) {
        // user clicked on a child and we ignore that
        return;
      }

      let value = evt?.target?.value;

      trace(`click '${value}' currentspeed='${g_currentSpeed}'`);
      let speed = DEFAULT_SPEED;
      if (!(value === UNZOOM_CMD ||   // unzoom value
            value === g_currentSpeed)) {  // toggle speed
        speed = value;
      }

      g_currentSpeed = speed;

      for (const eachElem of parent.children) {
        eachElem.checked = (eachElem?.value === speed);
      }
      const cmd = (value === UNZOOM_CMD) ? UNZOOM_CMD : SET_SPEED_CMD;
      await chrome.runtime.sendMessage({
        message: {
          cmd,
          speed,
          tabId,
        },
      }, (response) => {
        if (cmd === UNZOOM_CMD) {
          window.close();
        }
      });
    });

    parent.addEventListener('keypress', (evt) => {
      if (evt.code === 'Escape') {
        window.close();
      }
    });

    document.getElementById(`videomax.ext.${MENU.length - 1}`)
      ?.focus();
  };

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const params       = new URLSearchParams(url.hash.replace('#', ''));
      const tabId        = params.get('tabId');
      const currentSpeed = params.get('speed');
      const videofound   = params.get('videofound');
      const container    = window.document.getElementById('speedBtnGroup');
      trace(`DOMContentLoaded params tabId:'${tabId}' currentSpeed:'${currentSpeed}' videofound:'${videofound}'`);

      addSpeedControlUI(window.document, container, tabId, currentSpeed);

      // update the selected checkbox
      for (const eachElem of container.children) {
        eachElem.checked = (eachElem.value === currentSpeed);
      }

      // The page could have been UNZOOMED by the escape key and everything could be out of sync
      chrome.runtime.sendMessage({
        message: {
          cmd:   REZOOM_CMD,
          value: currentSpeed,
          tabId: tabId,
        },
      }, (response) => {
        trace('sendMessage callback', response);
      });
    } catch (err) {
      logerr(err);
    }
  });
} catch (e) {
  console.log(e);
}
