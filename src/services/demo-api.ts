import type { MarketrixConfig, SendMessageRequest, SendMessageResponse } from '../types';

export interface DemoContextMessage {
  question: string;
  responses: {
    show: string;
    tell: string;
    do: string;
  };
}

interface StepGuide {
  step_number: number;
  action: string;
  element: string;
  id?: string;
  class?: string;
  text?: string;
  style?: string;
  description: string;
  selector?: string;
  icon?: {
    alt: string;
    src: string;
    width: number;
    height: number;
  };
}

class DemoApiService {
  private config: MarketrixConfig;
  private currentContext: string | null = null;
  private currentStepGuide: StepGuide[] | null = null;
  private currentStepIndex: number = 0;

  // Context-aware messages for different elements
  private contextMessages: Record<string, DemoContextMessage> = {
    dashboard: {
      question:
        "I see you're looking at the Dashboard button! Would you like me to show you how to navigate to the main dashboard or explain what key metrics you'll find there?",
      responses: {
        show: 'Let me highlight the key areas of the dashboard for you! The main dashboard shows your most important business metrics at a glance.',
        tell: 'The dashboard is your command center! It displays real-time metrics like revenue, orders, customer count, and conversion rates. You can customize which widgets appear based on your business priorities.',
        do: 'I can help you customize your dashboard layout. Would you like me to add specific widgets or rearrange the current ones to better suit your workflow?',
      },
    },
    products: {
      question:
        'Interested in product management? I can show you how to add new products, manage inventory, or explain the product catalog features!',
      responses: {
        show: "Here's how product management works - I'll walk you through adding a new product step by step!",
        tell: 'The Products section lets you manage your entire inventory. You can add new items, set pricing, manage stock levels, organize into categories, and track performance metrics for each product.',
        do: "I can help you add a new product right now! Just tell me the product details and I'll guide you through the process.",
      },
    },
    orders: {
      question:
        'Looking at order management? I can explain the order workflow, show you how to process orders, or help you track specific orders!',
      responses: {
        show: 'Let me demonstrate the order processing workflow from receipt to delivery!',
        tell: "Order management handles your entire fulfillment process. Orders flow through stages: received → payment processing → fulfillment → delivery. You can track each order's status and manage any issues that arise.",
        do: 'I can help you process pending orders or update order statuses. Which orders would you like me to help you with?',
      },
    },
    customers: {
      question:
        'Looking at customer management? I can show you customer profiles, explain segmentation, or help you with customer service tasks!',
      responses: {
        show: 'Let me walk you through the customer management interface and show you how to view customer details and history!',
        tell: 'Customer management gives you a complete view of your customers - their purchase history, preferences, support tickets, and lifetime value. You can segment customers for targeted marketing.',
        do: 'I can help you find specific customers, update their information, or resolve customer service issues. What would you like me to help with?',
      },
    },
    analytics: {
      question:
        'Interested in analytics? I can show you key reports, explain the metrics, or help you create custom dashboards!',
      responses: {
        show: 'Let me demonstrate the analytics dashboard and show you the most important reports for your business!',
        tell: 'Analytics provides deep insights into your business performance - sales trends, customer behavior, product performance, and marketing effectiveness. You can create custom reports and set up automated alerts.',
        do: 'I can generate specific reports for you or set up automated analytics alerts. What metrics would you like me to analyze?',
      },
    },
    settings: {
      question:
        'Need help with settings? I can show you system configuration, explain different options, or help you update your preferences!',
      responses: {
        show: 'Let me guide you through the settings panel and show you the most important configuration options!',
        tell: 'Settings allow you to customize your system preferences, payment gateways, shipping options, tax configurations, user permissions, and integrations with other tools.',
        do: 'I can help you configure specific settings or update your system preferences. What settings would you like me to adjust?',
      },
    },
    revenue: {
      question:
        "I notice you're checking the revenue metrics! Would you like me to explain what drives this number or show you how to improve revenue growth?",
      responses: {
        show: 'Let me break down your revenue sources and show you which products and channels are performing best!',
        tell: 'Your monthly revenue of $24,563 represents a healthy 12.5% growth! This includes sales from all channels minus returns and refunds. The growth indicates strong business momentum.',
        do: 'I can help you identify opportunities to increase revenue. Would you like me to analyze your top-performing products or suggest pricing optimizations?',
      },
    },
    'orders-count': {
      question:
        'Looking at order volume? I can explain order trends, show you order details, or help you optimize order processing!',
      responses: {
        show: 'Let me show you the order breakdown by status and highlight any orders that need attention!',
        tell: "You've processed 342 orders this month with 8.3% growth! This includes new orders, completed orders, and any cancelled or refunded orders. The growth shows increasing customer demand.",
        do: 'I can help you process pending orders, update order statuses, or identify orders that need special attention. What would you like me to focus on?',
      },
    },
    'customers-count': {
      question:
        'Checking customer numbers? I can show you customer segments, explain growth patterns, or help you with customer retention!',
      responses: {
        show: 'Let me show you your customer breakdown by segments and highlight your most valuable customers!',
        tell: 'You have 1,247 active customers with impressive 15.2% growth! This includes new registrations, repeat customers, and active users. The growth indicates strong customer acquisition.',
        do: 'I can help you identify at-risk customers, create retention campaigns, or analyze customer lifetime value. What customer insights would you like me to provide?',
      },
    },
    conversion: {
      question:
        "I see you're looking at conversion rates. The 3.8% rate with a -2.1% change needs attention! Want me to explain what's happening or suggest improvements?",
      responses: {
        show: 'Let me show you the conversion funnel and highlight where visitors are dropping off!',
        tell: 'A 3.8% conversion rate means about 38 out of every 1,000 visitors make a purchase. The recent 2.1% decline could be due to seasonal factors, website issues, or increased competition. Industry average is typically 2-4%.',
        do: 'I can help improve your conversion rate! Let me analyze your checkout process, product pages, and suggest A/B tests to optimize conversions.',
      },
    },
    'add-product': {
      question:
        "Ready to add a new product? I can walk you through the entire process step-by-step or explain what information you'll need!",
      responses: {
        show: 'Let me guide you through adding a new product - from basic details to pricing and inventory setup!',
        tell: 'Adding a product requires: product name, description, category, pricing, inventory count, images, and SEO details. You can also set up variants for different sizes/colors and configure shipping options.',
        do: "I'll help you add a new product right now! What type of product are you adding? I'll collect all the necessary information and create the listing for you.",
      },
    },
    'bulk-import': {
      question:
        'Need to import multiple products? I can show you the import process, explain file formats, or help you prepare your data!',
      responses: {
        show: 'Let me demonstrate the bulk import process and show you how to format your product data correctly!',
        tell: "Bulk import allows you to add hundreds of products at once using CSV or Excel files. You'll need columns for name, description, price, inventory, categories, and images. The system validates data before import.",
        do: 'I can help you prepare your import file or guide you through the import process. Do you have a product file ready to import?',
      },
    },
    categories: {
      question:
        'Working with product categories? I can show you category management, explain organization strategies, or help you restructure your catalog!',
      responses: {
        show: 'Let me show you how to create and organize product categories for better customer navigation!',
        tell: 'Categories help customers find products easily and improve your SEO. You can create hierarchical categories (main > sub > specific), assign products to multiple categories, and use categories for targeted marketing.',
        do: 'I can help you reorganize your categories, create new ones, or assign products to better categories. What category structure would work best for your products?',
      },
    },
    inventory: {
      question:
        'Checking inventory levels? I can show you stock status, explain inventory alerts, or help you manage stock levels!',
      responses: {
        show: 'Let me show you your current inventory status and highlight products that need restocking!',
        tell: 'Inventory management tracks stock levels, sets low-stock alerts, manages supplier information, and handles reorder points. You can set up automatic reordering and track inventory across multiple locations.',
        do: 'I can help you update stock levels, set up low inventory alerts, or create reorder reports. Which inventory tasks would you like me to handle?',
      },
    },
    'order-received': {
      question:
        'Looking at the order received step? I can explain what happens when orders come in or show you order processing workflow!',
      responses: {
        show: 'Let me show you what happens when a new order is received and how it enters your processing queue!',
        tell: 'When orders are received, the system captures customer details, validates payment information, checks inventory availability, and creates an order record. Orders then move to payment processing.',
        do: "I can help you review new orders, handle order issues, or update order details. Are there specific orders you'd like me to check?",
      },
    },
    'payment-processing': {
      question:
        "I see you're looking at the payment processing step! Need help understanding how payments work or troubleshooting payment issues?",
      responses: {
        show: 'Let me show you how payment processing works and what happens when payments succeed or fail!',
        tell: 'Payment processing verifies customer payment methods, charges the amount, and confirms the transaction. This step includes fraud detection, currency conversion if needed, and integration with your payment gateway.',
        do: "I can help you resolve payment issues or update payment settings. Are there specific payment problems you'd like me to investigate?",
      },
    },
    fulfillment: {
      question:
        'Looking at fulfillment? I can show you the picking and packing process, explain shipping options, or help you optimize fulfillment!',
      responses: {
        show: 'Let me demonstrate the fulfillment workflow from inventory picking to package preparation!',
        tell: 'Fulfillment involves picking items from inventory, packing them securely, generating shipping labels, and preparing packages for delivery. You can optimize this process with barcode scanning and automated packing slips.',
        do: 'I can help you process fulfillment tasks, generate packing slips, or optimize your fulfillment workflow. What fulfillment tasks need attention?',
      },
    },
    delivery: {
      question:
        'Checking delivery status? I can show you shipping tracking, explain delivery options, or help you manage delivery issues!',
      responses: {
        show: 'Let me show you how to track deliveries and manage shipping notifications for customers!',
        tell: 'Delivery management includes shipping carrier integration, tracking number generation, customer notifications, and handling delivery exceptions. You can offer multiple shipping options and track delivery performance.',
        do: 'I can help you track specific deliveries, resolve shipping issues, or update delivery preferences. Which deliveries need attention?',
      },
    },
    'customer-segments': {
      question:
        'Checking out customer segments? I can explain how these segments are created or show you how to target each group effectively!',
      responses: {
        show: 'Let me show you what defines each customer segment and how to create targeted campaigns for each group!',
        tell: 'Your customers are segmented by purchase behavior: VIP customers (23%) are high-value repeat buyers, Regular buyers (45%) purchase consistently, and New customers (32%) are first-time buyers. Each segment needs different marketing approaches.',
        do: 'I can help you create targeted campaigns for each segment. Which customer group would you like to focus on first?',
      },
    },
    'support-tickets': {
      question:
        'Looking at support tickets? I can show you ticket management, explain response strategies, or help you resolve specific issues!',
      responses: {
        show: 'Let me show you the support ticket interface and demonstrate how to efficiently handle customer inquiries!',
        tell: 'You have 12 open tickets with an average response time of 2.3 hours. Support ticket management includes categorizing issues, prioritizing urgent matters, and tracking resolution time to maintain customer satisfaction.',
        do: 'I can help you review open tickets, draft responses, or escalate urgent issues. Which support tickets need immediate attention?',
      },
    },
    'email-campaigns': {
      question:
        'Interested in email marketing? I can show you how to create campaigns, explain best practices, or help you launch your first campaign!',
      responses: {
        show: 'Let me demonstrate how to create an effective email campaign from template selection to sending!',
        tell: 'Email campaigns let you reach customers with personalized messages, promotional offers, and product updates. You can segment your audience, use templates, track open rates, and automate follow-ups based on customer behavior.',
        do: 'I can help you create and launch an email campaign right now! What type of campaign would you like to send - promotional, newsletter, or product announcement?',
      },
    },
    'discount-codes': {
      question:
        'Working with discount codes? I can show you how to create promotions, explain different discount types, or help you set up special offers!',
      responses: {
        show: 'Let me show you how to create different types of discount codes and set up promotional campaigns!',
        tell: 'Discount codes can be percentage-based, fixed amount, or free shipping. You can set usage limits, expiration dates, minimum order amounts, and restrict to specific products or customer segments.',
        do: 'I can help you create discount codes for specific promotions. What type of discount would you like to set up - seasonal sale, new customer offer, or loyalty reward?',
      },
    },
    'social-media': {
      question:
        'Managing social media? I can show you social integration features, explain posting strategies, or help you connect your accounts!',
      responses: {
        show: 'Let me show you how to integrate social media accounts and manage your social presence from the dashboard!',
        tell: 'Social media management includes connecting your Facebook, Instagram, and Twitter accounts, scheduling posts, sharing products, and tracking engagement. You can also import social media orders and manage social customer service.',
        do: 'I can help you connect social media accounts, schedule posts, or create social media campaigns. Which social platforms would you like to set up?',
      },
    },
    login: {
      question:
        'Need help with login? I can show you how to sign in, explain the login process, or help you with account access!',
      responses: {
        show: "Let me guide you through the login process step-by-step! I'll show you how to enter your credentials and access your account.",
        tell: "The login process requires your email address and password. Once authenticated, you'll have access to all your account features and data. Make sure to use the correct credentials associated with your account.",
        do: "I'll help you log in right now! Let me walk you through each step of the login process with visual guidance.",
      },
    },
  };

  // Step-by-step guides for different actions
  private stepGuides: Record<string, StepGuide[]> = {
    'add-product': [
      {
        step_number: 1,
        action: 'click',
        element: 'button',
        text: 'Products',
        description:
          "Click on the 'Products' button in the navigation to access the product management section",
        selector: "[data-demo-element='products']",
      },
      {
        step_number: 2,
        action: 'click',
        element: 'button',
        text: 'Add New Product',
        description: "Click on the 'Add New Product' button to start creating a new product",
        selector: "[data-demo-element='add-product']",
      },
      {
        step_number: 3,
        action: 'click',
        element: 'button',
        text: 'Bulk Import',
        description:
          "For managing multiple products, you can also use the 'Bulk Import' feature to upload many products at once using CSV or Excel files",
        selector: "[data-demo-element='bulk-import']",
      },
    ],
    'bulk-import': [
      {
        step_number: 1,
        action: 'click',
        element: 'button',
        text: 'Products',
        description:
          "Click on the 'Products' button in the navigation to access the product management section",
        selector: "[data-demo-element='products']",
      },
      {
        step_number: 2,
        action: 'click',
        element: 'button',
        text: 'Bulk Import',
        description:
          "Click on the 'Bulk Import' button to upload multiple products at once using CSV or Excel files",
        selector: "[data-demo-element='bulk-import']",
      },
      {
        step_number: 3,
        action: 'click',
        element: 'button',
        text: 'Manage Categories',
        description:
          "You can also organize your products by clicking 'Manage Categories' to set up product categories and subcategories",
        selector: "[data-demo-element='categories']",
      },
    ],
    'setup-widget': [
      {
        step_number: 1,
        action: 'click',
        element: 'button',
        text: 'Settings',
        description:
          "Click on the 'Settings' button in the navigation to access system configuration",
        selector: "[data-demo-element='settings']",
      },
      {
        step_number: 2,
        action: 'click',
        element: 'button',
        text: 'Dashboard',
        description: 'Navigate to the Dashboard to see your main overview and key metrics',
        selector: "[data-demo-element='dashboard']",
      },
      {
        step_number: 3,
        action: 'click',
        element: 'button',
        text: 'Products',
        description: 'Access the Products section to manage your product catalog and inventory',
        selector: "[data-demo-element='products']",
      },
      {
        step_number: 4,
        action: 'click',
        element: 'button',
        text: 'Login',
        description: 'Use the Login button to access your account and authentication features',
        selector: "[data-demo-element='login-button']",
      },
    ],
    login: [
      {
        step_number: 1,
        action: 'click',
        element: 'button',
        text: 'Login',
        description:
          "First, click on the 'Login' button to access the authentication system. This will open the login form where you can enter your credentials.",
        selector: "[data-demo-element='login-button']",
      },
      {
        step_number: 2,
        action: 'fill',
        element: 'input',
        text: 'Username/Email',
        description:
          "Enter your username or email address in the field. Example: john.doe@example.com or john_doe. Make sure it's a valid format and matches your account.",
        selector: "[data-demo-element='login-email']",
      },
      {
        step_number: 3,
        action: 'fill',
        element: 'input',
        text: 'Password',
        description:
          'Enter your password in the password field. Ensure it matches your account password. The password is case-sensitive and should be at least 8 characters long.',
        selector: "[data-demo-element='login-password']",
      },
      {
        step_number: 4,
        action: 'click',
        element: 'button',
        text: 'Sign In',
        description:
          "Click the 'Sign In' button to complete the login process and access your account. Make sure you've entered the correct credentials before clicking.",
        selector: "[data-demo-element='login-submit']",
      },
    ],
  };

  constructor(config: MarketrixConfig) {
    this.config = config;
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const { message, mode = 'tell' } = request;

    if (!message) {
      throw new Error('Message is required');
    }
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Check for step-by-step guide requests
    if (this.isStepGuideRequest(message)) {
      return this.handleStepGuideRequest(message, mode);
    }

    // Check if we have context from highlighted element (from global context or local context)
    let currentContext = this.currentContext || (window as any).currentDemoContext;

    // If no current context, try to determine context from the message content
    if (!currentContext) {
      currentContext = this.analyzeMessageForContext(message);
    }

    if (currentContext && this.contextMessages[currentContext]) {
      const contextMessage = this.contextMessages[currentContext];
      const response = contextMessage.responses[mode];

      // Trigger navigation and highlighting for 'show' mode
      if (mode === 'show') {
        this.navigateToElement(currentContext);
      }

      return {
        messageId: this.generateId(),
        response,
        timestamp: new Date(),
        mode,
      };
    }

    // Try to find relevant element based on message content
    const detectedContext = this.analyzeMessageForContext(message);
    if (detectedContext && this.contextMessages[detectedContext]) {
      const contextMessage = this.contextMessages[detectedContext];
      const response = contextMessage.responses[mode];

      // Trigger navigation and highlighting for 'show' mode
      if (mode === 'show') {
        this.navigateToElement(detectedContext);
      }

      return {
        messageId: this.generateId(),
        response,
        timestamp: new Date(),
        mode,
      };
    }

    // Default responses based on mode
    const defaultResponses = {
      show: "I'd be happy to show you how this works! In a real implementation, I would provide step-by-step visual guidance. Try hovering over different elements on the page to see contextual help!",
      tell: "Let me explain how this feature works. In this demo, I can provide detailed explanations about any element you hover over. The system is designed to give contextual help based on what you're looking at.",
      do: "I'm ready to help you accomplish this task! In a production environment, I would be able to perform actions on your behalf. For now, try hovering over different buttons and sections to see how I can assist with specific features.",
    };

    return {
      messageId: this.generateId(),
      response:
        defaultResponses[mode] ||
        "I'm here to help! Try hovering over different elements on the page to see contextual assistance.",
      timestamp: new Date(),
      mode,
    };
  }

  async checkAgentAvailability(): Promise<boolean> {
    // In demo mode, agent is always available
    return true;
  }

  async getAgentInfo(): Promise<{ name: string; avatarUrl: string } | null> {
    return {
      name: 'Marketrix Demo Assistant',
      avatarUrl: 'https://via.placeholder.com/64/0ea5e9/ffffff?text=AI',
    };
  }

  // Method to set current context from highlighted element
  setCurrentContext(context: string | null): void {
    this.currentContext = context;
  }

  // Get context message for an element
  getContextMessage(elementType: string): DemoContextMessage | null {
    return this.contextMessages[elementType] || null;
  }

  // Update configuration
  updateConfig(newConfig: Partial<MarketrixConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Get current configuration
  getConfig(): MarketrixConfig {
    return { ...this.config };
  }

  // Stop the current step guide
  stopStepGuide(): void {
    console.log('Stopping step guide');

    // Remove all step guide UI elements
    this.removeStepGuideUI();

    // Reset step guide state
    this.currentStepGuide = null;
    this.currentStepIndex = 0;

    // Remove global functions
    if (typeof window !== 'undefined') {
      delete (window as any).stepGuideNext;
      delete (window as any).stepGuidePrev;
    }

    // Remove all step-related event listeners
    document.querySelectorAll('[data-step-index]').forEach((el) => {
      el.removeAttribute('data-step-index');
      el.removeEventListener('click', this.handleStepElementClick);
    });

    console.log('Step guide stopped successfully');
  }

  // Check if step guide is currently running
  isStepGuideRunning(): boolean {
    return this.currentStepGuide !== null && this.currentStepGuide.length > 0;
  }

  // Analyze message content to determine which element to highlight
  private analyzeMessageForContext(message: string): string | null {
    const messageLower = message.toLowerCase();

    // Keywords mapping to element types
    const keywordMap: Record<string, string[]> = {
      dashboard: ['dashboard', 'overview', 'main page', 'home', 'main'],
      products: ['product', 'inventory', 'catalog', 'items', 'merchandise'],
      orders: ['order', 'purchase', 'transaction', 'sale', 'buy', 'sold'],
      customers: ['customer', 'user', 'client', 'buyer', 'people'],
      analytics: ['analytics', 'report', 'data', 'insight', 'metric', 'stats'],
      settings: ['setting', 'config', 'preference', 'option', 'setup'],
      revenue: ['revenue', 'money', 'income', 'earning', 'profit', 'sales', '$'],
      conversion: ['conversion', 'convert', 'rate', 'percentage', '%'],
      'add-product': ['add product', 'create product', 'new product', 'add item', 'create item'],
      'bulk-import': ['bulk import', 'import', 'upload', 'batch', 'csv', 'excel'],
      categories: ['category', 'organize', 'group', 'classification'],
      inventory: ['inventory', 'stock', 'quantity', 'warehouse'],
      'payment-processing': ['payment', 'pay', 'transaction', 'billing', 'checkout'],
      fulfillment: ['fulfillment', 'fulfill', 'ship', 'delivery', 'shipping'],
      'customer-segments': ['segment', 'group', 'vip', 'customer type', 'classification'],
      'email-campaigns': ['email', 'campaign', 'marketing', 'newsletter', 'promotion'],
      'discount-codes': ['discount', 'coupon', 'promo', 'offer', 'sale'],
      'social-media': ['social', 'facebook', 'instagram', 'twitter', 'media'],
      login: ['login', 'sign in', 'log in', 'authenticate', 'access', 'credentials'],
    };

    // Find the best match
    for (const [elementType, keywords] of Object.entries(keywordMap)) {
      if (keywords.some((keyword) => messageLower.includes(keyword))) {
        return elementType;
      }
    }

    return null;
  }

  // Navigate to and highlight the relevant element
  private navigateToElement(elementType: string): void {
    try {
      // Find the element on the page
      const element = document.querySelector(`[data-demo-element="${elementType}"]`);

      if (element) {
        // Scroll to the element
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });

        // Add highlighting effect
        this.highlightElement(element as HTMLElement);

        // Set global context
        (window as any).currentDemoContext = elementType;
      }
    } catch (error) {
      console.error('Error navigating to element:', error);
    }
  }

  // Add highlighting effect to an element
  private highlightElement(element: HTMLElement): void {
    // Add highlight styles
    this.addHighlightStyles();

    // Remove any existing highlights
    this.removeExistingHighlights();

    // Add highlight to the target element
    element.classList.add('demo-highlight');

    // Add subtle highlight effect
    element.style.transition = 'all 0.3s ease';

    // Create description overlay
    this.createDescriptionOverlay(element);

    // Remove highlight after 5 seconds
    setTimeout(() => {
      this.removeHighlight(element);
    }, 5000);
  }

  // Remove existing highlights
  private removeExistingHighlights(): void {
    document.querySelectorAll('.demo-highlight').forEach((el) => {
      el.classList.remove('demo-highlight');
    });

    // Remove existing overlays
    const existingOverlay = document.getElementById('highlight-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const existingDescription = document.getElementById('highlight-description');
    if (existingDescription) {
      existingDescription.remove();
    }
  }

  // Remove highlight from element
  private removeHighlight(element: HTMLElement): void {
    element.classList.remove('demo-highlight');
    element.style.transition = '';

    // Remove overlays
    const overlay = document.getElementById('highlight-overlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.3s ease-out forwards';
      setTimeout(() => overlay.remove(), 300);
    }

    const description = document.getElementById('highlight-description');
    if (description) {
      description.style.animation = 'fadeOut 0.3s ease-out forwards';
      setTimeout(() => description.remove(), 300);
    }
  }

  // Create description overlay with background blur
  private createDescriptionOverlay(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const elementType = element.getAttribute('data-demo-element');
    const description = this.getElementDescription(elementType);

    // Create background blur overlay
    const overlay = document.createElement('div');
    overlay.id = 'highlight-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(4px);
      z-index: 999;
      pointer-events: none;
      animation: overlayFadeIn 0.4s ease-out;
    `;
    document.body.appendChild(overlay);

    // Create description panel
    const descriptionPanel = document.createElement('div');
    descriptionPanel.id = 'highlight-description';
    descriptionPanel.innerHTML = `
      <div class="description-content">
        <div class="description-title">${this.getElementTitle(elementType)}</div>
        <div class="description-text">${description}</div>
      </div>
    `;

    // Position description panel
    const panelWidth = 320;
    const panelHeight = 120;
    let left = rect.left + rect.width / 2 - panelWidth / 2;
    let top = rect.top - panelHeight - 20;

    // Adjust position if panel goes off screen
    if (left < 20) left = 20;
    if (left + panelWidth > window.innerWidth - 20) {
      left = window.innerWidth - panelWidth - 20;
    }
    if (top < 20) {
      top = rect.bottom + 20;
    }

    descriptionPanel.style.cssText = `
      position: fixed;
      left: ${left}px;
      top: ${top}px;
      width: ${panelWidth}px;
      z-index: 1000;
      pointer-events: none;
      animation: descriptionSlideIn 0.4s ease-out;
    `;

    document.body.appendChild(descriptionPanel);
  }

  // Get element title based on type
  private getElementTitle(elementType: string | null): string {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      products: 'Products',
      orders: 'Orders',
      customers: 'Customers',
      analytics: 'Analytics',
      settings: 'Settings',
      revenue: 'Revenue',
      'orders-count': 'Order Count',
      'customers-count': 'Customer Count',
      conversion: 'Conversion Rate',
      'add-product': 'Add Product',
      'bulk-import': 'Bulk Import',
      categories: 'Categories',
      inventory: 'Inventory',
      'order-received': 'Order Received',
      'payment-processing': 'Payment Processing',
      fulfillment: 'Fulfillment',
      delivery: 'Delivery',
      'customer-segments': 'Customer Segments',
      'support-tickets': 'Support Tickets',
      'email-campaigns': 'Email Campaigns',
      'discount-codes': 'Discount Codes',
      'social-media': 'Social Media',
    };

    return elementType ? titles[elementType] || 'Interactive Element' : 'Interactive Element';
  }

  // Get element description based on type
  private getElementDescription(elementType: string | null): string {
    const descriptions: Record<string, string> = {
      dashboard: 'Your main control center showing key business metrics and navigation options.',
      products: 'Manage your product catalog, inventory, and product-related settings.',
      orders: 'View and process customer orders, track order status and fulfillment.',
      customers: 'Access customer information, segments, and customer service tools.',
      analytics: 'View detailed reports, metrics, and business intelligence insights.',
      settings: 'Configure system preferences, integrations, and account settings.',
      revenue: 'Track your revenue performance and financial metrics.',
      'orders-count': 'Monitor the number of orders processed and order volume trends.',
      'customers-count': 'View customer growth and active customer statistics.',
      conversion: 'Track conversion rates and optimize your sales funnel performance.',
      'add-product': 'Add new products to your catalog with detailed information.',
      'bulk-import': 'Import multiple products at once using CSV or Excel files.',
      categories: 'Organize products into categories for better navigation and SEO.',
      inventory: 'Manage stock levels, set alerts, and track inventory across locations.',
      'order-received': 'New orders that have been received and are ready for processing.',
      'payment-processing': 'Orders currently being processed for payment verification.',
      fulfillment: 'Orders being prepared for shipping and delivery.',
      delivery: 'Orders that have been shipped and are in transit to customers.',
      'customer-segments': 'Group customers by behavior, value, or other characteristics.',
      'support-tickets': 'Manage customer support requests and service tickets.',
      'email-campaigns': 'Create and manage email marketing campaigns and newsletters.',
      'discount-codes': 'Set up promotional codes, coupons, and special offers.',
      'social-media': 'Connect and manage your social media accounts and posts.',
    };

    return elementType
      ? descriptions[elementType] || 'Click to explore this feature'
      : 'Click to explore this feature';
  }

  // Add enhanced highlight styles
  private addHighlightStyles(): void {
    if (!document.getElementById('highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'highlight-styles';
      style.textContent = `
        .demo-highlight {
          outline: 2px solid #3B82F6 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2) !important;
          border-radius: 4px !important;
          position: relative !important;
          z-index: 1001 !important;
        }
        
        .description-content {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.1),
            0 0 0 1px rgba(59, 130, 246, 0.1);
        }
        
        .description-title {
          font-size: 16px;
          font-weight: 700;
          color: #1E40AF;
          margin-bottom: 8px;
          line-height: 1.3;
        }
        
        .description-text {
          font-size: 14px;
          color: #374151;
          line-height: 1.5;
          opacity: 0.9;
        }
        
        @keyframes overlayFadeIn {
          from { 
            opacity: 0; 
            backdrop-filter: blur(0px); 
          }
          to { 
            opacity: 1; 
            backdrop-filter: blur(4px); 
          }
        }
        
        @keyframes descriptionSlideIn {
          from { 
            opacity: 0; 
            transform: translateY(-20px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
        
        @keyframes fadeOut {
          to { 
            opacity: 0; 
            transform: scale(0.95);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Check if message is requesting a step-by-step guide
  private isStepGuideRequest(message: string): boolean {
    const messageLower = message.toLowerCase();
    const stepGuideKeywords = [
      'show me how to',
      'how do i',
      'step by step',
      'guide me through',
      'walk me through',
      'tutorial',
      'add a new product',
      'bulk import',
      'setup widget',
      'set up widget',
      'login',
      'sign in',
      'log in',
    ];

    return stepGuideKeywords.some((keyword) => messageLower.includes(keyword));
  }

  // Handle step-by-step guide requests
  private async handleStepGuideRequest(
    message: string,
    mode: 'show' | 'tell' | 'do'
  ): Promise<SendMessageResponse> {
    const messageLower = message.toLowerCase();
    let guideType = 'add-product'; // default

    // Determine which guide to show
    if (messageLower.includes('add') && messageLower.includes('product')) {
      guideType = 'add-product';
    } else if (messageLower.includes('bulk') && messageLower.includes('import')) {
      guideType = 'bulk-import';
    } else if (
      messageLower.includes('setup') ||
      messageLower.includes('set up') ||
      messageLower.includes('widget')
    ) {
      guideType = 'setup-widget';
    } else if (
      messageLower.includes('login') ||
      messageLower.includes('sign in') ||
      messageLower.includes('log in')
    ) {
      guideType = 'login';
    }

    const steps = this.stepGuides[guideType];
    if (!steps || steps.length === 0) {
      console.error('No steps found for guide type:', guideType);
      return {
        messageId: this.generateId(),
        response:
          "I don't have a step-by-step guide for that yet. Try asking about adding products, bulk importing, or setting up the widget.",
        timestamp: new Date(),
        mode,
      };
    }

    console.log('Starting step guide for:', guideType, 'with steps:', steps);

    if (mode === 'show') {
      // Start the step-by-step guide
      this.startStepGuide(steps);
      return {
        messageId: this.generateId(),
        response: `Perfect! I'll show you step-by-step how to ${this.getGuideTitle(guideType)}. Let me start the interactive guide for you.`,
        timestamp: new Date(),
        mode,
      };
    } else if (mode === 'tell') {
      // Show all steps as text
      const stepsText = steps
        .map((step) => `**Step ${step.step_number}:** ${step.description}`)
        .join('\n\n');

      return {
        messageId: this.generateId(),
        response: `Here's how to ${this.getGuideTitle(guideType)}:\n\n${stepsText}`,
        timestamp: new Date(),
        mode,
      };
    } else {
      // Do mode - check if it's login and should auto-execute
      if (guideType === 'login') {
        this.startAutoLoginGuide(steps);
        return {
          messageId: this.generateId(),
          response: `I'll help you login right now! Let me automatically walk through the login process for you.`,
          timestamp: new Date(),
          mode,
        };
      } else {
        // For other guides, start the interactive guide
        this.startStepGuide(steps);
        return {
          messageId: this.generateId(),
          response: `I'll help you ${this.getGuideTitle(guideType)} right now! Let me start the interactive guide.`,
          timestamp: new Date(),
          mode,
        };
      }
    }
  }

  // Get guide title based on type
  private getGuideTitle(guideType: string): string {
    const titles: Record<string, string> = {
      'add-product': 'add a new product',
      'bulk-import': 'bulk import products',
      'setup-widget': 'set up the widget',
      login: 'log in to your account',
    };
    return titles[guideType] || 'complete this task';
  }

  // Start automatic login guide (no user interaction required)
  private startAutoLoginGuide(steps: StepGuide[]): void {
    if (!steps || steps.length === 0) {
      console.error('Cannot start auto login guide: no steps provided');
      return;
    }

    console.log('Starting automatic login guide with', steps.length, 'steps');

    // Set up step guide state like show mode
    this.currentStepGuide = steps;
    this.currentStepIndex = 0;

    // Add step guide styles
    this.addStepGuideStyles();

    // Add background blur effect
    this.addBackgroundBlur();

    // Show completion notification first
    this.showIPhoneNotification(
      'Auto Login Started! 🚀',
      "I'm automatically walking through the login process for you. Watch as I complete each step!",
      'info'
    );

    // Show login form first
    this.showLoginForm();

    // Wait a moment for form to appear, then start with first step
    setTimeout(() => {
      this.showCurrentStepForAutoExecution();
      this.highlightCurrentStepElement();

      // Execute steps automatically with delays
      this.executeLoginStepsAutomatically(steps, 0);
    }, 1000); // 1 second delay to show form first
  }

  // Show current step for auto execution (using show mode style)
  private showCurrentStepForAutoExecution(): void {
    if (
      !this.currentStepGuide ||
      this.currentStepGuide.length === 0 ||
      this.currentStepIndex >= this.currentStepGuide.length
    ) {
      console.error('Invalid step guide state for auto execution');
      return;
    }

    const currentStep = this.currentStepGuide[this.currentStepIndex];
    if (!currentStep) {
      console.error('Current step is undefined for auto execution');
      return;
    }

    // Remove existing step UI
    this.removeStepGuideUI();

    // Add global functions for navigation (but they won't be used in auto mode)
    (window as any).stepGuideNext = (event?: Event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      // Auto mode - this won't be called by user
    };
    (window as any).stepGuidePrev = (event?: Event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      // Auto mode - this won't be called by user
    };

    // Create step indicator for auto execution
    this.createAutoStepIndicator();
  }

  // Create step indicator for auto execution
  private createAutoStepIndicator(): void {
    if (!this.currentStepGuide || this.currentStepIndex >= this.currentStepGuide.length) return;

    const currentStep = this.currentStepGuide[this.currentStepIndex];
    const totalSteps = this.currentStepGuide.length;

    // Create step indicator
    const stepIndicator = document.createElement('div');
    stepIndicator.id = 'auto-step-indicator';
    stepIndicator.innerHTML = `
      <div class="auto-step-indicator-content">
        <div class="auto-step-indicator-header">
          <div class="auto-step-indicator-icon">🤖</div>
          <div class="auto-step-indicator-title">Auto-Executing Login</div>
        </div>
        <div class="auto-step-indicator-progress">
          <div class="auto-step-indicator-step">Step ${this.currentStepIndex + 1} of ${totalSteps}</div>
          <div class="auto-step-indicator-description">${currentStep.description}</div>
        </div>
        <div class="auto-step-indicator-status">
          <div class="auto-step-indicator-dot"></div>
          <span>Preparing to execute...</span>
        </div>
      </div>
    `;

    stepIndicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      z-index: 10002;
      pointer-events: none;
      animation: autoStepIndicatorSlideIn 0.3s ease-out;
    `;

    document.body.appendChild(stepIndicator);
  }

  // Update auto step indicator status
  private updateAutoStepIndicatorStatus(
    status: string,
    type: 'preparing' | 'executing' | 'completed'
  ): void {
    const indicator = document.getElementById('auto-step-indicator');
    if (!indicator) return;

    const statusElement = indicator.querySelector('.auto-step-indicator-status span');
    const dotElement = indicator.querySelector('.auto-step-indicator-dot');

    if (statusElement) {
      statusElement.textContent = status;
    }

    if (dotElement) {
      // Update dot color based on status
      const dot = dotElement as HTMLElement;
      switch (type) {
        case 'preparing':
          dot.style.background = '#60a5fa';
          break;
        case 'executing':
          dot.style.background = '#f59e0b';
          break;
        case 'completed':
          dot.style.background = '#10b981';
          break;
      }
    }
  }

  // Execute login steps automatically with delays
  private async executeLoginStepsAutomatically(
    steps: StepGuide[],
    currentIndex: number
  ): Promise<void> {
    if (currentIndex >= steps.length) {
      // All steps completed
      setTimeout(() => {
        this.showGuideCompletion();
      }, 1000);
      return;
    }

    // Update current step index
    this.currentStepIndex = currentIndex;
    const currentStep = steps[currentIndex];
    console.log(`Auto-executing step ${currentIndex + 1}:`, currentStep);

    // Show current step with show mode style (highlighting and description)
    this.showCurrentStepForAutoExecution();
    this.highlightCurrentStepElement();

    // Show step notification
    this.showIPhoneNotification(
      `Step ${currentIndex + 1} of ${steps.length}`,
      currentStep.description,
      'info'
    );

    // Wait for highlighting and description to show, then execute the action
    setTimeout(async () => {
      // Update indicator status to executing
      this.updateAutoStepIndicatorStatus('Executing...', 'executing');

      // Show execution notification
      this.showIPhoneNotification('Executing...', `Performing: ${currentStep.description}`, 'info');

      await this.executeStepAction(currentStep);

      // Update indicator status to completed
      this.updateAutoStepIndicatorStatus('Step Completed! ✅', 'completed');

      // Show completion notification for this step
      this.showIPhoneNotification(
        'Step Completed! ✅',
        `Completed: ${currentStep.description}`,
        'success'
      );

      // Wait a bit before moving to next step
      setTimeout(() => {
        this.removeStepHighlights();
        this.executeLoginStepsAutomatically(steps, currentIndex + 1);
      }, 4000); // 4 second delay between steps to allow user to see the action
    }, 3000); // 3 second delay for highlighting and description
  }

  // Execute step action automatically
  private async executeStepAction(step: StepGuide): Promise<void> {
    const selector = step.selector || `[data-demo-element="${step.element}"]`;
    const element = document.querySelector(selector) as HTMLElement;

    if (!element) {
      console.warn('Element not found for action execution:', selector);
      return;
    }

    try {
      switch (step.action) {
        case 'click':
          // Simulate click
          element.click();
          console.log('Auto-clicked element:', step.text);
          break;

        case 'fill':
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            // Focus the element
            element.focus();

            // Clear existing value
            element.value = '';

            // Type the value with animation
            await this.typeTextWithAnimation(element, this.getSampleValue(step));

            // Trigger input events
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            console.log(
              'Auto-filled element:',
              step.text,
              'with value:',
              this.getSampleValue(step)
            );
          }
          break;

        default:
          console.log('Auto-executed action:', step.action, 'on element:', step.text);
      }
    } catch (error) {
      console.error('Error executing step action:', error);
    }
  }

  // Type text with animation
  private async typeTextWithAnimation(
    element: HTMLInputElement | HTMLTextAreaElement,
    text: string
  ): Promise<void> {
    const typingSpeed = 10; // milliseconds per character

    for (let i = 0; i <= text.length; i++) {
      element.value = text.substring(0, i);
      element.dispatchEvent(new Event('input', { bubbles: true }));

      if (i < text.length) {
        await new Promise((resolve) => setTimeout(resolve, typingSpeed));
      }
    }
  }

  // Get sample value for form fields
  private getSampleValue(step: StepGuide): string {
    if (
      step.text?.toLowerCase().includes('email') ||
      step.text?.toLowerCase().includes('username')
    ) {
      return 'demo@marketrix.com';
    } else if (step.text?.toLowerCase().includes('password')) {
      return 'demo123456';
    }
    return 'Sample Value';
  }

  // Start the step-by-step guide
  private startStepGuide(steps: StepGuide[]): void {
    if (!steps || steps.length === 0) {
      console.error('Cannot start step guide: no steps provided');
      return;
    }

    this.currentStepGuide = steps;
    this.currentStepIndex = 0;

    console.log('Starting step guide with', steps.length, 'steps');
    console.log('Steps:', steps);

    // Add step guide styles
    this.addStepGuideStyles();

    // Add background blur effect
    this.addBackgroundBlur();

    // Show the first step and highlight the element
    this.showCurrentStep();
    this.highlightCurrentStepElement();

    // Add click handlers for the first step
    this.addStepClickHandlers();

    // Don't start auto-progression - user must click "Next" manually
  }

  // Show current step with enhanced UI
  private showCurrentStep(): void {
    if (
      !this.currentStepGuide ||
      this.currentStepGuide.length === 0 ||
      this.currentStepIndex >= this.currentStepGuide.length
    ) {
      console.error('Invalid step guide state:', {
        currentStepGuide: this.currentStepGuide,
        currentStepIndex: this.currentStepIndex,
      });
      return;
    }

    const currentStep = this.currentStepGuide[this.currentStepIndex];
    if (!currentStep) {
      console.error('Current step is undefined:', {
        currentStepIndex: this.currentStepIndex,
        totalSteps: this.currentStepGuide.length,
      });
      return;
    }

    // Remove existing step UI
    this.removeStepGuideUI();

    // Add global functions for navigation
    (window as any).stepGuideNext = (event?: Event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      // Remove current highlights before moving to next step
      this.removeStepHighlights();
      this.markStepAsCompleted(this.currentStepIndex);

      // Add a brief delay to ensure spotlight is fully removed
      setTimeout(() => {
        this.nextStep();
      }, 100);
    };
    (window as any).stepGuidePrev = (event?: Event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      this.prevStep();
    };

    // Show step completion message
    // this.showStepCompletionMessage(currentStep);
  }

  // Add click handlers for step elements
  private addStepClickHandlers(): void {
    if (!this.currentStepGuide) return;

    console.log('Adding click handlers for current step:', this.currentStepIndex + 1);

    // Clear all existing step data attributes first
    document.querySelectorAll('[data-step-index]').forEach((el) => {
      el.removeAttribute('data-step-index');
      el.removeEventListener('click', this.handleStepElementClick);
    });

    // Only add click handler for the current step
    const currentStep = this.currentStepGuide[this.currentStepIndex];
    if (!currentStep) {
      console.error('No current step found at index:', this.currentStepIndex);
      return;
    }

    const selector = currentStep.selector || `[data-demo-element="${currentStep.element}"]`;
    const element = document.querySelector(selector) as HTMLElement;

    console.log(
      `Current step ${this.currentStepIndex + 1}: Looking for element with selector:`,
      selector
    );

    if (element) {
      console.log(`Current step ${this.currentStepIndex + 1}: Element found:`, element);
      // Store step index as data attribute
      element.setAttribute('data-step-index', this.currentStepIndex.toString());

      // Add click handler
      element.addEventListener('click', this.handleStepElementClick);
      console.log(
        `Current step ${this.currentStepIndex + 1}: Click handler added with index:`,
        this.currentStepIndex
      );
    } else {
      console.warn(
        `Current step ${this.currentStepIndex + 1}: Element not found for selector:`,
        selector
      );
    }
  }

  // Handle step element click
  private handleStepElementClick = (event: Event): void => {
    // Prevent default behavior to avoid page refresh
    event.preventDefault();
    event.stopPropagation();

    if (!this.currentStepGuide) return;

    const target = event.target as HTMLElement;
    const stepIndex = parseInt(target.getAttribute('data-step-index') || '0');

    // Only handle clicks for the current step
    if (stepIndex !== this.currentStepIndex) {
      console.log('Click on step', stepIndex, 'but current step is', this.currentStepIndex);
      return;
    }

    const currentStep = this.currentStepGuide[this.currentStepIndex];
    console.log('Step element clicked:', currentStep);

    // Add click feedback animation
    target.classList.add('step-element-clicked');

    // Remove click feedback after animation
    setTimeout(() => {
      target.classList.remove('step-element-clicked');
    }, 300);

    // Special handling for login button
    if (currentStep.element === 'button' && currentStep.text === 'Login') {
      this.handleLoginButtonClick();
      // Auto-advance to next step after showing form
      setTimeout(() => {
        this.removeStepHighlights();
        this.markStepAsCompleted(this.currentStepIndex);
        this.nextStep();
      }, 500);
    }
    // For form inputs, focus the element and add input listeners
    else if (currentStep.action === 'fill') {
      this.handleFormInputStep(target, currentStep);
    } else {
      // For non-form elements, auto-advance to next step
      this.removeStepHighlights();
      this.markStepAsCompleted(this.currentStepIndex);

      // Add a longer delay to ensure spotlight is fully removed before next step
      setTimeout(() => {
        this.nextStep();
      }, 500);
    }

    console.log('Step completed. Proceeding to next step.');
  };

  // Handle form input steps with validation and tick functionality
  private handleFormInputStep(inputElement: HTMLElement, step: StepGuide): void {
    // Focus the input element
    if (inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement) {
      inputElement.focus();

      // Add input validation and tick functionality
      this.addInputValidation(inputElement, step);
    }
  }

  // Add input validation and tick functionality
  private addInputValidation(inputElement: HTMLElement, step: StepGuide): void {
    if (
      !(inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    // Remove existing validation listeners
    inputElement.removeEventListener('input', this.handleInputValidation);
    inputElement.removeEventListener('blur', this.handleInputBlur);

    // Add new validation listeners
    inputElement.addEventListener('input', this.handleInputValidation);
    inputElement.addEventListener('blur', this.handleInputBlur);

    // Store step reference on the element
    (inputElement as any).currentStep = step;
  }

  // Handle input validation
  private handleInputValidation = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    const step = (input as any).currentStep;

    if (!step) return;

    // Check if input has valid content
    const hasContent = input.value.trim().length > 0;

    // Update the tick button state
    this.updateTickButtonState(hasContent);
  };

  // Handle input blur
  private handleInputBlur = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    const step = (input as any).currentStep;

    if (!step) return;

    // Check if input has valid content
    const hasContent = input.value.trim().length > 0;

    if (hasContent) {
      // Show success state
      this.showInputSuccess(input);
    } else {
      // Show error state
      this.showInputError(input);
    }
  };

  // Update tick button state based on input validation
  private updateTickButtonState(isValid: boolean): void {
    const tickButton = document.querySelector('.step-tick-button') as HTMLButtonElement;
    if (tickButton) {
      tickButton.disabled = !isValid;
      tickButton.style.opacity = isValid ? '1' : '0.5';
      tickButton.style.cursor = isValid ? 'pointer' : 'not-allowed';
    }
  }

  // Show input success state
  private showInputSuccess(input: HTMLInputElement | HTMLTextAreaElement): void {
    input.style.borderColor = '#10b981';
    input.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
  }

  // Show input error state
  private showInputError(input: HTMLInputElement | HTMLTextAreaElement): void {
    input.style.borderColor = '#ef4444';
    input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
  }

  // Mark step as completed
  private markStepAsCompleted(stepIndex: number): void {
    console.log('Marking step as completed:', stepIndex);

    const stepElement = document.querySelector(`[data-step-completed="${stepIndex}"]`);
    if (stepElement) {
      stepElement.classList.add('step-completed');
    }

    // Don't show individual step completion notifications
    // Only show final completion message when all steps are done
  }

  // Navigate to next step
  private nextStep(): void {
    if (!this.currentStepGuide || this.currentStepGuide.length === 0) {
      console.error('Cannot navigate to next step: no step guide available');
      return;
    }

    console.log('Moving to next step from:', this.currentStepIndex);

    // Remove current highlights and clean up COMPLETELY
    this.removeStepHighlights();
    this.markStepAsCompleted(this.currentStepIndex);

    if (this.currentStepIndex < this.currentStepGuide.length - 1) {
      // Move to next step
      this.currentStepIndex++;
      console.log('Now at step:', this.currentStepIndex + 1);

      // Show next step after a longer delay to ensure previous spotlight is completely closed
      setTimeout(() => {
        // Double-check that all previous highlights are removed
        this.removeStepHighlights();

        // Show the next step
        this.showCurrentStep();
        this.highlightCurrentStepElement();

        // Re-add click handlers for the new current step
        this.addStepClickHandlers();

        // Special handling for product form step
        if (
          this.currentStepIndex === 2 &&
          this.currentStepGuide &&
          this.currentStepGuide[this.currentStepIndex]?.action === 'fill'
        ) {
          this.showProductForm();
        }

        // Special handling for login form step
        if (
          this.currentStepIndex === 1 &&
          this.currentStepGuide &&
          this.currentStepGuide[this.currentStepIndex]?.action === 'fill'
        ) {
          this.showLoginForm();
        }
      }, 400); // Increased delay to ensure cleanup
    } else {
      // Final step - remove spotlight and show completion message
      console.log('Final step completed - removing all highlights');
      this.removeStepHighlights();

      // Wait a moment to ensure spotlight is completely removed
      setTimeout(() => {
        this.showGuideCompletion();
      }, 500); // Increased delay
    }
  }

  // Show product form when reaching the form step
  private showProductForm(): void {
    const form = document.getElementById('product-form-simulation');
    if (form) {
      form.style.display = 'block';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Show login form when reaching the login step
  private showLoginForm(): void {
    const form = document.getElementById('login-form-simulation');
    if (form) {
      form.style.display = 'block';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Show login form when login button is clicked
  private handleLoginButtonClick(): void {
    const form = document.getElementById('login-form-simulation');
    if (form) {
      form.style.display = 'block';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Navigate to previous step
  private prevStep(): void {
    if (!this.currentStepGuide || this.currentStepGuide.length === 0) {
      console.error('Cannot navigate to previous step: no step guide available');
      return;
    }

    if (this.currentStepIndex === 0) {
      console.log('Already at first step');
      return;
    }

    // Remove current highlights
    this.removeStepHighlights();

    // Go back to previous step
    this.currentStepIndex--;

    // Show previous step
    this.showCurrentStep();
    this.highlightCurrentStepElement();

    // Re-add click handlers for the new current step
    this.addStepClickHandlers();

    console.log('Navigated to previous step:', this.currentStepIndex + 1);
  }

  // Highlight current step element
  private highlightCurrentStepElement(): void {
    if (
      !this.currentStepGuide ||
      this.currentStepGuide.length === 0 ||
      this.currentStepIndex >= this.currentStepGuide.length
    ) {
      console.error('Cannot highlight step element: invalid step guide state');
      return;
    }

    const currentStep = this.currentStepGuide[this.currentStepIndex];
    if (!currentStep) {
      console.error('Current step is undefined');
      return;
    }

    const selector = currentStep.selector || `[data-demo-element="${currentStep.element}"]`;
    console.log('Looking for element with selector:', selector);

    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      console.log('Element found:', element);
      // Scroll to element
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });

      // Highlight element with enhanced effect
      this.highlightStepElement(element);
    } else {
      console.warn('Element not found for selector:', selector);
      // Try alternative selectors
      const altSelectors = [
        `#${currentStep.element}`,
        `.${currentStep.element}`,
        `[id="${currentStep.element}"]`,
        `[class*="${currentStep.element}"]`,
      ];

      for (const altSelector of altSelectors) {
        const altElement = document.querySelector(altSelector) as HTMLElement;
        if (altElement) {
          console.log('Found element with alternative selector:', altSelector, altElement);
          altElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          });
          this.highlightStepElement(altElement);
          return;
        }
      }
    }
  }

  // Enhanced highlighting for step elements
  private highlightStepElement(element: HTMLElement): void {
    // Remove existing step highlights FIRST
    this.removeStepHighlights();

    // Wait a moment to ensure cleanup is complete
    setTimeout(() => {
      // Add step highlight class
      element.classList.add('step-guide-highlight');

      // Create spotlight effect
      this.createStepSpotlight(element);

      // Create step description text on the right side with typing animation
      this.createStepDescriptionText(element);
    }, 100);
  }

  // Create spotlight effect for step highlighting
  private createStepSpotlight(element: HTMLElement): void {
    console.log('Creating spotlight for element:', element);

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
      animation: spotlightFadeIn 0.3s ease-out;
    `;

    // Create pulsing border
    const border = document.createElement('div');
    border.id = 'step-border';
    border.style.cssText = `
      position: fixed;
      border: 3px solid #3b82f6;
      border-radius: 8px;
      z-index: 10000;
      pointer-events: none;
    `;

    // Function to update positions based on current element position
    const updatePositions = () => {
      const rect = element.getBoundingClientRect();

      // Update spotlight gradient to follow element
      spotlight.style.background = `radial-gradient(ellipse at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px, 
        transparent 0%, 
        transparent 40%, 
        rgba(0, 0, 0, 0.6) 100%)`;

      // Update border position and size
      border.style.left = `${rect.left - 4}px`;
      border.style.top = `${rect.top - 4}px`;
      border.style.width = `${rect.width + 8}px`;
      border.style.height = `${rect.height + 8}px`;
    };

    // Initial position update
    updatePositions();

    // Add resize and scroll listeners to keep spotlight in sync
    const resizeHandler = () => updatePositions();
    const scrollHandler = () => updatePositions();

    window.addEventListener('resize', resizeHandler);
    window.addEventListener('scroll', scrollHandler, true);

    document.body.appendChild(spotlight);
    document.body.appendChild(border);

    // Store references for cleanup
    (element as any).stepSpotlight = spotlight;
    (element as any).stepBorder = border;
    (element as any).spotlightResizeHandler = resizeHandler;
    (element as any).spotlightScrollHandler = scrollHandler;

    console.log('Spotlight and border created with responsive positioning');
  }

  // Create step description text near the highlighted area with improved positioning
  private createStepDescriptionText(element: HTMLElement): void {
    if (!this.currentStepGuide || this.currentStepIndex >= this.currentStepGuide.length) return;

    const currentStep = this.currentStepGuide[this.currentStepIndex];
    console.log('Creating description text for step:', currentStep);

    // Create description text container with enhanced styling
    const descriptionText = document.createElement('div');
    descriptionText.id = `step-description-text-${this.currentStepIndex}`;
    descriptionText.innerHTML = `
      <div class="step-description-text-content">
        <div class="step-description-text-body">
          <div class="step-description-text-description" id="typing-text-${this.currentStepIndex}"></div>
          <span class="step-description-text-cursor">|</span>
        </div>
        ${
          currentStep.action === 'fill'
            ? `
          <div class="step-description-text-actions" style="display: none; opacity: 0;">
            <button class="step-tick-button" type="button" onclick="event.preventDefault(); event.stopPropagation(); window.stepGuideNext && window.stepGuideNext()">
              <span class="tick-text">Done</span>
            </button>
          </div>
        `
            : ''
        }
      </div>
    `;

    // Function to update text position based on current element position
    const updateTextPosition = () => {
      const rect = element.getBoundingClientRect();
      const textWidth = 320;
      const textHeight = currentStep.action === 'fill' ? 140 : 120;
      const margin = 20;

      // Calculate optimal position near the element
      let left, top;

      // Try different positions in order of preference
      const positions = [
        // Below the element (centered)
        {
          left: rect.left + (rect.width - textWidth) / 2,
          top: rect.bottom + margin,
          name: 'below',
        },
        // To the right of the element
        {
          left: rect.right + margin,
          top: rect.top + (rect.height - textHeight) / 2,
          name: 'right',
        },
        // To the left of the element
        {
          left: rect.left - textWidth - margin,
          top: rect.top + (rect.height - textHeight) / 2,
          name: 'left',
        },
        // Above the element (centered)
        {
          left: rect.left + (rect.width - textWidth) / 2,
          top: rect.top - textHeight - margin,
          name: 'above',
        },
      ];

      // Find the best position that fits on screen
      for (const pos of positions) {
        if (
          pos.left >= margin &&
          pos.left + textWidth <= window.innerWidth - margin &&
          pos.top >= margin &&
          pos.top + textHeight <= window.innerHeight - margin
        ) {
          left = pos.left;
          top = pos.top;
          break;
        }
      }

      // Fallback to center of screen if no position works
      if (left === undefined || top === undefined) {
        left = (window.innerWidth - textWidth) / 2;
        top = (window.innerHeight - textHeight) / 2;
      }

      console.log('Description text positioning:', {
        elementRect: rect,
        finalPosition: { left, top },
        textSize: { width: textWidth, height: textHeight },
        screenSize: { width: window.innerWidth, height: window.innerHeight },
      });

      descriptionText.style.cssText = `
        position: fixed;
        left: ${left}px;
        top: ${top}px;
        width: ${textWidth}px;
        height: ${textHeight}px;
        z-index: 10001;
        pointer-events: auto;
        animation: stepDescriptionTextSlideIn 0.3s ease-out;
      `;
    };

    // Initial position update
    updateTextPosition();

    // Add resize and scroll listeners to keep text position in sync
    const textResizeHandler = () => {
      console.log('Text resize handler triggered');
      updateTextPosition();
    };
    const textScrollHandler = () => {
      console.log('Text scroll handler triggered');
      updateTextPosition();
    };

    // Use more aggressive event listening
    window.addEventListener('resize', textResizeHandler, { passive: true });
    window.addEventListener('scroll', textScrollHandler, { passive: true, capture: true });
    document.addEventListener('scroll', textScrollHandler, { passive: true, capture: true });

    // Also listen for any layout changes
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        console.log('ResizeObserver triggered for description text');
        updateTextPosition();
      });
      resizeObserver.observe(document.body);
      (element as any).textResizeObserver = resizeObserver;
    }

    document.body.appendChild(descriptionText);

    // Start typing animation
    this.startTypingAnimation(currentStep.description, this.currentStepIndex);

    // Store references for cleanup
    (element as any).stepDescriptionText = descriptionText;
    (element as any).textResizeHandler = textResizeHandler;
    (element as any).textScrollHandler = textScrollHandler;

    // Also store the update function for manual triggering
    (element as any).updateTextPosition = updateTextPosition;

    // Set up a periodic check to ensure text stays in sync (fallback)
    const periodicCheck = setInterval(() => {
      if (!document.getElementById(`step-description-text-${this.currentStepIndex}`)) {
        clearInterval(periodicCheck);
        return;
      }
      updateTextPosition();
    }, 1000); // Check every second

    (element as any).textPeriodicCheck = periodicCheck;

    console.log('Description text created with enhanced positioning system');
  }

  // Method to manually update description text position (useful for debugging)
  public updateDescriptionTextPosition(): void {
    const currentElement = document.querySelector('.step-guide-highlight') as HTMLElement;
    if (currentElement && (currentElement as any).updateTextPosition) {
      console.log('Manually updating description text position');
      (currentElement as any).updateTextPosition();
    }
  }

  // Start typing animation for description text
  private startTypingAnimation(text: string, stepIndex: number): void {
    const typingElement = document.getElementById(`typing-text-${stepIndex}`);
    if (!typingElement) {
      console.error('Typing element not found for step:', stepIndex);
      return;
    }

    console.log('Starting typing animation with text:', text);

    let index = 0;
    const typingSpeed = 20; // milliseconds per character (faster typing)

    const typeText = () => {
      if (index < text.length) {
        typingElement.textContent = text.substring(0, index + 1);
        index++;
        setTimeout(typeText, typingSpeed);
      } else {
        // Typing is complete - show the Done button
        this.showDoneButton(stepIndex);

        // Remove cursor after typing is complete
        setTimeout(() => {
          const typingElement = document.querySelector(`#typing-text-${stepIndex}`);
          if (typingElement) {
            const cursor = typingElement.nextElementSibling;
            if (cursor) {
              (cursor as HTMLElement).style.opacity = '0';
            }
          }
        }, 1000);
      }
    };

    // Start typing after a short delay
    setTimeout(typeText, 500);
  }

  // Show the Done button after typing is complete
  private showDoneButton(stepIndex: number): void {
    const descriptionText = document.getElementById(`step-description-text-${stepIndex}`);
    if (!descriptionText) return;

    // Find the actions container
    const actionsContainer = descriptionText.querySelector('.step-description-text-actions');
    if (actionsContainer) {
      // Show the Done button with animation
      (actionsContainer as HTMLElement).style.display = 'flex';
      (actionsContainer as HTMLElement).style.opacity = '0';
      (actionsContainer as HTMLElement).style.transform = 'translateY(10px)';

      // Animate in
      setTimeout(() => {
        (actionsContainer as HTMLElement).style.transition = 'all 0.3s ease-out';
        (actionsContainer as HTMLElement).style.opacity = '1';
        (actionsContainer as HTMLElement).style.transform = 'translateY(0)';
      }, 100);
    }
  }

  // Remove step highlights
  private removeStepHighlights(): void {
    console.log('Removing step highlights');

    // Remove step highlight classes
    document.querySelectorAll('.step-guide-highlight').forEach((el) => {
      el.classList.remove('step-guide-highlight');
    });

    // Remove spotlight and border
    const spotlight = document.getElementById('step-spotlight');
    if (spotlight) {
      console.log('Removing spotlight');
      spotlight.remove();
    }

    const border = document.getElementById('step-border');
    if (border) {
      console.log('Removing border');
      border.remove();
    }

    // Clean up event listeners from any elements that had spotlight or text positioning
    document.querySelectorAll('[data-step-index]').forEach((el) => {
      const element = el as any;
      if (element.spotlightResizeHandler) {
        window.removeEventListener('resize', element.spotlightResizeHandler);
        element.spotlightResizeHandler = null;
      }
      if (element.spotlightScrollHandler) {
        window.removeEventListener('scroll', element.spotlightScrollHandler, true);
        element.spotlightScrollHandler = null;
      }
      if (element.textResizeHandler) {
        window.removeEventListener('resize', element.textResizeHandler);
        element.textResizeHandler = null;
      }
      if (element.textScrollHandler) {
        window.removeEventListener('scroll', element.textScrollHandler, true);
        document.removeEventListener('scroll', element.textScrollHandler, true);
        element.textScrollHandler = null;
      }
      if (element.textResizeObserver) {
        element.textResizeObserver.disconnect();
        element.textResizeObserver = null;
      }
      if (element.textPeriodicCheck) {
        clearInterval(element.textPeriodicCheck);
        element.textPeriodicCheck = null;
      }
    });

    // Remove description button
    const descriptionButton = document.getElementById('step-description-button');
    if (descriptionButton) descriptionButton.remove();

    // Remove description text
    document.querySelectorAll('[id^="step-description-text-"]').forEach((el) => el.remove());

    // Remove auto step indicator
    const autoStepIndicator = document.getElementById('auto-step-indicator');
    if (autoStepIndicator) {
      autoStepIndicator.remove();
    }

    // Remove all step borders
    document.querySelectorAll('[data-step-border]').forEach((el) => el.remove());

    // Remove any remaining spotlight elements
    document.querySelectorAll('.step-spotlight').forEach((el) => el.remove());

    // Remove any pulsing borders
    document.querySelectorAll('[style*="animation: stepPulse"]').forEach((el) => {
      (el as HTMLElement).style.animation = 'none';
    });

    // Force remove any elements with step-related classes
    document
      .querySelectorAll('.step-indicator, .step-completed, .step-element-clicked')
      .forEach((el) => {
        el.classList.remove('step-indicator', 'step-completed', 'step-element-clicked');
      });

    // Remove any elements that might have been created by previous steps
    document.querySelectorAll('[id*="step-"]').forEach((el) => {
      if (
        el.id.includes('spotlight') ||
        el.id.includes('border') ||
        el.id.includes('description')
      ) {
        el.remove();
      }
    });

    // Remove any elements with step-related data attributes
    document.querySelectorAll('[data-step-index]').forEach((el) => {
      el.removeAttribute('data-step-index');
    });

    // Clean up any remaining step-related elements
    document.querySelectorAll('*').forEach((el) => {
      const element = el as HTMLElement;
      if (
        element.style &&
        element.style.animation &&
        element.style.animation.includes('stepPulse')
      ) {
        element.style.animation = 'none';
      }
    });
  }

  // Remove step guide UI
  private removeStepGuideUI(): void {
    this.removeStepHighlights();
    this.removeBackgroundBlur();
  }

  // Show iPhone-style notification
  private showIPhoneNotification(
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'success'
  ): void {
    console.log('Showing iPhone notification:', { title, message, type });

    // Remove existing notification
    const existingNotification = document.getElementById('iphone-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // Create iPhone-style notification
    const notification = document.createElement('div');
    notification.id = 'iphone-notification';

    // Get icon based on type
    const icons = {
      success: '✅',
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
    };

    notification.innerHTML = `
      <div class="iphone-notification-content">
        <div class="iphone-notification-icon">${icons[type]}</div>
        <div class="iphone-notification-text">
          <div class="iphone-notification-title">${title}</div>
          <div class="iphone-notification-message">${message}</div>
        </div>
        <div class="iphone-notification-close" onclick="this.parentElement.parentElement.style.animation='iphoneNotificationSlideUp 0.5s ease-out forwards'; setTimeout(() => this.parentElement.parentElement.remove(), 500)">×</div>
      </div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.95);
      backdrop-filter: blur(25px);
      border-radius: 20px;
      padding: 0;
      box-shadow: 
        0 25px 50px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      z-index: 10000;
      animation: iphoneNotificationSlideDown 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      max-width: 400px;
      min-width: 300px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    // Add iPhone notification styles
    this.addIPhoneNotificationStyles();

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'iphoneNotificationSlideUp 0.5s ease-out forwards';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 500);
      }
    }, 4000);
  }

  // Add iPhone notification styles
  private addIPhoneNotificationStyles(): void {
    if (!document.getElementById('iphone-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'iphone-notification-styles';
      style.textContent = `
        .iphone-notification-content {
          display: flex;
          align-items: center;
          padding: 16px 20px;
          gap: 12px;
          color: white;
          position: relative;
        }

        .iphone-notification-icon {
          font-size: 24px;
          flex-shrink: 0;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        .iphone-notification-text {
          flex: 1;
          min-width: 0;
        }

        .iphone-notification-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
          line-height: 1.2;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .iphone-notification-message {
          font-size: 14px;
          opacity: 0.9;
          line-height: 1.3;
          color: rgba(255, 255, 255, 0.9);
        }

        .iphone-notification-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 24px;
          height: 24px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          transition: all 0.2s ease;
          backdrop-filter: blur(10px);
        }

        .iphone-notification-close:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        @keyframes iphoneNotificationSlideDown {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-100px) scale(0.8);
          }
          20% {
            opacity: 0.8;
            transform: translateX(-50%) translateY(-20px) scale(0.95);
          }
          40% {
            opacity: 1;
            transform: translateX(-50%) translateY(10px) scale(1.02);
          }
          60% {
            opacity: 1;
            transform: translateX(-50%) translateY(-5px) scale(0.98);
          }
          80% {
            opacity: 1;
            transform: translateX(-50%) translateY(2px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        @keyframes iphoneNotificationSlideUp {
          0% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
          20% {
            opacity: 0.8;
            transform: translateX(-50%) translateY(-10px) scale(0.98);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-100px) scale(0.8);
          }
        }

        /* Success notification specific styling */
        .iphone-notification.success .iphone-notification-icon {
          color: #34C759;
        }

        .iphone-notification.info .iphone-notification-icon {
          color: #007AFF;
        }

        .iphone-notification.warning .iphone-notification-icon {
          color: #FF9500;
        }

        .iphone-notification.error .iphone-notification-icon {
          color: #FF3B30;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Show guide completion message
  private showGuideCompletion(): void {
    console.log('Showing guide completion notification');

    // First, completely remove all spotlights and highlights
    this.removeStepHighlights();
    this.removeStepGuideUI();

    // Wait a moment to ensure all animations and spotlights are fully removed
    setTimeout(() => {
      // Prevent any form submission or page refresh
      if (typeof window !== 'undefined') {
        // Remove any form submission listeners that might interfere
        const forms = document.querySelectorAll('form');
        forms.forEach((form) => {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
          });
        });
      }

      // Show iPhone-style completion notification
      this.showIPhoneNotification(
        'Tour Completed! 🎉',
        "Congratulations! You've successfully completed the entire step-by-step guide. Great job!",
        'success'
      );
    }, 500); // Wait 500ms to ensure spotlight is completely gone
  }

  // Add background blur effect
  private addBackgroundBlur(): void {
    // Create background blur overlay
    const blurOverlay = document.createElement('div');
    blurOverlay.id = 'step-guide-blur-overlay';
    blurOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(2px);
      z-index: 9998;
      pointer-events: none;
      animation: blurFadeIn 0.3s ease-out;
    `;

    document.body.appendChild(blurOverlay);
  }

  // Remove background blur effect
  private removeBackgroundBlur(): void {
    const blurOverlay = document.getElementById('step-guide-blur-overlay');
    if (blurOverlay) {
      blurOverlay.style.animation = 'blurFadeOut 0.3s ease-out forwards';
      setTimeout(() => {
        if (blurOverlay.parentNode) {
          blurOverlay.remove();
        }
      }, 300);
    }
  }

  // Add step guide styles
  private addStepGuideStyles(): void {
    if (!document.getElementById('step-guide-styles')) {
      const style = document.createElement('style');
      style.id = 'step-guide-styles';
      style.textContent = `
        /* Step Guide Panel */
        .step-guide-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          border: 1px solid #e5e7eb;
        }
        
        .step-guide-header {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .step-guide-progress {
          flex: 1;
        }
        
        .step-guide-progress-bar {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        
        .step-guide-progress-fill {
          height: 100%;
          background: white;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        
        .step-guide-step-counter {
          font-size: 12px;
          font-weight: 500;
          opacity: 0.9;
        }
        
        .step-guide-close {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .step-guide-close:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .step-guide-body {
          padding: 20px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
        }
        
        .step-guide-icon {
          font-size: 24px;
          flex-shrink: 0;
          margin-top: 4px;
        }
        
        .step-guide-text {
          flex: 1;
        }
        
        .step-guide-title {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 8px;
        }
        
        .step-guide-description {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }
        
        .step-guide-actions {
          padding: 16px 20px;
          background: #f9fafb;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        
        .step-guide-prev,
        .step-guide-next {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
        }
        
        .step-guide-prev:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
        
        .step-guide-prev:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .step-guide-next {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        
        .step-guide-next:hover {
          background: #2563eb;
          border-color: #2563eb;
        }
        
        .step-guide-instructions {
          padding: 12px 20px;
          background: #f0f9ff;
          border-top: 1px solid #e0f2fe;
        }
        
        .step-guide-hint {
          font-size: 12px;
          color: #0369a1;
          text-align: center;
          font-style: italic;
        }
        
        .step-guide-icon {
          margin: 0 4px;
          font-size: 12px;
        }
        
        /* Step highlighting */
        .step-guide-highlight {
          position: relative;
          z-index: 10001;
        }
        
        /* Completed step styling */
        .step-completed {
          opacity: 0.7;
          position: relative;
        }
        
        .step-completed::after {
          content: '✓';
          position: absolute;
          top: -8px;
          right: -8px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          z-index: 10002;
        }
        
        /* Click feedback animation */
        .step-element-clicked {
          animation: stepClickFeedback 0.3s ease-out;
        }
        
        @keyframes stepClickFeedback {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        
        /* Step completion feedback */
        .step-completion-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .step-completion-icon {
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .step-completion-text {
          flex: 1;
        }
        
        .step-completion-title {
          font-weight: 600;
          color: #10b981;
          font-size: 16px;
          margin-bottom: 4px;
        }
        
        .step-completion-description {
          font-size: 14px;
          color: #374151;
          line-height: 1.4;
        }
        
        @keyframes stepCompletionSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        /* Animations */
        @keyframes stepGuideSlideIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }
        
        @keyframes spotlightFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes stepPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.02);
          }
        }
        
        /* Guide completion panel */
        .guide-completion-panel {
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          width: 300px;
          border: 2px solid #10B981;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
        }
        
        .guide-completion-icon {
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .guide-completion-text {
          flex: 1;
        }
        
        .guide-completion-title {
          font-size: 16px;
          font-weight: 700;
          color: #1F2937;
          margin-bottom: 4px;
        }
        
        .guide-completion-description {
          font-size: 12px;
          color: #6B7280;
          line-height: 1.4;
        }
        
        /* Step indicator on highlighted elements */
        .step-indicator {
          position: absolute;
          top: -12px;
          right: -12px;
          background: #3B82F6;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          z-index: 10001;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          animation: stepPulse 2s infinite;
          border: 3px solid white;
        }
        
        .step-description-overlay {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.95);
          color: white;
          padding: 16px;
          border-radius: 12px;
          font-size: 14px;
          z-index: 10001;
          margin-top: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          animation: stepDescriptionSlide 0.3s ease-out;
          border: 2px solid #3B82F6;
          max-width: 300px;
          min-width: 200px;
        }
        
        @keyframes stepPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        @keyframes stepDescriptionSlide {
          from { 
            opacity: 0; 
            transform: translateY(-10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        @keyframes guideFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes guideSlideIn {
          from { 
            opacity: 0; 
            transform: translateY(-20px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
         
         /* Step description button */
         .step-description-button-content {
           background: linear-gradient(135deg, #3b82f6, #1d4ed8);
           border-radius: 12px;
           padding: 12px 16px;
           box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
           border: 2px solid rgba(255, 255, 255, 0.2);
           display: flex;
           align-items: center;
           gap: 12px;
           color: white;
           position: relative;
           overflow: hidden;
         }
         
         .step-description-button-content::before {
           content: '';
           position: absolute;
           top: 0;
           left: -100%;
           width: 100%;
           height: 100%;
           background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
           animation: shimmer 2s infinite;
         }
         
         .step-description-button-icon {
           font-size: 20px;
           flex-shrink: 0;
           filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
         }
         
         .step-description-button-text {
           flex: 1;
           min-width: 0;
         }
         
         .step-description-button-title {
           font-size: 14px;
           font-weight: 700;
           margin-bottom: 2px;
           text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
         }
         
         .step-description-button-subtitle {
           font-size: 12px;
           opacity: 0.9;
           white-space: nowrap;
           overflow: hidden;
           text-overflow: ellipsis;
         }
         
         .step-description-button-arrow {
           font-size: 16px;
           font-weight: bold;
           opacity: 0.8;
           animation: arrowPulse 1.5s infinite;
         }
         
         @keyframes stepDescriptionButtonSlideIn {
           from {
             opacity: 0;
             transform: translateX(-20px) scale(0.9);
           }
           to {
             opacity: 1;
             transform: translateX(0) scale(1);
           }
         }
         
         @keyframes shimmer {
           0% { left: -100%; }
           100% { left: 100%; }
         }
         
         @keyframes arrowPulse {
           0%, 100% { transform: translateX(0); }
           50% { transform: translateX(3px); }
         }
         
         /* Auto step indicator styles */
         .auto-step-indicator-content {
           background: linear-gradient(135deg, #1f2937, #374151);
           border-radius: 12px;
           padding: 16px;
           box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
           border: 2px solid rgba(59, 130, 246, 0.3);
           color: white;
           position: relative;
           overflow: hidden;
         }
         
         .auto-step-indicator-content::before {
           content: '';
           position: absolute;
           top: 0;
           left: -100%;
           width: 100%;
           height: 100%;
           background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
           animation: shimmer 3s infinite;
         }
         
         .auto-step-indicator-header {
           display: flex;
           align-items: center;
           gap: 8px;
           margin-bottom: 12px;
           padding-bottom: 8px;
           border-bottom: 1px solid rgba(59, 130, 246, 0.3);
         }
         
         .auto-step-indicator-icon {
           font-size: 18px;
           flex-shrink: 0;
           filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
         }
         
         .auto-step-indicator-title {
           font-size: 14px;
           font-weight: 600;
           color: #60a5fa;
           text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
         }
         
         .auto-step-indicator-progress {
           margin-bottom: 12px;
         }
         
         .auto-step-indicator-step {
           font-size: 12px;
           font-weight: 600;
           color: #10b981;
           margin-bottom: 4px;
           text-transform: uppercase;
           letter-spacing: 0.5px;
         }
         
         .auto-step-indicator-description {
           font-size: 13px;
           line-height: 1.4;
           color: #e5e7eb;
         }
         
         .auto-step-indicator-status {
           display: flex;
           align-items: center;
           gap: 8px;
           font-size: 11px;
           color: #60a5fa;
           font-weight: 500;
         }
         
         .auto-step-indicator-dot {
           width: 8px;
           height: 8px;
           border-radius: 50%;
           background: #10b981;
           animation: pulse 1s infinite;
         }
         
         @keyframes autoStepIndicatorSlideIn {
           from {
             opacity: 0;
             transform: translateX(30px) scale(0.9);
           }
           to {
             opacity: 1;
             transform: translateX(0) scale(1);
           }
         }
         
         
         /* Step description text with typing animation */
         .step-description-text-content {
           background: linear-gradient(135deg, #1f2937, #374151);
           border-radius: 12px;
           padding: 14px;
           box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
           border: 2px solid rgba(59, 130, 246, 0.3);
           color: white;
           position: relative;
           overflow: hidden;
         }
         
         .step-description-text-content::before {
           content: '';
           position: absolute;
           top: 0;
           left: -100%;
           width: 100%;
           height: 100%;
           background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
           animation: shimmer 3s infinite;
         }
         
         .step-description-text-header {
           display: flex;
           align-items: center;
           gap: 8px;
           margin-bottom: 12px;
           padding-bottom: 8px;
           border-bottom: 1px solid rgba(59, 130, 246, 0.3);
         }
         
         .step-description-text-icon {
           font-size: 18px;
           flex-shrink: 0;
           filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
         }
         
         .step-description-text-title {
           font-size: 14px;
           font-weight: 600;
           color: #60a5fa;
           text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
         }
         
         .step-description-text-body {
           position: relative;
           min-height: 40px;
           margin-bottom: 12px;
         }
         
         .step-description-text-description {
           font-size: 13px;
           line-height: 1.4;
           color: #e5e7eb;
           min-height: 20px;
           display: inline;
         }
         
         .step-description-text-cursor {
           display: inline;
           color: #60a5fa;
           font-weight: bold;
           animation: cursorBlink 1s infinite;
           margin-left: 2px;
         }
         
         .step-description-text-actions {
           display: flex;
           justify-content: center;
           margin-top: 8px;
         }
         
         .step-tick-button {
           background: linear-gradient(135deg, #10b981, #059669);
           border: none;
           border-radius: 8px;
           padding: 8px 16px;
           color: white;
           font-size: 12px;
           font-weight: 600;
           cursor: pointer;
           display: flex;
           align-items: center;
           gap: 6px;
           transition: all 0.2s ease;
           box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
         }
         
         .step-tick-button:hover {
           background: linear-gradient(135deg, #059669, #047857);
           transform: translateY(-1px);
           box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
         }
         
         .step-tick-button:active {
           transform: translateY(0);
           box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
         }
         
         .tick-icon {
           font-size: 14px;
           font-weight: bold;
         }
         
         .tick-text {
           font-size: 11px;
           text-transform: uppercase;
           letter-spacing: 0.5px;
         }
         
         @keyframes stepDescriptionTextSlideIn {
           from {
             opacity: 0;
             transform: translateX(30px) scale(0.9);
           }
           to {
             opacity: 1;
             transform: translateX(0) scale(1);
           }
         }
         
         @keyframes cursorBlink {
           0%, 50% { opacity: 1; }
           51%, 100% { opacity: 0; }
         }
         
         /* Background blur animations */
         @keyframes blurFadeIn {
           from { 
             opacity: 0; 
             backdrop-filter: blur(0px); 
           }
           to { 
             opacity: 1; 
             backdrop-filter: blur(2px); 
           }
         }
         
         @keyframes blurFadeOut {
           from { 
             opacity: 1; 
             backdrop-filter: blur(2px); 
           }
           to { 
             opacity: 0; 
             backdrop-filter: blur(0px); 
           }
         }
         
         /* Tick mark animation */
         @keyframes tickMarkAppear {
           from {
             opacity: 0;
             transform: scale(0.5) rotate(-180deg);
           }
           to {
             opacity: 1;
             transform: scale(1) rotate(0deg);
           }
         }
         
         /* Clickable tick mark styles */
         .step-tick-mark {
           cursor: pointer !important;
           transition: all 0.2s ease !important;
         }
         
         .step-tick-mark:hover {
           transform: scale(1.1) !important;
           box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5) !important;
         }
         
         .step-tick-mark:active {
           transform: scale(0.95) !important;
         }
      `;
      document.head.appendChild(style);
    }
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default DemoApiService;
