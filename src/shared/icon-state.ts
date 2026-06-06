export function setIconActive(tabId: number, active: boolean): void {
  chrome.action.setBadgeText({ tabId, text: active ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: active ? '#10B981' : '#64748B' });
  chrome.action.setTitle({ tabId, title: active ? 'FixIt (Active)' : 'FixIt' });
}
