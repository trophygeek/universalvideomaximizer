

/*
  Video Maximizer

 Copyright (c) 2023. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

/**
 * Negative numbers means skip backwards
 */
export function injectVideoSkip(skipSecondsStr: string) {
  const skipSeconds = parseFloat(skipSecondsStr);
  for (const eachVideo of document.querySelectorAll("video")) {
    try {
      if (
          !eachVideo.checkVisibility({
                                       checkOpacity: true,
                                       checkVisibilityCSS: true,
                                     })
      ) {
        // eslint-disable-next-line no-console
        // console.log(`VideoMaxExt: injectVideoSkip checkVisibility=false, skipping`, eachVideo);
        continue;
      }
      if ((eachVideo?.seekable?.length || 0) <= 0) {
        // eslint-disable-next-line no-console
        // console.log(`VideoMaxExt: injectVideoSkip not seekable, skipping`, eachVideo?.seekable);
        continue;
      }
      // restore playback speed after we skip
      const savedSpeed = eachVideo.playbackRate || 1.0;

      // eachVideo.pause(); // pause/play trigger controls to briefly show. (doesn't rehide on some
      // sites)

      // don't go negative;
      eachVideo.currentTime = Math.max(0, eachVideo.currentTime + skipSeconds);
      eachVideo.playbackRate = savedSpeed;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
          `VideoMaxExt: injectVideoSkip err for video`,
          err,
          eachVideo
      );
    }
  }
}
