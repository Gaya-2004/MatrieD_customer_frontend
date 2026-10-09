// AIAssistantOverlay — Voice Agent primary ordering journey controller
// No DB access — all actions via ui_actions[] dispatched to frontend state
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVoiceAgent } from '../context/VoiceAgentContext';
import { useCart } from '../context/CartContext';
import './AIAssistantOverlay.css';
import { sendToCustomerMCP } from '../services/mcpCustomerService';
import { derivePageContext, getInitialGreetingForPage } from '../utils/voiceAgentUtils';

const API_BASE = import.meta.env.VITE_API_URL || '';
const agentwaiterLogoImg = `/assets/images/agentwaiter_logo.png`;

const SILENCE_TIMEOUT = 3000; // Configurable silence threshold (increased to 3.0s to allow users to speak long sentences without being cut off)
const RMS_THRESHOLD = 2.0;    // Configurable voice detection threshold

// ── Wave animation helper ─────────────────────────────────────────────────────
const WaveSymbol = ({ active }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '16px' }}>
    {[1,2,3,4,5].map(i => (
      <div key={i} style={{
        width: '3px',
        height: active ? '100%' : '4px',
        background: '#ff4e00',
        borderRadius: '3px',
        animation: active ? `waveBarBounce 0.5s infinite alternate ease-in-out ${i*0.1}s` : 'none',
        transition: 'height 0.2s'
      }} />
    ))}
  </div>
);

// ── Typing indicator ──────────────────────────────────────────────────────────
const TypingDots = () => (
  <div className="ai-msg-bubble" style={{
    background: 'white', padding: '12px 18px', borderRadius: '18px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0'
  }}>
    <span className="dot-typing" />
  </div>
);

const isInternalMessage = (content) => {
  if (!content) return false;
  const lower = content.toLowerCase();
  return (
    lower.includes('[system') ||
    lower.includes('[debug') ||
    lower.includes('[mcp') ||
    lower.includes('[internal') ||
    lower.includes('system note')
  );
};

const AIAssistantOverlay = () => {
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [micState, setMicState]       = useState('IDLE'); // 'LISTENING' | 'RECORDING' | 'PROCESSING' | 'SPEAKING' | 'IDLE'
  const [inputText, setInputText]     = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [isMuted, setIsMuted]         = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const isSpeakingRef                 = useRef(false);
  const isVoiceModeRef                = useRef(true);

  // Keep refs in sync
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isVoiceModeRef.current = isVoiceMode;
  }, [isVoiceMode]);

  const location    = useLocation();
  const navigate    = useNavigate();

  const {
    agentState,
    setFlowStage,
    setCustomerInfo,
    setOrderType,
    setTableNumber,
    setOrderPlaced,
    setOrderStatus,
    setDetectedLanguage,
    startOrderTracking,
    detectLanguage,
    setMessages,
    setIsGreeted,
    updateFromRoute,
    isAgentOpen: isOpen,
    setIsAgentOpen: setIsOpen,
  } = useVoiceAgent();

  const messages = agentState.messages || [];

  const {
    cart,
    addToCart,
    removeCartItem,
    clearCart,
    isCartOpen,
    setIsCartOpen,
    setTableNumber: setCartTableNumber,
    subtotal,
    totalAmount,
    setActiveCategory,
    updateItemQuantity,
    updateNote,
  } = useCart();

  const sidebarRef             = useRef(null);
  const messagesEndRef          = useRef(null);
  const currentAudioRef         = useRef(null);
  const recognitionRef          = useRef(null);
  const transcriptRef           = useRef('');
  const silenceTimerRef         = useRef(null);
  const processInputRef         = useRef(null);
  const isProcessingVoiceRef    = useRef(false);
  const hasSpeechStartedRef     = useRef(false);
  const shouldSubmitRef         = useRef(false);
  const requestCounterRef       = useRef(0);
  const checkoutTimerRef        = useRef(null);

  // ── Synchronize route with context state ──────────────────────────────────
  useEffect(() => {
    updateFromRoute(location.pathname);
  }, [location.pathname, updateFromRoute]);

  // ── Close agent when cart opens ───────────────────────────────────────────
  useEffect(() => {
    if (isCartOpen) {
      setIsOpen(false);
    }
  }, [isCartOpen]);

  // ── Auto-open and greet ────────────────────────────────────────────────────
  useEffect(() => {
    if (location.pathname === '/') return;
    const isSuccessPage = location.pathname.includes('order-success');
    if (!agentState.isGreeted && !isSuccessPage) {
      setIsGreeted(true);
      setIsOpen(true);
      setIsVoiceMode(true);
      const pageCtx = derivePageContext(location.pathname);
      const initialGreeting = getInitialGreetingForPage(pageCtx, agentState) ||
        '[SYSTEM: Start the ordering journey. Greet the customer warmly, welcome them to Data Udipi, and ask for their name. flow_stage=GREETING]';
      
      // Do not clear this timeout on cleanup, otherwise the re-render from setIsGreeted will cancel it.
      setTimeout(() => {
        processInput(initialGreeting);
      }, 600);
    }
  }, [agentState.isGreeted, location.pathname, setIsGreeted, agentState]);

  // ── Auto-scroll messages ──────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Listen for order status updates (from VoiceAgentContext polling) ───────
  useEffect(() => {
    const handleStatusUpdate = (e) => {
      const status = e.detail?.status;
      if (status) {
        setOrderStatus(status);
        const statusMsgs = {
          PENDING:   '[SYSTEM: Order status is now RECEIVED. Inform the customer warmly that their order has been received and confirmed.]',
          CONFIRMED: '[SYSTEM: Order status is now RECEIVED. Inform the customer warmly that their order has been received and confirmed.]',
          PREPARING: '[SYSTEM: Order status is now PREPARING. Inform the customer warmly that their food is being prepared.]',
          READY:     '[SYSTEM: Order status is now READY. Tell the customer their order is ready and will be served soon.]',
          SERVED:    '[SYSTEM: Order status is now SERVED. Congratulate the customer and wish them a great meal.]',
          COMPLETED: '[SYSTEM: Order status is now COMPLETED. Congratulate the customer and wish them a great meal.]',
        };
        if (statusMsgs[status]) {
          setIsOpen(true);
          setTimeout(() => {
            if (processInputRef.current) processInputRef.current(statusMsgs[status]);
          }, 300);
        }
      }
    };
    document.addEventListener('order-status-update', handleStatusUpdate);
    return () => document.removeEventListener('order-status-update', handleStatusUpdate);
  }, []);



  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (checkoutTimerRef.current) clearTimeout(checkoutTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  // ── Audio playback ────────────────────────────────────────────────────────
  const stopAudioPlayback = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setMicState('IDLE');
  }, []);

  const speakFallback = useCallback((text, onEnd) => {
    if (!text || isMuted) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const lang = agentState.detectedLanguage;
    const langMap = {
      tamil: 'ta', malayalam: 'ml', kannada: 'kn', telugu: 'te',
      hindi: 'hi', urdu: 'ur', bengali: 'bn', gujarati: 'gu',
      punjabi: 'pa', english: 'en',
    };
    const bcp = langMap[lang] || 'en';
    
    // Male voice preference
    const findMaleVoice = (langPrefix) => {
      return voices.find(v => {
        const n = v.name.toLowerCase();
        return v.lang.startsWith(langPrefix) && (n.includes('male') || n.includes('david') || n.includes('mark') || n.includes('valluvar') || n.includes('prabhat')) && !n.includes('female');
      }) || voices.find(v => v.lang.startsWith(langPrefix) && !v.name.toLowerCase().includes('female')) || voices.find(v => v.lang.startsWith(langPrefix));
    };

    const voice = findMaleVoice(bcp) || findMaleVoice('en');
    if (voice) utter.voice = voice;
    utter.lang = `${bcp}-IN`;
    utter.onend = () => { setIsSpeaking(false); isSpeakingRef.current = false; setMicState('IDLE'); onEnd?.(); };
    utter.onerror = () => { setIsSpeaking(false); isSpeakingRef.current = false; setMicState('IDLE'); onEnd?.(); };
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setMicState('SPEAKING');
    window.speechSynthesis.speak(utter);
  }, [isMuted, agentState.detectedLanguage]);

  // ── Microphone recording cleanup & control ─────────────────────────────────
  const cleanupMic = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

  const stopListening = useCallback(() => {
    cleanupMic();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    setMicState('IDLE');
  }, [cleanupMic]);

  // ── (Removed outside click interference so agent keeps listening) ──────────

  const startListening = useCallback(() => {
    if (location.pathname === '/') return;
    if (isSpeakingRef.current || isProcessingVoiceRef.current) return;
    stopAudioPlayback();
    cleanupMic();
    
    shouldSubmitRef.current = false;
    hasSpeechStartedRef.current = false;
    transcriptRef.current = '';

    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch(e) {}
    }
  }, [stopAudioPlayback, cleanupMic, location.pathname]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, { role: 'model', content: 'Speech recognition is not supported in this browser. Please type your message.' }]);
      setIsVoiceMode(false);
      isVoiceModeRef.current = false;
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      // Use Indian English by default for optimal recognition of local dishes (e.g. Idly, Dosa, Parcel)
      recognition.lang = 'en-IN';
      
      recognition.onstart = () => {
        setMicState('LISTENING');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.trim();
        if (transcript) {
          transcriptRef.current = transcript;
          setInputText(transcript);
          shouldSubmitRef.current = true;
        }
      };

      recognition.onend = () => {
        if (shouldSubmitRef.current) {
          isProcessingVoiceRef.current = true;
          setMicState('PROCESSING');
          let finalStr = transcriptRef.current.trim();
          
          // Normalize common Web Speech API misrecognitions for Indian terms
          if (finalStr) {
            finalStr = finalStr.replace(/\bitaly\b/gi, 'Idly');
            finalStr = finalStr.replace(/\bpaise\b/gi, 'Parcel');
            finalStr = finalStr.replace(/\bpart\b/gi, 'Parcel');
            finalStr = finalStr.replace(/\bgobbled\b/gi, 'Gobi');
          }

          setInputText('');
          transcriptRef.current = '';
          
          if (finalStr) {
            if (processInputRef.current) processInputRef.current(finalStr, null);
          } else {
            isProcessingVoiceRef.current = false;
            hasSpeechStartedRef.current = false;
            shouldSubmitRef.current = false;
            if (isVoiceModeRef.current && !isSpeakingRef.current) {
              setMicState('LISTENING');
              setTimeout(() => {
                 if (recognitionRef.current && !isSpeakingRef.current) {
                     try { recognitionRef.current.start(); } catch(e) {}
                 }
              }, 300);
            }
          }
        } else {
          // Browser stopped it naturally, or user clicked mic off. Restart if still in voice mode.
          if (isVoiceModeRef.current && !isSpeakingRef.current && !isProcessingVoiceRef.current) {
            setTimeout(() => {
               if (recognitionRef.current && !isSpeakingRef.current && !isProcessingVoiceRef.current) {
                   try { recognitionRef.current.start(); } catch(e) {}
               }
            }, 300);
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error !== 'aborted') console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMessages(prev => [...prev, { role: 'model', content: 'Microphone access denied. Please type your message.' }]);
          setIsVoiceMode(false);
          isVoiceModeRef.current = false;
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // ── Fetch fresh menu items for cart matching ──────────────────────────────
  const fetchMenuItems = useCallback(async () => {
    try {
      const rid = localStorage.getItem('selected_restaurant_id') || '1';
      const res = await fetch(`${API_BASE}/api/v1/public/menu/items?restaurant_id=${rid}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }, []);

  // ── Handle ui_actions from the AI (no DB access) ──────────────────────────
  const handleUIAction = useCallback(async (action, menuItems) => {
    const a = action.action?.toLowerCase();
    if (!a) return;

    switch (a) {
      case 'set_customer': {
        const name  = action.name  || action.customer_name  || null;
        const phone = action.phone || action.customer_phone || null;
        setCustomerInfo({ name, phone });
        if (name) document.dispatchEvent(new CustomEvent('update-name',  { detail: { name } }));
        if (phone) document.dispatchEvent(new CustomEvent('update-phone', { detail: { phone } }));
        break;
      }

      case 'set_flow_stage': {
        const stage = action.stage || action.flow_stage || '';
        if (stage) setFlowStage(stage);
        break;
      }

      case 'set_order_type': {
        const type = (action.type || action.order_type || '').toLowerCase();
        setOrderType(type);
        break;
      }

      case 'set_region': {
        const region = (action.region || '').toLowerCase();
        if (region.includes('north')) {
           document.dispatchEvent(new CustomEvent('change-region', { detail: { region: 'north' } }));
        } else if (region.includes('south')) {
           document.dispatchEvent(new CustomEvent('change-region', { detail: { region: 'south' } }));
        } else {
           document.dispatchEvent(new CustomEvent('change-region', { detail: { region: 'all' } }));
        }
        break;
      }

      case 'set_table_number': {
        const num = String(action.table || action.table_number || '').replace(/\D/g,'') || action.table;
        if (num) {
          setTableNumber(num);
          if (setCartTableNumber) setCartTableNumber(num);
        }
        break;
      }

      case 'navigate': {
        const page = (action.page || '').toLowerCase();
        if (page === 'dine-in' || page === 'dinein')           navigate('/dine-in');
        else if (page === 'take-away' || page === 'takeaway')  navigate('/take-away');
        else if (page === 'checkout' || page === 'cart')       navigate(agentState.orderType === 'takeaway' ? '/takeaway-checkout' : '/checkout');
        else if (page === 'payment')                           navigate(agentState.orderType === 'takeaway' ? '/takeaway-payment' : '/payment');
        else if (page === 'home')                              navigate('/home');
        else if (page === 'landing' || page === '/')           navigate('/');
        else if (action.page) {
          const categoryName = action.page.trim();
          const lowerName = categoryName.toLowerCase();
          const rid = localStorage.getItem('selected_restaurant_id') || '1';
          fetch(`${API_BASE}/api/v1/public/menu/categories?restaurant_id=${rid}`)
            .then(res => res.json())
            .then(categories => {
              const matched = categories.find(c => c.name?.toLowerCase().includes(lowerName))
                            || categories.find(c => lowerName.includes(c.name?.toLowerCase()));
              if (matched && setActiveCategory) {
                const targetRoute = agentState.orderType === 'takeaway' ? '/take-away' : '/dine-in';
                if (window.location.pathname !== targetRoute) {
                  navigate(targetRoute);
                }
                setTimeout(() => {
                  setActiveCategory(String(matched.id));
                  document.dispatchEvent(new CustomEvent('change-category', { detail: { categoryId: String(matched.id) } }));
                }, 100);
              }
            }).catch(err => console.warn('Failed to navigate category:', err));
        }
        break;
      }

      case 'add_to_cart': {
        const itemName = action.item || '';
        const qty = Number(action.quantity) || 1;
        if (!itemName) break;
        const items = menuItems || await fetchMenuItems();
        const match = items.find(m => m.name?.toLowerCase() === itemName.toLowerCase())
                   || items.find(m => m.name?.toLowerCase().includes(itemName.toLowerCase()));
        if (match) {
          let img = null;
          if (match.image_url) {
            img = match.image_url.startsWith('http') ? match.image_url : `${API_BASE}${match.image_url}`;
          }
          addToCart({ id: match.id, name: match.name, price: Number(match.price), image: img }, qty);
          
          if (setIsCartOpen) {
            setIsOpen(false);
            setIsCartOpen(true);
            setTimeout(() => {
              setIsCartOpen(false);
              setIsOpen(true);
            }, 3000);
          }
        }
        break;
      }

      case 'remove_from_cart': {
        const itemName = action.item || '';
        const found = cart.find(c => c.name?.toLowerCase() === itemName.toLowerCase());
        if (found) removeCartItem(found.id);
        break;
      }

      case 'view_cart': {
        const route = agentState.orderType === 'takeaway' ? '/take-away' : '/dine-in';
        if (window.location.pathname !== route && window.location.pathname !== '/') {
          navigate(route);
          setTimeout(() => {
            if (setIsCartOpen) setIsCartOpen(true);
          }, 100);
        } else {
          if (window.location.pathname === '/' && route) {
             navigate(route);
             setTimeout(() => {
               if (setIsCartOpen) setIsCartOpen(true);
             }, 100);
          } else {
             if (setIsCartOpen) setIsCartOpen(true);
          }
        }
        break;
      }

      case 'trigger_checkout': {
        setFlowStage('CHECKOUT_REVIEW');
        const route = agentState.orderType === 'takeaway' ? '/takeaway-checkout' : '/checkout';
        navigate(route);
        break;
      }

      case 'auto_navigate_to_payment': {
        const delay = Number(action.delay_ms) || 2500;
        setFlowStage('PAYMENT_SELECT');
        checkoutTimerRef.current = setTimeout(() => {
          const route = agentState.orderType === 'takeaway' ? '/takeaway-payment' : '/payment';
          navigate(route);
        }, delay);
        break;
      }

      case 'payment_method': {
        const method = (action.method || 'Cash').toLowerCase().includes('upi') ? 'UPI' : 'Cash';
        document.dispatchEvent(new CustomEvent('select-payment', { detail: { method } }));
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('confirm-place-order', { detail: { method } }));
          const confirmBtn = document.getElementById('payment-confirm-btn');
          if (confirmBtn) {
            confirmBtn.click();
          }
        }, 300);
        break;
      }

      case 'start_order_tracking': {
        const oid = agentState.orderId || localStorage.getItem('active_order_id');
        if (oid) startOrderTracking(oid, (status) => {
          setOrderStatus(status);
        });
        break;
      }

      case 'request_feedback': {
        setFlowStage('FEEDBACK');
        break;
      }

      default:
        console.warn('[VoiceAgent] Unknown ui_action:', a, action);
    }
  }, [agentState, navigate, cart, addToCart, removeCartItem, setIsCartOpen,
      setCustomerInfo, setFlowStage, setOrderType, setTableNumber, setCartTableNumber,
      setOrderStatus, startOrderTracking, fetchMenuItems, setActiveCategory]);

  // ── Main process function ─────────────────────────────────────────────────
  const processInput = useCallback(async (textPrompt, audioBase64 = null) => {
    if (textPrompt && !textPrompt.startsWith('[SYSTEM')) {
      setMessages(prev => [...prev, { role: 'user', content: textPrompt }]);
      const lang = detectLanguage(textPrompt);
      if (lang !== agentState.detectedLanguage) setDetectedLanguage(lang);
    }

    setIsLoading(true);
    setMicState('PROCESSING');
    stopAudioPlayback();
    cleanupMic();

    requestCounterRef.current += 1;
    const seq = requestCounterRef.current;

    try {
      const response = await sendToCustomerMCP({
        prompt: textPrompt || (audioBase64 ? '[SYSTEM NOTE: User spoke via mic. Transcribe and respond.]' : ''),
        chatHistory: messages.slice(-12),
        audioBase64,
        isVoice: true,
        restaurantId: parseInt(localStorage.getItem('selected_restaurant_id')) || 1,
        orderId: agentState.orderId || localStorage.getItem('active_order_id'),
        currentPage: window.location.pathname,
        orderType: agentState.orderType,
        cartData: cart,
        customerName: agentState.customerName,
        customerPhone: agentState.mobileNumber,
        flowStage: agentState.flowStage,
        tableNumber: agentState.tableNumber,
        paymentStatus: agentState.paymentStatus,
        orderStatus: agentState.orderStatus,
        detectedLanguage: agentState.detectedLanguage,
        sessionId: agentState.conversationSessionId,
      });

      if (seq !== requestCounterRef.current) return;

      // Handle invalid speech / empty transcription
      if (audioBase64 && (!response.transcribed_user_text || !response.transcribed_user_text.trim())) {
        const fallbackText = "Sorry, I couldn't hear that. Please try again.";
        setMessages(prev => [...prev, { role: 'model', content: fallbackText }]);
        const afterSpeak = () => {
          if (isVoiceModeRef.current && seq === requestCounterRef.current) {
            setMicState('LISTENING');
            setTimeout(() => startListening(), 300);
          } else {
            setMicState('IDLE');
          }
        };
        if (!isMuted) {
          speakFallback(fallbackText, afterSpeak);
        } else {
          afterSpeak();
        }
        return;
      }

      // Update messages
      if (response.assistant_text) {
        setMessages(prev => {
          const next = [...prev];
          if (audioBase64 && response.transcribed_user_text) {
            next.push({ role: 'user', content: response.transcribed_user_text });
            const lang = detectLanguage(response.transcribed_user_text);
            if (lang !== agentState.detectedLanguage) setDetectedLanguage(lang);
          }
          next.push({ role: 'model', content: response.assistant_text });
          return next;
        });
      }

      // Execute all ui_actions
      const freshMenu = await fetchMenuItems();
      if (response.ui_actions && Array.isArray(response.ui_actions)) {
        for (const actionObj of response.ui_actions) {
          await handleUIAction(actionObj, freshMenu);
        }
      }

      // Speak the response
      const afterSpeak = () => {
        if (isVoiceModeRef.current && seq === requestCounterRef.current) {
          setMicState('LISTENING');
          setTimeout(() => startListening(), 300);
        } else {
          setMicState('IDLE');
        }
      };

      if (response.audio_payload && !isMuted) {
        stopAudioPlayback();
        const audio = new Audio(`data:audio/mp3;base64,${response.audio_payload}`);
        currentAudioRef.current = audio;
        audio.playbackRate = 1.15;
        setIsSpeaking(true);
        isSpeakingRef.current = true;
        setMicState('SPEAKING');
        audio.onended = () => { setIsSpeaking(false); isSpeakingRef.current = false; setMicState('IDLE'); afterSpeak(); };
        audio.play().catch(() => speakFallback(response.assistant_text, afterSpeak));
      } else if (response.assistant_text && !isMuted) {
        speakFallback(response.assistant_text, afterSpeak);
      } else {
        afterSpeak();
      }

    } catch (err) {
      if (seq !== requestCounterRef.current) return;
      console.error('[VoiceAgent] MCP error:', err);
      setMessages(prev => [...prev, { role: 'model', content: 'Oops! Something went wrong. Please try again.' }]);
      if (isVoiceModeRef.current && !isSpeakingRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    } finally {
      if (seq === requestCounterRef.current) {
        setIsLoading(false);
        isProcessingVoiceRef.current = false;
      }
    }
  }, [
    messages, agentState, cart, isMuted, isVoiceMode,
    handleUIAction, fetchMenuItems, speakFallback, stopAudioPlayback,
    startListening, detectLanguage, setDetectedLanguage, cleanupMic, setMessages,
  ]);

  useEffect(() => {
    processInputRef.current = processInput;
  }, [processInput]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    processInput(text);
  };

  const handleVoiceSend = () => {
    // Deprecated: voice submits automatically via silence detection.
  };

  const toggleSidebar = () => {
    if (isOpen) {
      setIsOpen(false);
      stopListening();
    } else {
      setIsOpen(true);
      if (isVoiceMode) {
        setMicState('LISTENING');
        setTimeout(() => startListening(), 100);
      }
    }
  };

  // ── Don't render on the landing page ──────────────────────────────────
  if (location.pathname === '/') return null;

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <div
          className={`ai-trigger-btn ${(micState === 'LISTENING' || micState === 'RECORDING') ? 'is-listening' : ''}`}
          onClick={toggleSidebar}
          title="Talk to Voice Agent"
        >
          <div className="ai-trigger-avatar-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: '50%', width: '100%', height: '100%', overflow: 'hidden' }}>
            <img src={agentwaiterLogoImg} alt="Agent Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div className="ai-trigger-text-wrap">
            <span className="ai-trigger-title">Talk to Your Agent</span>
            <span className="ai-trigger-subtitle">⬇ Tap to speak</span>
          </div>
          <div className="ai-hover-tooltip">
            <div className="tooltip-line1">Hi! I&apos;m your Voice Agent.</div>
            <div className="tooltip-line2">I&apos;ll guide your entire order!</div>
          </div>
        </div>
      )}

      {/* Main sidebar */}
      <div ref={sidebarRef} className={['ai-sidebar-overlay', isOpen ? 'active' : ''].join(' ')}>
        <div className="ai-sidebar-content-original">

          {/* Hero section */}
          <div className="ai-hero-frosted-original" style={{ height: isVoiceMode ? '270px' : '110px', transition: 'height 0.3s ease' }}>
            <header className="ai-unified-header">
              <span>Talk To Your Agent</span>
              {/* Close button removed to keep agent open permanently */}
            </header>

            {/* Mascot */}
            {isVoiceMode && (
              <div className="ai-namaste-wrap-original">
                <div className="ai-waveform-bg">
                  {Array.from({ length: 15 }).map((_, i) => <div key={i} className="ai-wave-line" />)}
                </div>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', zIndex: 2, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.9)', background: '#fff' }}>
                  <img src={agentwaiterLogoImg} alt="Agent Waiter Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="ai-chat-messages" style={{
            flex: 1, minHeight: 0, overflowY: 'auto', scrollBehavior: 'smooth',
            padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: '14px',
            scrollbarWidth: 'none',
          }}>
            <style>{'.ai-chat-messages::-webkit-scrollbar { display: none; }'}</style>

            {messages.filter(msg => msg && msg.content && !isInternalMessage(msg.content)).length === 0 ? (
              <div className="ai-greeting-center">
                <h2>Hi! I&apos;m your Voice Agent.</h2>
                <p>I&apos;ll guide you through your entire order!</p>
              </div>
            ) : (
              messages
                .filter(msg => msg && msg.content && !isInternalMessage(msg.content))
                .map((msg, i) => (
                  <div key={i}
                    className={['ai-msg-container', msg.role].join(' ')}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      animation: 'aiMsgIn 0.3s ease-out',
                    }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: msg.role === 'user' ? '#ff4e00' : 'white',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.1)', overflow: 'hidden',
                    }}>
                      {msg.role === 'user'
                        ? <i className="fa-solid fa-user-check" style={{ color: 'white', fontSize: '14px' }} />
                        : <img src={agentwaiterLogoImg} alt="Agent" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      }
                    </div>
                    <div className="ai-msg-bubble" style={{
                      background: 'white', color: '#333', padding: '12px 18px',
                      borderRadius: '18px', maxWidth: '78%', fontSize: '14.5px',
                      fontWeight: '500', boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                      border: '1px solid #f0f0f0',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))
            )}

            {isLoading && (
              <div className="ai-msg-container model" style={{ display: 'flex', gap: '12px', animation: 'aiMsgIn 0.3s ease-out' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', background: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)', overflow: 'hidden',
                }}>
                  <img src={agentwaiterLogoImg} alt="Agent" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <TypingDots />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer input */}
          <div className="ai-footer-original" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="ai-input-pill-original">
              {/* Mic / Keyboard Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  if (isVoiceMode) {
                    setIsVoiceMode(false);
                    stopListening();
                    setMicState('IDLE');
                  } else {
                    setIsVoiceMode(true);
                    setMicState('LISTENING');
                    setTimeout(() => startListening(), 100);
                  }
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: isVoiceMode ? '#ffebee' : '#f0f0f0',
                  color: isVoiceMode ? '#ff4e00' : '#666',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginRight: '6px'
                }}
                title={isVoiceMode ? 'Switch to typing mode' : 'Switch to voice mode'}
              >
                <i className={`fa-solid ${isVoiceMode ? 'fa-keyboard' : 'fa-microphone'}`} />
              </button>

              {/* Input / Listening indicator */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
                {isVoiceMode ? (
                  <>
                    <input
                      type="text"
                      placeholder={
                        micState === 'PROCESSING' ? 'Processing...' :
                        micState === 'SPEAKING' ? 'Agent is responding...' :
                        'Listening... Speak now'
                      }
                      value={inputText}
                      readOnly
                      style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: '0 4px', outline: 'none', fontSize: '13px', color: micState === 'PROCESSING' || micState === 'SPEAKING' ? '#888' : '#000' }}
                    />
                    {(micState === 'RECORDING' || micState === 'SPEAKING' || micState === 'LISTENING') && (
                      <WaveSymbol active={micState === 'RECORDING' || micState === 'SPEAKING'} />
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    disabled={isLoading}
                    style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: '0 4px', outline: 'none', fontSize: '14px' }}
                  />
                )}
              </div>

              {/* Send button (works in both text mode and voice mode when recording/listening) */}
              <button
                type="button"
                onClick={isVoiceMode ? handleVoiceSend : handleSend}
                disabled={isVoiceMode ? true : (inputText.trim().length === 0 || isLoading)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: isVoiceMode
                    ? ((micState === 'RECORDING' || micState === 'LISTENING') ? '#ff4e00' : '#e0e0e0')
                    : ((inputText.trim().length > 0 && !isLoading) ? '#ff4e00' : '#e0e0e0'),
                  color: '#fff',
                  cursor: isVoiceMode
                    ? ((micState === 'RECORDING' || micState === 'LISTENING') ? 'pointer' : 'default')
                    : ((inputText.trim().length > 0 && !isLoading) ? 'pointer' : 'default'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <i className="fa-solid fa-paper-plane" />
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default AIAssistantOverlay;
