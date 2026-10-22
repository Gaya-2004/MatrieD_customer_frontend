import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { useVoiceAgent } from '../context/VoiceAgentContext'
import Header from '../components/Header'
import { fetchCategories, fetchItems, formatMenuData, placeOrder } from '../services/menuService'
import { sendToCustomerMCP } from '../services/mcpCustomerService'
import '../styles/pages.css'
const agentwaiterLogoImg = `/assets/images/chef_avatar_head.png`;

function Agent() {
  const navigate = useNavigate()
  const { language, t } = useLanguage()
  const { agentState, setCustomerInfo, setFlowStage } = useVoiceAgent()
  const [messages, setMessages] = useState([
    { role: 'model', content: language === 'English' ? 'Welcome to maitreD! Please tell me your name and mobile number.' : 'மைத்ரேடிக்கு உங்களை வரவேற்கிறோம்! தயவுசெய்து உங்கள் பெயர் மற்றும் தொலைபேசி எண்ணைக் கூறவும்.' }
  ])
  const [inputText, setInputText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isMuted, setIsMutedState] = useState(false)
  const isMutedRef = useRef(false)

  const setIsMuted = (val) => {
    setIsMutedState(val)
    isMutedRef.current = val
    if (val && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }

  const menuTopRef = useRef(null)
  const [micToast, setMicToast] = useState('')
  const [menuCategories, setMenuCategories] = useState([{ id: 'all', name: 'All Menu', image: null }]);
  const [menuItems, setMenuItems] = useState({ all: [] });
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderType, setOrderType] = useState(() => localStorage.getItem('active_order_type') || '');
  const [customerName, setCustomerName] = useState(() => sessionStorage.getItem('customer_name') || '');

  useEffect(() => {
    async function loadData() {
      try {
        const [dbCats, dbItems] = await Promise.all([fetchCategories(), fetchItems()]);
        const { categories, itemsMap, allItems } = formatMenuData(dbCats, dbItems);
        setMenuCategories(categories);
        setMenuItems(itemsMap);
        setAllItems(allItems);
      } catch (err) {
        console.error('Failed to load menu data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    // Foolproof auto-navigation when both Name and Phone are collected
    if (agentState.customerName && agentState.mobileNumber) {
      const timer = setTimeout(() => {
        navigate('/home');
      }, 800); // Small delay to let 'Thank you.' TTS finish playing
      return () => clearTimeout(timer);
    }
  }, [agentState.customerName, agentState.mobileNumber, navigate]);

  const [showMenu, setShowMenu] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [viewMode, setViewMode] = useState('grid') // 'grid' for categories, 'list' for items

  // Cart State Management from Context
  const {
    cart,
    setCart,
    addToCart,
    changeQty,
    removeCartItem,
    totalItems,
    subtotal: totalAmount
  } = useCart()

  // Checkout & Mobile Flow State
  const [isAwaitingMobile, setIsAwaitingMobile] = useState(false)
  const [isAwaitingPayment, setIsAwaitingPayment] = useState(false)
  const [mobileNumber, setMobileNumber] = useState(() => sessionStorage.getItem('customer_phone') || '')
  const [finalInvoiceData, setFinalInvoiceData] = useState(null)

  const messagesEndRef = useRef(null)

  // Autoscroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (showMenu && menuTopRef.current) {
      // Scroll to the top of the menu instead of the bottom of the chat
      setTimeout(() => {
        menuTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      scrollToBottom()
    }
  }, [messages, showMenu, activeCategory, viewMode])

  // Speech Recognition Setup
  const recognitionRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const manualStopRef = useRef(false);
  const handleSendMessageRef = useRef(null);
  const agentStateRef = useRef(agentState);
  const messagesRef = useRef(messages);

  useEffect(() => {
    agentStateRef.current = agentState;
  }, [agentState]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'English' ? 'en-IN' : 'ta-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setMicToast(language === 'English' ? 'Listening...' : 'கேட்கிறது...');
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setMicToast('Speech captured!');
        if (handleSendMessageRef.current) {
          handleSendMessageRef.current(transcript);
        }
        setTimeout(() => setMicToast(''), 1000);
      };

      recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
          console.error('Speech recognition error', event.error);
          setMicToast('Mic error. Please try again.');
          setTimeout(() => setMicToast(''), 2000);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setMicToast(prev => prev === 'Listening...' ? '' : prev);

        // Auto-loop mic unless manually stopped or currently speaking
        if (!isMutedRef.current && !isSpeakingRef.current && !manualStopRef.current && recognitionRef.current) {
          setTimeout(() => {
             if (!isMutedRef.current && !isSpeakingRef.current && !manualStopRef.current && recognitionRef.current) {
                 try { recognitionRef.current.start(); } catch(e) {}
             }
          }, 500);
        }
      };

      recognitionRef.current = recognition;
      
      try {
        recognition.start();
      } catch (err) {
        console.warn('Auto-start mic failed:', err);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, [language]); // Re-initialize if language changes

  const toggleListen = () => {
    if (isListening) {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
    } else {
      manualStopRef.current = false;
      recognitionRef.current?.start();
    }
  };

  const speakText = (text) => {
    if (isMutedRef.current || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }
    };
    
    utterance.onend = () => {
      isSpeakingRef.current = false;
      if (!isMutedRef.current && recognitionRef.current && !manualStopRef.current) {
        setTimeout(() => {
          if (!isSpeakingRef.current && !manualStopRef.current && recognitionRef.current) {
             try { recognitionRef.current.start(); } catch(e) {}
          }
        }, 300);
      }
    };

    const voices = window.speechSynthesis.getVoices();

    // Consistent Voice Selection throughout the app (Male voice preference)
    const englishVoice = voices.find(v => {
      const n = v.name.toLowerCase();
      return v.lang.startsWith('en') && (
        n.includes('male') ||
        n.includes('david') ||
        n.includes('mark') ||
        n.includes('george') ||
        n.includes('brian') ||
        n.includes('prabhat')
      ) && !n.includes('female');
    }) || voices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('female')) || voices.find(v => v.lang.startsWith('en'));

    const tamilVoice = voices.find(v => {
      const n = v.name.toLowerCase();
      return v.lang.startsWith('ta') && (
        n.includes('valluvar') ||
        n.includes('male')
      ) && !n.includes('female');
    }) || voices.find(v => v.lang.startsWith('ta') && !v.name.toLowerCase().includes('female')) || voices.find(v => v.lang.startsWith('ta'));

    const hasTamil = /[\u0b80-\u0bff]/.test(text);
    const hasHindi = /[\u0900-\u097f]/.test(text);
    const hasKannada = /[\u0c80-\u0cff]/.test(text);
    const hasTelugu = /[\u0c00-\u0c7f]/.test(text);
    const hasMalayalam = /[\u0d00-\u0d7f]/.test(text);

    if (hasTamil) {
      if (tamilVoice) utterance.voice = tamilVoice;
      utterance.lang = 'ta-IN';
      utterance.pitch = 1.0;
      utterance.rate = 0.95;
    } else if (hasHindi) {
      const hindiVoice = voices.find(v => v.lang.startsWith('hi')) || englishVoice;
      if (hindiVoice) utterance.voice = hindiVoice;
      utterance.lang = 'hi-IN';
      utterance.pitch = 1.0;
      utterance.rate = 0.95;
    } else if (hasKannada) {
      const kannadaVoice = voices.find(v => v.lang.startsWith('kn')) || englishVoice;
      if (kannadaVoice) utterance.voice = kannadaVoice;
      utterance.lang = 'kn-IN';
      utterance.pitch = 1.0;
      utterance.rate = 0.95;
    } else if (hasTelugu) {
      const teluguVoice = voices.find(v => v.lang.startsWith('te')) || englishVoice;
      if (teluguVoice) utterance.voice = teluguVoice;
      utterance.lang = 'te-IN';
      utterance.pitch = 1.0;
      utterance.rate = 0.95;
    } else if (hasMalayalam) {
      const malayalamVoice = voices.find(v => v.lang.startsWith('ml')) || englishVoice;
      if (malayalamVoice) utterance.voice = malayalamVoice;
      utterance.lang = 'ml-IN';
      utterance.pitch = 1.0;
      utterance.rate = 0.95;
    } else if (language === 'Tamil') {
      if (tamilVoice) utterance.voice = tamilVoice;
      utterance.lang = 'ta-IN';
      utterance.pitch = 1.0;
      utterance.rate = 0.95;
    } else {
      if (englishVoice) utterance.voice = englishVoice;
      utterance.lang = 'en-US';
      utterance.pitch = 1.05;
      utterance.rate = 0.95;
    }

    window.speechSynthesis.speak(utterance);
  }

  // Auto-greet on mount
  useEffect(() => {
    const greeting = language === 'English' 
      ? 'Welcome to MaitreD! Please tell me your name and mobile number.' 
      : 'மேய்டர்-டிக்கு உங்களை வரவேற்கிறோம்! தயவுசெய்து உங்கள் பெயர் மற்றும் தொலைபேசி எண்ணைக் கூறவும்.';
    const timer = setTimeout(() => {
      speakText(greeting);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const handleSendMessage = async (textToSubmit = inputText) => {
    if (!textToSubmit || !textToSubmit.trim()) return;

    // Direct check for "show menu"
    if (textToSubmit.toLowerCase().includes('show menu')) {
      setShowMenu(true);
      setViewMode('grid');
      const localResponse = "Certainly! Here are our menu categories.";
      setMessages(prev => {
        const next = [...prev, { role: 'user', content: textToSubmit }, { role: 'model', content: localResponse }];
        messagesRef.current = next;
        return next;
      });
      speakText(localResponse);
      setInputText('');
      return;
    }

    const currentMessages = messagesRef.current || messages;
    const currentAgentState = agentStateRef.current || agentState;
    const userMessage = { role: 'user', content: textToSubmit };
    const updatedMessages = [...currentMessages, userMessage];
    setMessages(updatedMessages);
    messagesRef.current = updatedMessages;
    setInputText('');
    setIsLoading(true);

    const effectiveName = currentAgentState.customerName || sessionStorage.getItem('customer_name') || customerName || null;
    const effectivePhone = currentAgentState.mobileNumber || sessionStorage.getItem('customer_phone') || mobileNumber || null;
    const effectiveStage = currentAgentState.flowStage || (effectiveName && !effectivePhone ? 'COLLECT_PHONE' : (effectiveName && effectivePhone ? 'SELECT_ORDER_TYPE' : 'GREETING'));

    try {
      const response = await sendToCustomerMCP({
        prompt: textToSubmit,
        chatHistory: updatedMessages.slice(0, -1).map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', text: m.content })),
        isVoice: false,
        restaurantId: parseInt(localStorage.getItem('selected_restaurant_id')) || 1,
        orderId: localStorage.getItem('active_order_id'),
        currentPage: '/',
        flowStage: effectiveStage,
        customerName: effectiveName,
        customerPhone: effectivePhone,
        sessionId: currentAgentState.conversationSessionId
      });

      if (response.assistant_text) {
        setMessages(prev => {
          const next = [...prev, { role: 'model', content: response.assistant_text }];
          messagesRef.current = next;
          return next;
        });
        speakText(response.assistant_text);
      }

      const actions = response.ui_actions || [];
      if (response.tool_name) {
         actions.push({ action: response.tool_name, ...response.parameters, ...response.tool_result });
      }

      for (const actionObj of actions) {
        const actionType = (actionObj.action || actionObj.type || actionObj.tool_name || '').toLowerCase();
        
        if (actionType === 'set_order_type' || actionType === 'set_order') {
           const type = (actionObj.type || actionObj.order_type || '').toLowerCase();
           setOrderType(type);
           localStorage.setItem('active_order_type', type);
        }
        else if (actionType === 'add_to_cart' || actionType === 'quick_order') {
           const itemsToAdd = actionObj.items || (actionObj.item ? [actionObj] : []);
           for (const reqItem of itemsToAdd) {
              const realItem = allItems.find(mi => mi.name.toLowerCase() === (reqItem.name || reqItem.item || '').toLowerCase());
              if (realItem) {
                 addToCart(realItem, reqItem.quantity || 1);
              }
           }
        }
        else if (actionType === 'view_cart' || actionType === 'open_cart') {
           setShowMenu(false);
           setMessages(prev => {
             const next = [...prev, { role: 'model', type: 'review' }];
             messagesRef.current = next;
             return next;
           });
        }
        else if (actionType === 'set_customer' || actionType === 'update_name') {
           const newInfo = {};
           const name = actionObj.name || actionObj.customer_name;
           const phone = actionObj.phone || actionObj.customer_phone;
           if (name) {
              setCustomerName(name);
              newInfo.name = name;
              sessionStorage.setItem('customer_name', name);
           }
           if (phone) {
              setMobileNumber(phone);
              newInfo.phone = phone;
              sessionStorage.setItem('customer_phone', phone);
           }
           if (Object.keys(newInfo).length > 0) {
              setCustomerInfo(newInfo);
              if (agentStateRef.current) {
                 agentStateRef.current = { ...agentStateRef.current, ...newInfo };
              }
           }
        }
        else if (actionType === 'set_flow_stage') {
           const nextStage = actionObj.stage || actionObj.flow_stage;
           setFlowStage(nextStage);
           if (agentStateRef.current) {
              agentStateRef.current = { ...agentStateRef.current, flowStage: nextStage };
           }
        }
        else if (actionType === 'payment_method' || actionType === 'proceed_to_payment') {
           // Ask payment mode and then go to live order status
           const method = (actionObj.method || 'Cash').toLowerCase();
           const mappedMethod = method.includes('upi') || method.includes('card') ? 'UPI' : 'Cash';
           
           if (orderType.includes('takeaway') || orderType.includes('take-away')) {
              navigate('/takeaway-payment', { state: { autoConfirmMethod: mappedMethod } });
           } else {
              navigate('/order-success', { state: { autoTrack: true, tableNumber: '06' } });
           }
        }
        else if (actionType === 'navigate' || actionType === 'navigate_to_page') {
           const page = (actionObj.page || '').toLowerCase();
           if (page === 'home') {
               setTimeout(() => navigate('/home'), 800);
           }
           else if (page === 'checkout' || page === 'cart') {
               navigate(orderType.includes('takeaway') || orderType.includes('take-away') ? '/takeaway-checkout' : '/checkout');
           } else if (page === 'dine-in') navigate('/dine-in');
           else if (page === 'takeaway' || page === 'take-away') navigate('/take-away');
        }
      }
    } catch (error) {
      console.error("MCP Error:", error);
      const errText = language === 'English' ? "I'm sorry, I'm having a bit of trouble connecting to the system." : "மன்னிக்கவும், பிழை.";
      setMessages(prev => [...prev, { role: 'model', content: errText }]);
      speakText(errText);
    } finally {
      setIsLoading(false);
    }
  }
  handleSendMessageRef.current = handleSendMessage;

  const handleCategoryClick = (category) => {
    setActiveCategory(category.id)

    if (category.id !== 'all' && menuItems[category.id]) {
      setViewMode('list')
    } else {
      setViewMode('grid')
    }

    setMessages(prev => [
      ...prev,
      { role: 'model', content: `Showing ${category.name} menu` }
    ])
  }

  // Cart Functions using Context
  const handleAddToCart = (item) => {
    addToCart(item)

    // Instant local AI feedback without roundtrip
    setMessages(prev => [
      ...prev,
      { role: 'model', content: `Added ${item.name} to your order! Say 'review order' to see your summary, or keep adding more.` }
    ])
    speakText(`Added ${item.name} to your order!`)
  }

  const updateCartQty = (itemId, delta) => {
    changeQty(itemId, delta)
  }


  const handleCheckout = () => {
    const subtotal = totalAmount;
    const service = 0;
    const gst = 0;
    const finalTotal = subtotal;

    const checkoutData = {
      cartData: [...cart],
      subtotal,
      service,
      gst,
      finalTotal
    };

    setFinalInvoiceData(checkoutData);

    setShowMenu(false);
    setMessages([
      {
        role: 'model',
        type: 'checkout',
        ...checkoutData
      }
    ]);

    setCart([]); // Clear cart after freezing data to message
    speakText(t('proceedToPayment'));
  }

  const handleMobileDigit = (digit) => {
    if (mobileNumber.length >= 10) return;
    setMobileNumber(prev => prev + digit);
  }

  const handleMobileDelete = () => {
    setMobileNumber(prev => prev.slice(0, -1));
  }

  // Listeners moved to handleSendMessage hooks directly where API bypass is needed.

  return (
    <div className="app-container landing-page-container">
      <div className="background-image landing-bg"></div>
      <Header hideTableIndicator={true} showFullHeader={true} useTitleImage={true}>
         <button className="switch-manual-btn" onClick={() => navigate('/home')}>
           <i className="fa-solid fa-hand-pointer"></i> Switch to Manual
         </button>
      </Header>

      <main className="landing-page-content">
        
        <div className="landing-chat-wrapper">
          <div className="landing-center-mascot">
            <div className="waveform-bg"></div>
            <div className="mascot-wrapper">
               <img src="/assets/images/chef_avatar_bust.png" alt="Chef Mascot" className="landing-mascot-img" />
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role === 'model' ? 'bot-message' : 'user-message'}`}>
                {msg.role === 'model' ? (
                  <>
                    <div className="message-icon bot-icon"><img src={agentwaiterLogoImg} alt="bot" /></div>

                    {msg.type === 'review' ? (
                      <div className="review-card" style={{ margin: '0 10px', maxWidth: '420px', width: '100%' }}>
                        <h3 className="title">{t('reviewOrder')}</h3>

                        <div className="review-card-items-list">
                          {cart.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#666', padding: '15px 0' }}>Your cart is empty.</p>
                          ) : (
                            cart.map(item => (
                              <div key={item.id} className="item-card">
                                <div className="item-top">
                                  <div>
                                    <div className="item-name">
                                      {item.name}
                                      {item.available && <span className="badge">● Available</span>}
                                    </div>
                                    <div className="item-desc">
                                      {item.description}
                                    </div>
                                  </div>
                                  <div className="price">Rs. {item.price * item.quantity}</div>
                                </div>
                                <div className="qty-row">
                                  <button className="qty-btn minus" onClick={() => updateCartQty(item.id, -1)}>−</button>
                                  <span className="qty">{item.quantity}</span>
                                  <button className="qty-btn plus" onClick={() => updateCartQty(item.id, 1)}>+</button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <button className="add-more" onClick={() => {
                          setShowMenu(true)
                          setMessages(prev => [...prev, { role: 'model', content: t('addMore') }])
                        }}>{t('addMore')}</button>

                        {cart.length > 0 && (
                          <button className="checkout-btn" onClick={() => {
                            handleCheckout();
                          }}>{t('confirmOrder')} (Rs. {totalAmount})</button>
                        )}

                        <p className="footer-text">
                          Shall we proceed for check out? Say just yes.
                        </p>
                      </div>
                    ) : msg.type === 'checkout' ? (
                      <div className="checkout-card" id="checkoutCard" style={{ margin: '0 10px', maxWidth: '420px', width: '100%' }}>
                        <h3 className="title">Check out</h3>

                        <div id="itemsContainer">
                          {msg.cartData.map((item, i) => (
                            <div key={i} className="co-item">
                              <div className="co-item-top">
                                <div>
                                  <div className="co-item-name">{item.name}</div>
                                  <div className="co-item-desc">{item.description}</div>
                                  <div className="co-qty">Qty : {item.quantity}</div>
                                </div>
                                <div className="co-price">Rs. {(item.price * item.quantity).toFixed(2)}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="co-bill">
                          <div className="co-row"><span>{t('subtotal')}</span><span id="subtotal">Rs. {msg.subtotal.toFixed(2)}</span></div>

                          <div className="co-divider"></div>

                          <div className="co-row co-total">
                            <span>{t('total')} :</span>
                            <span id="total">Rs. {msg.finalTotal.toFixed(2)}</span>
                          </div>
                        </div>
                        <p className="co-footer">
                          {t('proceedToPayment')}
                        </p>
                      </div>
                    ) : msg.type === 'mobile_prompt' ? (
                      <div className="mobile-card" style={{ margin: '0 10px', maxWidth: '400px', width: '100%' }}>
                        <p className="title">{t('enterMobile')}</p>

                        <div className="display">
                          {mobileNumber.split("").join(" ")}
                          {mobileNumber.length === 0 ? " " : ""}
                          {Array.from({ length: 10 - mobileNumber.length }).map((_, i) => "_ ").join("").trim()}
                        </div>

                        <div className="keypad">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button key={num} onClick={() => handleMobileDigit(num)}>{num}</button>
                          ))}
                          <button onClick={() => handleMobileDigit(0)} className="zero">0</button>
                          <button onClick={handleMobileDelete} className="delete">⌫</button>
                        </div>

                        <p className="footer" style={{ fontSize: '13px', color: '#666', marginTop: '15px' }}>{t('paymentComplete')}</p>
                      </div>
                    ) : msg.type === 'qr_prompt' ? (
                      <div className="qr-card" style={{ margin: '0 10px', maxWidth: '420px', width: '100%' }}>
                        <p className="title">{t('qrPrompt')}</p>

                        <div className="qr-container">
                          <div className="corner tl"></div>
                          <div className="corner tr"></div>
                          <div className="corner bl"></div>
                          <div className="corner br"></div>

                          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=maitred@upi%26pn=MaitreD%26am=${msg.finalTotal ? msg.finalTotal.toFixed(2) : '0.00'}%26cu=INR`} alt="Payment QR Code" />
                        </div>

                        <p className="scan-text" style={{ marginTop: '15px', color: '#EAA639', fontWeight: 600 }}>{t('scanToPay')}</p>
                      </div>
                    ) : (
                      <div className="message-bubble">{msg.content}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="message-bubble">{msg.content}</div>
                    <div className="message-icon user-icon"><i className="fa-solid fa-user"></i></div>
                  </>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="message bot-message listening-message">
                <div className="message-icon bot-icon"><img src={agentwaiterLogoImg} alt="bot" /></div>
                <div className="message-content">
                  <div className="message-bubble">...</div>
                  <div className="listening-indicator">
                    <span className="dot gray"></span><span className="dot gray"></span><span className="dot gray"></span> Thinking...
                  </div>
                </div>
              </div>
            )}
            {showMenu && (
              <div className="message bot-message" ref={menuTopRef}>
                <div className="menu-categories-container">
                  {viewMode === 'grid' ? (
                    <div className="menu-container">
                      {menuCategories.map((cat) => (
                        <div
                          key={cat.id}
                          className={`menu-card ${activeCategory === cat.id ? 'active' : ''}`}
                          onClick={() => handleCategoryClick(cat)}
                        >
                          <div className="menu-img">
                            {cat.image && <img src={cat.image} alt={cat.name} />}
                          </div>
                          <div className="menu-name">{t(cat.name)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="horizontal-categories">
                        {menuCategories.map((cat) => (
                          <div
                            key={cat.id}
                            className={`cat-pill ${activeCategory === cat.id ? 'active' : ''}`}
                            onClick={() => handleCategoryClick(cat)}
                          >
                            {cat.image && <img src={cat.image} alt={cat.name} className="cat-pill-img" />}
                            <span>{cat.name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="menu-list-header">
                        <h3 className="menu-list-title">
                          {menuCategories.find(c => c.id === activeCategory)?.name}
                        </h3>
                        <button className="back-to-categories-btn" onClick={() => setViewMode('grid')}>
                          Back to Categories
                        </button>
                      </div>
                      <div className="menu-items-display">
                        {(menuItems[activeCategory] || []).map((item) => (
                          <div key={item.id} className="menu-item-card">
                            <div className="menu-item-header">
                              <span className="menu-item-name">{item.name}</span>
                              {item.available && (
                                <span className="available-badge">
                                  <span className="available-dot"></span>
                                  <span className="available-text">Available</span>
                                </span>
                              )}
                            </div>

                            <p className="menu-item-desc">
                              {item.description}
                            </p>

                            <div className="menu-item-footer">
                              <div className="menu-item-tags">
                                {item.tags.map((tag, i) => (
                                  <span key={i} className="menu-tag">{tag}</span>
                                ))}
                              </div>

                              <div className="menu-item-price-row">
                                <span className="menu-item-price">Rs. {item.price}</span>
                                {cart.find(c => c.id === item.id) ? (
                                  <div className="in-menu-qty-control">
                                    <button className="qty-btn" onClick={() => updateCartQty(item.id, -1)}>−</button>
                                    <span className="qty">{cart.find(c => c.id === item.id).quantity}</span>
                                    <button className="qty-btn" onClick={() => updateCartQty(item.id, 1)}>+</button>
                                  </div>
                                ) : (
                                  <button className="add-btn" onClick={() => handleAddToCart(item)}>
                                    +
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Mic Feedback Toast */}
          {micToast && (
            <div style={{
              position: 'absolute',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '0.9rem',
              zIndex: 100,
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              animation: 'fadeIn 0.3s ease'
            }}>
              {micToast}
            </div>
          )}

          <div className="chat-input-wrapper">
            <div className="chat-input-box">
              <span className="waveform-indicator" style={{ display: isListening ? 'inline-block' : 'none', color: '#ff4e00', marginRight: '10px' }}>
                <i className="fa-solid fa-waveform-lines" style={{ fontSize: '18px' }}></i>
              </span>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isListening ? 
                  (agentState.customerName ? "Listening for your mobile number..." : "Listening for your name...") 
                  : "Listening..."}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  padding: '15px 10px',
                  fontSize: '1.05rem',
                  color: '#333'
                }}
              />
              <button
                className={`mic-btn ${isListening ? 'pulse-anim' : ''}`}
                onClick={toggleListen}
                style={{ background: '#ec1c24', color: 'white', border: 'none', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <i className={`fa-solid ${isListening ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
              </button>
            </div>
          </div>

          <button
            className="mute-btn"
            onClick={() => setIsMuted(!isMuted)}
            style={{ color: isMuted ? '#ec1c24' : '#666' }}
          >
            <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
          </button>

          {/* Bottom Fixed Summary Bar - Only show when cart has items */}
          {cart.length > 0 && (
            <div className={`order-summary-bar ${!showMenu ? 'visible' : ''}`} onClick={() => {
              setShowMenu(false)
              setMessages(prev => [...prev, { role: 'user', content: 'Review my order' }, { role: 'model', type: 'review' }])
              speakText("Shall we proceed for checkout? Say just yes.")
            }}>
              <div className="left">
                <div className="icon">🧾</div>
                <span>{totalItems} Item{totalItems !== 1 ? 's' : ''} – Tap to Review</span>
              </div>
              <div className="right">Rs.{totalAmount}</div>
            </div>
          )}

        </div>
      </main>



    </div>
  )
}

export default Agent
