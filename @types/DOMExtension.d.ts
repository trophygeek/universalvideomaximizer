
/*
  Video Maximizer

 Copyright (c) 2024. trophygeek@gmail.com
 www.videomaximizer.com

  Removes the clutter. Maximizes videos to view in full-page theater mode on most sites.

  Creative Commons Share Alike 4.0
  To view a copy of this license, visit https://creativecommons.org/licenses/by-sa/4.0/


 */

// Augmentations for the global scope can only be directly nested
// in external modules or ambient module declarations.
export {}

declare global {
  export interface AnchorBox {
    x: number;
    y: number;
    width: number;
    height: number;

    contains(x: number, y: number): boolean;
    relativeTo(box: AnchorBox): AnchorBox;
    relativeToElement(element: HTMLElement): AnchorBox;
    equals(anchorBox: AnchorBox | null): boolean;
  }

  export interface Node {
    traverseNextTextNode(stayWithin: Node): Node | null;
    enclosingNodeOrSelfWithClass(
        className: string,
        stayWithin: Node | null
    ): Node | null;
    enclosingNodeOrSelfWithClassList(
        classNames: string[],
        stayWithin: Node | null
    ): Node | null;
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
    traverseNextNode(
        stayWithin: Node | null,
        skipShadowRoot?: boolean
    ): Node | null;
    traversePreviousNode(stayWithin?: Node): Node | null;
    setTextContentTruncatedIfNeeded(
        text: string | Node,
        placeholder?: string
    ): boolean;
    getComponentRoot(): Document | DocumentFragment | null;
  }

  export interface HTMLElement {
    positionAt(
        x: number | undefined,
        y: number | undefined,
        relativeTo?: HTMLElement
    ): void;
    removeChildren(): void;
    createChild(
        elementName: string,
        className?: string,
        customElementType?: string
    ): HTMLElement;
    boxInWindow(targetWindow?: Window | null): AnchorBox;
    hasFocus(): boolean;

    // appendChild(child: Node | null): Node;
    // insertBefore(child: Node | null, anchor: Node | null): Node;
    // removeChild(child: Node | null): Node;
    // removeChildren(): void;
  }

  export interface Document {
    // createElement(tagName: string, customElementType?: string): HTMLElement;
    createTextNode(data: string | number): Text;
    createDocumentFragment(): DocumentFragment;
    AnchorBox: AnchorBox;
    onInvokeElement(
        element: HTMLElement,
        callback: (arg0: Event) => void
    ): void;
  }

  export interface DocumentFragment {
    createChild(
        elementName: string,
        className?: string,
        customElementType?: string
    ): HTMLElement;
  }

  export interface Event {
    consume(preventDefault?: boolean): void;
  }
}
