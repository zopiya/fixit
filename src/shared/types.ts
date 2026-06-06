export type CssSelectorConfidence =
  | 'data-attr'
  | 'id'
  | 'aria'
  | 'name'
  | 'semantic-class'
  | 'structural';

export interface FixItAnnotation {
  id: string;
  url: string;
  fullUrl: string;
  cssSelector: string;
  cssSelectorConfidence: CssSelectorConfidence;
  xpath: string;
  htmlSnapshot: string;
  userComment: string;
  sequenceIndex: number;
  createdAt: number;
  aiRefinedComment?: string;
  visualDiff?: { property: string; from: string; to: string }[];
}

export enum MessageType {
  ADD_ANNOTATION = 'ADD_ANNOTATION',
  UPDATE_ANNOTATION = 'UPDATE_ANNOTATION',
  DELETE_ANNOTATION = 'DELETE_ANNOTATION',
  ANNOTATIONS_UPDATED = 'ANNOTATIONS_UPDATED',
  GET_ANNOTATIONS = 'GET_ANNOTATIONS',
  CLEAR_ALL = 'CLEAR_ALL',
  TOGGLE_ANNOTATION = 'TOGGLE_ANNOTATION',
  HIGHLIGHT = 'HIGHLIGHT',
}

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
  tabId?: number;
}
