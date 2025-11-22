// / <reference lib="dom" />
import React, { useEffect, useRef, useState } from 'react';
import { HiUser } from 'react-icons/hi2';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { LuMousePointerClick } from 'react-icons/lu';
import { SiTicktick } from 'react-icons/si';

import MarketrixIcon from '../assets/marketrix-icon.png';
import { useWidget } from '../hooks/useWidget';
import { sdk, type TourData, type TourStepData } from '../sdk';
import type { ChatMessage, MarketrixConfig } from '../types';
import {
  cleanupAllWidgetElements,
  cleanupStepHighlights,
  cleanupTypewriterStyles,
} from '../utils/cleanupUtils';
import {
  addOpacity,
  darkenColor,
  extractColorFromGradient,
  getContrastingColor,
  hexToRgb,
  lightenColor,
} from '../utils/colorUtils';
import { removeTourClickHandler } from '../utils/domUtils';
import { createUserMessage } from '../utils/messageFactory';
import { formatMessageTime } from '../utils/textFormatting';
import {
  isHTMLButtonElement,
  isHTMLElement,
  isHTMLElementEventTarget,
  isHTMLInputElement,
  isHTMLSelectElement,
  isString,
  isTourAnswerWithSteps,
  isTourStepDataArray,
} from '../utils/typeGuards';

// Define the chip type to handle both formats
type ChipData = {
  chip_mode?: 'show' | 'tell' | 'do' | string;
  chip_text?: string;
  type?: 'show' | 'tell' | 'do' | string;
  question?: string;
};

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSendMessage?: (
    message: string,
    mode?: 'show' | 'tell' | 'do',
    connectionId?: number,
    question?: string
  ) => void;
  onSetMode?: (mode: 'show' | 'tell' | 'do') => void;
  onModeChange?: (mode: 'show' | 'tell' | 'do') => void;
  onAddMessage?: (message: ChatMessage) => void;
  config?: MarketrixConfig;
  onStepGuideStart?: () => void;
  onScreenAccessAllow?: () => void;
  onScreenAccessDeny?: () => void;
  isTaskRunning?: boolean;
  currentMode?: 'show' | 'tell' | 'do';
}

export const MessageList = ({
  messages,
  isLoading,
  messagesEndRef,
  onSendMessage,
  onSetMode,
  onModeChange,
  onAddMessage,
  config,
  onStepGuideStart,
  onScreenAccessAllow,
  onScreenAccessDeny,
  isTaskRunning = false,
  currentMode,
}: MessageListProps) => {
  // Get widget settings
  const { settings } = useWidget(config ? { config } : {});

  // Helper function to get connection ID from config with fallback
  const getConnectionId = (): number => {
    return config?.connectionId ?? 1;
  };

  // Use SDK types
  type TourStep = TourStepData;

  const [tourData, setTourData] = useState<TourData | null>(null);
  const [parsedSteps, setParsedSteps] = useState<TourStep[]>([]);
  const [isLoadingTour, setIsLoadingTour] = useState(false);

  // Step-by-step tour state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isStepGuideRunning, setIsStepGuideRunning] = useState(false);
  const [currentStepElement, setCurrentStepElement] = useState<HTMLElement | null>(null);
  const [stepTimer, setStepTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Cache for found elements to prevent duplicate searches
  const elementCache = new Map<string, HTMLElement | null>();

  // Track console log counts for each step
  const stepLogCounts = new Map<number, number>();

  // Track typewriter animation state for each step
  const typewriterRunning = new Map<number, boolean>();

  // Store active typewriter intervals to clear them
  const activeTypewriterIntervals = new Map<number, ReturnType<typeof setInterval>>();

  // Cleanup effect for timer
  React.useEffect(() => {
    return () => {
      if (stepTimer) {
        clearTimeout(stepTimer);
      }
    };
  }, [stepTimer]);

  // Store event listener references for cleanup
  let preventReloadHandler: ((e: Event) => boolean) | null = null;
  let preventClickHandler: ((e: Event) => void) | null = null;

  // Function to start step-by-step tour guide
  const startStepGuide = (steps: TourStep[]) => {
    console.log('🎯 Starting tour with', steps.length, 'steps');

    setIsStepGuideRunning(true);
    setCurrentStepIndex(0);
    setParsedSteps(steps);

    // Prevent page reloads during tour
    preventReloadHandler = (e: Event) => {
      e.preventDefault();
      return false;
    };

    preventClickHandler = (e: Event) => {
      if (!isHTMLElementEventTarget(e.target)) {
        return;
      }
      const target = e.target;
      if (
        target.tagName === 'A' ||
        (target.tagName === 'BUTTON' && isHTMLButtonElement(target) && target.type === 'submit')
      ) {
        e.preventDefault();
      }
    };

    // Add global event listeners to prevent reloads
    document.addEventListener('submit', preventReloadHandler, true);
    document.addEventListener('click', preventClickHandler, true);

    // Show first step
    showCurrentStep(steps, 0);
  };

  // Function to show current step with spotlight
  const showCurrentStep = (steps: TourStep[], stepIndex: number) => {
    if (stepIndex >= steps.length) {
      console.log('✅ Tour completed!');
      stopStepGuide();
      return;
    }

    // Clear any existing timer
    if (stepTimer) {
      clearTimeout(stepTimer);
      setStepTimer(null);
    }

    // Remove any existing highlights and animations before showing new step
    removeStepHighlights();

    const step = steps[stepIndex];

    // Only log once per step
    if (!stepLogCounts.has(stepIndex)) {
      stepLogCounts.set(stepIndex, 1);
      console.log(
        `📍 Step ${stepIndex + 1}/${steps.length}: ${step.action || 'action'} - ${step.description || step.text || 'No description'}`
      );
    }

    // Find the element for this step - prioritize selector over element
    const selector = step.selector || (isString(step.element) ? step.element : undefined);

    let element = selector ? findElementBySelector(selector) : null;
    if (!element) {
      console.warn(`❌ Element not found for step ${stepIndex + 1}:`, selector);

      // Try alternative selectors
      const elementStr = isString(step.element) ? step.element : '';
      const alternativeSelectors = [
        `[data-demo-element="${elementStr}"]`,
        `#${elementStr}`,
        `.${elementStr}`,
        elementStr,
      ].filter(Boolean);

      let foundElement = null;
      for (const altSelector of alternativeSelectors) {
        foundElement = document.querySelector(altSelector);
        if (foundElement) {
          console.log(`✅ Found with alternative: ${altSelector}`);
          break;
        }
      }

      if (!foundElement) {
        console.error(`❌ Skipping step ${stepIndex + 1} - no element found`);
        // Move to next step after a delay
        const timer = setTimeout(() => {
          showCurrentStep(steps, stepIndex + 1);
        }, 2000);
        setStepTimer(timer);
        return;
      }

      // Use the found element
      if (!isHTMLElement(foundElement)) {
        return;
      }
      element = foundElement;
    }

    if (!element) {
      console.error('❌ Element is null, cannot proceed');
      return;
    }

    console.log(
      `🎯 Clicking element: ${element.tagName}${element.className ? `.${element.className.split(' ').join('.')}` : ''}`
    );

    setCurrentStepElement(element);
    setCurrentStepIndex(stepIndex);

    // Create spotlight and description for this step
    createStepSpotlight(element, step, stepIndex, steps.length, steps);

    // No automatic progression - user must click action button to proceed
  };

  // Function to create step spotlight and description (improved positioning)
  const createStepSpotlight = (
    element: HTMLElement,
    step: TourStep,
    stepIndex: number,
    totalSteps: number,
    steps: TourStep[]
  ) => {
    // Remove existing spotlight elements
    removeStepHighlights();

    // Check if description is already showing to prevent duplicates
    if (document.getElementById('step-description')) {
      return;
    }

    // Create spotlight overlay
    const spotlight = document.createElement('div');
    spotlight.id = 'step-spotlight';
    spotlight.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 9999;
      pointer-events: none;
    `;

    // Create step description text with improved positioning
    const descriptionDiv = document.createElement('div');
    descriptionDiv.id = 'step-description';
    const accentColor = extractColorFromGradient(settings.widget_accent_color);
    const secondaryColor = extractColorFromGradient(settings.widget_secondary_color);
    const accentRgb = hexToRgb(accentColor);
    const secondaryRgb = hexToRgb(secondaryColor);
    const accentRgba = accentRgb
      ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.95)`
      : 'rgba(15, 23, 42, 0.95)';
    const secondaryRgba = secondaryRgb
      ? `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.95)`
      : 'rgba(30, 41, 59, 0.95)';
    const borderRgba = accentRgb
      ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.4)`
      : 'rgba(59, 130, 246, 0.4)';
    const borderLightRgba = accentRgb
      ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.3)`
      : 'rgba(59, 130, 246, 0.3)';
    descriptionDiv.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: linear-gradient(135deg, ${accentRgba}, ${secondaryRgba});
      color: ${getContrastingColor(accentColor)};
      padding: 16px;
      border-radius: 8px;
      max-width: 350px;
      min-width: 350px;
      font-size: 14px;
      line-height: 1.6;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px ${borderLightRgba}, inset 0 1px 0 rgba(255, 255, 255, 0.1);
      border: 2px solid ${borderRgba};
      backdrop-filter: blur(15px);
      display: block;
      visibility: visible;
      opacity: 1;
    `;

    // Create step content
    const stepDescription = step.description || step.text || 'Follow this step';

    // Determine if this step needs a "Done" button (only for fill actions)
    const needsDoneButton = step.action === 'fill';

    descriptionDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: flex-start;">
        <div id="step-description-text" style="line-height: 1.5; text-align: left;"></div>
        <div style="display: flex; justify-content: center; align-items: center;">
          ${
            needsDoneButton
              ? `<button id="done-step-btn" style="background: ${settings.widget_accent_color}; border: none; color: ${getContrastingColor(settings.widget_accent_color)}; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">
              ${stepIndex < totalSteps - 1 ? 'Done' : 'Finish'}
            </button>`
              : ''
          }
        </div>
      </div>
    `;

    // Update spotlight position based on element
    const updateSpotlightPosition = () => {
      const rect = element.getBoundingClientRect();
      spotlight.style.background = `radial-gradient(ellipse at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, 
        transparent 0%, 
        transparent 40%, 
        rgba(0, 0, 0, 0.6) 100%)`;
    };

    // Improved description positioning
    const updateDescriptionPosition = () => {
      const rect = element.getBoundingClientRect();

      // Calculate optimal position - start with element position
      let left = rect.right + 20;
      let top = rect.top;

      // Adjust if too far right
      if (left + 350 > window.innerWidth - 20) {
        left = rect.left - 350 - 20;
      }

      // Adjust if too far left
      if (left < 20) {
        left = 20;
      }

      // Adjust vertical position
      if (top < 20) {
        top = 20;
      } else if (top + 100 > window.innerHeight - 20) {
        top = window.innerHeight - 100 - 20;
      }

      descriptionDiv.style.left = `${left}px`;
      descriptionDiv.style.top = `${top}px`;
      descriptionDiv.style.display = 'block';

      console.log('📍 Description positioned at:', left, top);
    };

    updateSpotlightPosition();
    updateDescriptionPosition();

    // Add resize and scroll listeners
    const resizeHandler = () => {
      updateSpotlightPosition();
      updateDescriptionPosition();
    };
    const scrollHandler = () => {
      updateSpotlightPosition();
      updateDescriptionPosition();
    };

    window.addEventListener('resize', resizeHandler);
    window.addEventListener('scroll', scrollHandler, true);

    document.body.appendChild(spotlight);
    document.body.appendChild(descriptionDiv);

    // Fallback positioning if description is not visible
    setTimeout(() => {
      const desc = document.getElementById('step-description');
      if (desc) {
        const rect = desc.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          console.log('📍 Applying fallback positioning');
          desc.style.left = '50%';
          desc.style.top = '50%';
          desc.style.transform = 'translate(-50%, -50%)';
        }
      }
    }, 100);

    // Add highlight class to element
    element.classList.add('step-highlight');

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add typewriter animation to description
    // Use setTimeout to ensure the DOM element is fully rendered
    setTimeout(() => {
      console.log(
        `🎯 Creating typewriter for step ${stepIndex + 1} with description: "${stepDescription}"`
      );
      addTypewriterAnimation(descriptionDiv, stepDescription, stepIndex, () => {
        if (needsDoneButton) {
          // Fill actions: wait for Done button click
          addDoneButtonHandler(steps, stepIndex);
        } else {
          // Click actions: wait for user to click the highlighted button
          addClickActionHandler(element, step, steps, stepIndex);
        }
      });
    }, 100);

    // Fallback: If typewriter doesn't start after 500ms, try again
    setTimeout(() => {
      const textElement = descriptionDiv.querySelector('#step-description-text');
      if (!isHTMLElement(textElement)) {
        return;
      }
      if (textElement && (!textElement.textContent || textElement.textContent.trim() === '')) {
        console.log(`🔄 Fallback: Retrying typewriter for step ${stepIndex + 1}`);
        addTypewriterAnimation(descriptionDiv, stepDescription, stepIndex, () => {
          if (needsDoneButton) {
            addDoneButtonHandler(steps, stepIndex);
          } else {
            addClickActionHandler(element, step, steps, stepIndex);
          }
        });
      }
    }, 500);

    // Step spotlight created successfully
  };

  // Function to execute step action
  const executeStepAction = (element: HTMLElement, step: TourStep) => {
    const action = step.action || '';

    try {
      switch (action.toLowerCase()) {
        case 'click':
          // Simulate click with visual feedback
          element.style.transform = 'scale(0.95)';
          setTimeout(() => {
            element.style.transform = 'scale(1)';

            // Prevent page reload for form submissions and navigation
            if (
              element.tagName === 'BUTTON' &&
              isHTMLButtonElement(element) &&
              element.type === 'submit'
            ) {
              // For submit buttons, prevent form submission
              const form = element.closest('form');
              if (form) {
                form.addEventListener('submit', (e) => {
                  e.preventDefault();
                  console.log('Form submission prevented during tour');
                });
              }
            }

            // For links, prevent navigation
            if (element.tagName === 'A') {
              element.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Link navigation prevented during tour');
              });
            }

            element.click();
            console.log('Click action executed (page reload prevented)');
          }, 150);
          break;

        case 'fill':
          // Focus input fields for manual filling
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (!isHTMLInputElement(element)) {
              break;
            }
            const input = element;

            // Focus the input for user to fill manually
            input.focus();

            console.log('Input field focused, waiting for user to fill manually');
          }
          break;

        case 'select':
          // Handle select elements
          if (element.tagName === 'SELECT') {
            if (!isHTMLSelectElement(element)) {
              break;
            }
            const select = element;
            select.focus();

            // Select first option if available
            if (select.options.length > 1) {
              select.selectedIndex = 1;
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          break;

        case 'hover':
          // Simulate hover effect
          element.style.transform = 'scale(1.05)';
          element.style.transition = 'transform 0.2s ease';
          setTimeout(() => {
            element.style.transform = 'scale(1)';
          }, 500);
          break;

        default:
          console.log(`No specific action for: ${action}`);
      }
    } catch (error) {
      console.error('Error executing step action:', error);
    }
  };

  // Function to add smooth typewriter animation to description
  const addTypewriterAnimation = (
    descriptionDiv: HTMLElement,
    text: string,
    stepIndex: number,
    onComplete?: () => void
  ) => {
    const textElement = descriptionDiv.querySelector('#step-description-text');
    if (!isHTMLElement(textElement)) {
      return;
    }
    if (!textElement) {
      console.log('⚠️ Text element not found');
      return;
    }

    // Clear any existing typewriter interval for this step
    if (activeTypewriterIntervals.has(stepIndex)) {
      console.log(`🛑 Clearing existing typewriter for step ${stepIndex + 1}`);
      const interval = activeTypewriterIntervals.get(stepIndex);
      if (interval) clearInterval(interval);
      activeTypewriterIntervals.delete(stepIndex);
    }

    // Use the provided text as the original text
    const originalText = text || 'Follow this step';

    console.log(`💬 Step ${stepIndex + 1} - Starting typewriter: "${originalText}"`);
    console.log(`💬 Step ${stepIndex + 1} - Text element found:`, textElement);
    console.log(`💬 Step ${stepIndex + 1} - Current text content:`, textElement.textContent);

    // Clear any existing content and reset
    textElement.textContent = '';
    textElement.innerHTML = '';

    // Add CSS for blinking cursor
    textElement.style.cssText = `
      position: relative;
      overflow: hidden;
      line-height: 1.5;
      text-align: left;
    `;

    // Remove any existing cursor styles first
    const existingStyle = document.getElementById('typewriter-cursor-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Add blinking cursor styles
    const style = document.createElement('style');
    style.id = 'typewriter-cursor-style';
    style.textContent = `
      #step-description-text::after {
        content: '|';
        animation: blink 1s infinite;
        color: #3b82f6;
        font-weight: bold;
        margin-left: 2px;
      }
      
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    console.log(
      `💬 Step ${stepIndex + 1} - Starting typewriter interval for text: "${originalText}"`
    );

    let index = 0;
    const typeInterval = setInterval(() => {
      if (index < originalText.length) {
        textElement.textContent = originalText.substring(0, index + 1);
        console.log(`💬 Step ${stepIndex + 1} - Typing: "${originalText.substring(0, index + 1)}"`);
        index++;
      } else {
        clearInterval(typeInterval);
        activeTypewriterIntervals.delete(stepIndex);
        console.log('✅ Typewriter completed');
        // Remove the cursor after typing is complete
        setTimeout(() => {
          // Update the style to hide the cursor
          if (style?.parentNode) {
            style.textContent = `
              #step-description-text::after {
                content: '';
                animation: none;
              }
            `;
          }
          // Call completion callback if provided
          if (onComplete) {
            onComplete();
          }
        }, 1000);
      }
    }, 30); // Faster typing for better UX

    // Store the interval so we can clear it later
    activeTypewriterIntervals.set(stepIndex, typeInterval);
  };

  // Function to add click action handler (for click actions)
  const addClickActionHandler = (
    element: HTMLElement,
    step: TourStep,
    steps: TourStep[],
    stepIndex: number
  ) => {
    // Add click event listener to the highlighted element
    const clickHandler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();

      console.log('👆 User clicked element');

      // Execute the step action
      executeStepAction(element, step);

      // Remove the click handler to prevent multiple clicks
      element.removeEventListener('click', clickHandler);

      // Auto-advance after click action
      setTimeout(() => {
        removeStepHighlights();
        if (stepIndex < steps.length - 1) {
          showCurrentStep(steps, stepIndex + 1);
        } else {
          // Last step - show success message
          showSuccessMessage();
          stopStepGuide();
        }
      }, 1000); // 1 second delay after action completes
    };

    // Add the click event listener
    element.addEventListener('click', clickHandler, true);

    // Store the handler for cleanup if needed
    element._tourClickHandler = clickHandler;
  };

  // Function to add Done button handler (for fill actions only)
  const addDoneButtonHandler = (steps: TourStep[], currentStepIndex: number) => {
    setTimeout(() => {
      // Handle Done/Finish button
      const doneBtn = document.getElementById('done-step-btn');
      if (doneBtn) {
        doneBtn.onclick = () => {
          console.log('✅ Done button clicked');

          // Execute the step action before moving to next
          const currentStep = steps[currentStepIndex];
          const selector =
            currentStep.selector ||
            (isString(currentStep.element) ? currentStep.element : undefined);
          const element = selector ? findElementBySelector(selector) : null;
          if (element) {
            executeStepAction(element, currentStep);
          }

          // Remove current step spotlight before moving to next
          removeStepHighlights();

          // Move to next step
          if (currentStepIndex < steps.length - 1) {
            showCurrentStep(steps, currentStepIndex + 1);
          } else {
            // Last step - show success message for fill actions
            showSuccessMessage();
            stopStepGuide();
          }
        };
      }

      // Handle Previous button (available for all steps)
      const prevBtn = document.getElementById('prev-step-btn');
      if (prevBtn) {
        prevBtn.onclick = () => {
          console.log('⬅️ Previous button clicked');

          // Remove current step spotlight before moving to previous
          removeStepHighlights();

          // Move to previous step
          if (currentStepIndex > 0) {
            showCurrentStep(steps, currentStepIndex - 1);
          }
        };
      }
    }, 100);
  };

  // Function to show success message when tour completes
  const showSuccessMessage = () => {
    console.log('🎉 Tour completed successfully!');

    // Remove any existing success overlay first
    const existingOverlay = document.getElementById('tour-success-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Create success message overlay
    const successOverlay = document.createElement('div');
    successOverlay.id = 'tour-success-overlay';
    successOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    // Create success message box
    const successBox = document.createElement('div');
    const accentColor = extractColorFromGradient(settings.widget_accent_color);
    const darkenAccent = darkenColor(accentColor, 0.1);
    successBox.style.cssText = `
      background: linear-gradient(135deg, ${accentColor}, ${darkenAccent});
      color: ${getContrastingColor(accentColor)};
      padding: 40px;
      border-radius: 16px;
      text-align: center;
      max-width: 500px;
      margin: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    `;

    successBox.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
      <h2 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600;">Tour Completed Successfully!</h2>
      <p style="margin: 0 0 24px 0; font-size: 16px; opacity: 0.9; line-height: 1.5;">
        Great job! You've successfully completed the tour. You now know how to navigate through the process step by step.
      </p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button id="restart-tour-btn" style="
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
          🔄 Restart Tour
        </button>
        <button id="close-success-btn" style="
          background: rgba(255, 255, 255, 0.9);
          border: none;
          color: ${darkenAccent};
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s ease;
        " onmouseover="this.style.background='white'" onmouseout="this.style.background='rgba(255,255,255,0.9)'">
          ✓ Close
        </button>
      </div>
    `;

    successOverlay.appendChild(successBox);
    document.body.appendChild(successOverlay);

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideInUp {
        from { 
          opacity: 0;
          transform: translateY(30px);
        }
        to { 
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);

    // Add button handlers
    setTimeout(() => {
      const restartBtn = document.getElementById('restart-tour-btn');
      const closeBtn = document.getElementById('close-success-btn');

      if (restartBtn) {
        restartBtn.onclick = () => {
          console.log('Restarting tour...');
          // Clean up existing elements
          document.body.removeChild(successOverlay);
          if (document.head.contains(style)) {
            document.head.removeChild(style);
          }

          // Restart the tour with current parsed steps
          if (parsedSteps && parsedSteps.length > 0) {
            console.log('Restarting with existing steps:', parsedSteps.length);
            startStepGuide(parsedSteps);
          } else {
            console.log('No parsed steps available for restart');
            // If no parsed steps, try to fetch tour data again
            if (tourData?.question) {
              console.log('Fetching tour data again for restart');
              fetchTourData(tourData.question, tourData.connection_id);
            }
          }
        };
      }

      if (closeBtn) {
        closeBtn.onclick = () => {
          console.log('Closing success message...');
          document.body.removeChild(successOverlay);
          if (document.head.contains(style)) {
            document.head.removeChild(style);
          }
        };
      }
    }, 100);
  };

  // Function to remove step highlights
  const removeStepHighlights = () => {
    // Clear processed steps for current step only
    stepLogCounts.delete(currentStepIndex);
    typewriterRunning.delete(currentStepIndex);

    // Clear any active typewriter interval for current step
    if (activeTypewriterIntervals.has(currentStepIndex)) {
      const interval = activeTypewriterIntervals.get(currentStepIndex);
      if (interval) clearInterval(interval);
      activeTypewriterIntervals.delete(currentStepIndex);
    }

    // Clean up typewriter styles using utility
    cleanupTypewriterStyles();

    // Remove highlight class from current element
    if (currentStepElement) {
      currentStepElement.classList.remove('step-highlight');
      removeTourClickHandler(currentStepElement);
    }

    // Remove all step highlights using utility
    cleanupStepHighlights();
  };

  // Function to stop step guide
  const stopStepGuide = () => {
    console.log('🛑 Stopping tour guide');

    // Clear any existing timer
    if (stepTimer) {
      clearTimeout(stepTimer);
      setStepTimer(null);
    }

    // Remove event listeners that prevent page reloads
    if (preventReloadHandler) {
      document.removeEventListener('submit', preventReloadHandler, true);
      preventReloadHandler = null;
    }

    if (preventClickHandler) {
      document.removeEventListener('click', preventClickHandler, true);
      preventClickHandler = null;
    }

    // Use consolidated cleanup utility
    cleanupAllWidgetElements();

    // Remove step highlights (includes step-specific cleanup)
    removeStepHighlights();

    setIsStepGuideRunning(false);
    setCurrentStepIndex(0);
    setCurrentStepElement(null);

    // Clear all processed steps
    stepLogCounts.clear();
    typewriterRunning.clear();

    // Clear all active typewriter intervals
    activeTypewriterIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    activeTypewriterIntervals.clear();

    // Clear element cache
    elementCache.clear();
  };

  // Function to find element by selector
  const findElementBySelector = (selector: string): HTMLElement | null => {
    try {
      // Check cache first
      if (elementCache.has(selector)) {
        return elementCache.get(selector) || null;
      }

      if (!selector) {
        elementCache.set(selector, null);
        return null;
      }

      let element: HTMLElement | null = null;

      // Handle data-demo-element selectors
      if (selector.includes('[data-demo-element=')) {
        const match = selector.match(/\[data-demo-element=['"]([^'"]+)['"]\]/);
        if (match) {
          const elementValue = match[1];
          const foundElement = document.querySelector(`[data-demo-element="${elementValue}"]`);
          if (!isHTMLElement(foundElement)) {
            return null;
          }
          element = foundElement;
          if (element) {
            elementCache.set(selector, element);
            return element;
          }
        }
      }

      // Cache the result (even if null)
      elementCache.set(selector, element);
      return element;
    } catch {
      elementCache.set(selector, null);
      return null;
    }
  };

  // Function to add step guide styles
  const addStepGuideStyles = () => {
    if (!document.getElementById('step-guide-styles')) {
      const style = document.createElement('style');
      style.id = 'step-guide-styles';
      const accentColor = extractColorFromGradient(settings.widget_accent_color);
      const secondaryColor = extractColorFromGradient(settings.widget_secondary_color);
      const accentRgb = hexToRgb(accentColor);
      const secondaryRgb = hexToRgb(secondaryColor);
      const accentRgba = accentRgb
        ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.6)`
        : 'rgba(59, 130, 246, 0.6)';
      const accentRgbaLight = accentRgb
        ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.3)`
        : 'rgba(59, 130, 246, 0.3)';
      const accentRgbaDark = accentRgb
        ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.9)`
        : 'rgba(59, 130, 246, 0.9)';
      const accentRgbaInset = accentRgb
        ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.1)`
        : 'rgba(59, 130, 246, 0.1)';
      const accentRgbaInsetDark = accentRgb
        ? `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.2)`
        : 'rgba(59, 130, 246, 0.2)';
      const secondaryRgba = secondaryRgb
        ? `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.5)`
        : 'rgba(59, 130, 246, 0.5)';
      const darkenAccent = darkenColor(accentColor, 0.1);
      const darkenAccentRgb = hexToRgb(darkenAccent);
      const darkenAccentRgba = darkenAccentRgb
        ? `rgba(${darkenAccentRgb.r}, ${darkenAccentRgb.g}, ${darkenAccentRgb.b}, 0.3)`
        : 'rgba(16, 185, 129, 0.3)';
      const darkenAccentRgbaHover = darkenAccentRgb
        ? `rgba(${darkenAccentRgb.r}, ${darkenAccentRgb.g}, ${darkenAccentRgb.b}, 0.4)`
        : 'rgba(16, 185, 129, 0.4)';
      style.textContent = `
        @keyframes stepSpotlightFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes descriptionSlideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .step-highlight {
          position: relative;
          z-index: 10001;
          border: 3px solid ${accentColor} !important;
          border-radius: 8px;
          animation: stepHighlightPulse 2s infinite, stepHighlightGlow 3s infinite;
          box-shadow: 0 0 25px ${accentRgba}, 0 0 50px ${accentRgbaLight}, inset 0 0 20px ${accentRgbaInset};
          transform: scale(1.02);
          transition: all 0.3s ease;
        }

        @keyframes stepHighlightPulse {
          0% {
            box-shadow: 0 0 25px ${accentRgba}, 0 0 50px ${accentRgbaLight}, inset 0 0 20px ${accentRgbaInset};
            transform: scale(1.02);
          }
          50% {
            box-shadow: 0 0 35px ${accentRgbaDark}, 0 0 70px ${secondaryRgba}, inset 0 0 30px ${accentRgbaInsetDark};
            transform: scale(1.03);
          }
          100% {
            box-shadow: 0 0 25px ${accentRgba}, 0 0 50px ${accentRgbaLight}, inset 0 0 20px ${accentRgbaInset};
            transform: scale(1.02);
          }
        }

        @keyframes stepHighlightGlow {
          0%, 100% {
            border-color: ${accentColor};
          }
          25% {
            border-color: ${secondaryColor};
          }
          50% {
            border-color: ${lightenColor(accentColor, 0.2)};
          }
          75% {
            border-color: ${darkenColor(accentColor, 0.1)};
          }
        }

        #step-description button {
          transition: all 0.3s ease;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          font-size: 12px;
        }

        #step-description button:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
        }

        #done-step-btn {
          background: linear-gradient(135deg, ${accentColor}, ${darkenColor(accentColor, 0.1)}) !important;
          border: none !important;
          color: ${getContrastingColor(accentColor)} !important;
          padding: 10px 20px !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          margin-top: 10px !important;
          box-shadow: 0 4px 12px ${darkenAccentRgba} !important;
        }

        #done-step-btn:hover {
          background: linear-gradient(135deg, ${darkenColor(accentColor, 0.1)}, ${darkenColor(accentColor, 0.2)}) !important;
          box-shadow: 0 6px 16px ${darkenAccentRgbaHover} !important;
        }

        #prev-step-btn:hover {
          background: rgba(255, 255, 255, 0.3) !important;
        }

        #next-step-btn:hover {
          background: ${accentColor} !important;
        }

        #step-description-text {
          position: relative;
        }

        #step-description-text::after {
          content: '|';
          animation: blink 1s infinite;
          color: ${accentColor};
          font-weight: bold;
          margin-left: 2px;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .step-highlight {
          transition: all 0.3s ease;
        }

        .step-highlight:hover {
          transform: scale(1.02);
        }
      `;
      document.head.appendChild(style);
    }
  };

  // Function to fetch tour data from API using tourSearch
  const fetchTourData = async (question: string, connectionId?: number) => {
    try {
      setIsLoadingTour(true);
      console.log('=== FETCHING TOUR DATA USING tourSearch ===');
      console.log('Question:', question);
      console.log('Connection ID:', connectionId);

      // Use SDK to search all tours for the connection
      const response = await sdk.tourSearch({
        query: {
          connection_id: connectionId,
        },
      });

      console.log('=== TOUR SEARCH API RESPONSE ===');
      console.log('Response status:', response.status);
      console.log('Response body:', response.body);
      console.log('Response body type:', typeof response.body);
      console.log(
        'Response body keys:',
        response.body ? Object.keys(response.body) : 'null/undefined'
      );

      // Check if response is successful
      if (response.status !== 200) {
        console.error('Tour Search API returned non-200 status:', response.status);
        console.error('Response body:', response.body);
        return;
      }

      // Handle different response body structures
      let tours: TourData[] = [];

      // Check if body has success property (standard API response format)
      if (response.body && typeof response.body === 'object' && 'success' in response.body) {
        const body = response.body as { success: boolean; data?: TourData[]; error?: string };
        if (body.success && body.data && Array.isArray(body.data)) {
          tours = body.data;
          console.log('✅ Tour array extracted from response.body.data');
        } else {
          console.error('❌ Response body.success is false or data is missing');
          console.error('Response body:', body);
          if (body.error) {
            console.error('Error message:', body.error);
          }
          return;
        }
      }
      // Check if body is directly an array of tours
      else if (response.body && Array.isArray(response.body)) {
        tours = response.body as TourData[];
        console.log('✅ Tour array is directly in response.body');
      } else {
        console.error('❌ Invalid response body structure');
        console.error('Response body:', response.body);
        return;
      }

      if (!tours || tours.length === 0) {
        console.log('⚠️ No tours found for connection ID:', connectionId);
        return;
      }

      console.log('=== ALL TOURS FOUND ===');
      console.log('Total tours:', tours.length);

      // Log each tour's question and answer
      tours.forEach((tour, index) => {
        console.log(`\n--- TOUR ${index + 1} ---`);
        console.log('Tour ID:', tour.id);
        console.log('Connection ID:', tour.connection_id);
        console.log('Question:', tour.question);
        console.log('Answer (raw):', tour.answer);
        console.log('Answer type:', typeof tour.answer);
        console.log('Answer (stringified):', JSON.stringify(tour.answer, null, 2));
      });

      // Find the tour that matches the question (case-insensitive partial match)
      const matchingTour = tours.find(
        (tour) =>
          tour.question.toLowerCase().includes(question.toLowerCase()) ||
          question.toLowerCase().includes(tour.question.toLowerCase())
      );

      if (!matchingTour) {
        console.log('⚠️ No matching tour found for question:', question);
        console.log(
          'Available questions:',
          tours.map((t) => t.question)
        );
        return;
      }

      console.log('\n=== MATCHING TOUR FOUND ===');
      console.log('Tour ID:', matchingTour.id);
      console.log('Connection ID:', matchingTour.connection_id);
      console.log('Question:', matchingTour.question);
      console.log('Answer (raw):', matchingTour.answer);
      console.log('Answer type:', typeof matchingTour.answer);

      const tour = matchingTour;

      // Store tour data
      setTourData(tour);

      // Handle the answer data - convert to JSON value
      if (tour.answer) {
        try {
          console.log('=== PROCESSING TOUR ANSWER ===');
          console.log('Tour answer type:', typeof tour.answer);
          console.log('Tour answer (raw):', tour.answer);
          console.log('Tour answer (stringified):', JSON.stringify(tour.answer, null, 2));

          // Convert answer to JSON value - handle all possible formats
          let parsedSteps: TourStepData[] = [];
          let answerValue: unknown = tour.answer;

          // Step 1: If it's a string, parse it to JSON
          if (isString(answerValue)) {
            console.log('Answer is a string, parsing to JSON...');
            try {
              answerValue = JSON.parse(answerValue);
              console.log('Parsed JSON:', answerValue);
            } catch (parseError) {
              console.error('Failed to parse answer string as JSON:', parseError);
              console.error('Raw string value:', answerValue);
              return;
            }
          }

          // Step 2: If it's already an array, use it directly
          if (Array.isArray(answerValue)) {
            console.log('Answer is already an array');
            if (isTourStepDataArray(answerValue)) {
              parsedSteps = answerValue;
              console.log('Array is valid TourStepData array');
            } else {
              console.error('Array is not a valid TourStepData array');
              console.error('Array contents:', answerValue);
              return;
            }
          }
          // Step 3: If it's an object, check for steps property or try to convert
          else if (typeof answerValue === 'object' && answerValue !== null) {
            console.log('Answer is an object, checking structure...');

            // Check if it has a steps property
            if (isTourAnswerWithSteps(answerValue)) {
              if (isTourStepDataArray(answerValue.steps)) {
                console.log('Answer has steps property, extracting steps array');
                parsedSteps = answerValue.steps;
              } else {
                console.error('Steps property is not a valid TourStepData array');
                return;
              }
            }
            // Try to convert object to array if it looks like a single step
            else if ('step_number' in answerValue || 'action' in answerValue) {
              console.log('Answer appears to be a single step object, converting to array');
              parsedSteps = [answerValue as TourStepData];
            }
            // Try to extract array from object values
            else {
              const obj = answerValue as Record<string, unknown>;
              const values = Object.values(obj);
              const arrayValue = values.find((v) => Array.isArray(v));
              if (arrayValue && isTourStepDataArray(arrayValue)) {
                console.log('Found array in object values');
                parsedSteps = arrayValue;
              } else {
                console.error('Could not extract valid steps array from object');
                console.error('Object keys:', Object.keys(obj));
                console.error('Object values:', values);
                return;
              }
            }
          } else {
            console.error('Invalid tour answer format - not string, array, or object');
            console.error('Answer value:', answerValue);
            console.error('Answer type:', typeof answerValue);
            return;
          }

          console.log('Final parsed steps:', parsedSteps);

          // Store parsed steps
          if (Array.isArray(parsedSteps) && parsedSteps.length > 0) {
            console.log('=== TOUR STEPS ===');
            console.log('Number of steps:', parsedSteps.length);
            setParsedSteps(parsedSteps);

            // Log each step step by step
            parsedSteps.forEach((step, index) => {
              console.log(`\n--- STEP ${index + 1} ---`);
              console.log('Step Number:', step.step_number);
              console.log('Action:', step.action);
              console.log('Element:', step.element);
              console.log('Text:', step.text);
              console.log('Description:', step.description);
              console.log('Selector:', step.selector);
              console.log('Full Step Object:', step);
            });

            // Add step guide styles
            addStepGuideStyles();

            // Start step-by-step tour guide
            console.log('=== STARTING STEP-BY-STEP TOUR ===');
            startStepGuide(parsedSteps);
          } else {
            console.log('No valid steps found in tour answer');
            console.log('Steps type:', typeof parsedSteps);
            console.log('Steps value:', parsedSteps);
            setParsedSteps([]);
          }
        } catch (parseError) {
          console.error('=== ERROR PROCESSING TOUR ANSWER ===');
          console.error('Parse error:', parseError);
          console.error('Raw answer:', tour.answer);
          setParsedSteps([]);
        }
      } else {
        console.log('No answer field in tour data');
        setParsedSteps([]);
      }
    } catch (error) {
      console.error('=== ERROR FETCHING TOUR DATA ===');
      console.error('Error:', error);
    } finally {
      setIsLoadingTour(false);
    }
  };

  // Function to handle tour question when user asks a question
  const handleTourQuestion = async (question: string) => {
    console.log('=== HANDLING TOUR QUESTION ===');
    console.log('Question:', question);

    // Use connection ID from config with fallback
    const connectionId = getConnectionId();
    console.log('Using connection ID:', connectionId);

    // Fetch tour data
    await fetchTourData(question, connectionId);

    // Trigger step guide start for show actions
    if (onStepGuideStart) {
      onStepGuideStart();
    }
  };

  // Suggested actions to show when no messages - get from settings or use defaults
  const getSuggestedActions = () => {
    // If settings have widget_chips, use those
    if (settings?.widget_chips && settings.widget_chips.length > 0) {
      // console.log('Widget chips from settings:', settings.widget_chips);

      return settings.widget_chips.map((chip: ChipData, index: number) => {
        // Handle both formats: chip_text (expected) and question (actual backend)
        const chipText = chip.chip_text || chip.question || '';
        const chipMode = chip.chip_mode || chip.type || 'tell';
        const mode: 'show' | 'tell' | 'do' =
          chipMode === 'show' || chipMode === 'tell' || chipMode === 'do' ? chipMode : 'tell';

        // console.log(`Processing chip ${index}:`, { chip, chipText, chipMode, mode });

        let icon;
        let isShow = false;

        switch (mode) {
          case 'do':
            icon = (
              <SiTicktick
                className='w-3 h-3 text-xs'
                style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
              />
            );
            isShow = false;
            break;
          case 'show':
            icon = (
              <LuMousePointerClick
                className='w-3 h-3 text-xs'
                style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
              />
            );
            isShow = true;
            break;
          case 'tell':
            icon = (
              <IoChatbubbleEllipsesOutline
                className='w-3 h-3 text-xs'
                style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
              />
            );
            isShow = false;
            break;
          default:
            icon = (
              <IoChatbubbleEllipsesOutline
                className='w-3 h-3 text-xs'
                style={{ fontSize: '0.75rem', width: '0.75rem', height: '0.75rem' }}
              />
            );
            isShow = false;
        }

        // Create a unique ID using the chip content and index
        const uniqueId = `chip-${chipText.replace(/\s+/g, '-').toLowerCase()}-${index}`;

        return {
          id: uniqueId,
          text: chipText,
          icon,
          type: mode,
          isShow,
        };
      });
    }

    return [
      {
        id: 'show-add-product',
        text: 'Show me how to add a new product',
        icon: <LuMousePointerClick className='w-6 h-6' />,
        type: 'show' as const,
        isShow: true,
      },
      {
        id: 'show-login',
        text: 'Show me how to login',
        icon: <LuMousePointerClick className='w-6 h-6' />,
        type: 'show' as const,
        isShow: true,
      },
      {
        id: 'do-login',
        text: 'Do the login process for me',
        icon: <SiTicktick className='w-4 h-4' />,
        type: 'do' as const,
        isShow: false,
      },
      {
        id: 'show-revenue',
        text: 'Show me the revenue metrics',
        icon: <LuMousePointerClick className='w-6 h-6' />,
        type: 'show' as const,
        isShow: true,
      },
      {
        id: 'tell-conversion-rate',
        text: 'What does my conversion rate mean and how can I improve it?',
        icon: <IoChatbubbleEllipsesOutline className='w-5 h-5' />,
        type: 'tell' as const,
        isShow: false,
      },
    ];
  };

  const suggestedActions = getSuggestedActions();
  const seenIds = new Set();
  interface SuggestedActionItem {
    id: string;
    text: string;
    icon: React.ReactElement;
    type: 'tell' | 'show' | 'do';
    isShow: boolean;
  }

  const uniqueSuggestedActions = suggestedActions.map((action: SuggestedActionItem) => {
    let uniqueId = action.id;
    let counter = 0;
    while (seenIds.has(uniqueId)) {
      counter++;
      uniqueId = `${action.id}-${counter}`;
    }
    seenIds.add(uniqueId);

    if (counter > 0) {
      console.warn(`Duplicate ID found: ${action.id}, using: ${uniqueId}`);
    }

    return {
      ...action,
      id: uniqueId,
    };
  });

  const handleSuggestedActionClick = async (
    action: (typeof suggestedActions)[0],
    event: React.MouseEvent
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // FIRST: Switch to the chip's mode if not already in that mode
    // Use onModeChange if available (adds system message), otherwise fall back to onSetMode
    if (action.type) {
      if (onModeChange) {
        // onModeChange adds system message and switches mode
        console.log('Changing mode to:', action.type);
        onModeChange(action.type);
      } else if (onSetMode) {
        // Fallback to direct mode set
        console.log('Setting mode to:', action.type);
        onSetMode(action.type);
      }

      // Wait a tick to ensure mode change is processed and UI updates
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // THEN: Add the chip message as a user message in the chat (like user typed it)
    // The greeting message and all existing messages remain unchanged
    if (onAddMessage) {
      const userMessage = createUserMessage(action.text, action.type, 'chip-message');
      onAddMessage(userMessage);
    }

    // Send message through normal flow (will check for screen access if needed)
    // This ensures chips get the same treatment as typing a message
    if (onSendMessage) {
      console.log('Sending message with mode:', action.type, action.text);

      // Handle tour question for show actions
      if (action.type === 'show') {
        console.log('Handling show action with tour question:', action.text);
        await handleTourQuestion(action.text);

        // Trigger step guide start for show actions
        if (onStepGuideStart) {
          onStepGuideStart();
        }

        // For show actions, pass tour data (connection_id and question)
        // The wrapper in ChatWindow will handle screen access check
        onSendMessage(action.text, action.type, getConnectionId(), action.text);
      } else {
        // The wrapper in ChatWindow will handle screen access check
        onSendMessage(action.text, action.type);
      }
    }
  };

  return (
    <div
      key='message-list-container'
      className={`
            h-full overflow-y-auto px-2 space-y-0.5
            scrollbar-thin scrollbar-track-[#f6f6f6] scrollbar-thumb-[#b6b6b6]
          `}
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: settings.widget_background_color.includes('gradient')
          ? settings.widget_background_color
          : `linear-gradient(135deg, ${settings.widget_background_color} 0%, ${settings.widget_background_color} 100%)`,
        scrollbarColor: `${addOpacity(settings.widget_border_color, 0.3)} ${addOpacity(settings.widget_border_color, 0.1)}`,
        scrollbarWidth: 'thin',
      }}
    >
      {/* Welcome message - always show */}
      <div key='welcome-message' className='group flex flex-col justify-start mt-2'>
        <style>{`
            .agent-logo-img {
              border: none !important;
              outline: none !important;
              box-shadow: ${settings.widget_shadow} !important;
              background-color: transparent !important;
              border-radius: ${settings.widget_border_radius} !important;
            }
            .agent-logo-img-container {
              background-color: transparent !important;
            }
          `}</style>
        <div className='flex items-start gap-1 flex-row'>
          {/* Agent Logo */}
          <div
            className='flex-shrink-0 agent-logo-img-container'
            style={{
              backgroundColor: 'transparent',
              width: '32px',
              height: '32px',
            }}
          >
            <img
              src={MarketrixIcon}
              alt='Marketrix AI'
              className='agent-logo-img'
              style={{
                width: '32px',
                height: '32px',
                boxShadow: settings.widget_shadow,
                borderRadius: settings.widget_border_radius,
                border: 'none',
                outline: 'none',
                display: 'block',
                objectFit: 'cover',
                backgroundColor: 'transparent',
              }}
            />
          </div>

          {/* Message bubble */}
          <div
            className={`
                flex flex-col flex-1
                px-2.5 py-2 rounded-r-lg rounded-tl-lg rounded-bl-lg shadow-sm border
              `}
            style={{
              backgroundColor: '#ffffff',
              backgroundImage: 'none',
              color: settings.widget_text_color,
              borderColor: settings.widget_border_color,
            }}
          >
            {/* Message content */}
            <div className='text-xs font-inter font-medium leading-tight whitespace-pre-wrap break-words'>
              {settings.widget_greeting}
            </div>

            {/* Chips inside the greeting message bubble */}
            {uniqueSuggestedActions.length > 0 && (
              <div className='mt-2.5 mb-1.5 p-0 flex flex-col gap-1'>
                {uniqueSuggestedActions.map((action: SuggestedActionItem, chipIndex: number) => (
                  <button
                    key={`welcome-chip-${action.id}-${chipIndex}`}
                    onClick={(e) => handleSuggestedActionClick(action, e)}
                    className={`
                      w-full flex items-center gap-1 font-inter font-normal text-xs px-2.5 py-2 rounded-lg cursor-pointer 
                      transition-all duration-200 text-left hover:shadow-md hover:scale-[1.01] active:scale-100
                      group
                      leading-tight
                    `}
                    style={{
                      backgroundColor: addOpacity(settings.widget_secondary_color, 0.2),
                      borderColor: addOpacity(settings.widget_secondary_color, 0.3),
                      color: settings.widget_text_color,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = addOpacity(
                        settings.widget_secondary_color,
                        0.3
                      );
                      e.currentTarget.style.borderColor = addOpacity(
                        settings.widget_secondary_color,
                        0.4
                      );
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = addOpacity(
                        settings.widget_secondary_color,
                        0.2
                      );
                      e.currentTarget.style.borderColor = addOpacity(
                        settings.widget_secondary_color,
                        0.3
                      );
                    }}
                  >
                    <span
                      className='flex-shrink-0 flex items-center justify-center'
                      style={{
                        width: '0.75rem',
                        height: '0.75rem',
                        lineHeight: '0.75rem',
                        color: settings.widget_secondary_color,
                      }}
                    >
                      {action.icon}
                    </span>
                    <span
                      className='font-normal leading-none'
                      style={{ color: settings.widget_text_color }}
                    >
                      {action.type === 'show' ? (
                        <>
                          <span
                            className='font-semibold'
                            style={{ color: settings.widget_secondary_color }}
                          >
                            Show me{' '}
                          </span>
                          {action.text.replace(/^Show me\s*/i, '')}
                        </>
                      ) : action.type === 'do' ? (
                        <>
                          <span
                            className='font-semibold'
                            style={{ color: settings.widget_secondary_color }}
                          >
                            Do{' '}
                          </span>
                          {action.text.replace(/^Do\s*/i, '')}
                        </>
                      ) : action.type === 'tell' ? (
                        action.text
                      ) : (
                        action.text
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Timestamp below card - agent message, so right-aligned */}
        <div className='flex justify-end mt-0.5'>
          <span
            className='text-[10px] font-inter font-normal'
            style={{ color: addOpacity(settings.widget_text_color, 0.6) }}
          >
            {formatMessageTime(new Date())}
          </span>
        </div>
      </div>

      {/* Messages */}
      {messages.map((message: ChatMessage, index: number) => {
        // Debug: Log message keys to check for duplicates
        // console.log(`Message ${index}:`, {
        //   id: message.id,
        //   content: message.content ? message.content.substring(0, 50) : 'No content',
        // });

        // Render system messages differently (muted, centered)
        if (message.isSystemMessage) {
          return (
            <div
              key={`message-${message.id}-${index}`}
              className='flex justify-center items-center py-0'
            >
              <span
                className='text-[10px] font-inter font-normal'
                style={{ color: addOpacity(settings.widget_text_color, 0.6) }}
              >
                {message.content}
              </span>
            </div>
          );
        }

        return (
          <div
            key={`message-${message.id}-${index}`}
            className={`group flex flex-col ${
              message.sender === 'user' ? 'justify-end' : 'justify-start'
            } mt-[10px]`}
          >
            <div
              className={`flex items-start gap-1 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Logo */}
              <div
                className='flex-shrink-0 agent-logo-img-container'
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'transparent',
                }}
              >
                {message.sender === 'agent' ? (
                  <img
                    src={MarketrixIcon}
                    alt='Marketrix AI'
                    className='agent-logo-img'
                    style={{
                      width: '32px',
                      height: '32px',
                      boxShadow: settings.widget_shadow,
                      borderRadius: settings.widget_border_radius,
                      border: 'none',
                      outline: 'none',
                      display: 'block',
                      objectFit: 'cover',
                      backgroundColor: 'transparent',
                    }}
                  />
                ) : (
                  <div
                    className='w-8 h-8 flex items-center justify-center rounded-lg'
                    style={{ backgroundColor: settings.widget_accent_color }}
                  >
                    <HiUser
                      className='w-5 h-5'
                      style={{ color: getContrastingColor(settings.widget_accent_color) }}
                    />
                  </div>
                )}
              </div>

              {/* Message bubble */}
              <div
                className={`flex flex-col flex-1
                ${message.videoStream ? 'p-0' : 'px-2.5 py-2'} shadow-sm border
                ${
                  message.sender === 'user'
                    ? 'rounded-l-lg rounded-tr-lg rounded-br-lg'
                    : 'rounded-r-lg rounded-tl-lg rounded-bl-lg'
                }
              `}
                style={{
                  backgroundColor: '#ffffff',
                  color: settings.widget_text_color,
                  borderColor: settings.widget_border_color,
                }}
              >
                {/* Video stream display - edge-to-edge */}
                {message.videoStream && (
                  <VideoStreamDisplay
                    stream={message.videoStream}
                    isUserMessage={message.sender === 'user'}
                  />
                )}
                {/* Message content or placeholder loading animation */}
                {message.isPlaceholder ? (
                  <div className='flex flex-col gap-1.5'>
                    {/* Subtle Facebook Messenger-style loading dots */}
                    <div className='flex items-center gap-1 py-0.5'>
                      <span className='messenger-dot' style={{ animationDelay: '0s' }} />
                      <span className='messenger-dot' style={{ animationDelay: '0.15s' }} />
                      <span className='messenger-dot' style={{ animationDelay: '0.3s' }} />
                    </div>
                    {/* Thinking text with subtle ellipsis at bottom */}
                    <div className='flex items-center'>
                      <span
                        className='text-[10px] font-inter font-normal'
                        style={{ color: addOpacity(settings.widget_text_color, 0.5) }}
                      >
                        Thinking
                        <span className='thinking-dots'>
                          <span style={{ animationDelay: '0s' }}>.</span>
                          <span style={{ animationDelay: '0.2s' }}>.</span>
                          <span style={{ animationDelay: '0.4s' }}>.</span>
                        </span>
                      </span>
                    </div>
                    <style>{`
                      @keyframes messenger-bounce {
                        0%, 60%, 100% {
                          transform: translateY(0);
                          opacity: 0.4;
                        }
                        30% {
                          transform: translateY(-4px);
                          opacity: 0.7;
                        }
                      }
                      .messenger-dot {
                        width: 4px;
                        height: 4px;
                        border-radius: 50%;
                        background-color: ${addOpacity(settings.widget_text_color, 0.35)};
                        animation: messenger-bounce 1.2s ease-in-out infinite;
                        display: inline-block;
                      }
                      @keyframes thinking-dot {
                        0%, 20% { opacity: 0; }
                        50% { opacity: 1; }
                        100% { opacity: 0; }
                      }
                      .thinking-dots span {
                        animation: thinking-dot 1.4s infinite;
                        margin-left: 1px;
                      }
                    `}</style>
                  </div>
                ) : (
                  <>
                    {/* Only show text content if there is content and no video stream */}
                    {message.content && !message.videoStream && (
                      <div className='text-xs font-inter font-medium leading-tight whitespace-pre-wrap break-words'>
                        {message.content
                          .replace(/\n\n__THINKING__$/, '')
                          .replace(/__THINKING__/g, '') || 'No content available'}
                      </div>
                    )}
                    {/* Show Thinking indicator for active task messages when waiting */}
                    {isTaskRunning &&
                      (currentMode === 'show' || currentMode === 'do') &&
                      message.sender === 'agent' &&
                      !message.isSystemMessage &&
                      !message.isScreenAccessRequest &&
                      !message.isPlaceholder &&
                      index === messages.length - 1 &&
                      message.content.includes('__THINKING__') && (
                        <div
                          className='flex flex-col gap-1.5 mt-2 pt-1 border-t'
                          style={{ borderColor: addOpacity(settings.widget_border_color, 0.2) }}
                        >
                          {/* Subtle Facebook Messenger-style loading dots */}
                          <div className='flex items-center gap-1 py-0.5'>
                            <span className='messenger-dot' style={{ animationDelay: '0s' }} />
                            <span className='messenger-dot' style={{ animationDelay: '0.15s' }} />
                            <span className='messenger-dot' style={{ animationDelay: '0.3s' }} />
                          </div>
                          {/* Thinking text with subtle ellipsis at bottom */}
                          <div className='flex items-center'>
                            <span
                              className='text-[10px] font-inter font-normal'
                              style={{ color: addOpacity(settings.widget_text_color, 0.5) }}
                            >
                              Thinking
                              <span className='thinking-dots'>
                                <span style={{ animationDelay: '0s' }}>.</span>
                                <span style={{ animationDelay: '0.2s' }}>.</span>
                                <span style={{ animationDelay: '0.4s' }}>.</span>
                              </span>
                            </span>
                          </div>
                          <style>{`
                            @keyframes messenger-bounce {
                              0%, 60%, 100% {
                                transform: translateY(0);
                                opacity: 0.4;
                              }
                              30% {
                                transform: translateY(-4px);
                                opacity: 0.7;
                              }
                            }
                            .messenger-dot {
                              width: 4px;
                              height: 4px;
                              border-radius: 50%;
                              background-color: ${addOpacity(settings.widget_text_color, 0.35)};
                              animation: messenger-bounce 1.2s ease-in-out infinite;
                              display: inline-block;
                            }
                            @keyframes thinking-dot {
                              0%, 20% { opacity: 0; }
                              50% { opacity: 1; }
                              100% { opacity: 0; }
                            }
                            .thinking-dots span {
                              animation: thinking-dot 1.4s infinite;
                              margin-left: 1px;
                            }
                          `}</style>
                        </div>
                      )}
                  </>
                )}

                {/* Screen access request action buttons - only show if not yet handled */}
                {message.isScreenAccessRequest &&
                  !message.content.includes('✓') &&
                  !message.content.includes('✗') && (
                    <div className='mt-1.5 pt-0.5 flex gap-2'>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onScreenAccessAllow?.();
                        }}
                        className='flex items-center justify-center text-sm font-medium transition-all duration-200 bg-purple-600 text-white shadow-lg border-2 border-transparent'
                        style={{
                          width: '65px',
                          height: '26px',
                          borderRadius: '22px',
                        }}
                      >
                        <span className='text-xs font-medium'>Yes</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onScreenAccessDeny?.();
                        }}
                        className='flex items-center justify-center text-sm font-medium transition-all duration-200 bg-purple-100 text-black hover:bg-purple-200 border border-purple-200'
                        style={{
                          width: '65px',
                          height: '26px',
                          borderRadius: '22px',
                        }}
                      >
                        <span className='text-xs font-medium'>No</span>
                      </button>
                    </div>
                  )}
              </div>
            </div>
            {/* Timestamp below card */}
            {!message.isPlaceholder && (
              <div
                className={`flex ${message.sender === 'user' ? 'justify-start' : 'justify-end'} mt-0.5`}
              >
                <span className='text-[10px] text-gray-400 font-inter font-normal'>
                  {formatMessageTime(message.timestamp)}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Tour loading indicator */}
      {isLoadingTour && (
        <div key='tour-loading-indicator' className='flex justify-start'>
          <div className='w-full px-3 py-2 rounded-2xl bg-blue-50 shadow-sm border border-blue-200'>
            <div className='flex items-center space-x-2'>
              <div className='flex space-x-1'>
                <div className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'></div>
                <div
                  className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
              <span className='text-xs text-blue-600'>Finding tour guide...</span>
            </div>
          </div>
        </div>
      )}

      {/* Tour data display */}
      {tourData && parsedSteps.length > 0 && (
        <div key='tour-data-display' className='flex justify-start'>
          <div className='w-full px-3 py-2 rounded-l-md rounded-b-md bg-white shadow-sm'>
            <div className='space-y-3'>
              <div className='flex items-center space-x-2'>
                <LuMousePointerClick className='w-4 h-4 text-black' />
                <span className='text-sm font-medium text-black'>{tourData.question}</span>
              </div>

              {/* Display tour steps */}
              <div className='space-y-2'>
                {parsedSteps.map((step, index) => (
                  <div
                    key={index}
                    className={`rounded-lg p-2 border ${
                      isStepGuideRunning && index === currentStepIndex
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-green-200'
                    }`}
                  >
                    <div className='flex items-start space-x-2'>
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                          isStepGuideRunning && index === currentStepIndex
                            ? 'bg-blue-100'
                            : 'bg-green-100'
                        }`}
                      >
                        <span
                          className={`text-xs font-medium ${
                            isStepGuideRunning && index === currentStepIndex
                              ? 'text-blue-600'
                              : 'text-green-600'
                          }`}
                        >
                          {step.step_number || index + 1}
                        </span>
                      </div>
                      <div className='flex-1 min-w-0'>
                        <div className='text-sm font-medium text-gray-900'>
                          {step.action && <span className='capitalize'>{step.action}</span>}
                          {step.text && <span className='ml-1 text-gray-600'>"{step.text}"</span>}
                        </div>
                        {step.description && (
                          <div className='text-xs text-gray-600 mt-1'>{step.description}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thinking indicator for show/do mode when task is running */}
      {isTaskRunning && (currentMode === 'show' || currentMode === 'do') && !isLoading && (
        <div key='thinking-indicator' className='flex justify-start px-3 py-1'>
          <span className='text-xs text-gray-400'>
            Thinking
            <span className='thinking-dots'>
              <span style={{ animationDelay: '0s' }}>.</span>
              <span style={{ animationDelay: '0.2s' }}>.</span>
              <span style={{ animationDelay: '0.4s' }}>.</span>
            </span>
          </span>
          <style>{`
            @keyframes thinking-dot {
              0%, 20% { opacity: 0; }
              50% { opacity: 1; }
              100% { opacity: 0; }
            }
            .thinking-dots span {
              animation: thinking-dot 1.4s infinite;
            }
          `}</style>
        </div>
      )}

      {/* Auto-scroll anchor */}
      <div key='scroll-anchor' ref={messagesEndRef} />
    </div>
  );
};

// Video Stream Display Component
interface VideoStreamDisplayProps {
  stream: MediaStream | null;
  isUserMessage?: boolean;
}

const VideoStreamDisplay: React.FC<VideoStreamDisplayProps> = ({
  stream,
  isUserMessage = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      const video = videoRef.current;

      // Cancel any pending play() request
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {
          // Ignore errors from cancelled play requests
        });
        playPromiseRef.current = null;
      }

      // Set the stream source
      video.srcObject = stream;

      // Attempt to play, handling AbortError gracefully
      const playPromise = video.play();
      playPromiseRef.current = playPromise;

      playPromise.catch((error) => {
        // AbortError is expected when a new stream loads - don't log it as an error
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error playing video stream:', error);
        }
        playPromiseRef.current = null;
      });
    }

    return () => {
      // Clean up: cancel any pending play() and clear srcObject
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {
          // Ignore errors from cancelled play requests
        });
        playPromiseRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  if (!stream) return null;

  // Match message bubble border radius: user messages have rounded-l-lg rounded-tr-lg rounded-br-lg
  // So top corners should be rounded: top-left and top-right
  const borderRadiusClass = isUserMessage
    ? 'rounded-tl-lg rounded-tr-lg'
    : 'rounded-tr-lg rounded-tl-lg';

  return (
    <div className={`w-full overflow-hidden mb-1 ${borderRadiusClass}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-auto max-h-48 object-contain ${borderRadiusClass}`}
      />
    </div>
  );
};
