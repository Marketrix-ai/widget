/**
 * Show Mode Helper
 * Handles automatic element highlighting for "show" mode questions.
 * When user asks "Show me how to login", this will:
 * 1. Call get_html to get the page HTML
 * 2. Find the relevant element (login button, etc.)
 * 3. Highlight it with a tooltip
 */

import { toolExecutionService } from '../services/ToolService';
import {
  findElementDataId,
  highlightElementByDataId,
  processShowModeQuestion,
} from '../services/elementHighlightService';

/**
 * Process a show mode question by finding and highlighting the relevant element.
 * @param question The user's question (e.g., "Show me how to login")
 * @returns Promise that resolves when highlighting is complete
 */
export async function handleShowModeQuestion(question: string): Promise<void> {
  try {
    console.log('[ShowModeHelper] Processing show mode question:', question);

    // Step 1: Call get_html to get the page HTML with data-id attributes
    const htmlResult = await toolExecutionService.executeTool('get_html', {}, 'do');
    
    if (!htmlResult.success || !htmlResult.result) {
      console.warn('[ShowModeHelper] Failed to get HTML:', htmlResult.error);
      return;
    }

    const html = htmlResult.result;
    console.log('[ShowModeHelper] Got HTML, length:', html.length);

    // Step 2: Process the question to find and highlight the element
    const highlighted = processShowModeQuestion(question, html, 'click_element');
    
    if (highlighted) {
      console.log('[ShowModeHelper] Successfully highlighted element for question:', question);
    } else {
      console.warn('[ShowModeHelper] Could not find element for question:', question);
      
      // Try alternative search strategies
      const normalizedQuestion = question.toLowerCase();
      
      if (normalizedQuestion.includes('login')) {
        // Try finding by various methods
        let dataId: number | null = null;
        
        // Try data-demo-element="login-button"
        dataId = findElementDataId(html, { dataDemoElement: 'login-button' });
        
        // Try finding button with "Login" text
        if (dataId === null) {
          dataId = findElementDataId(html, { text: 'Login' });
        }
        
        // Try finding by id
        if (dataId === null) {
          dataId = findElementDataId(html, { id: 'login-button' });
        }
        
        if (dataId !== null) {
          highlightElementByDataId(dataId, {
            tooltipText: 'Click this button to login',
            tooltipPosition: 'top',
          });
          console.log('[ShowModeHelper] Found login button with data-id:', dataId);
        }
      }
    }
  } catch (error) {
    console.error('[ShowModeHelper] Error processing show mode question:', error);
  }
}

/**
 * Check if a question is asking to show how to do something.
 * @param question The user's question
 * @returns true if it's a "show me how" type question
 */
export function isShowModeQuestion(question: string): boolean {
  const normalized = question.toLowerCase();
  const showPatterns = [
    'show me',
    'how to',
    'where is',
    'find the',
    'locate',
    'point to',
    'highlight',
  ];
  
  return showPatterns.some((pattern) => normalized.includes(pattern));
}

