import { WebAssemblyResourceLoader } from '../WebAssemblyResourceLoader';

const BLAZOR_DEBUG_FLAG = '_blazor_debug';

const currentBrowserIsChrome = (window as any).chrome
  && navigator.userAgent.indexOf('Edge') < 0; // Edge pretends to be Chrome

let isDebugging = sessionStorage.getItem(BLAZOR_DEBUG_FLAG);

window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  const isDebuggingParam = params.get(BLAZOR_DEBUG_FLAG);
  // (1) Value from query param then (2) value in session storage then (3) default to true
  isDebugging = isDebuggingParam !== null ? isDebuggingParam : isDebugging || 'true';
  sessionStorage.setItem(BLAZOR_DEBUG_FLAG, isDebugging);

  // Remove flag from URL if it was provided
  if (isDebuggingParam !== null) {
    params.delete(BLAZOR_DEBUG_FLAG);
    const redirectParmas = params.toString() != "" ? `?${params.toString()}` : '';
    const redirectUrl = `${window.location.origin}${window.location.pathname}${redirectParmas}`;
    history.pushState(/*Data not needed*/ null, /*Title not needed*/ '', redirectUrl);
  }
})

let hasReferencedPdbs = false;

export function hasDebuggingEnabled() {
  return isDebugging == 'true' && hasReferencedPdbs && currentBrowserIsChrome;
}

export function attachDebuggerHotkey(resourceLoader: WebAssemblyResourceLoader) {
  hasReferencedPdbs = !!resourceLoader.bootConfig.resources.pdb;

  // Use the combination shift+alt+D because it isn't used by the major browsers
  // for anything else by default
  const altKeyName = navigator.platform.match(/^Mac/i) ? 'Cmd' : 'Alt';
  if (hasDebuggingEnabled()) {
    console.info(`Debugging hotkey: Shift+${altKeyName}+D (when application has focus)`);
  }

  // Even if debugging isn't enabled, we register the hotkey so we can report why it's not enabled
  document.addEventListener('keydown', evt => {
    if (evt.shiftKey && (evt.metaKey || evt.altKey) && evt.code === 'KeyD') {
      if (!hasReferencedPdbs) {
        console.error('Cannot start debugging, because the application was not compiled with debugging enabled.');
      } else if (!currentBrowserIsChrome) {
        console.error('Currently, only Microsoft Edge (80+), or Google Chrome, are supported for debugging.');
      } else if (!isDebugging) {
        console.error(`_blazor_debug query parameter must be set to enable debugging. To enable debugging, go to ${location.href}?_blazor_debug=true.`);
      } else {
        launchDebugger();
      }
    }
  });
}

function launchDebugger() {
  // The noopener flag is essential, because otherwise Chrome tracks the association with the
  // parent tab, and then when the parent tab pauses in the debugger, the child tab does so
  // too (even if it's since navigated to a different page). This means that the debugger
  // itself freezes, and not just the page being debugged.
  //
  // We have to construct a link element and simulate a click on it, because the more obvious
  // window.open(..., 'noopener') always opens a new window instead of a new tab.
  const link = document.createElement('a');
  link.href = `_framework/debug?url=${encodeURIComponent(location.href)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
}
