(function () {
  'use strict';

  /**
 * Détecte la langue à partir de l'URL
 * @returns {string} Code de langue détecté (par défaut: 'fr')
 */
  function detectLanguageFromUrl() {
    try {
      const url = window.location.href;
      const pathname = window.location.pathname;

      const langMatch = pathname.match(/\/([a-z]{2})(\/|$)/i);
      if (langMatch && langMatch[1]) {
        return langMatch[1].toLowerCase();
      }

      return 'fr';
    } catch (error) {
      return 'fr';
    }
  }
  // URL-based rubrique detection
  function detectRubriqueFromUrl() {
    const currentUrl = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // Define URL patterns for different rubriques
    const rubriqueMappings = {
      // Product-related pages
      'produit': [
        '/produit', '/product', '/services', '/offre', '/solution',
        '/actions', '/action-collective', '/dossier', '/affaire',
        '/chlordecone', '/levothyrox', '/linky', '/dieselgate', '/airbag',
        '/stellantis', '/androcur', '/essure', '/motorgate'
      ],

      // Client account/profile pages  
      'compte_client': [
        '/compte', '/account', '/profil', '/profile', '/mon-compte',
        '/dashboard', '/espace-client', '/client-area', '/connexion',
        '/login', '/inscription', '/register', '/mes-dossiers'
      ],

      // Sales/purchase funnel pages
      'tunnel_vente': [
        '/achat', '/buy', '/purchase', '/commande', '/order',
        '/paiement', '/payment', '/checkout', '/panier', '/cart',
        '/tarif', '/pricing', '/abonnement', '/subscription',
        '/rejoindre', '/participer', '/souscrire'
      ],

      // General/informational pages (default)
      'general': [
        '/accueil', '/home', '/about', '/qui-sommes-nous', '/notre-equipe',
        '/avocats', '/partenaires', '/contact', '/faq', '/aide', '/help',
        '/mentions-legales', '/cgu', '/confidentialite', '/blog', '/actualites',
        '/news', '/ressources', '/documentation', '/manifeste', '/valeurs'
      ]
    };

    // Check for specific patterns in URL
    for (const [rubrique, patterns] of Object.entries(rubriqueMappings)) {
      for (const pattern of patterns) {
        if (pathname.includes(pattern) || currentUrl.includes(pattern)) {
          console.log(`🎯 Rubrique détectée: ${rubrique} (pattern: ${pattern})`);
          return rubrique;
        }
      }
    }

    // Special case: detect product codes in URL parameters or path
    const urlParams = new URLSearchParams(window.location.search);
    const productCode = urlParams.get('product') || urlParams.get('produit') ||
      urlParams.get('action') || urlParams.get('dossier');

    if (productCode) {
      console.log(`🎯 Code produit détecté: ${productCode} -> rubrique: produit`);
      return 'produit';
    }

    // Check for product-like patterns in hash or query
    if (window.location.hash.includes('action') ||
      window.location.search.includes('action') ||
      pathname.match(/\/(action|dossier|affaire)-/)) {
      return 'produit';
    }

    console.log('🎯 Rubrique par défaut: general');
    return 'general';
  }

  // Detect product code from URL
  function detectProductCodeFromUrl() {
    const pathname = window.location.pathname.toLowerCase();
    const urlParams = new URLSearchParams(window.location.search);

    // Check URL parameters first
    const productFromParams = urlParams.get('product') || urlParams.get('produit') ||
      urlParams.get('action') || urlParams.get('dossier') ||
      urlParams.get('ref') || urlParams.get('code');

    if (productFromParams) {
      console.log(`🏷️ Code produit détecté (params): ${productFromParams}`);
      return productFromParams.toUpperCase();
    }

    // Define known product codes from MyLeo actions
    const knownProducts = {
      'chlordecone': 'CHLORDECONE_2024',
      'levothyrox': 'LEVOTHYROX_MERCK',
      'linky': 'LINKY_ACTION',
      'dieselgate': 'DIESELGATE_VW',
      'airbag-takata': 'AIRBAG_TAKATA',
      'stellantis': 'STELLANTIS_BLUEHDI',
      'androcur': 'ANDROCUR_BAYER',
      'essure': 'ESSURE_BAYER',
      'motorgate': 'MOTORGATE_CASSE',
      'swoon': 'SWOON_ACTION',
      'uber-eats': 'UBER_EATS',
      'respiratorgate': 'PHILIPS_RESPIRATOR',
      'h2o': 'H2O_ACTION'
    };

    // Check if URL contains known product names
    for (const [productName, productCode] of Object.entries(knownProducts)) {
      if (pathname.includes(productName) || pathname.includes(productName.replace('-', ''))) {
        console.log(`🏷️ Code produit détecté (URL): ${productCode}`);
        return productCode;
      }
    }

    // Extract potential product code from URL path segments
    const pathSegments = pathname.split('/').filter(segment => segment.length > 0);
    for (const segment of pathSegments) {
      // Look for segments that might be product codes (uppercase, contains numbers/letters)
      if (segment.match(/^[A-Z0-9_-]{3,}$/i) && segment !== 'fr' && segment !== 'en') {
        console.log(`🏷️ Code produit potentiel détecté: ${segment.toUpperCase()}`);
        return segment.toUpperCase();
      }
    }

    return null;
  }

  // Enhanced widget configuration with URL detection
  const WIDGET_CONFIG = {
    apiBaseUrl: window.MyleoWidgetConfig?.apiUrl || 'http://localhost:3000/api',
    language: window.MyleoWidgetConfig?.language || detectLanguageFromUrl(),
    rubrique: window.MyleoWidgetConfig?.rubrique || detectRubriqueFromUrl(),
    productCode: window.MyleoWidgetConfig?.productCode || detectProductCodeFromUrl(),
    theme: window.MyleoWidgetConfig?.theme || 'myleo',
    position: window.MyleoWidgetConfig?.position || 'bottom-right',
    autoDetectRubrique: window.MyleoWidgetConfig?.autoDetectRubrique !== false, // enabled by default
    autoDetectProduct: window.MyleoWidgetConfig?.autoDetectProduct !== false // enabled by default
  };

  // MyLeo brand colors (inspired by legal/professional themes)
  const THEME_COLORS = {
    myleo: {
      primary: '#1e3a8a',      // Deep blue (professional, trustworthy)
      secondary: '#3b82f6',    // Lighter blue
      accent: '#f59e0b',       // Warm orange/amber (energy, action)
      success: '#10b981',      // Green
      error: '#ef4444',        // Red
      background: '#ffffff',   // White
      surface: '#f8fafc',      // Light gray
      text: '#1f2937',         // Dark gray
      textLight: '#6b7280',    // Medium gray
      border: '#e5e7eb'        // Light border
    }
  };

  class MyleoChatWidget {
    constructor() {
      this.isOpen = false;
      this.isMinimized = false;
      this.sessionId = null;
      this.messages = [];
      this.isTyping = false;
      this.currentTheme = THEME_COLORS[WIDGET_CONFIG.theme] || THEME_COLORS.myleo;

      this.init();
    }

    init() {
      this.logContextInfo();
      this.injectStyles();
      this.createWidget();
      this.bindEvents();
      this.loadLanguage();
      this.notifyReady();
    }

    logContextInfo() {
      console.log('🤖 MyLeo Chatbot Widget - Configuration détectée:');
      console.log(`   📍 URL: ${window.location.href}`);
      console.log(`   🏷️ Rubrique: ${WIDGET_CONFIG.rubrique}`);
      console.log(`   📦 Code produit: ${WIDGET_CONFIG.productCode || 'Aucun'}`);
      console.log(`   🌐 Langue: ${WIDGET_CONFIG.language}`);
      console.log(`   🎨 Thème: ${WIDGET_CONFIG.theme}`);
      console.log(`   📱 Position: ${WIDGET_CONFIG.position}`);
    }

    notifyReady() {
      // Make configuration globally available
      window.WIDGET_CONFIG = WIDGET_CONFIG;

      // Dispatch custom event to notify that widget is ready
      const event = new CustomEvent('myleoWidgetReady', {
        detail: {
          config: WIDGET_CONFIG,
          widget: this
        }
      });
      document.dispatchEvent(event);

      console.log('✅ MyLeo Widget prêt et configuré');
    }

    injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        /* MyLeo Chatbot Widget Styles */
        .myleo-widget-container {
          position: fixed;
          ${WIDGET_CONFIG.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
          ${WIDGET_CONFIG.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          direction: ${WIDGET_CONFIG.language === 'ar' ? 'rtl' : 'ltr'};
        }

        .myleo-widget-trigger {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${this.currentTheme.primary} 0%, ${this.currentTheme.secondary} 100%);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .myleo-widget-trigger:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .myleo-widget-trigger:active {
          transform: translateY(0);
        }

        .myleo-widget-trigger svg {
          width: 28px;
          height: 28px;
          fill: white;
          transition: transform 0.3s ease;
        }

        .myleo-widget-trigger.open svg {
          transform: rotate(45deg);
        }

        .myleo-widget-notification {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 20px;
          height: 20px;
          background: ${this.currentTheme.accent};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: white;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }

        .myleo-widget-chat {
          position: absolute;
          ${WIDGET_CONFIG.position.includes('right') ? 'right: 0;' : 'left: 0;'}
          bottom: 80px;
          width: 380px;
          max-width: calc(100vw - 40px);
          height: 500px;
          max-height: calc(100vh - 140px);
          background: ${this.currentTheme.background};
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          display: none;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid ${this.currentTheme.border};
        }

        .myleo-widget-chat.open {
          display: flex;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .myleo-widget-chat.minimized {
          height: 60px;
        }

        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .myleo-widget-header {
          background: linear-gradient(135deg, ${this.currentTheme.primary} 0%, ${this.currentTheme.secondary} 100%);
          color: white;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .myleo-widget-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='0.05'%3E%3Cpath d='M20 20c0-11.046 8.954-20 20-20s20 8.954 20 20-8.954 20-20 20-20-8.954-20-20z'/%3E%3C/g%3E%3C/svg%3E") repeat;
          pointer-events: none;
        }

        .myleo-widget-title {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 1;
        }

        .myleo-widget-logo {
          width: 32px;
          height: 32px;
          background: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: ${this.currentTheme.primary};
          font-size: 14px;
        }

        .myleo-widget-title h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .myleo-widget-status {
          font-size: 12px;
          opacity: 0.9;
          margin-top: 2px;
        }

        .myleo-widget-controls {
          display: flex;
          gap: 8px;
          position: relative;
          z-index: 1;
        }

        .myleo-widget-control {
          width: 32px;
          height: 32px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s ease;
        }

        .myleo-widget-control:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .myleo-widget-control svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }

        .myleo-widget-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: ${this.currentTheme.surface};
          scrollbar-width: thin;
          scrollbar-color: ${this.currentTheme.border} transparent;
        }

        .myleo-widget-messages::-webkit-scrollbar {
          width: 6px;
        }

        .myleo-widget-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .myleo-widget-messages::-webkit-scrollbar-thumb {
          background: ${this.currentTheme.border};
          border-radius: 3px;
        }

        .myleo-widget-message {
          margin-bottom: 16px;
          display: flex;
          gap: 12px;
          animation: messageSlideIn 0.3s ease-out;
        }

        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .myleo-widget-message.user {
          flex-direction: row-reverse;
        }

        .myleo-widget-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .myleo-widget-message.bot .myleo-widget-avatar {
          background: linear-gradient(135deg, ${this.currentTheme.primary} 0%, ${this.currentTheme.secondary} 100%);
          color: white;
        }

        .myleo-widget-message.user .myleo-widget-avatar {
          background: ${this.currentTheme.accent};
          color: white;
        }

        .myleo-widget-message-content {
          flex: 1;
          max-width: 280px;
        }

        .myleo-widget-bubble {
          padding: 12px 16px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.4;
          position: relative;
        }

        .myleo-widget-message.bot .myleo-widget-bubble {
          background: white;
          color: ${this.currentTheme.text};
          border: 1px solid ${this.currentTheme.border};
          border-bottom-left-radius: 6px;
        }

        .myleo-widget-message.user .myleo-widget-bubble {
          background: linear-gradient(135deg, ${this.currentTheme.primary} 0%, ${this.currentTheme.secondary} 100%);
          color: white;
          border-bottom-right-radius: 6px;
          margin-left: auto;
        }

        .myleo-widget-message-time {
          font-size: 11px;
          color: ${this.currentTheme.textLight};
          margin-top: 4px;
          text-align: center;
        }

        .myleo-widget-typing {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: white;
          border-radius: 18px;
          border-bottom-left-radius: 6px;
          border: 1px solid ${this.currentTheme.border};
          color: ${this.currentTheme.textLight};
          font-size: 14px;
        }

        .myleo-widget-typing-dots {
          display: flex;
          gap: 4px;
        }

        .myleo-widget-typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${this.currentTheme.textLight};
          animation: typingDot 1.5s infinite ease-in-out;
        }

        .myleo-widget-typing-dot:nth-child(1) { animation-delay: 0s; }
        .myleo-widget-typing-dot:nth-child(2) { animation-delay: 0.3s; }
        .myleo-widget-typing-dot:nth-child(3) { animation-delay: 0.6s; }

        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }

        .myleo-widget-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .myleo-widget-suggestion {
          background: ${this.currentTheme.surface};
          border: 1px solid ${this.currentTheme.border};
          color: ${this.currentTheme.text};
          padding: 8px 12px;
          border-radius: 16px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .myleo-widget-suggestion:hover {
          background: ${this.currentTheme.primary};
          color: white;
          border-color: ${this.currentTheme.primary};
        }

        .myleo-widget-input-area {
          padding: 16px 20px;
          background: white;
          border-top: 1px solid ${this.currentTheme.border};
        }

        .myleo-widget-input-container {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .myleo-widget-input {
          flex: 1;
          border: 2px solid ${this.currentTheme.border};
          border-radius: 24px;
          padding: 12px 16px;
          font-size: 14px;
          resize: none;
          outline: none;
          max-height: 120px;
          min-height: 44px;
          transition: border-color 0.2s ease;
          font-family: inherit;
        }

        .myleo-widget-input:focus {
          border-color: ${this.currentTheme.primary};
        }

        .myleo-widget-send {
          width: 44px;
          height: 44px;
          border: none;
          background: linear-gradient(135deg, ${this.currentTheme.primary} 0%, ${this.currentTheme.secondary} 100%);
          color: white;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .myleo-widget-send:hover {
          transform: scale(1.05);
        }

        .myleo-widget-send:active {
          transform: scale(0.95);
        }

        .myleo-widget-send:disabled {
          background: ${this.currentTheme.border};
          cursor: not-allowed;
          transform: none;
        }

        .myleo-widget-send svg {
          width: 18px;
          height: 18px;
          fill: currentColor;
        }

        .myleo-widget-footer {
          padding: 12px 20px;
          background: ${this.currentTheme.surface};
          border-top: 1px solid ${this.currentTheme.border};
          text-align: center;
          font-size: 11px;
          color: ${this.currentTheme.textLight};
        }

        .myleo-widget-escalation {
          background: white;
          padding: 20px;
          border-radius: 12px;
          border: 1px solid ${this.currentTheme.border};
          margin: 16px 0;
        }

        .myleo-widget-escalation h4 {
          margin: 0 0 12px 0;
          color: ${this.currentTheme.text};
          font-size: 16px;
        }

        .myleo-widget-escalation-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .myleo-widget-escalation input,
        .myleo-widget-escalation textarea {
          border: 1px solid ${this.currentTheme.border};
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s ease;
          font-family: inherit;
        }

        .myleo-widget-escalation input:focus,
        .myleo-widget-escalation textarea:focus {
          border-color: ${this.currentTheme.primary};
        }

        .myleo-widget-escalation-buttons {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .myleo-widget-button {
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .myleo-widget-button-primary {
          background: linear-gradient(135deg, ${this.currentTheme.primary} 0%, ${this.currentTheme.secondary} 100%);
          color: white;
        }

        .myleo-widget-button-secondary {
          background: ${this.currentTheme.surface};
          color: ${this.currentTheme.text};
          border: 1px solid ${this.currentTheme.border};
        }

        .myleo-widget-button:hover {
          transform: translateY(-1px);
        }

        .myleo-widget-error {
          color: ${this.currentTheme.error};
          font-size: 12px;
          margin-top: 4px;
        }

        /* Mobile responsiveness */
        @media (max-width: 480px) {
          .myleo-widget-chat {
            width: calc(100vw - 20px);
            right: 10px !important;
            left: 10px !important;
            bottom: 90px;
            height: calc(100vh - 140px);
          }
          
          .myleo-widget-trigger {
            width: 56px;
            height: 56px;
          }
          
          .myleo-widget-trigger svg {
            width: 24px;
            height: 24px;
          }
        }
      `;

      document.head.appendChild(style);
    }

    createWidget() {
      // Create container
      this.container = document.createElement('div');
      this.container.className = 'myleo-widget-container';

      // Create trigger button
      this.trigger = document.createElement('button');
      this.trigger.className = 'myleo-widget-trigger';
      this.trigger.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      `;

      // Create chat interface
      this.chatWidget = document.createElement('div');
      this.chatWidget.className = 'myleo-widget-chat';

      this.chatWidget.innerHTML = `
        <div class="myleo-widget-header">
          <div class="myleo-widget-title">
            <div class="myleo-widget-logo">ML</div>
            <div>
              <h3 id="widget-title">Assistant Myleo</h3>
              <div class="myleo-widget-status" id="widget-status">En ligne</div>
            </div>
          </div>
          <div class="myleo-widget-controls">
            <button class="myleo-widget-control" id="widget-close" title="Fermer">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
        <div class="myleo-widget-messages" id="widget-messages"></div>
        <div class="myleo-widget-input-area">
          <div class="myleo-widget-input-container">
            <textarea 
              id="widget-input" 
              class="myleo-widget-input" 
              placeholder="Tapez votre message..."
              rows="1"
            ></textarea>
            <button id="widget-send" class="myleo-widget-send" disabled>
              <svg viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="myleo-widget-footer">
          <div id="widget-powered-by">Propulsé par Myleo</div>
        </div>
      `;

      this.container.appendChild(this.trigger);
      this.container.appendChild(this.chatWidget);
      document.body.appendChild(this.container);

      // Get references to elements
      this.messagesContainer = document.getElementById('widget-messages');
      this.input = document.getElementById('widget-input');
      this.sendButton = document.getElementById('widget-send');
    }

    bindEvents() {
      // Trigger button click
      this.trigger.addEventListener('click', () => {
        this.toggleWidget();
      });



      document.getElementById('widget-close').addEventListener('click', () => {
        this.closeWidget();
      });

      // Input handling
      this.input.addEventListener('input', () => {
        this.handleInputChange();
      });

      this.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Send button
      this.sendButton.addEventListener('click', () => {
        this.sendMessage();
      });

      // Click outside to close
      document.addEventListener('click', (e) => {
        if (!this.container.contains(e.target) && this.isOpen) {
          // Don't auto-close while user is typing or interacting
        }
      });

      // Delegate event listeners for dynamic content (suggestions, escalation)
      this.messagesContainer.addEventListener('click', (e) => {
        // Handle suggestion clicks
        if (e.target.classList.contains('myleo-widget-suggestion') && e.target.dataset.suggestion) {
          this.handleSuggestionClick(e.target.dataset.suggestion);
        }

        // Handle escalation button
        if (e.target.classList.contains('myleo-widget-suggestion') && e.target.dataset.action === 'escalate') {
          this.showEscalationForm();
        }

        // Handle cancel escalation
        if (e.target.dataset.action === 'cancel-escalation') {
          const escalationForm = e.target.closest('.myleo-widget-escalation');
          if (escalationForm) {
            escalationForm.remove();
          }
        }
      });

      // Handle escalation form submission
      this.messagesContainer.addEventListener('submit', (e) => {
        if (e.target.dataset.action === 'submit-escalation') {
          e.preventDefault();
          this.submitEscalation(e);
        }
      });
    }

    async loadLanguage() {
      try {
        const response = await fetch(`${WIDGET_CONFIG.apiBaseUrl.replace('/api', '')}/languages/${WIDGET_CONFIG.language}.json`);
        this.translations = await response.json();
        this.updateUITexts();
      } catch (error) {
        console.warn('Failed to load translations, using defaults');
        this.translations = {
          widget: {
            title: 'Assistant Myleo',
            placeholder: 'Tapez votre message...',
            poweredBy: 'Propulsé par Myleo'
          }
        };
      }
    }

    updateUITexts() {
      if (!this.translations) return;

      document.getElementById('widget-title').textContent = this.translations.widget?.title || 'Assistant Myleo';
      document.getElementById('widget-input').placeholder = this.translations.widget?.placeholder || 'Tapez votre message...';
      document.getElementById('widget-powered-by').textContent = this.translations.widget?.poweredBy || 'Propulsé par Myleo';
      document.getElementById('widget-status').textContent = this.translations.messages?.connected || 'En ligne';
    }

    toggleWidget() {
      if (this.isOpen) {
        this.closeWidget();
      } else {
        this.openWidget();
      }
    }

    async openWidget() {
      this.isOpen = true;
      this.trigger.classList.add('open');
      this.chatWidget.classList.add('open');
      this.input.focus();

      // Start conversation if not already started
      if (!this.sessionId) {
        await this.startConversation();
      }
    }

    closeWidget() {
      this.isOpen = false;
      this.trigger.classList.remove('open');
      this.chatWidget.classList.remove('open');
    }

    minimizeWidget() {
      this.isMinimized = !this.isMinimized;
      this.chatWidget.classList.toggle('minimized', this.isMinimized);
    }

    handleInputChange() {
      const hasText = this.input.value.trim().length > 0;
      this.sendButton.disabled = !hasText || this.isTyping;

      // Auto-resize textarea
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
    }

    async startConversation() {
      try {
        const response = await fetch(`${WIDGET_CONFIG.apiBaseUrl}/chat/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            language: WIDGET_CONFIG.language,
            rubrique: WIDGET_CONFIG.rubrique,
            productCode: WIDGET_CONFIG.productCode,
            userAgent: navigator.userAgent
          })
        });

        const data = await response.json();

        if (data.success) {
          this.sessionId = data.sessionId;
          this.addMessage('bot', data.welcomeMessage);
        } else {
          this.addMessage('bot', this.translations?.messages?.error || 'Une erreur s\'est produite.');
        }
      } catch (error) {
        console.error('Failed to start conversation:', error);
        this.addMessage('bot', this.translations?.messages?.networkError || 'Erreur de connexion.');
      }
    }

    async sendMessage() {
      const message = this.input.value.trim();
      if (!message || this.isTyping) return;

      this.addMessage('user', message);
      this.input.value = '';
      this.handleInputChange();
      this.showTyping();

      try {
        const response = await fetch(`${WIDGET_CONFIG.apiBaseUrl}/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.sessionId,
            message: message
          })
        });

        const data = await response.json();

        this.hideTyping();

        if (data.success) {
          this.addMessage('bot', data.message, {
            suggestions: data.suggestions,
            canEscalate: data.canEscalate
          });
        } else {
          this.addMessage('bot', data.error || this.translations?.messages?.error || 'Une erreur s\'est produite.');
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        this.hideTyping();
        this.addMessage('bot', this.translations?.messages?.networkError || 'Erreur de connexion.');
      }
    }

    addMessage(type, text, options = {}) {
      const messageElement = document.createElement('div');
      messageElement.className = `myleo-widget-message ${type}`;

      const avatarText = type === 'bot' ? 'ML' : 'U';
      const currentTime = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      messageElement.innerHTML = `
        <div class="myleo-widget-avatar">${avatarText}</div>
        <div class="myleo-widget-message-content">
          <div class="myleo-widget-bubble">${this.formatMessage(text)}</div>
          <div class="myleo-widget-message-time">${currentTime}</div>
          ${options.suggestions ? this.createSuggestions(options.suggestions) : ''}
          ${options.canEscalate ? this.createEscalationButton() : ''}
        </div>
      `;

      this.messagesContainer.appendChild(messageElement);
      this.scrollToBottom();

      // Store message
      this.messages.push({ type, text, timestamp: new Date() });

      // Auto-show escalation form if canEscalate is true and this is a bot message
      if (type === 'bot' && options.canEscalate && options.suggestions && options.suggestions.length === 0) {
        // Small delay to let the message appear first
        setTimeout(() => {
          this.showEscalationForm();
        }, 500);
      }
    }

    formatMessage(text) {
      // Basic HTML sanitization and formatting
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    createSuggestions(suggestions) {
      if (!suggestions || suggestions.length === 0) return '';

      const suggestionsHtml = suggestions.map(suggestion =>
        `<button class="myleo-widget-suggestion" data-suggestion="${suggestion}">${suggestion}</button>`
      ).join('');

      return `<div class="myleo-widget-suggestions">${suggestionsHtml}</div>`;
    }

    createEscalationButton() {
      const escalateText = this.translations?.suggestions?.contactSupport || 'Contacter le support';
      return `
        <div class="myleo-widget-suggestions">
          <button class="myleo-widget-suggestion" data-action="escalate">${escalateText}</button>
        </div>
      `;
    }

    handleSuggestionClick(suggestion) {
      this.input.value = suggestion;
      this.input.focus();
      this.handleInputChange();
    }

    showEscalationForm() {
      // Create a bot message container for the escalation form
      const messageElement = document.createElement('div');
      messageElement.className = 'myleo-widget-message bot';

      const currentTime = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // Create the escalation form HTML
      const formHtml = `
        <div class="myleo-widget-escalation">
          <h4>${this.translations?.escalation?.title || 'Contacter le support'}</h4>
          <p>${this.translations?.escalation?.subtitle || 'Vous n\'avez pas trouvé de réponse ? Contactez notre équipe support.'}</p>
          <form class="myleo-widget-escalation-form" data-action="submit-escalation">
            <input type="text" name="firstName" placeholder="${this.translations?.escalation?.form?.firstName || 'Prénom'}" required>
            <input type="text" name="lastName" placeholder="${this.translations?.escalation?.form?.lastName || 'Nom'}" required>
            <input type="email" name="email" placeholder="${this.translations?.escalation?.form?.email || 'Email'}" required>
            <input type="tel" name="phone" placeholder="${this.translations?.escalation?.form?.phone || 'Téléphone'}">
            <input type="text" name="subject" placeholder="${this.translations?.escalation?.form?.subject || 'Objet de votre demande'}" required>
            <textarea name="availability" placeholder="${this.translations?.escalation?.form?.availability || 'Vos créneaux de disponibilité'}" rows="2"></textarea>
            <div class="myleo-widget-escalation-buttons">
              <button type="button" class="myleo-widget-button myleo-widget-button-secondary" data-action="cancel-escalation">
                ${this.translations?.escalation?.form?.cancel || 'Annuler'}
              </button>
              <button type="submit" class="myleo-widget-button myleo-widget-button-primary">
                ${this.translations?.escalation?.form?.submit || 'Envoyer la demande'}
              </button>
            </div>
          </form>
        </div>
      `;

      // Build the complete message structure
      messageElement.innerHTML = `
        <div class="myleo-widget-avatar">ML</div>
        <div class="myleo-widget-message-content">
          <div class="myleo-widget-message-time">${currentTime}</div>
          ${formHtml}
        </div>
      `;

      // Add to messages container
      this.messagesContainer.appendChild(messageElement);
      this.scrollToBottom();

      // Store message
      this.messages.push({
        type: 'bot',
        text: '[Formulaire d\'escalation]',
        timestamp: new Date()
      });
    }

    async submitEscalation(event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const contactData = Object.fromEntries(formData);

      try {
        const response = await fetch(`${WIDGET_CONFIG.apiBaseUrl}/chat/escalate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.sessionId,
            contactData: contactData
          })
        });

        const data = await response.json();

        if (data.success) {
          this.addMessage('bot', this.translations?.escalation?.success || 'Votre demande a été envoyée avec succès.');
          event.target.closest('.myleo-widget-escalation').remove();
        } else {
          this.addMessage('bot', this.translations?.escalation?.error || 'Une erreur s\'est produite lors de l\'envoi de votre demande.');
        }
      } catch (error) {
        console.error('Failed to escalate:', error);
        this.addMessage('bot', this.translations?.escalation?.error || 'Erreur de connexion.');
      }
    }

    showTyping() {
      this.isTyping = true;
      this.sendButton.disabled = true;

      const typingElement = document.createElement('div');
      typingElement.className = 'myleo-widget-message bot typing';
      typingElement.innerHTML = `
        <div class="myleo-widget-avatar">ML</div>
        <div class="myleo-widget-message-content">
          <div class="myleo-widget-typing">
            <span>${this.translations?.messages?.typing || 'En train d\'écrire...'}</span>
            <div class="myleo-widget-typing-dots">
              <div class="myleo-widget-typing-dot"></div>
              <div class="myleo-widget-typing-dot"></div>
              <div class="myleo-widget-typing-dot"></div>
            </div>
          </div>
        </div>
      `;

      this.messagesContainer.appendChild(typingElement);
      this.scrollToBottom();
    }

    hideTyping() {
      this.isTyping = false;
      this.handleInputChange();

      const typingElement = this.messagesContainer.querySelector('.typing');
      if (typingElement) {
        typingElement.remove();
      }
    }

    scrollToBottom() {
      setTimeout(() => {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }, 100);
    }
  }

  // Initialize widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.myleoChatWidget = new MyleoChatWidget();
    });
  } else {
    window.myleoChatWidget = new MyleoChatWidget();
  }
})();