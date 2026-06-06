import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Message } from '../../src/shared/types';
import { MessageType } from '../../src/shared/types';
import { sendMessage, sendToTab, onMessage } from '../../src/shared/messages';

const sendMessageMock = vi.fn();
const sendTabMock = vi.fn();
const listeners: Array<(msg: unknown, sender: unknown) => void> = [];

const chromeMock = {
  runtime: {
    sendMessage: sendMessageMock,
    onMessage: {
      addListener: vi.fn((fn: (msg: unknown, sender: unknown) => void) => {
        listeners.push(fn);
      }),
    },
  },
  tabs: {
    sendMessage: sendTabMock,
  },
};

vi.stubGlobal('chrome', chromeMock);

beforeEach(() => {
  listeners.length = 0;
  vi.clearAllMocks();
});

describe('sendMessage', () => {
  it('delegates to chrome.runtime.sendMessage', async () => {
    sendMessageMock.mockResolvedValue({ ok: true });
    const msg: Message = { type: MessageType.GET_ANNOTATIONS };
    const result = await sendMessage(msg);
    expect(sendMessageMock).toHaveBeenCalledWith(msg);
    expect(result).toEqual({ ok: true });
  });
});

describe('sendToTab', () => {
  it('delegates to chrome.tabs.sendMessage with tabId', async () => {
    sendTabMock.mockResolvedValue(undefined);
    const msg: Message = { type: MessageType.TOGGLE_ANNOTATION, payload: { active: true } };
    await sendToTab(42, msg);
    expect(sendTabMock).toHaveBeenCalledWith(42, msg);
  });
});

describe('onMessage', () => {
  it('registers a listener that fires for matching message type', () => {
    const handler = vi.fn();
    onMessage(MessageType.ADD_ANNOTATION, handler);

    const msg: Message = { type: MessageType.ADD_ANNOTATION, payload: { id: '1' } };
    const sender = { tab: { id: 1 } } as unknown as chrome.runtime.MessageSender;
    listeners[0](msg, sender);

    expect(handler).toHaveBeenCalledWith(msg, sender);
  });

  it('does not fire for non-matching message type', () => {
    const handler = vi.fn();
    onMessage(MessageType.ADD_ANNOTATION, handler);

    const msg: Message = { type: MessageType.DELETE_ANNOTATION, payload: { id: '1' } };
    const sender = {} as chrome.runtime.MessageSender;
    listeners[0](msg, sender);

    expect(handler).not.toHaveBeenCalled();
  });
});
