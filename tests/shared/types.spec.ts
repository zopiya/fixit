import { describe, it, expect } from 'vitest';
import type { FixItAnnotation, CssSelectorConfidence, Message } from '../../src/shared/types';
import { MessageType } from '../../src/shared/types';

describe('MessageType enum', () => {
  it('should have all 11 message types', () => {
    expect(MessageType.ADD_ANNOTATION).toBe('ADD_ANNOTATION');
    expect(MessageType.UPDATE_ANNOTATION).toBe('UPDATE_ANNOTATION');
    expect(MessageType.DELETE_ANNOTATION).toBe('DELETE_ANNOTATION');
    expect(MessageType.ANNOTATIONS_UPDATED).toBe('ANNOTATIONS_UPDATED');
    expect(MessageType.GET_ANNOTATIONS).toBe('GET_ANNOTATIONS');
    expect(MessageType.CLEAR_ALL).toBe('CLEAR_ALL');
    expect(MessageType.TOGGLE_ANNOTATION).toBe('TOGGLE_ANNOTATION');
    expect(MessageType.REQUEST_TOGGLE).toBe('REQUEST_TOGGLE');
    expect(MessageType.HIGHLIGHT).toBe('HIGHLIGHT');
    expect(MessageType.ANNOTATION_STATUS).toBe('ANNOTATION_STATUS');
    expect(MessageType.STORAGE_ERROR).toBe('STORAGE_ERROR');
  });

  it('should have exactly 11 members', () => {
    const keys = Object.keys(MessageType);
    expect(keys).toHaveLength(11);
  });
});

describe('FixItAnnotation type shape', () => {
  it('should accept a valid annotation object at compile time', () => {
    const annotation: FixItAnnotation = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      url: 'http://localhost:3000/dashboard',
      fullUrl: 'http://localhost:3000/dashboard?tab=settings#section',
      cssSelector: '[data-testid="submit-btn"]',
      cssSelectorConfidence: 'data-attr',
      xpath: '//form[@id="login-form"]//button[@type="submit"]',
      htmlSnapshot: '<button data-testid="submit-btn">Submit</button>',
      userComment: 'Change color to blue',
      sequenceIndex: 1,
      createdAt: Date.now(),
    };

    expect(annotation.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(annotation.cssSelectorConfidence).toBe('data-attr');
  });

  it('should accept V2 reserved fields as optional', () => {
    const annotation: FixItAnnotation = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      url: 'http://localhost:3000/dashboard',
      fullUrl: 'http://localhost:3000/dashboard',
      cssSelector: '#login-form',
      cssSelectorConfidence: 'id',
      xpath: '//form[@id="login-form"]',
      htmlSnapshot: '<form id="login-form"></form>',
      userComment: 'Fix alignment',
      sequenceIndex: 2,
      createdAt: Date.now(),
      aiRefinedComment: 'Adjust the alignment of the login form',
      visualDiff: [{ property: 'margin', from: '0', to: '16px' }],
    };

    expect(annotation.aiRefinedComment).toBe('Adjust the alignment of the login form');
    expect(annotation.visualDiff).toHaveLength(1);
  });
});

describe('CssSelectorConfidence type', () => {
  it('should accept all 6 confidence levels', () => {
    const levels: CssSelectorConfidence[] = [
      'data-attr',
      'id',
      'aria',
      'name',
      'semantic-class',
      'structural',
    ];

    expect(levels).toHaveLength(6);
  });
});

describe('Message type shape', () => {
  it('should accept a message with payload', () => {
    const msg: Message<FixItAnnotation> = {
      type: MessageType.ADD_ANNOTATION,
      payload: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        url: 'http://localhost:3000',
        fullUrl: 'http://localhost:3000',
        cssSelector: '.btn',
        cssSelectorConfidence: 'semantic-class',
        xpath: '//button[@class="btn"]',
        htmlSnapshot: '<button class="btn">Click</button>',
        userComment: 'Make it bigger',
        sequenceIndex: 1,
        createdAt: Date.now(),
      },
      tabId: 42,
    };

    expect(msg.type).toBe(MessageType.ADD_ANNOTATION);
    expect(msg.tabId).toBe(42);
  });

  it('should accept a message without payload', () => {
    const msg: Message = {
      type: MessageType.GET_ANNOTATIONS,
    };

    expect(msg.type).toBe(MessageType.GET_ANNOTATIONS);
    expect(msg.payload).toBeUndefined();
  });
});
