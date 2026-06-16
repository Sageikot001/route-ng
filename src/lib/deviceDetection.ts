// Detect iOS device
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

// Detect if running as installed PWA (standalone mode)
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
}

// Detect iOS browser (not in PWA mode) - applies to ALL browsers on iOS
// since Apple forces all iOS browsers to use WebKit
export function isIOSSafari(): boolean {
  return isIOS() && !isStandalone();
}

// Alias for clarity - all iOS browsers have same PWA requirement
export function isIOSBrowser(): boolean {
  return isIOSSafari();
}

// Check if device can support web push
export function canSupportWebPush(): boolean {
  // iOS requires PWA mode for push notifications (all browsers)
  if (isIOS()) {
    return isStandalone();
  }
  // Other platforms support it natively
  return 'Notification' in window && 'serviceWorker' in navigator;
}
