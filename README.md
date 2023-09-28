# universalvideomaximizer
Chrome extension that finds and enlarges the main video filling browser window.

Google is requiring all chrome extensions be upgraded to v3. This breaks some of the mechanisms the old Universal Video Maximizer uses and required a rewrite. To be fair, the original code dates back to 2012, so it lasted a long time.

## How to use this old version with Chrome.

If you still want to use this old version with chrome, it's pretty easy to do.

1. Download this source and save somewhere locally. Unzip it and rename it something like `VideoMaxExt2`
![image](https://github.com/trophygeek/universalvideomaximizer/assets/522197/48d35694-6847-4f56-8784-bcabb760fba4)
2. Follow these instructions from Google on how to load a local Chrome Extension.
(Loading an unpacked extension)[https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked]
3. You need to use **Load unpacked** directory by selecting the `src` inside the `VideoMaxExt2` directory.

You will likely get an error warning it's a version 2 extension but that's it.

## Firefox support
The `v2` branch that is verified to work with Firefox.
https://addons.mozilla.org/addon/universal-video-maximizer/
