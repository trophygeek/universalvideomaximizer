try {
  const UNZOOM_CMD = 'UNZOOM';
  const SPEED_CMD = 'SPEED';

  const url = new URL(document.location.href);

  const NORMAL_SPEED = "1.0";
  let currentSpeed = NORMAL_SPEED;

  /**
   * @param doc {Document}
   * @param parent {HTMLElement}
   * @param tabId {string}
   * @param defaultValue {string}
   */
  const addSpeedControlUI = async (doc, parent, tabId, defaultValue) => {
    const htmlArr = [];
    [
      {
        label: '🖐️',
        value: '0',
      },
      {
        label: '0.25',
        value: '0.25',
      },
      {
        label: '0.50',
        value: '0.50',
      },
      {
        label: '0.75',
        value: '0.75',
      },
      {
        label: '1.0',
        value: NORMAL_SPEED,
      },
      {
        label: '1.25',
        value: '1.25',
      },
      {
        label: '1.50',
        value: '1.50',
      },
      {
        label: '1.75',
        value: '1.75',
      },
      {
        label: '2x',
        value: '2.0',
      },
      {
        label: '4x',
        value: '4.0',
      },
      {
        label: '8x',
        value: '8.0',
      },
      {
        label: '16x',
        value: '16.0',
      },
      {
        label: 'unzoom',
        value: UNZOOM_CMD,
      },
    ].map((item, ii) => {
      const id = `videomax.ext.${ii}`;
      const ischecked = item.value === defaultValue ? 'checked' : '';
      const elemhtml = `
      <input type="radio"
              class="videomax-ext-speed-control-radio-button videomax-ext-speed-control-radio-button-${item.value}" 
             name="${id}" value="${item.value}" id="${id}"
             ${ischecked}/>
      <label for="${id}">${item.label}</label>`;
      htmlArr.push(elemhtml);
    });

    parent.innerHTML = htmlArr.join('\n');
    parent.className = 'videomax-ext-speed-control-container';
    parent.addEventListener('click', async (evt) => {
      if (!evt?.target?.value ) {
        // user clicked on a child and we ignore that
        return;
      }

      let value = evt?.target?.value || "1.0";

      if (value !== UNZOOM_CMD) {
        if (value === currentSpeed) {
          // ok. playing with the "toggle" feature.
          value = NORMAL_SPEED;
        }
        currentSpeed = value;
      }

      for (const eachElem of parent.children) {
        eachElem.checked = (eachElem?.value === value);
      }
      const cmd = (value === UNZOOM_CMD) ? UNZOOM_CMD : SPEED_CMD;
      await chrome.runtime.sendMessage({
        message: {
          cmd,
          value,
          tabId,
        },
      }, () => {
        if (cmd === UNZOOM_CMD) {
          window?.close();
        }
      });
    });
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(url.hash.replace('#', ''));
    const tabId = params.get('tabId');
    const currentSpeed = params.get('speed') || '1.0';

    // create the speed button UI
    const container = window.document.getElementById('speedBtnGroup');
    await addSpeedControlUI(window.document, container, tabId, currentSpeed);
  });
} catch (e) {
  console.trace(e);
}
