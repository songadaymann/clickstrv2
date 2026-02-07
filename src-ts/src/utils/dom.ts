/**
 * DOM utility functions
 */

/**
 * Get an element by ID with type safety
 * Throws if element not found
 */
export function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element not found: #${id}`);
  }
  return element as T;
}

/**
 * Get an element by ID, returning null if not found
 */
export function getElementOrNull<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Query selector with type safety
 */
export function querySelector<T extends Element>(selector: string, parent: ParentNode = document): T | null {
  return parent.querySelector(selector) as T | null;
}

/**
 * Query all elements matching a selector
 */
export function querySelectorAll<T extends Element>(selector: string, parent: ParentNode = document): T[] {
  return Array.from(parent.querySelectorAll(selector)) as T[];
}

/**
 * Add a class to an element
 */
export function addClass(element: Element, ...classes: string[]): void {
  element.classList.add(...classes);
}

/**
 * Remove a class from an element
 */
export function removeClass(element: Element, ...classes: string[]): void {
  element.classList.remove(...classes);
}

/**
 * Toggle a class on an element
 */
export function toggleClass(element: Element, className: string, force?: boolean): void {
  element.classList.toggle(className, force);
}

/**
 * Check if an element has a class
 */
export function hasClass(element: Element, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * Set text content of an element
 */
export function setText(element: Element, text: string): void {
  element.textContent = text;
}

/**
 * Set HTML content of an element
 */
export function setHtml(element: Element, html: string): void {
  element.innerHTML = html;
}

/**
 * Show an element (remove display: none)
 */
export function show(element: HTMLElement, display = 'block'): void {
  element.style.display = display;
}

/**
 * Hide an element (set display: none)
 */
export function hide(element: HTMLElement): void {
  element.style.display = 'none';
}

/**
 * Add event listener with automatic cleanup
 */
export function addListener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  type: K,
  listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  element.addEventListener(type, listener, options);
  return () => element.removeEventListener(type, listener, options);
}

/**
 * Create an element with optional attributes and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  children?: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value);
    }
  }

  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }

  return element;
}
