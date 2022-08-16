/*
 * This test copies over the extension and modifies it so it can be run
 * in an automated fashion.
 */
const puppeteer        = require('puppeteer');
const path             = require('path');
const { promises: fs } = require('fs');
const { url_suite1 }   = require('./test_urls');

const user_agent = ' Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const srcDir           = path.join(__dirname, '../src/');
const extDir          = path.join(__dirname, './testvidmax/');
const currDir          = path.join(__dirname, '../test/');
const screenshotsDir   = path.join(__dirname, './screenshots/');
const manifestfile     = `${extDir}manifest.json`;
const mainInjectFile   = `${extDir}videomax_main_inject.js`;
const logFile          = `${currDir}matching.log`;
const ext_install_path = extDir;


const copyDirectory = async (src, dest) => {
  const [entries] = await Promise.all(
    [fs.readdir(src, { withFileTypes: true }), fs.mkdir(dest, { recursive: true })]);

  await Promise.all(entries.map((entry) => {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    return entry.isDirectory() ? copyDirectory(srcPath, destPath) : fs.copyFile(srcPath, destPath);
  }));
};

const copyOverExtension = async () => {
  try {
    // the manifest needs to be modified for it to work in testing,
    // copy it to a temp-test location
    try {
      await fs.rm(extDir, { recursive: true });
    } catch (err) {}

    await copyDirectory(srcDir, extDir);

    // Modify the manifest to give it MORE permissions for automated testing
    {
      const manifest = await fs.readFile(manifestfile, 'utf8');
      // ],
      //   "host_permissions": [
      //     "*://*/*"
      //   ],
      await fs.writeFile(manifestfile,
        manifest.replace(`"optional_permissions"`, `"host_permissions": ["*://*/*"],"permissions"`),
        'utf8');
    }

    // modify the main injected script to make sure the EMBED_SCORES is enabled.
    const videomaxMainInject = await fs.readFile(mainInjectFile, 'utf-8');
    const result             = videomaxMainInject.replace(/EMBED_SCORES\s+=\s+false/g,
        `EMBED_SCORES = true`)
      .replace(/FULL_DEBUG\s+=\s+false/g, 'FULL_DEBUG = true')
      .replace(/BREAK_ON_BEST_MATCH\s+=\s+true/g, 'BREAK_ON_BEST_MATCH = false');
    await fs.writeFile(mainInjectFile, result, 'utf-8');
  } catch (err) {
    console.error(err);
  }
};

const clearLog = async () => {
  try {
    await fs.rm(logFile);
    await fs.appendFile(logFile, `${new Date().toLocaleString()}\n`, 'utf-8');
  } catch (err) {
    console.log(err);
  }
};

const writeLog = async (str) => {
  await fs.appendFile(logFile, str.toString(), 'utf-8');
};

const clearScreenshots = async () => {

};

const getUrlFilename = (url) => {
  const urlObj    = new URL(url);
  const urlString = `${urlObj.origin}${urlObj.pathname}`.slice(0, 150);

  return `${encodeURIComponent(urlString)}.png`;
};

const goto = async (page, url) => {
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout:   5000,
    });
  } catch {}
};

const ZoomExtCmd = async (webWorker) => {
  return webWorker.evaluate(() => {
    chrome.tabs.query({ active: true }, async (tabs) => {
      // commands in here are in context of background script
      try {
        await Zoom(tabs[0].id, tabs[0].url);
      } catch (err) {
        console.error(err);
      }
    });
  });

};

const UnZoomExtCmd = async (webWorker) => {
  return webWorker.evaluate(() => {
    chrome.tabs.query({ active: true }, async (tabs) => {
      // commands in here are in context of background script
      try {
        await unZoom(tabs[0].id, true);
      } catch (err) {
        console.error(err);
      }
    });
  });
};

const extractDomain = (url) => {
  if (!url) {
    return '';
  }
  const domain_parts = String(url)
    .match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i, '');
  if (domain_parts && domain_parts.length >= 2) {
    return domain_parts[1].split(':')[0];
  }
  return '';
};


const ReadResultsAndSave = async (page, domain) => {
  try {
    await page.waitForSelector('.videomax-ext-video-matched', { timeout: 8 * 1000 });
    const result = await page.evaluate(
      () => window.document.body.parentNode.getAttribute('data-videomax-weights'));
    // save result
    await writeLog(result);
    return result;
  } catch(err) {
    await writeLog(`\n!!!!${domain} failed\n `);
    console.error(domain, err);
    return '';
  }
};


const testPage = async (webWorker, page, url, clickToPlay = false) => {
  try {
    const domain = extractDomain(url);
    await writeLog(`\n\n==========START============\ntesting ${domain}\n`);
    await goto(page, url);
    Promise.allSettled([page.waitForNavigation({
      waitUntil: 'load',
      timeout:   2000,
    }), sleep(2000)]);

    await ZoomExtCmd(webWorker);
    await sleep(1000);
    await ReadResultsAndSave(page, domain);
    await writeLog(`\n==========END============\n`);
    //
    // await page.bringToFront();
    // await page.mouse.move(500, 250, { steps: 10 });
    // if (clickToPlay) {
    //   await page.mouse.click(500, 250);
    // } else {
    //   await page.keyboard.press('Space', { delay: 50 });
    // }
    // await sleep(500);
    //
    // {
    //   const promise1 = page.mouse.move(400, 150, { steps: 500 });
    //   const promise2 = page.screenshot({ path: path.join(screenshotsDir, `${domain}-1-zoom.png`)
    // }); await Promise.allSettled([promise1, promise2]); } await sleep(500);  await
    // UnZoomExtCmd(webWorker); await sleep(500); await page.screenshot({ path:
    // path.join(screenshotsDir, `${domain}-2-unzoom.png`) }); await sleep(500);  await
    // ZoomExtCmd(webWorker); await sleep(500); await page.keyboard.press('Escape', { delay: 50 });
    //  { const promise1 = page.mouse.move(500, 250, { steps: 500 }); const promise2 =
    // page.screenshot({ path: path.join(screenshotsDir, `${domain}-3-rezoom.png`) }); await
    // Promise.allSettled([promise1, promise2]); }
  } catch (err) {
    await writeLog(`#### Error\n`, err);
  }
};

(async (options) => {
  try {
    console.log('===> Testing Chromium');
    const {
            devtools = false,
          } = options;

    await clearLog();
    await copyOverExtension();

    const browser = await puppeteer.launch({
      headless:         false,
      logLevel:         'verbose',
      enableExtensions: true,
      defaultViewport:  null,    // fix the window resize viewport issue.
      startingUrl:      'about:blank',

      // defaultViewport: {
      //   width:  1080,
      //   height: 1080,
      // },
      // devtools,
      args: [`--disable-extensions-except=${ext_install_path}`,
             `--load-extension=${ext_install_path}`,
             `--user-agent=${user_agent}`,
        // '--no-xshm',
        // '--disable-gpu',
        // '--disable-dev-shm-usage',
        // '--disable-setuid-sandbox',
             '--no-first-run',
             '--disable-default-apps',
        // '--no-sandbox',
        // '--no-zygote',
             `--disable-site-isolation-trials`, // to ignore some chromium errors
             `--disable-background-timer-throttling`,
             `--disable-sync`,
             `--metrics-recording-only`,
             `--disable-default-apps`,
             `--disable-breakpad`,
             `--disable-features=site-per-process`,
             `--disable-hang-monitor`,
             `--disable-popup-blocking`,
             `--disable-prompt-on-repost`,
             `--disable-sync`,
             `--disable-translate`,
             `--metrics-recording-only`,
             `--safebrowsing-disable-auto-update`,
             `--mute-audi`],
    });
    const pages   = await browser.pages();
    const page    = pages[0];
    await goto(page, 'chrome://serviceworker-internals/');

    // const extBackgroundTarget = await browser.waitForTarget(t => t.type() === 'background_page')
    // const extBackgroundPage = await extBackgroundTarget.page()
    const serviceWorker = await browser.waitForTarget(t => t.type() === 'service_worker');

    // find extension service worker and get it
    const webWorker         = await serviceWorker.worker();
    const [, , extensionId] = (webWorker.url() || '').split('/');
    console.log('extensionId', extensionId);

    // enable extension debugger
    {
      // await goto(page, 'chrome://extensions/shortcuts');
      await goto(page, 'chrome://serviceworker-internals/');
      await page.bringToFront();
      await sleep(1000);


      await page.keyboard.press('Tab', { delay: 50 });
      await page.keyboard.press('Space', { delay: 50 });

      for (let ii = 0; ii < 4; ii++) {
        await page.keyboard.press('Tab', { delay: 50 });
      }

      await page.keyboard.press('Enter', { delay: 50 });
    }

    await goto(page, 'chrome://extensions/');


    for (let eachurl of url_suite1) {
      await testPage(webWorker, page, eachurl);
    }
    await goto(page, 'chrome://extensions/');
    await browser.close();
  } catch (err) {
    debugger;
    console.log(err);
  }
})({
  devtools: false,
});
