let enabled = false;

export function initTracking(userHash) {
  if (!window.analytics || !process.env.production) {
    return;
  }

  enabled = true;
  trackPage();
  trackEvent('init');
  window.analytics.identify(userHash);
}

export function trackPage() {
  if (enabled) {
    window.analytics.page();
  }
}

export function trackEvent(action: string, data?: any) {
  if (enabled) {
    data = { ...data, app: 'pnl-widget' };
    window.analytics.track(action, data || {});
  } else {
    console.debug('[analytics] track event', { action, data });
  }
}
