// @ts-check
/**
 * Put types in a .d.ts and they are used automatically
 * by the IDE to help with typechecking w/out needing
 * too transpile with javascript. Neat.
 */

type KeyValuePair = {
  [key: string]: string
};

type SettingsType = {
  lastBetaVersion?: string,
  useAdvancedFeatures: boolean,
  spacebarTogglesPlayback: boolean,
  regSkipSeconds: number,
  longSkipSeconds: number,
  preportionalSkipTimes: boolean,
  wholeDomainAccess: boolean,
  allSitesAccess: boolean,
  allSitesAccessNeedsRevoke: boolean,
  zoomExclusionListStr: string,
  beta3EndingShown?: boolean,
  firstUseShown?: boolean,
  firstUseOn2ndScreen?: boolean,
  stickySPANav?: boolean, // true if zooming should auto-reapply on the same domain (e.g. back button)
};

type SettingsKeyType = keyof SettingsType;

type SettingStorageKeyConstType = "settingsJson";

// Used by chrome.runtime.sendMessage
type CmdType =
    "UNZOOM_CMD"
    | "SET_SPEED_CMD"
    | "REZOOM_CMD"
    | "SKIP_PLAYBACK_CMD"
    | "OPTIONS_CMD"
    | "GET_SPEED_PREP_CMD"
    | "GET_SPEED_COMPLETE_CMD"
    | ""; // last one is fallback

type BackgroundMessage = {
  message: {
    cmd: CmdType,
    tabId: number,
    domain?: string,
    speed?: string,
  }
}

type BackgroundMessageResponse = {
  success: boolean,
  playbackSpeed?: string,
}

// Used by popup for buttons that aren't speed changes.
type PopupMenuCmd = "UNZOOM_BTN_CMD" | "OPTIONS_BTN_CMD";

type DomRect = {
  top: number,
  left: number,
  bottom: number,
  width: number,
  right: number,
  height: number
}

type ActionFunction = (elem: Node) => boolean;

type HtmlElementType = keyof Partial<HTMLElementTagNameMap>;
type HtmlElementTypes = HtmlElementType[];

type InjectExecScriptCmds = "CrossDomainFailedIFrames" | "VideoSpeedAdjust";

type VideomaxGlobalsTypeBase = {
  matchedVideo: HTMLVideoElement | HTMLIFrameElement | Element | null;
  matchVideoRect: DomRect;
  matchedVideoSrc: string;
  matchedCommonCntl: Element | null;
  processInFrame: boolean,
  isMaximized: boolean,
  tagonly: boolean,
  unzooming: boolean,
};
