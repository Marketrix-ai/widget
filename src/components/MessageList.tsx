// / <reference lib="dom" />
import React, { useState } from 'react';
import { IoChatbubbleEllipsesOutline } from 'react-icons/io5';
import { LuMousePointerClick } from 'react-icons/lu';
import { SiTicktick } from 'react-icons/si';

import MarketrixLogo from '../assets/marketrix-icon.png';
import { API_URL_GLOBAL_SET } from '../config';
import { useWidgetAtmosphere } from '../hooks/useWidgetAtmosphere';
import type { WidgetSettingsData } from '../sdk';
import type { ChatMessage, MarketrixConfig } from '../types';
import { formatMessageTime } from '../utils/formatting';
import { ScreenAccessModal } from './ScreenAccessModal';

// Define the chip type to handle both formats
type ChipData = {
  chip_mode?: string;
  chip_text?: string;
  type?: string;
  question?: string;
};

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSendMessage?: (
    message: string,
    mode?: 'show' | 'tell' | 'do',
    connectionId?: number,
    question?: string
  ) => void;
  onSetMode?: (mode: 'show' | 'tell' | 'do') => void;
  config?: MarketrixConfig;
  onStepGuideStart?: () => void;
  integrationSettings?: WidgetSettingsData | null;
  onScreenSharingChange?: (
    isSharing: boolean,
    stream?: MediaStream | null,
    showPreview?: boolean
  ) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  messagesEndRef,
  onSendMessage,
  onSetMode,
  config,
  onStepGuideStart,
  integrationSettings,
  onScreenSharingChange,
}) => {
  // Get atmosphere configuration
  const { getWidgetText, getActiveAvatar } = useWidgetAtmosphere(config);
  const widgetText = getWidgetText();
  const activeAvatar = getActiveAvatar();

  // Tour data state
  interface TourStep {
    id: number;
    title: string;
    description: string;
    text?: string;
    selector?: string;
    xpath?: string;
    action?: string;
    order: number;
    step_number?: number;
    element?: HTMLElement;
  }

  interface TourData {
    id: number;
    connection_id: number;
    question: string;
    created_at: string;
    updated_at: string;
    answer: TourStep[];
  }

  const [tourData, setTourData] = useState<TourData | null>(null);
  const [parsedSteps, setParsedSteps] = useState<TourStep[]>([]);
  const [isLoadingTour, setIsLoadingTour] = useState(false);

  // Step-by-step tour state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isStepGuideRunning, setIsStepGuideRunning] = useState(false);
  const [currentStepElement, setCurrentStepElement] = useState<HTMLElement | null>(null);
  const [stepTimer, setStepTimer] = useState<number | null>(null);

  // Screen sharing state
  const [_isScreenAccessActive, setIsScreenAccessActive] = useState(false);
  const [showScreenAccessModal, setShowScreenAccessModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'show' | 'do'; text: string } | null>(
    null
  );

  // Cache for found elements to prevent duplicate searches
  const elementCache = new Map<string, HTMLElement | null>();

  // Track console log counts for each step
  const stepLogCounts = new Map<number, number>();

  // Track typewriter animation state for each step
  const typewriterRunning = new Map<number, boolean>();

  // Store active typewriter intervals to clear them
  const activeTypewriterIntervals = new Map<number, number>();

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
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'A' ||
        (target.tagName === 'BUTTON' && (target as HTMLButtonElement).type === 'submit')
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
    const selector = step.selector || (typeof step.element === 'string' ? step.element : undefined);

    let element = selector ? findElementBySelector(selector) : null;
    if (!element) {
      console.warn(`❌ Element not found for step ${stepIndex + 1}:`, selector);

      // Try alternative selectors
      const elementStr = typeof step.element === 'string' ? step.element : '';
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
        setStepTimer(timer as unknown as number);
        return;
      }

      // Use the found element
      element = foundElement as HTMLElement;
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
    descriptionDiv.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
      color: white;
      padding: 16px;
      border-radius: 8px;
      max-width: 350px;
      min-width: 350px;
      font-size: 14px;
      line-height: 1.6;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(59, 130, 246, 0.4);
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
              ? `<button id="done-step-btn" style="background: #10b981; border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">
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
      const textElement = descriptionDiv.querySelector('#step-description-text') as HTMLElement;
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
            if (element.tagName === 'BUTTON' && (element as HTMLButtonElement).type === 'submit') {
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
            const input = element as HTMLInputElement;

            // Focus the input for user to fill manually
            input.focus();

            console.log('Input field focused, waiting for user to fill manually');
          }
          break;

        case 'select':
          // Handle select elements
          if (element.tagName === 'SELECT') {
            const select = element as HTMLSelectElement;
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

  // Note: Sample text and type animation functions removed - users now fill fields manually

  // Function to add smooth typewriter animation to description
  const addTypewriterAnimation = (
    descriptionDiv: HTMLElement,
    text: string,
    stepIndex: number,
    onComplete?: () => void
  ) => {
    const textElement = descriptionDiv.querySelector('#step-description-text') as HTMLElement;
    if (!textElement) {
      console.log('⚠️ Text element not found');
      return;
    }

    // Clear any existing typewriter interval for this step
    if (activeTypewriterIntervals.has(stepIndex)) {
      console.log(`🛑 Clearing existing typewriter for step ${stepIndex + 1}`);
      clearInterval(activeTypewriterIntervals.get(stepIndex)!);
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
          if (style && style.parentNode) {
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
    activeTypewriterIntervals.set(stepIndex, typeInterval as unknown as number);
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
    (element as HTMLElement & { _tourClickHandler?: (e: Event) => void })._tourClickHandler =
      clickHandler;
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
            (typeof currentStep.element === 'string' ? currentStep.element : undefined);
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
    successBox.style.cssText = `
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
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
          color: #059669;
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
    const spotlight = document.getElementById('step-spotlight');
    const description = document.getElementById('step-description');

    if (spotlight) spotlight.remove();
    if (description) description.remove();

    // Reset flags
    // (typewriter state is now tracked per step via typewriterLogCounts)

    // Clear processed steps for current step only
    stepLogCounts.delete(currentStepIndex);
    typewriterRunning.delete(currentStepIndex);

    // Clear any active typewriter interval for current step
    if (activeTypewriterIntervals.has(currentStepIndex)) {
      clearInterval(activeTypewriterIntervals.get(currentStepIndex)!);
      activeTypewriterIntervals.delete(currentStepIndex);
    }

    // Clean up any existing typewriter styles
    const existingStyle = document.getElementById('typewriter-cursor-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Remove highlight class from current element
    if (currentStepElement) {
      currentStepElement.classList.remove('step-highlight');
    }

    // Remove highlight class from ALL elements to ensure no pulsing remains
    const allHighlightedElements = document.querySelectorAll('.step-highlight');
    allHighlightedElements.forEach((element) => {
      element.classList.remove('step-highlight');

      // Remove any tour click handlers
      const elementWithHandler = element as HTMLElement & {
        _tourClickHandler?: (e: Event) => void;
      };
      if (elementWithHandler._tourClickHandler) {
        element.removeEventListener('click', elementWithHandler._tourClickHandler, true);
        delete elementWithHandler._tourClickHandler;
      }
    });

    // All step highlights, animations, and click handlers removed
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

    // Note: We don't clear parsedSteps and tourData here so they can be reused for restart
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
          element = document.querySelector(`[data-demo-element="${elementValue}"]`) as HTMLElement;
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
          border: 3px solid #3b82f6 !important;
          border-radius: 8px;
          animation: stepHighlightPulse 2s infinite, stepHighlightGlow 3s infinite;
          box-shadow: 0 0 25px rgba(59, 130, 246, 0.6), 0 0 50px rgba(59, 130, 246, 0.3), inset 0 0 20px rgba(59, 130, 246, 0.1);
          transform: scale(1.02);
          transition: all 0.3s ease;
        }

        @keyframes stepHighlightPulse {
          0% {
            box-shadow: 0 0 25px rgba(59, 130, 246, 0.6), 0 0 50px rgba(59, 130, 246, 0.3), inset 0 0 20px rgba(59, 130, 246, 0.1);
            transform: scale(1.02);
          }
          50% {
            box-shadow: 0 0 35px rgba(59, 130, 246, 0.9), 0 0 70px rgba(59, 130, 246, 0.5), inset 0 0 30px rgba(59, 130, 246, 0.2);
            transform: scale(1.03);
          }
          100% {
            box-shadow: 0 0 25px rgba(59, 130, 246, 0.6), 0 0 50px rgba(59, 130, 246, 0.3), inset 0 0 20px rgba(59, 130, 246, 0.1);
            transform: scale(1.02);
          }
        }

        @keyframes stepHighlightGlow {
          0%, 100% {
            border-color: #3b82f6;
          }
          25% {
            border-color: #8b5cf6;
          }
          50% {
            border-color: #06b6d4;
          }
          75% {
            border-color: #10b981;
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
          background: linear-gradient(135deg, #10b981, #059669) !important;
          border: none !important;
          color: white !important;
          padding: 10px 20px !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          margin-top: 10px !important;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3) !important;
        }

        #done-step-btn:hover {
          background: linear-gradient(135deg, #059669, #047857) !important;
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4) !important;
        }

        #prev-step-btn:hover {
          background: rgba(255, 255, 255, 0.3) !important;
        }

        #next-step-btn:hover {
          background: #2563eb !important;
        }

        #done-step-btn:hover {
          background: #059669 !important;
          transform: translateY(-1px);
        }

        #step-description-text {
          position: relative;
        }

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

  // Function to fetch tour data from API
  const fetchTourData = async (question: string, connectionId?: number) => {
    try {
      setIsLoadingTour(true);
      console.log('=== FETCHING TOUR DATA ===');
      console.log('Question:', question);
      console.log('Connection ID:', connectionId);

      // Fetch tour data from API
      const url = `${API_URL_GLOBAL_SET.API_END_POINT}/tour?question=${encodeURIComponent(question)}&connection_id=${connectionId}`;
      console.log('Fetching tour data from:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Tour API Error:', response.status, response.statusText);
        return;
      }

      const data: unknown = await response.json();
      console.log('=== TOUR API RESPONSE ===');
      console.log('Full response:', data);

      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        const responseData = data as { success: boolean; data: unknown };
        if (responseData.success && responseData.data) {
          const tour = responseData.data as TourData;
          console.log('=== TOUR DATA ===');
          console.log('Tour ID:', tour.id);
          console.log('Connection ID:', tour.connection_id);
          console.log('Question:', tour.question);
          console.log('Answer (raw):', tour.answer);

          // Store tour data
          setTourData(tour);

          // Handle the answer data - it's already a JSON object, not a string
          if (tour.answer) {
            try {
              console.log('=== PROCESSING TOUR ANSWER ===');
              console.log('Tour answer type:', typeof tour.answer);
              console.log('Tour answer:', tour.answer);

              // The answer is already a JSON object (array of steps)
              let steps = tour.answer;

              // If it's a string, parse it
              if (typeof tour.answer === 'string') {
                console.log('Parsing answer string...');
                steps = JSON.parse(tour.answer) as TourStep[];
              }

              // Handle both array format and object with steps property
              let parsedSteps = steps;
              if (
                steps &&
                typeof steps === 'object' &&
                !Array.isArray(steps) &&
                'steps' in steps &&
                Array.isArray((steps as { steps: unknown }).steps)
              ) {
                console.log('Answer has steps property, extracting steps array');
                parsedSteps = (steps as { steps: TourStep[] }).steps;
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
        } else {
          console.log('No tour data found in response');
        }
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

    // Use default connection ID for tour queries
    const connectionId = 1;
    console.log('Using connection ID:', connectionId);

    // Fetch tour data
    await fetchTourData(question, connectionId);

    // Trigger step guide start for show actions
    if (onStepGuideStart) {
      onStepGuideStart();
    }
  };

  // Suggested actions to show when no messages - get from integration settings or use defaults
  const getSuggestedActions = () => {
    // If integration settings have widget_chips, use those
    if (integrationSettings?.widget_chips && integrationSettings.widget_chips.length > 0) {
      console.log('Widget chips from integration settings:', integrationSettings.widget_chips);

      return integrationSettings.widget_chips.map((chip: ChipData, index: number) => {
        // Handle both formats: chip_text (expected) and question (actual backend)
        const chipText = chip.chip_text || chip.question || '';
        const chipMode = chip.chip_mode || chip.type || 'tell';
        const mode = chipMode as 'show' | 'tell' | 'do';

        console.log(`Processing chip ${index}:`, { chip, chipText, chipMode, mode });

        let icon;
        let isShow = false;

        switch (mode) {
          case 'do':
            icon = <SiTicktick className='w-4 h-4' />;
            isShow = false;
            break;
          case 'show':
            icon = <LuMousePointerClick className='w-6 h-6' />;
            isShow = true;
            break;
          case 'tell':
            icon = <IoChatbubbleEllipsesOutline className='w-5 h-5' />;
            isShow = false;
            break;
          default:
            icon = <IoChatbubbleEllipsesOutline className='w-5 h-5' />;
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

    // Check if there are any chips in a different location or format
    console.log('No widget_chips found, checking for alternative chip formats...');
    console.log(
      'Full integration settings structure:',
      JSON.stringify(integrationSettings, null, 2)
    );

    // Fallback to default suggested actions if no integration settings
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

  // Debug: Log suggested actions to check for duplicate keys
  console.log(
    'Suggested actions:',
    suggestedActions.map((action) => ({ id: action.id, text: action.text }))
  );

  // Check for duplicate IDs and fix them
  const seenIds = new Set();
  interface SuggestedActionItem {
    id: string;
    text: string;
    icon: JSX.Element;
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

    // Set the mode based on action type FIRST
    if (onSetMode && action.type) {
      console.log('Setting mode to:', action.type);
      onSetMode(action.type as 'show' | 'tell' | 'do');
    }

    // Show screen access modal for show and do modes
    if (action.type === 'show' || action.type === 'do') {
      console.log(`🎥 Screen access requested for mode: ${action.type}`);
      setPendingAction({ type: action.type as 'show' | 'do', text: action.text });
      setShowScreenAccessModal(true);
      return; // Don't proceed with other actions until modal is handled
    }

    // Handle tell mode actions (no screen sharing needed)
    if (action.type === 'tell') {
      // Send message for tell mode
      if (onSendMessage) {
        console.log('Sending message with mode:', action.type, action.text);
        onSendMessage(action.text, action.type as 'tell');
      }
    }
  };

  // Function to handle modal responses
  const handleModalAllow = async () => {
    console.log('✅ User allowed screen access');
    setShowScreenAccessModal(false);
    await startScreenCapture();

    // After screen access is granted, proceed with the pending action
    if (pendingAction) {
      console.log('🎯 Processing pending action:', pendingAction);

      // Handle tour question for show actions
      if (pendingAction.type === 'show') {
        console.log('Handling show action with tour question:', pendingAction.text);
        await handleTourQuestion(pendingAction.text);
      }

      // Trigger step guide start for show actions
      if (pendingAction.type === 'show' && onStepGuideStart) {
        onStepGuideStart();
      }

      // Send message with the correct mode and tour data
      if (onSendMessage) {
        console.log('Sending message with mode:', pendingAction.type, pendingAction.text);
        // For show actions, pass tour data (connection_id and question)
        if (pendingAction.type === 'show') {
          console.log('Calling onSendMessage with tour data:', {
            message: pendingAction.text,
            mode: pendingAction.type,
            connectionId: 1,
            question: pendingAction.text,
          });
          onSendMessage(pendingAction.text, pendingAction.type, 1, pendingAction.text);
        } else {
          console.log('Calling onSendMessage without tour data:', {
            message: pendingAction.text,
            mode: pendingAction.type,
          });
          onSendMessage(pendingAction.text, pendingAction.type);
        }
      }

      // Clear pending action
      setPendingAction(null);
    }
  };

  const handleModalDeny = () => {
    console.log('❌ User denied screen access');
    setShowScreenAccessModal(false);
    setPendingAction(null);
  };

  const handleModalClose = () => {
    console.log('🚫 Screen access modal closed');
    setShowScreenAccessModal(false);
    setPendingAction(null);
  };

  // Screen sharing functions
  const startScreenCapture = async () => {
    try {
      console.log('🎥 Starting screen capture...');

      // Request screen capture permission
      const stream = await (navigator as Navigator & { mediaDevices: MediaDevices }).mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      // Create a minimal status indicator
      const statusIndicator = document.createElement('div');
      statusIndicator.id = 'marketrix-screen-status';
      statusIndicator.style.position = 'fixed';
      statusIndicator.style.top = '20px';
      statusIndicator.style.left = '20px';
      statusIndicator.style.zIndex = '9999';
      statusIndicator.style.display = 'flex';
      statusIndicator.style.alignItems = 'center';
      statusIndicator.style.gap = '8px';
      statusIndicator.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
      statusIndicator.style.padding = '8px 16px';
      statusIndicator.style.borderRadius = '20px';
      statusIndicator.style.fontSize = '14px';
      statusIndicator.style.fontWeight = '500';
      statusIndicator.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      statusIndicator.style.border = '1px solid rgba(0, 0, 0, 0.1)';
      statusIndicator.innerHTML = `
        <div style="width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; animation: pulse 2s infinite;"></div>
        Marketrix is monitoring your screen
        <button id="marketrix-stop-btn" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 12px; cursor: pointer; font-size: 12px; margin-left: 8px;">Stop</button>
      `;

      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);

      // Add the status indicator to the page
      document.body.appendChild(statusIndicator);

      // Add click handler for stop button
      const stopBtn = document.getElementById('marketrix-stop-btn');
      if (stopBtn) {
        stopBtn.onclick = () => {
          stopScreenCapture();
          setIsScreenAccessActive(false);
        };
      }

      // Handle when user stops sharing
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenCapture();
          setIsScreenAccessActive(false);
        };
      }

      // Store references for cleanup
      (window as Window & { screenCaptureStream?: MediaStream; screenCaptureOverlay?: HTMLElement }).screenCaptureStream = stream;
      (window as Window & { screenCaptureStream?: MediaStream; screenCaptureOverlay?: HTMLElement }).screenCaptureOverlay = statusIndicator;

      // Set screen access active state
      setIsScreenAccessActive(true);

      // Notify parent component about screen sharing state
      onScreenSharingChange?.(true, stream, true);

      console.log('✅ Screen capture started successfully');
    } catch (error) {
      console.error('❌ Error accessing screen:', error);
      setIsScreenAccessActive(false);
      // Show error message to user
      alert('Unable to access screen. Please check your permissions.');
    }
  };

  const stopScreenCapture = () => {
    console.log('🛑 Stopping screen capture...');

    // Stop all video tracks
    if ((window as any).screenCaptureStream) {
      (window as any).screenCaptureStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
    }

    // Remove status indicator
    const statusIndicator = document.getElementById('marketrix-screen-status');
    if (statusIndicator) {
      document.body.removeChild(statusIndicator);
    }

    // Clear references and state
    (window as any).screenCaptureStream = null;
    (window as any).screenCaptureOverlay = null;
    setIsScreenAccessActive(false);

    // Notify parent component about screen sharing state
    onScreenSharingChange?.(false, null, false);

    console.log('✅ Screen capture stopped');
  };

  return (
    <div
      key='message-list-container'
      className={`
        h-full overflow-y-auto px-4 space-y-3
        bg-transparent
        scrollbar-thin scrollbar-track-[#f6f6f6] scrollbar-thumb-[#b6b6b6]
      `}
      style={{
        scrollbarColor: '#f6f6f6 transparent',
        scrollbarWidth: 'thin',
        marginRight: '12px',
      }}
    >
      {/* Welcome message */}
      {messages.length === 0 && !isLoading && (
        <div key='welcome-message' className='space-y-3'>
          <div className='flex justify-start'>
            <div className='w-full '>
              <div className='flex gap-2'>
                <img src={MarketrixLogo} alt='Marketrix Logo' className='w-6 h-6 object-cover' />
                <div className=' font-inter font-normal text-sm bg-white text-black px-3 py-2 gradient-border'>
                  {widgetText.greeting || "Hey! 👋 I'm Marketrix AI, How can I help you"}
                </div>
              </div>
              <div className='flex items-center justify-between mt-1.5 text-sm font-medium text-[#1D2939]'>
                <span>{activeAvatar.name || 'Marketrix AI'}</span>
                <span className='text-[#667085] text-xs font-normal'>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long' })}{' '}
                  {new Date().toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggested actions */}
      {!isLoading && (
        <div key='suggested-actions' className='space-y-2'>
          {uniqueSuggestedActions.map((action: any, index: number) => (
            <div key={`suggested-action-${action.id}-${index}`} className='flex justify-start'>
              <button
                onClick={(e) => handleSuggestedActionClick(action, e)}
                className={`
                  w-full font-inter font-normal text-sm px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 text-left hover:shadow-md
                  ${
                    action.isShow
                      ? 'bg-white border border-gray-200 hover:bg-gray-50'
                      : 'bg-white border border-gray-200 hover:bg-gray-50'
                  }
                `}
              >
                <div className='text-sm text-black flex items-center space-x-2'>
                  <span className='text-black'>{action.icon}</span>
                  <span className='font-normal'>
                    {action.type === 'show' ? (
                      <>
                        <span className='font-bold'>Show me </span>
                        {action.text.replace(/^Show me\s*/i, '')}
                      </>
                    ) : action.type === 'do' ? (
                      <>
                        <span className='font-bold'>Do </span>
                        {action.text.replace(/^Do\s*/i, '')}
                      </>
                    ) : action.type === 'tell' ? (
                      action.text
                    ) : (
                      action.text
                    )}
                  </span>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.map((message, index) => {
        // Debug: Log message keys to check for duplicates
        console.log(`Message ${index}:`, {
          id: message.id,
          content: message.content ? message.content.substring(0, 50) : 'No content',
        });
        return (
          <div
            key={`message-${message.id}-${index}`}
            className={`flex flex-col gap-1 ${
              message.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`flex flex-col gap-2 justify-between
              w-full px-3 py-3 rounded-l-md rounded-b-md shadow-sm border
              ${
                message.sender === 'user'
                  ? 'bg-[#101828] text-white'
                  : 'bg-white text-black border-gray-200'
              }
            `}
            >
              {message.sender === 'user' && message.mode && (
                <span className='inline-flex items-center gap-1 px-2 py-0.5 bg-[#6941C6] text-white text-xs font-medium rounded-2xl w-fit'>
                  {message.mode === 'show' ? (
                    <LuMousePointerClick className='w-3 h-3' />
                  ) : message.mode === 'tell' ? (
                    <IoChatbubbleEllipsesOutline className='w-3 h-3' />
                  ) : message.mode === 'do' ? (
                    <SiTicktick className='w-3 h-3' />
                  ) : null}
                  {message.mode === 'show'
                    ? 'Show'
                    : message.mode === 'tell'
                      ? 'Tell'
                      : message.mode === 'do'
                        ? 'Do'
                        : message.mode}
                </span>
              )}
              {/* Message content */}
              <div className='text-sm font-inter font-normal whitespace-pre-wrap break-words'>
                {message.content || 'No content available'}
              </div>
            </div>
            <div className='flex items-center justify-between text-xs font-inter font-normal'>
              <div className='items-center gap-2'>
                <span>
                  {message.sender === 'user' ? 'You' : activeAvatar.name || 'Marketrix AI'}
                </span>
              </div>
              <span>{formatMessageTime(message.timestamp)}</span>
            </div>
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

      {/* Loading indicator */}
      {isLoading && (
        <div key='loading-indicator' className='flex justify-start'>
          <div className='w-full px-3 py-2 rounded-2xl bg-white shadow-sm border border-gray-200'>
            <div className='flex items-center space-x-2'>
              <div className='flex space-x-1'>
                <div className='w-2 h-2 bg-gradient-to-r from-green-400 to-purple-500 rounded-full animate-bounce'></div>
                <div
                  className='w-2 h-2 bg-gradient-to-r from-green-400 to-purple-500 rounded-full animate-bounce'
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className='w-2 h-2 bg-gradient-to-r from-green-400 to-purple-500 rounded-full animate-bounce'
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
              <span className='text-xs text-gray-500'>Typing...</span>
            </div>
          </div>
        </div>
      )}

      {/* Auto-scroll anchor */}
      <div key='scroll-anchor' ref={messagesEndRef} />

      {/* Screen Access Modal */}
      <ScreenAccessModal
        isOpen={showScreenAccessModal}
        onAllow={handleModalAllow}
        onDeny={handleModalDeny}
        onClose={handleModalClose}
      />
    </div>
  );
};
