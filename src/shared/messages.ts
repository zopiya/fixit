import type { Message } from './types';
import { MessageType } from './types';

export { MessageType };
export type { Message };

export function sendMessage<T>(message: Message<T>): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}

export function sendToTab<T>(tabId: number, message: Message<T>): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}

export function onMessage(
  type: MessageType,
  handler: (message: Message<unknown>, sender: chrome.runtime.MessageSender) => void,
): void {
  chrome.runtime.onMessage.addListener(
    (message: Message<unknown>, sender: chrome.runtime.MessageSender) => {
      if (message.type === type) {
        handler(message, sender);
      }
    },
  );
}
