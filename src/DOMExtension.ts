// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
/*
 * Copyright (C) 2007 Apple Inc.  All rights reserved.
 * Copyright (C) 2012 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * Contains diff method based on Javascript Diff Algorithm By John Resig
 * http://ejohn.org/files/jsdiff.js (released under the MIT license).
 */
export {};

interface AnchorBox {
  x: number;
  y: number;
  width: number;
  height: number;

  contains(x: number, y: number): boolean;
  relativeTo(box: AnchorBox): AnchorBox;
  relativeToElement(element: HTMLElement): AnchorBox;
  equals(anchorBox: AnchorBox | null): boolean;
}

declare global {
  interface Node {
    traverseNextTextNode(stayWithin: Node): Node | null;
    enclosingNodeOrSelfWithClass(className: string, stayWithin: Node | null): Node | null;
    enclosingNodeOrSelfWithClassList(classNames: string[], stayWithin: Node | null): Node | null;
    parentElementOrShadowHost(): HTMLElement | null;
    parentNodeOrShadowHost(): Node | null;
    getComponentSelection(): Selection | null;
    hasSelection(): boolean;
    window(): Window;
    removeChildren(): void;
    deepTextContent(): string;
    childTextNodes(): Node[];
    isAncestor(node: Node | null): boolean;
    isDescendant(descendant: Node | null): boolean;
    isSelfOrAncestor(node: Node | null): boolean;
    isSelfOrDescendant(node: Node | null): boolean;
    traverseNextNode(stayWithin: Node | null, skipShadowRoot?: boolean): Node | null;
    traversePreviousNode(stayWithin?: Node): Node | null;
    setTextContentTruncatedIfNeeded(text: string | Node, placeholder?: string): boolean;
    getComponentRoot(): Document | DocumentFragment | null;
  }

  interface HTMLElement {
    positionAt(x: number | undefined, y: number | undefined, relativeTo?: HTMLElement): void;
    removeChildren(): void;
    createChild(elementName: string, className?: string, customElementType?: string): HTMLElement;
    boxInWindow(targetWindow?: Window | null): AnchorBox;
    hasFocus(): boolean;

    // appendChild(child: Node | null): Node;
    // insertBefore(child: Node | null, anchor: Node | null): Node;
    // removeChild(child: Node | null): Node;
    // removeChildren(): void;
  }

  interface Document {
    // createElement(tagName: string, customElementType?: string): HTMLElement;
    createTextNode(data: string | number): Text;
    createDocumentFragment(): DocumentFragment;
    AnchorBox: AnchorBox;
    onInvokeElement(element: HTMLElement, callback: (arg0: Event) => void): void;
  }

  interface DocumentFragment {
    createChild(elementName: string, className?: string, customElementType?: string): HTMLElement;
  }

  interface Event {
    consume(preventDefault?: boolean): void;
  }
}

// from Platform.StringUtilities
const trimMiddle = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) {
    return String(str);
  }
  let leftHalf = maxLength >> 1;
  let rightHalf = maxLength - leftHalf - 1;
  if ((str.codePointAt(str.length - rightHalf - 1) as number) >= 0x10000) {
    --rightHalf;
    ++leftHalf;
  }
  if (leftHalf > 0 && (str.codePointAt(leftHalf - 1) as number) >= 0x10000) {
    --leftHalf;
  }
  return str.substr(0, leftHalf) + '…' + str.substr(str.length - rightHalf, rightHalf);
};

// from Platform.KeyboardUtilities
function isEnterOrSpaceKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ';
}


Node.prototype.traverseNextTextNode = function (stayWithin: Node): Node | null {
  let node = this.traverseNextNode(stayWithin);
  if (!node) {
    return null;
  }
  const nonTextTags: { [key: string]: number } = {'STYLE': 1, 'SCRIPT': 1, '#document-fragment': 1};
  while (node && (node.nodeType !== Node.TEXT_NODE || nonTextTags[node.parentNode ? node.parentNode.nodeName : ''])) {
    node = node.traverseNextNode(stayWithin);
  }

  return node;
};

HTMLElement.prototype.positionAt = function (x: number | undefined, y: number | undefined, relativeTo?: HTMLElement): void {
  let shift: AnchorBox | {
    x: number, y: number,
  } = {x: 0, y: 0};
  if (relativeTo) {
    shift = relativeTo.boxInWindow(this.ownerDocument.defaultView);
  }

  if (typeof x === 'number') {
    this.style.setProperty('left', (shift.x + x) + 'px');
  } else {
    this.style.removeProperty('left');
  }

  if (typeof y === 'number') {
    this.style.setProperty('top', (shift.y + y) + 'px');
  } else {
    this.style.removeProperty('top');
  }

  if (typeof x === 'number' || typeof y === 'number') {
    this.style.setProperty('position', 'absolute');
  } else {
    this.style.removeProperty('position');
  }
};

Node.prototype.enclosingNodeOrSelfWithClass = function (className: string, stayWithin: Node | null = null): Node | null {
  return this.enclosingNodeOrSelfWithClassList([className], stayWithin || null);
};

Node.prototype.enclosingNodeOrSelfWithClassList = function (classNames: string[], stayWithin: Node | null): Node | null {
  for (let node: Node | null = this; node && node !== stayWithin && node !== this.ownerDocument; node = node.parentNodeOrShadowHost()) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }
    let containsAll = true;
    for (let i = 0; i < classNames.length && containsAll; ++i) {
      if (!(node as HTMLElement).classList.contains(classNames[i])) {
        containsAll = false;
      }
    }
    if (containsAll) {
      return node as HTMLElement;
    }
  }
  return null;
};

Node.prototype.parentElementOrShadowHost = function (): HTMLElement | null {
  const thisAsShadow: ShadowRoot = this as ShadowRoot;
  if (this.nodeType === Node.DOCUMENT_FRAGMENT_NODE && thisAsShadow?.host) {
    return thisAsShadow.host as HTMLElement;
  }
  const node = this.parentNode;
  if (!node) {
    return null;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node as HTMLElement;
  }
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    return thisAsShadow.host as HTMLElement;
  }
  return null;
};

Node.prototype.parentNodeOrShadowHost = function (): Node | null {
  if (this.parentNode) {
    return this.parentNode;
  }
  const thisAsShadow: ShadowRoot = this as ShadowRoot;
  if (this.nodeType === Node.DOCUMENT_FRAGMENT_NODE && thisAsShadow.host) {
    return thisAsShadow.host;
  }
  return null;
};

Node.prototype.getComponentSelection = function (): Selection | null {
  let parent: ((Node & ParentNode) | null) = this.parentNode;
  while (parent && parent.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    parent = parent.parentNode;
  }
  // @ts-ignore
  return parent instanceof ShadowRoot ? parent.getSelection() : this.window().getSelection();
};

Node.prototype.hasSelection = function (): boolean {
  // TODO(luoe): use contains(node, {includeShadow: true}) when it is fixed for shadow dom.
  if (this instanceof HTMLElement) {
    const slots = this.querySelectorAll('slot');
    for (const slot of slots) {
      if (Array.prototype.some.call(slot.assignedNodes(), node => node.hasSelection())) {
        return true;
      }
    }
  }

  const selection = this.getComponentSelection();
  if (!selection || selection?.type !== 'Range') {
    return false;
  }
  return selection.containsNode(this, true) || selection.anchorNode?.isSelfOrDescendant(this) || selection.focusNode?.isSelfOrDescendant(this) || false;
};

Node.prototype.window = function (): Window {
  return this.ownerDocument?.defaultView as Window;
};

HTMLElement.prototype.removeChildren = function (): void {
  if (this.firstChild) {
    this.textContent = '';
  }
};

// Document.prototype.createElement = function (tagName: string, customElementType?: string): HTMLElement {
//   return document.createElement(tagName, {is: customElementType});
// };

Document.prototype.createTextNode = function (data: string | number): Text {
  return document.createTextNode(data);
};

Document.prototype.createDocumentFragment = function (): DocumentFragment {
  return document.createDocumentFragment();
};

HTMLElement.prototype.createChild = function (elementName: string, className?: string, customElementType?: string): HTMLElement {
  const element = document.createElement(elementName, {is: customElementType});
  if (className) {
    element.className = className;
  }
  this.appendChild(element);
  return element;
};

DocumentFragment.prototype.createChild = HTMLElement.prototype.createChild;

class ClassAnchorBox implements AnchorBox {
  x: number;
  y: number;
  width: number;
  height: number;

  constructor(x?: number, y?: number, width?: number, height?: number) {
    this.x = x || 0;
    this.y = y || 0;
    this.width = width || 0;
    this.height = height || 0;
  }

  contains(x: number, y: number): boolean {
    return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
  }

  relativeTo(box: AnchorBox): AnchorBox {
    return new ClassAnchorBox(this.x - box.x, this.y - box.y, this.width, this.height);
  }

  relativeToElement(element: HTMLElement): AnchorBox {
    return this.relativeTo(element.boxInWindow(element.ownerDocument.defaultView));
  }

  equals(anchorBox: AnchorBox | null): boolean {
    return Boolean(anchorBox) && this.x === anchorBox?.x && this.y === anchorBox.y && this.width === anchorBox.width && this.height === anchorBox.height;
  }
}

// Document.prototype.AnchorBox = ClassAnchorBox;

HTMLElement.prototype.boxInWindow = function (targetWindowIn?: Window | null): AnchorBox {
  const targetWindow = targetWindowIn || this.ownerDocument.defaultView;

  const anchorBox = new ClassAnchorBox();
  let curElement: HTMLElement | null = this;
  let curWindow: Window | ((Window & typeof globalThis) | null) = this.ownerDocument.defaultView;
  while (curWindow && curElement) {
    anchorBox.x += curElement.getBoundingClientRect().left;
    anchorBox.y += curElement.getBoundingClientRect().top;
    if (curWindow === targetWindow) {
      break;
    }
    curElement = curWindow.frameElement as HTMLElement;
    curWindow = curWindow.parent;
  }

  const widthDelta = targetWindow?.innerWidth ? targetWindow.innerWidth - anchorBox.x : 0;
  const heightDelta = targetWindow?.innerHeight ? targetWindow.innerHeight - anchorBox.y : 0;
  anchorBox.width = Math.min(this.offsetWidth, widthDelta);
  anchorBox.height = Math.min(this.offsetHeight, heightDelta);
  return anchorBox;
};

Event.prototype.consume = function (preventDefault?: boolean): void {
  this.stopImmediatePropagation();
  if (preventDefault) {
    this.preventDefault();
  }
  // this.handled = true;
};

Node.prototype.deepTextContent = function (): string {
  return this.childTextNodes()
             .map(function (node) {
               return node.textContent;
             })
             .join('');
};

Node.prototype.childTextNodes = function (): Node[] {
  let node = this.traverseNextTextNode(this);
  const result = [];
  const nonTextTags: { [key: string]: number } = {'STYLE': 1, 'SCRIPT': 1, '#document-fragment': 1};
  while (node) {
    if (!nonTextTags[node.parentNode ? node.parentNode.nodeName : '']) {
      result.push(node);
    }
    node = node.traverseNextTextNode(this);
  }
  return result;
};

Node.prototype.isAncestor = function (node: Node | null): boolean {
  if (!node) {
    return false;
  }

  let currentNode = node.parentNodeOrShadowHost();
  while (currentNode) {
    if (this === currentNode) {
      return true;
    }
    currentNode = currentNode.parentNodeOrShadowHost();
  }
  return false;
};

Node.prototype.isDescendant = function (descendant: Node | null): boolean {
  return Boolean(descendant) && descendant?.isAncestor(this) || false;
};

Node.prototype.isSelfOrAncestor = function (node: Node | null): boolean {
  return Boolean(node) && (node === this || this.isAncestor(node));
};

Node.prototype.isSelfOrDescendant = function (node: Node | null): boolean {
  return Boolean(node) && (node === this || this.isDescendant(node));
};

Node.prototype.traverseNextNode = function (stayWithin: Node | null = null, skipShadowRoot: boolean = false): Node | null {
  if (!stayWithin) {
    return null;
  }

  if (!skipShadowRoot && (stayWithin instanceof Element) && stayWithin.shadowRoot) {
    return stayWithin.shadowRoot;
  }

  const distributedNodes = this instanceof HTMLSlotElement ? this.assignedNodes() : [];

  if (distributedNodes.length) {
    return distributedNodes[0];
  }

  if (this.firstChild) {
    return this.firstChild;
  }

  function nextSibling(node: Node): Node | null {
    if (!(node as Element).assignedSlot) {  // check instanceof Element?
      return node.nextSibling;
    }
    const distributedNodes = (node as Element).assignedSlot?.assignedNodes() || [];

    const position = Array.prototype.indexOf.call(distributedNodes, node);
    if (position + 1 < distributedNodes.length) {
      return distributedNodes[position + 1];
    }
    return null;
  }

  let node: Node | null = this;
  while (node) {
    if (stayWithin && node === stayWithin) {
      return null;
    }

    const sibling = nextSibling(node);
    if (sibling) {
      return sibling;
    }

    node = ((node instanceof HTMLElement) ? (this as HTMLElement).assignedSlot : null) || node.parentNodeOrShadowHost();
  }
  return null;
};

Node.prototype.traversePreviousNode = function (stayWithin?: Node): Node | null {
  if (stayWithin && this === stayWithin) {
    return null;
  }
  let node: ChildNode | (ChildNode | null) = this.previousSibling;
  while (node && node.lastChild) {
    node = node.lastChild;
  }
  if (node) {
    return node;
  }
  return this.parentNodeOrShadowHost();
};

Node.prototype.setTextContentTruncatedIfNeeded = function (text: string | Node, placeholder?: string): boolean {
  // Huge texts in the UI reduce rendering performance drastically.
  // Moreover, Blink/WebKit uses <unsigned short> internally for storing text content
  // length, so texts longer than 65535 are inherently displayed incorrectly.
  const maxTextContentLength = 10000;

  if (typeof text === 'string' && text.length > maxTextContentLength) {
    this.textContent = typeof placeholder === 'string' ? placeholder : trimMiddle(text, maxTextContentLength);
    return true;
  }

  this.textContent = String(text);
  return false;
};

HTMLElement.prototype.hasFocus = function (): boolean {
  const root: DocumentOrShadowRoot | null = this.getComponentRoot() as DocumentOrShadowRoot;
  return Boolean(root) && this.isSelfOrAncestor(root?.activeElement);
};
Node.prototype.getComponentRoot = function (): Document | DocumentFragment | null {
  let node: ((Node & ParentNode) | null) | Node = this;
  while (node && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE) {
    node = node.parentNode;
  }
  return node as Document | DocumentFragment | null;
};

Document.prototype.onInvokeElement = function (element: HTMLElement, callback: (arg0: Event) => void): void {
  element.addEventListener('keydown', event => {
    if (isEnterOrSpaceKey(event)) {
      callback(event);
    }
  });
  element.addEventListener('click', event => callback(event));
};

//
// // DevTools front-end still assumes that
// //   classList.toggle('a', undefined) works as
// //   classList.toggle('a', false) rather than as
// //   classList.toggle('a');
// (function (): void {
//   const originalToggle = DOMTokenList.prototype.toggle;
//   DOMTokenList.prototype['toggle'] = function (token: string, force: boolean | undefined): boolean {
//     if (arguments.length === 1) {
//       force = !this.contains(token);
//     }
//     return originalToggle.call(this, token, Boolean(force));
//   };
// })();
// //

// export const originalAppendChild = HTMLElement.prototype.appendChild;
// export const originalInsertBefore = HTMLElement.prototype.insertBefore;
// export const originalRemoveChild = HTMLElement.prototype.removeChild;
// export const originalRemoveChildren = HTMLElement.prototype.removeChildren;
//
// HTMLElement.prototype.appendChild = function (child: Node | null): Node {
//   // @ts-ignore
//   if (child?.__widget && child.parentElement !== this) {
//     throw new Error('Attempt to add widget via regular DOM operation.');
//   }
//   return originalAppendChild.call(this, child);
// };
//
// HTMLElement.prototype.insertBefore = function (child: Node | null, anchor: Node | null): Node {
//   if (child.__widget && child.parentElement !== this) {
//     throw new Error('Attempt to add widget via regular DOM operation.');
//   }
//   return originalInsertBefore.call(this, child, anchor);
// };
//
// HTMLElement.prototype.removeChild = function (child: Node | null): Node {
//   if (child.__widgetCounter || child.__widget) {
//     throw new Error('Attempt to remove element containing widget via regular DOM operation');
//   }
//   return originalRemoveChild.call(this, child);
// };
//
// HTMLElement.prototype.removeChildren = function (): void {
//   if (this.__widgetCounter) {
//     throw new Error('Attempt to remove element containing widget via regular DOM operation');
//   }
//   originalRemoveChildren.call(this);
// };
