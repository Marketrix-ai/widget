/**
 * Development-only service for testing DOM mismatch detection and recovery.
 * This service provides methods to simulate DOM changes and agent commands.
 */

import { domService, type ElementFingerprint, type ValidationResult } from './DomService';
import { toolExecutionService } from './ToolService';

export interface TestResult {
  command: string;
  index: number;
  validation: ValidationResult;
  outcome: 'executed' | 'recovered' | 'failed';
  details: string;
  timestamp: Date;
}

export interface ValidationLogEntry {
  timestamp: Date;
  action: string;
  originalIndex: number;
  validation: ValidationResult;
  recoveryAction?: string;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  steps: TestResult[];
  passed: boolean;
  summary: string;
}

class DevTestService {
  private static instance: DevTestService;
  private validationLog: ValidationLogEntry[] = [];
  private lastTestResult: TestResult | null = null;

  private constructor() {}

  static getInstance(): DevTestService {
    if (!DevTestService.instance) {
      DevTestService.instance = new DevTestService();
    }
    return DevTestService.instance;
  }

  // ============================================================
  // Category 1: Index Shift Simulations
  // ============================================================

  /**
   * Insert a new interactable element before the element at the given index
   * This will shift all subsequent indices
   */
  insertElementBefore(index: number, count: number = 1): HTMLElement[] {
    const elements = domService.getAllFingerprints();
    const targetEntry = elements.find(([idx]) => idx === index);

    if (!targetEntry) {
      console.warn(`[DevTestService] No element at index ${index}`);
      return [];
    }

    const targetElement = domService.getElementByIndex(index);
    if (!targetElement) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return [];
    }

    const insertedElements: HTMLElement[] = [];

    for (let i = 0; i < count; i++) {
      const newButton = document.createElement('button');
      newButton.textContent = `Inserted Button ${i + 1}`;
      newButton.setAttribute('data-test-inserted', 'true');
      newButton.style.cssText =
        'padding: 8px 16px; margin: 4px; background: #ff6b6b; color: white; border: none; border-radius: 4px;';

      targetElement.parentElement?.insertBefore(newButton, targetElement);
      insertedElements.push(newButton);
    }

    console.log(`[DevTestService] Inserted ${count} element(s) before index ${index}`);
    return insertedElements;
  }

  /**
   * Insert a new interactable element after the element at the given index
   */
  insertElementAfter(index: number): HTMLElement | null {
    const targetElement = domService.getElementByIndex(index);
    if (!targetElement) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return null;
    }

    const newButton = document.createElement('button');
    newButton.textContent = 'Inserted Button (After)';
    newButton.setAttribute('data-test-inserted', 'true');
    newButton.style.cssText =
      'padding: 8px 16px; margin: 4px; background: #ff6b6b; color: white; border: none; border-radius: 4px;';

    targetElement.parentElement?.insertBefore(newButton, targetElement.nextSibling);

    console.log(`[DevTestService] Inserted element after index ${index}`);
    return newButton;
  }

  /**
   * Remove the element at the given index
   */
  removeElement(index: number): boolean {
    const targetElement = domService.getElementByIndex(index);
    if (!targetElement) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return false;
    }

    targetElement.remove();
    console.log(`[DevTestService] Removed element at index ${index}`);
    return true;
  }

  /**
   * Remove multiple elements by their indices
   */
  removeMultipleElements(indices: number[]): number {
    let removed = 0;
    // Sort indices in descending order to avoid index shifting during removal
    const sortedIndices = [...indices].sort((a, b) => b - a);

    for (const index of sortedIndices) {
      if (this.removeElement(index)) {
        removed++;
      }
    }

    return removed;
  }

  // ============================================================
  // Category 2: SPA Re-render Simulations
  // ============================================================

  /**
   * Simulate a component re-render by replacing the element with a new one
   * This creates a new DOM node with the same attributes
   */
  simulateRerender(index: number): HTMLElement | null {
    const targetElement = domService.getElementByIndex(index);
    if (!targetElement) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return null;
    }

    // Clone the element (creates new DOM node)
    const newElement = targetElement.cloneNode(true) as HTMLElement;
    newElement.setAttribute('data-test-rerendered', 'true');

    // Replace the original element
    targetElement.parentElement?.replaceChild(newElement, targetElement);

    console.log(`[DevTestService] Simulated re-render of element at index ${index}`);
    return newElement;
  }

  /**
   * Simulate a state change that re-renders a container
   */
  simulateStateChange(containerSelector: string = 'body'): number {
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.warn(`[DevTestService] Container not found: ${containerSelector}`);
      return 0;
    }

    // Get all interactable elements in the container
    const buttons = container.querySelectorAll('button, a, input, select');
    let replaced = 0;

    buttons.forEach(element => {
      if (element instanceof HTMLElement) {
        const newElement = element.cloneNode(true) as HTMLElement;
        newElement.setAttribute('data-test-state-changed', 'true');
        element.parentElement?.replaceChild(newElement, element);
        replaced++;
      }
    });

    console.log(`[DevTestService] Simulated state change, replaced ${replaced} elements`);
    return replaced;
  }

  /**
   * Simulate navigation by replacing page content
   */
  simulateNavigation(): void {
    const main = document.querySelector('main') || document.body;

    // Store original content
    const originalContent = main.innerHTML;

    // Replace with new content
    main.innerHTML = `
      <div data-test-navigated="true" style="padding: 20px;">
        <h1>Navigated Page</h1>
        <p>This simulates a SPA navigation event.</p>
        <button id="nav-btn-1">Navigation Button 1</button>
        <button id="nav-btn-2">Navigation Button 2</button>
        <input type="text" placeholder="Navigation Input" />
        <button onclick="this.closest('[data-test-navigated]').outerHTML='${originalContent.replace(/'/g, "\\'")}'" style="margin-top: 20px;">
          Restore Original
        </button>
      </div>
    `;

    console.log('[DevTestService] Simulated navigation');
  }

  /**
   * Reorder elements in a list container
   */
  reorderList(containerSelector: string): number {
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.warn(`[DevTestService] Container not found: ${containerSelector}`);
      return 0;
    }

    const children = Array.from(container.children);
    if (children.length < 2) {
      console.warn('[DevTestService] Not enough children to reorder');
      return 0;
    }

    // Shuffle children
    for (let i = children.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [children[i], children[j]] = [children[j], children[i]];
    }

    // Re-append in new order
    children.forEach(child => container.appendChild(child));

    console.log(`[DevTestService] Reordered ${children.length} elements`);
    return children.length;
  }

  // ============================================================
  // Category 3: Lazy Loading Simulations
  // ============================================================

  /**
   * Inject content after a delay
   */
  async injectDelayedContent(delayMs: number = 2000): Promise<HTMLElement[]> {
    return new Promise(resolve => {
      setTimeout(() => {
        const container = document.createElement('div');
        container.setAttribute('data-test-delayed', 'true');
        container.style.cssText = 'padding: 10px; background: #e8f5e9; margin: 10px 0; border-radius: 4px;';
        container.innerHTML = `
          <p>Delayed content loaded!</p>
          <button id="delayed-btn-1">Delayed Button 1</button>
          <button id="delayed-btn-2">Delayed Button 2</button>
          <input type="text" placeholder="Delayed Input" />
        `;

        document.body.appendChild(container);
        const elements = Array.from(container.querySelectorAll('button, input')) as HTMLElement[];

        console.log(`[DevTestService] Injected delayed content after ${delayMs}ms`);
        resolve(elements);
      }, delayMs);
    });
  }

  /**
   * Simulate infinite scroll by adding elements at the end
   */
  simulateInfiniteScroll(count: number = 5): HTMLElement[] {
    const container = document.createElement('div');
    container.setAttribute('data-test-infinite-scroll', 'true');
    container.style.cssText = 'padding: 10px; background: #fff3e0; margin: 10px 0; border-radius: 4px;';

    const elements: HTMLElement[] = [];

    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      item.innerHTML = `
        <span>Scroll Item ${i + 1}</span>
        <button>Action ${i + 1}</button>
      `;
      container.appendChild(item);
      elements.push(item.querySelector('button') as HTMLElement);
    }

    document.body.appendChild(container);
    console.log(`[DevTestService] Added ${count} infinite scroll items`);
    return elements;
  }

  /**
   * Replace a skeleton loader with real content
   */
  replaceSkeleton(skeletonIndex: number): HTMLElement | null {
    const skeleton = domService.getElementByIndex(skeletonIndex);
    if (!skeleton) {
      console.warn(`[DevTestService] No skeleton at index ${skeletonIndex}`);
      return null;
    }

    const realContent = document.createElement('div');
    realContent.setAttribute('data-test-skeleton-replaced', 'true');
    realContent.innerHTML = `
      <button>Real Content Button</button>
      <input type="text" placeholder="Real Input" />
    `;

    skeleton.parentElement?.replaceChild(realContent, skeleton);
    console.log(`[DevTestService] Replaced skeleton at index ${skeletonIndex}`);
    return realContent.querySelector('button') as HTMLElement;
  }

  // ============================================================
  // Category 4: Selector Fragility Simulations
  // ============================================================

  /**
   * Insert a sibling of the same type to break nth-of-type selectors
   */
  insertSameSibling(index: number): HTMLElement | null {
    const targetElement = domService.getElementByIndex(index);
    if (!targetElement) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return null;
    }

    const newElement = document.createElement(targetElement.tagName.toLowerCase());
    newElement.textContent = 'Same Type Sibling';
    newElement.setAttribute('data-test-same-sibling', 'true');
    if (targetElement.tagName === 'BUTTON') {
      (newElement as HTMLButtonElement).style.cssText = 'padding: 8px 16px; margin: 4px;';
    }

    targetElement.parentElement?.insertBefore(newElement, targetElement);
    console.log(`[DevTestService] Inserted same-type sibling before index ${index}`);
    return newElement as HTMLElement;
  }

  /**
   * Change the class name of an element
   */
  changeClassName(index: number, newClass: string): boolean {
    const element = domService.getElementByIndex(index);
    if (!element) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return false;
    }

    element.className = newClass;
    element.setAttribute('data-test-class-changed', 'true');
    console.log(`[DevTestService] Changed class of element at index ${index} to "${newClass}"`);
    return true;
  }

  /**
   * Wrap an element in a new parent div, changing its DOM path
   */
  wrapInParent(index: number): HTMLElement | null {
    const element = domService.getElementByIndex(index);
    if (!element) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return null;
    }

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-test-wrapper', 'true');
    wrapper.style.cssText = 'padding: 10px; border: 2px dashed #9c27b0; margin: 5px;';

    element.parentElement?.insertBefore(wrapper, element);
    wrapper.appendChild(element);

    console.log(`[DevTestService] Wrapped element at index ${index} in new parent`);
    return wrapper;
  }

  /**
   * Add a duplicate ID to cause selector ambiguity
   */
  addDuplicateId(index: number): HTMLElement | null {
    const element = domService.getElementByIndex(index);
    if (!element?.id) {
      console.warn(`[DevTestService] Element at index ${index} has no ID`);
      return null;
    }

    const duplicate = document.createElement('div');
    duplicate.id = element.id; // Same ID!
    duplicate.textContent = `Duplicate ID: ${element.id}`;
    duplicate.setAttribute('data-test-duplicate-id', 'true');
    duplicate.style.cssText = 'padding: 10px; background: #ffcdd2; margin: 5px;';

    document.body.insertBefore(duplicate, document.body.firstChild);
    console.log(`[DevTestService] Added duplicate ID "${element.id}"`);
    return duplicate;
  }

  // ============================================================
  // Category 5: Hidden Elements Simulations
  // ============================================================

  /**
   * Create and show a modal with buttons
   */
  showModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.setAttribute('data-test-modal', 'true');
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
    `;
    modal.innerHTML = `
      <h3>Test Modal</h3>
      <p>These buttons were not indexed initially.</p>
      <button id="modal-btn-1">Modal Button 1</button>
      <button id="modal-btn-2">Modal Button 2</button>
      <button onclick="this.closest('[data-test-modal]').remove()" style="margin-top: 10px;">Close Modal</button>
    `;

    document.body.appendChild(modal);
    console.log('[DevTestService] Showed modal with buttons');
    return modal;
  }

  /**
   * Expand a dropdown to show options
   */
  expandDropdown(index: number): HTMLElement | null {
    const element = domService.getElementByIndex(index);
    if (!element) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return null;
    }

    const dropdown = document.createElement('div');
    dropdown.setAttribute('data-test-dropdown', 'true');
    dropdown.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
    `;
    dropdown.innerHTML = `
      <button style="display: block; width: 100%; padding: 8px; border: none; background: none; cursor: pointer;">Option 1</button>
      <button style="display: block; width: 100%; padding: 8px; border: none; background: none; cursor: pointer;">Option 2</button>
      <button style="display: block; width: 100%; padding: 8px; border: none; background: none; cursor: pointer;">Option 3</button>
    `;

    element.parentElement?.appendChild(dropdown);
    console.log(`[DevTestService] Expanded dropdown at index ${index}`);
    return dropdown;
  }

  // ============================================================
  // Category 6: Race Condition Simulations
  // ============================================================

  /**
   * Perform rapid DOM changes
   */
  rapidFireChanges(count: number = 5): void {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const btn = document.createElement('button');
        btn.textContent = `Rapid ${i + 1}`;
        btn.setAttribute('data-test-rapid', 'true');
        document.body.appendChild(btn);

        setTimeout(() => btn.remove(), 100);
      }, i * 50);
    }

    console.log(`[DevTestService] Started ${count} rapid changes`);
  }

  // ============================================================
  // Category 7: iFrame & Shadow DOM Simulations
  // ============================================================

  /**
   * Create an iframe with a button inside
   */
  createIframeWithButton(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-test-iframe', 'true');
    iframe.style.cssText = 'width: 300px; height: 100px; border: 2px solid #2196f3;';

    document.body.appendChild(iframe);

    // Write content to iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.body.innerHTML = `
        <button id="iframe-button" style="padding: 10px; margin: 10px;">
          Button Inside iFrame
        </button>
      `;
    }

    console.log('[DevTestService] Created iframe with button');
    return iframe;
  }

  /**
   * Create a custom element with Shadow DOM
   */
  createShadowDomElement(): HTMLElement {
    // Define custom element if not already defined
    if (!window.customElements.get('test-shadow-host')) {
      window.customElements.define(
        'test-shadow-host',
        class extends HTMLElement {
          constructor() {
            super();
            const shadow = this.attachShadow({ mode: 'open' });
            shadow.innerHTML = `
            <style>
              button { padding: 10px; background: #9c27b0; color: white; border: none; border-radius: 4px; }
            </style>
            <div>
              <button id="shadow-button">Button in Shadow DOM</button>
            </div>
          `;
          }
        },
      );
    }

    const host = document.createElement('test-shadow-host');
    host.setAttribute('data-test-shadow', 'true');
    document.body.appendChild(host);

    console.log('[DevTestService] Created Shadow DOM element');
    return host;
  }

  // ============================================================
  // Change Element Content
  // ============================================================

  /**
   * Change the text content of an element
   */
  changeElementContent(index: number, newText: string): boolean {
    const element = domService.getElementByIndex(index);
    if (!element) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return false;
    }

    element.textContent = newText;
    element.setAttribute('data-test-content-changed', 'true');
    console.log(`[DevTestService] Changed content of element at index ${index} to "${newText}"`);
    return true;
  }

  /**
   * Hide an element (make it non-interactable)
   */
  hideElement(index: number): boolean {
    const element = domService.getElementByIndex(index);
    if (!element) {
      console.warn(`[DevTestService] Could not find element at index ${index}`);
      return false;
    }

    element.style.display = 'none';
    element.setAttribute('data-test-hidden', 'true');
    console.log(`[DevTestService] Hid element at index ${index}`);
    return true;
  }

  // ============================================================
  // Test Execution
  // ============================================================

  /**
   * Simulate an agent command and track the result
   */
  async simulateAgentCommand(tool: string, args: Record<string, unknown>): Promise<TestResult> {
    const index = args.index as number;

    // Execute the tool
    const result = await toolExecutionService.executeTool(tool, args, 'do', '');

    // Get validation info
    const { validation } = domService.getValidatedElement(index);

    let outcome: 'executed' | 'recovered' | 'failed';
    let details: string;

    if (result.success) {
      if (result.recoveryInfo) {
        outcome = 'recovered';
        details = `Recovered from index ${result.recoveryInfo.originalIndex} to ${result.recoveryInfo.recoveredIndex}`;
      } else {
        outcome = 'executed';
        details = result.result;
      }
    } else {
      outcome = 'failed';
      details = result.error || 'Unknown error';
    }

    const testResult: TestResult = {
      command: tool,
      index,
      validation,
      outcome,
      details,
      timestamp: new Date(),
    };

    this.lastTestResult = testResult;
    this.addToLog({
      timestamp: new Date(),
      action: `${tool} on index ${index}`,
      originalIndex: index,
      validation,
      recoveryAction: outcome === 'recovered' ? details : undefined,
    });

    return testResult;
  }

  /**
   * Run a predefined test scenario
   */
  async runScenario(scenarioId: string): Promise<ScenarioResult> {
    const scenarios: Record<string, () => Promise<ScenarioResult>> = {
      'index-shift-insert': async () => this.runIndexShiftInsertScenario(),
      'index-shift-remove': async () => this.runIndexShiftRemoveScenario(),
      'element-content-change': async () => this.runContentChangeScenario(),
      'spa-rerender': async () => this.runSpaRerenderScenario(),
    };

    const scenarioFn = scenarios[scenarioId];
    if (!scenarioFn) {
      return {
        scenarioId,
        scenarioName: 'Unknown',
        steps: [],
        passed: false,
        summary: `Unknown scenario: ${scenarioId}`,
      };
    }

    return scenarioFn();
  }

  private async runIndexShiftInsertScenario(): Promise<ScenarioResult> {
    const steps: TestResult[] = [];

    // Step 1: Index the DOM
    domService.indexInteractableElements();

    // Step 2: Get a target index (e.g., 3)
    const targetIndex = 3;
    const fingerprint = domService.getFingerprint(targetIndex);

    if (!fingerprint) {
      return {
        scenarioId: 'index-shift-insert',
        scenarioName: 'Index Shift - Insert',
        steps: [],
        passed: false,
        summary: 'No element at target index',
      };
    }

    // Step 3: Insert element before target
    this.insertElementBefore(targetIndex, 2);

    // Step 4: Try to click the original target
    const result = await this.simulateAgentCommand('click_element', { index: targetIndex });
    steps.push(result);

    return {
      scenarioId: 'index-shift-insert',
      scenarioName: 'Index Shift - Insert',
      steps,
      passed: result.outcome !== 'failed',
      summary:
        result.outcome === 'recovered'
          ? 'Successfully recovered element after index shift'
          : result.outcome === 'executed'
            ? 'Element found at original index (unexpected)'
            : 'Failed to recover element',
    };
  }

  private async runIndexShiftRemoveScenario(): Promise<ScenarioResult> {
    const steps: TestResult[] = [];

    domService.indexInteractableElements();
    const targetIndex = 2;

    // Remove the target element
    this.removeElement(targetIndex);

    // Try to click it
    const result = await this.simulateAgentCommand('click_element', { index: targetIndex });
    steps.push(result);

    return {
      scenarioId: 'index-shift-remove',
      scenarioName: 'Index Shift - Remove',
      steps,
      passed: result.outcome === 'failed' && result.details.includes('DOM_CHANGED'),
      summary: result.outcome === 'failed' ? 'Correctly detected element removal' : 'Unexpectedly succeeded',
    };
  }

  private async runContentChangeScenario(): Promise<ScenarioResult> {
    const steps: TestResult[] = [];

    domService.indexInteractableElements();
    const targetIndex = 1;

    // Change content slightly
    this.changeElementContent(targetIndex, 'Modified Button Text');

    const result = await this.simulateAgentCommand('click_element', { index: targetIndex });
    steps.push(result);

    return {
      scenarioId: 'element-content-change',
      scenarioName: 'Element Content Change',
      steps,
      passed: result.outcome === 'executed' || result.outcome === 'recovered',
      summary: `Content change handled: ${result.outcome}`,
    };
  }

  private async runSpaRerenderScenario(): Promise<ScenarioResult> {
    const steps: TestResult[] = [];

    domService.indexInteractableElements();
    const targetIndex = 0;

    // Simulate re-render
    this.simulateRerender(targetIndex);

    const result = await this.simulateAgentCommand('click_element', { index: targetIndex });
    steps.push(result);

    return {
      scenarioId: 'spa-rerender',
      scenarioName: 'SPA Re-render',
      steps,
      passed: result.outcome === 'recovered' || result.outcome === 'executed',
      summary: `Re-render handled: ${result.outcome}`,
    };
  }

  /**
   * Run all test scenarios
   */
  async runAllScenarios(): Promise<ScenarioResult[]> {
    const scenarioIds = ['index-shift-insert', 'index-shift-remove', 'element-content-change', 'spa-rerender'];

    const results: ScenarioResult[] = [];

    for (const id of scenarioIds) {
      // Refresh DOM between scenarios
      this.cleanupTestElements();
      const result = await this.runScenario(id);
      results.push(result);
    }

    return results;
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Get the last test result
   */
  getLastTestResult(): TestResult | null {
    return this.lastTestResult;
  }

  /**
   * Get the validation log
   */
  getValidationLog(): ValidationLogEntry[] {
    return [...this.validationLog];
  }

  /**
   * Clear the validation log
   */
  clearLog(): void {
    this.validationLog = [];
  }

  private addToLog(entry: ValidationLogEntry): void {
    this.validationLog.push(entry);
    // Keep only last 100 entries
    if (this.validationLog.length > 100) {
      this.validationLog = this.validationLog.slice(-100);
    }
  }

  /**
   * Clean up test elements from the DOM
   */
  cleanupTestElements(): void {
    const testElements = document.querySelectorAll(
      '[data-test-inserted], [data-test-rerendered], [data-test-state-changed], ' +
        '[data-test-navigated], [data-test-delayed], [data-test-infinite-scroll], ' +
        '[data-test-skeleton-replaced], [data-test-same-sibling], [data-test-class-changed], ' +
        '[data-test-wrapper], [data-test-duplicate-id], [data-test-modal], [data-test-dropdown], ' +
        '[data-test-rapid], [data-test-iframe], [data-test-shadow], [data-test-content-changed], ' +
        '[data-test-hidden]',
    );

    testElements.forEach(el => el.remove());
    console.log(`[DevTestService] Cleaned up ${testElements.length} test elements`);
  }

  /**
   * Get all indexed elements with their fingerprints
   */
  getIndexedElements(): Array<{
    index: number;
    fingerprint: ElementFingerprint;
    element: HTMLElement | null;
  }> {
    const fingerprints = domService.getAllFingerprints();

    return fingerprints.map(([index, fingerprint]) => ({
      index,
      fingerprint,
      element: domService.getElementByIndex(index),
    }));
  }

  /**
   * Force a validation check on a specific index
   */
  forceValidation(index: number): ValidationResult {
    const { validation } = domService.getValidatedElement(index);
    return validation;
  }
}

export const devTestService = DevTestService.getInstance();
