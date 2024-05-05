// @ts-check
/**
 * Put types in a .d.ts and they are used automatically
 * by the IDE to help with typechecking w/out needing
 * too transpile with javascript. Neat.
 */

type KeyValuePair = { [key: string]: string };

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
};

type SettingsKeyType = keyof SettingsType;

type SettingStorageKeyConstType = "settingsJson";

// Used by chrome.runtime.sendMessage
type CmdType =
    "UNZOOM_CMD"
    | "SET_SPEED_CMD"
    | "REZOOM_CMD"
    | "SKIP_PLAYBACK_CMD"
    | "TOGGLE_PLAYBACK_CMD"
    | "OPTIONS_CMD"
    | "FIRST_USE_REFRESH_POPUP_URL_CMD"
    | "POPUP_CLOSING";

// Used by popup for buttons that aren't speed changes.
type PopupMenuCmd = "UNZOOM_BTN_CMD" | "OPTIONS_BTN_CMD";

type DomRect = {
  top: number, left: number, bottom: number, width: number, right: number, height: number
}

type BackgroundState = | "UNZOOMED" | "ZOOMING" // maps to ZOOMED_NOSPEED or ZOOMED_SPEED
    | "ZOOMING_SPEED_ONLY" // maps to SPEED_ONLY
    | "ZOOMED_NOSPEED" | "ZOOMED_SPEED" | "SPEED_ONLY" | "REFRESH" | "ERR_PERMISSION" | "ERR_URL" | ""; // means
                                                                                                        // preserve
                                                                                                        // state

type BackgroundStateValue = {
  readonly badge: string,
  readonly title: string,
  readonly showpopup: boolean,
  readonly zoomed: boolean,
  readonly color: string,
};

type BackgroundStateMap = {
  [key in BackgroundState]: BackgroundStateValue;
}

type SubFrameParamData = {
  tabId: number; domain: string; subFrameStr: string;
};
type SubFramePermMatching = { [tabId: number]: SubFrameParamData };

type ActionFunction = (elem: Node) => boolean;

type HtmlElementType = keyof Partial<HTMLElementTagNameMap>;
type HtmlElementTypes = HtmlElementType[];

type InjectExecScriptCmds = "CrossDomainFailedIFrames" | "VideoSpeedAdjust";

type VideomaxGlobalsTypeBase = {
  matchedVideo: HTMLVideoElement | HTMLIFrameElement | null;
  matchVideoRect: DomRect;
  matchedIsHtml5Video: boolean;
  matchedVideoSrc: string;
  matchedCommonCntl: Element | null;
  processInFrame: boolean,
  isMaximized: boolean,
  tagonly: boolean,
  unzooming: boolean,
};
