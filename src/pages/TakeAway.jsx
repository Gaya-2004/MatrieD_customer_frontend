import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import Header from '../components/Header'
import { DEFAULT_CATEGORIES, DEFAULT_MENU_ITEMS } from '../data/menuData'
import '../styles/dinein.css'
import '../styles/home.css'
import '../styles/flow_screens.css'

export default function TakeAway() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const {
    cart,
    addToCart,
    changeQty,
    removeCartItem,
    updateNote,
    clearCart,
    tableNumber
  } = useCart()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [filterOption, setFilterOption] = useState('all')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // Separated features: Voice Chatbot vs View Cart drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false)
  const [agentInputText, setAgentInputText] = useState('')
  const [isAgentTyping, setIsAgentTyping] = useState(false)
  const [showPrompts, setShowPrompts] = useState(true)
  const chatStreamRef = useRef(null)

  const INITIAL_TAKEAWAY_GREETING = {
    id: 'agent-greet-1',
    sender: 'agent',
    text: 'Hello! Welcome to Maitre D Takeaway. What would you like to take away today?'
  }

  const [chatMessages, setChatMessages] = useState([INITIAL_TAKEAWAY_GREETING])

  useEffect(() => {
    localStorage.setItem('active_order_type', 'takeaway')
  }, [])

  const scrollToChatBottom = () => {
    if (chatStreamRef.current) {
      setTimeout(() => {
        if (chatStreamRef.current) {
          chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight
        }
      }, 50)
    }
  }

  useEffect(() => {
    scrollToChatBottom()
  }, [chatMessages, isAgentTyping])

  const TAKEAWAY_PROMPTS = [
    'Show me popular takeaway dishes',
    'Add Mutton Curry to takeaway',
    'Add Chicken Biryani to takeaway',
    "What are today's specials?"
  ]

  // Filter items based on category, search, and availability
  const filteredItems = useMemo(() => {
    return DEFAULT_MENU_ITEMS.filter(item => {
      if (activeCategory !== 'all') {
        const matchesCategory =
          item.category === activeCategory ||
          (item.categoryName && item.categoryName.toLowerCase().includes(activeCategory.toLowerCase()))
        if (!matchesCategory) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesTamil = item.tamilName && item.tamilName.toLowerCase().includes(q)
        const matchesDesc = item.description && item.description.toLowerCase().includes(q)
        if (!matchesName && !matchesTamil && !matchesDesc) return false
      }

      if (filterOption === 'available' && !item.available) return false
      if (filterOption === 'veg' && !item.isVeg) return false
      if (filterOption === 'non-veg' && item.isVeg) return false

      return true
    })
  }, [activeCategory, searchQuery, filterOption])

  const getItemQty = (id) => {
    const found = cart.find(i => i.id === id)
    return found ? (Number(found.quantity) || 0) : 0
  }

  const handleIncrement = (item) => {
    if (!item.available) return
    const current = getItemQty(item.id)
    if (current === 0) {
      addToCart(item, 1)
    } else {
      changeQty(item.id, 1)
    }
  }

  const handleDecrement = (item) => {
    const current = getItemQty(item.id)
    if (current > 0) {
      changeQty(item.id, -1)
    }
  }

  // Dynamic voice chatbot responder for takeaway
  const handleSendMessage = (userText) => {
    if (!userText || !userText.trim()) return
    setShowPrompts(false)
    const cleanText = userText.trim()
    setAgentInputText('')

    // Add user message to conversation stream
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: cleanText
    }
    setChatMessages(prev => [...prev, userMsg])
    setIsAgentTyping(true)
    scrollToChatBottom()

    setTimeout(() => {
      const lower = cleanText.toLowerCase()
      let agentReply = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: ''
      }

      // Add dish command
      if (lower.includes('order') || lower.includes('add') || lower.includes('want') || lower.includes('takeaway')) {
        let matched = null
        if (lower.includes('mutton')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('mutton')) || {
            id: 4,
            name: 'Mutton Curry',
            price: 260,
            image: '/assets/images/dishes/mutton_curry.png',
            serves: '1-2'
          }
        } else if (lower.includes('biryani')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('biryani')) || {
            id: 9,
            name: 'Chicken Biryani',
            price: 210,
            image: '/assets/images/dishes/chicken_biryani.png',
            serves: '1'
          }
        } else if (lower.includes('butter chicken') || lower.includes('butter')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('butter')) || {
            id: 8,
            name: 'Butter Chicken',
            price: 240,
            image: '/assets/images/dishes/butter_chicken.png',
            serves: '1'
          }
        } else if (lower.includes('fish')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('fish')) || {
            id: 3,
            name: 'Fish Fry',
            price: 190,
            image: '/assets/images/dishes/fish_fry.png',
            serves: '1'
          }
        } else if (lower.includes('chicken 65')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('65')) || {
            id: 1,
            name: 'Chicken 65',
            price: 160,
            image: '/assets/images/dishes/chicken_65.png',
            serves: '1'
          }
        }

        if (matched) {
          addToCart(matched, 1)
          agentReply.text = `Added ${matched.name} to your takeaway order! You can check your items anytime in "View Cart", or let me know what else you'd like!`
        } else {
          agentReply.text = "I've noted that! Which delicious dish would you like me to add to your takeaway package?"
        }
      } else if (lower.includes('special') || lower.includes('popular') || lower.includes('recommend')) {
        agentReply.text = "Our top takeaway specials today are fragrant Chicken Biryani, rich Mutton Curry, and crispy Fish Fry. Which would you prefer to try?"
      } else if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
        agentReply.text = "Hello! I am your Maitre D voice assistant for takeaway. Tell me what you crave, or tap any suggestion to get started!"
      } else {
        agentReply.text = `Understood! I'm here to assist with your takeaway order. Would you like to order popular dishes like Biryani or Mutton Curry?`
      }

      setChatMessages(prev => [...prev, agentReply])
      setIsAgentTyping(false)
      scrollToChatBottom()
    }, 700)
  }

  const handlePromptClick = (promptText) => {
    setShowPrompts(false)
    handleSendMessage(promptText)
  }

  const handleSendInput = (e) => {
    e.preventDefault()
    if (!agentInputText || !agentInputText.trim()) return
    setShowPrompts(false)
    handleSendMessage(agentInputText)
  }

  return (
    <div className="menu-page-container">
      {/* Top Header Navigation matching the Wireframe */}
      <Header
        tableNumber="Take Away"
        menuWireframeHeader={true}
        showDateTime={true}
        showServiceBell={false}
      />

      {/* Main 2-Column Content */}
      <main className={`menu-main-layout ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
        {/* Left Column: Menu Items */}
        <section className="menu-left-column">
          {/* Top Card: Search, Filter, New Order & Category Pills */}
          <div className="menu-top-card">
            <div className="menu-search-row">
              {/* Search Bar */}
              <div className="menu-search-bar">
                <input
                  type="text"
                  className="menu-search-input"
                  placeholder={t('searchPlaceholder') || 'Search for food......'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <i className="fa-solid fa-magnifying-glass menu-search-icon" />
              </div>

              {/* Filter Button */}
              <div style={{ position: 'relative' }}>
                <button
                  className="menu-filter-btn"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  title="Filter options"
                  type="button"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                  </svg>
                </button>

                {showFilterDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '10px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                      zIndex: 100,
                      minWidth: '160px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <button
                      style={{
                        padding: '8px 12px',
                        border: 'none',
                        background: filterOption === 'all' ? '#EAA639' : '#f4f4f5',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onClick={() => { setFilterOption('all'); setShowFilterDropdown(false); }}
                    >
                      All Items
                    </button>
                    <button
                      style={{
                        padding: '8px 12px',
                        border: 'none',
                        background: filterOption === 'available' ? '#EAA639' : '#f4f4f5',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onClick={() => { setFilterOption('available'); setShowFilterDropdown(false); }}
                    >
                      Available Only
                    </button>
                  </div>
                )}
              </div>

              {/* New Order Button */}
              <button
                className="menu-new-order-btn"
                onClick={() => {
                  clearCart()
                  setSearchQuery('')
                  setActiveCategory('all')
                }}
                type="button"
              >
                <span>New Order</span>
                <span style={{ fontSize: '1.2rem', lineHeight: '0.8', marginLeft: '2px' }}>+</span>
              </button>
            </div>

            {/* Category Pills Row */}
            <div className="menu-categories-scroll">
              {DEFAULT_CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    className={`menu-category-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                    type="button"
                  >
                    {cat.iconType === 'pot' ? (
                      <div className="menu-cat-icon">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 13h14v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5z" />
                          <line x1="3.5" y1="13" x2="20.5" y2="13" />
                          <line x1="5" y1="9.5" x2="19" y2="7.5" />
                          <path d="M10 8.5a2.2 2.2 0 0 1 3.8-.5" />
                        </svg>
                      </div>
                    ) : (
                      <img src={cat.image} alt={cat.name} className="menu-cat-thumb" />
                    )}
                    <span className="menu-cat-name">{cat.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bottom Card: Dishes Grid */}
          <div className="menu-dishes-card">
            <div className="menu-dishes-grid">
              {filteredItems.map(item => {
                const qty = getItemQty(item.id)
                return (
                  <div key={item.id} className="dish-card">
                    <div className="dish-image-wrap">
                      <img src={item.image} alt={item.name} className="dish-img" />
                    </div>

                    <div className="dish-card-body">
                      <div className="dish-header-row">
                        <h3 className="dish-title">{item.name}</h3>
                        <span className={`dish-badge ${item.available ? 'available' : 'unavailable'}`}>
                          {item.available ? 'Available' : 'Not Available'}
                        </span>
                      </div>

                      <p className="dish-desc">{item.description}</p>

                      <div className="dish-price">Rs. {item.price}</div>
                    </div>

                    <div className="dish-footer-row">
                      <div className="dish-stepper">
                        <button
                          className="dish-stepper-btn minus"
                          onClick={() => handleDecrement(item)}
                          disabled={qty === 0}
                          type="button"
                        >
                          −
                        </button>
                        <span className="dish-stepper-val">{qty}</span>
                        <button
                          className="dish-stepper-btn plus"
                          onClick={() => handleIncrement(item)}
                          disabled={!item.available}
                          type="button"
                        >
                          +
                        </button>
                      </div>

                      <span className={`dish-diet-tag ${item.isVeg ? 'veg' : 'non-veg'}`}>
                        {item.isVeg ? 'VEG' : 'NON-VEG'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="menu-scroll-indicator">
              <div className="menu-scroll-thumb" />
            </div>

            {/* Separate Feature 1: Floating View Cart Button at bottom right */}
            {cart.length > 0 && !isCartDrawerOpen && (
              <button
                className="floating-view-cart-btn"
                onClick={() => {
                  setIsCartDrawerOpen(true)
                  setIsSidebarOpen(false)
                }}
                type="button"
                title="View Cart"
              >
                <i className="fa-solid fa-cart-shopping" />
                <span>View Cart</span>
                <span className="floating-cart-count-badge">
                  {cart.reduce((s, it) => s + (Number(it.quantity) || 1), 0)}
                </span>
              </button>
            )}

            {/* Separate Feature 2: Dedicated View Cart Drawer */}
            {isCartDrawerOpen && (
              <>
                <div
                  className="manual-cart-backdrop"
                  onClick={() => setIsCartDrawerOpen(false)}
                  title="Close Cart"
                />
                <aside className="manual-cart-drawer">
                  <div>
                    <div className="manual-cart-drawer-header">
                      <span className="manual-cart-drawer-title">Cart</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="manual-cart-drawer-table">Take Away 🛍️</span>
                        <button
                          className="manual-cart-drawer-close"
                          onClick={() => setIsCartDrawerOpen(false)}
                          title="Close Cart"
                          type="button"
                          aria-label="Close Cart"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="manual-cart-order-id-label"># Order ID : 3001</div>

                    {/* Mode Tabs */}
                    <div className="manual-cart-type-tabs">
                      <button
                        className="manual-cart-type-tab"
                        onClick={() => navigate('/dine-in')}
                        type="button"
                      >
                        <span>Dine In</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 3v5a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
                          <path d="M8 3v5" />
                          <path d="M8 10v11" />
                          <path d="M16 3v9a2 2 0 0 1-2-2V3" />
                          <path d="M16 12v9" />
                        </svg>
                      </button>
                      <button className="manual-cart-type-tab active" type="button">
                        <span>Take Away</span>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="6" width="16" height="15" rx="3" />
                          <path d="M4 8l3-4h10l3 4" />
                          <path d="M9 11a3 3 0 0 0 6 0" />
                        </svg>
                      </button>
                    </div>

                    {/* Items List */}
                    <div className="manual-cart-items-list">
                      {cart.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af', fontSize: '0.9rem' }}>
                          Your takeaway cart is empty. Add delicious items from the menu!
                        </div>
                      ) : (
                        cart.map(item => {
                          const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1)
                          return (
                            <div key={item.id} className="manual-cart-card">
                              <div className="manual-cart-card-top">
                                <img
                                  src={item.image || '/assets/images/dishes/chicken_biryani.png'}
                                  alt={item.name}
                                  className="manual-cart-thumb"
                                />
                                <div className="manual-cart-info">
                                  <div className="manual-cart-name">{item.name}</div>
                                  <div className="manual-cart-serves">Serves : {item.serves || '1-2'}</div>
                                  <div className="manual-cart-unit-price">Rs. {item.price}</div>
                                </div>
                                <div className="manual-cart-total-col">
                                  <div className="manual-cart-total-label">Total</div>
                                  <div className="manual-cart-total-val">{itemTotal.toFixed(2)}</div>
                                  <div className="manual-cart-gst-tag">+ GST</div>
                                </div>
                              </div>

                              <div className="manual-cart-card-actions">
                                <button
                                  className="manual-cart-remove-link"
                                  onClick={() => removeCartItem(item.id)}
                                  type="button"
                                >
                                  Remove item ×
                                </button>
                                <div className="dish-stepper">
                                  <button
                                    className="dish-stepper-btn minus"
                                    onClick={() => changeQty(item.id, -1)}
                                    type="button"
                                  >
                                    −
                                  </button>
                                  <span className="dish-stepper-val">{item.quantity}</span>
                                  <button
                                    className="dish-stepper-btn plus"
                                    onClick={() => changeQty(item.id, 1)}
                                    type="button"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div className="manual-cart-note-box">
                                <input
                                  type="text"
                                  placeholder="Special instructions..."
                                  value={item.note || ''}
                                  onChange={(e) => updateNote(item.id, e.target.value)}
                                  style={{
                                    width: '100%',
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    fontFamily: 'inherit',
                                    fontSize: '0.82rem',
                                    color: '#52525b'
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <button
                      className="manual-cart-place-btn"
                      onClick={() => {
                        if (cart.length === 0) {
                          alert('Please add at least one dish to your takeaway order.')
                          return
                        }
                        navigate('/takeaway-checkout')
                      }}
                      type="button"
                    >
                      Place Order
                    </button>
                  </div>
                </aside>
              </>
            )}
          </div>
        </section>

        {/* Right Column: Dedicated Voice Chatbot (Feature 3) */}
        {isSidebarOpen ? (
          <aside className="menu-right-sidebar voice-panel-mode">
            <div className="voice-agent-container">
              {/* Top Pane: Header and Chef Avatar */}
              <div className="voice-agent-top-pane">
                <div className="voice-agent-header-row">
                  <span className="voice-agent-header-title">Talk to your Maitre D</span>
                  <button
                    className="voice-agent-close-btn"
                    onClick={() => setIsSidebarOpen(false)}
                    title="Close Voice Assistant"
                    type="button"
                    aria-label="Close Voice Assistant"
                  >
                    ✕
                  </button>
                </div>

                {/* Compact Chef Avatar with Waveform */}
                <div className="voice-agent-visual-center compact">
                  <div className="voice-agent-waveform-bars">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <div
                        key={i}
                        className="voice-wave-bar"
                        style={{
                          animationDelay: `${(i % 5) * 0.2}s`,
                          height: `${8 + (Math.sin(i * 1.5) + 1) * 10}px`
                        }}
                      />
                    ))}
                  </div>
                  <img
                    src="/assets/images/chef_avatar_bust.png"
                    alt="AI Voice Agent"
                    className="voice-agent-chef-img"
                  />
                  <div className="voice-agent-mic-badge" title="Maitre D Listening">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                    </svg>
                  </div>
                </div>

                {/* Suggestion Prompts - Hidden after user clicks or starts chatting */}
                {showPrompts && (
                  <div className="voice-prompt-list">
                    {TAKEAWAY_PROMPTS.map((promptText, idx) => (
                      <button
                        key={idx}
                        className="voice-prompt-pill"
                        onClick={() => handlePromptClick(promptText)}
                        type="button"
                      >
                        <div className="prompt-pill-icon">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                            <circle cx="9.5" cy="7.5" r="3.5" fill="#EAA639" />
                            <path d="M3.5 18c0-3 2.7-5 6-5s6 2 6 5" fill="#EAA639" />
                            <path d="M17.5 9a3.5 3.5 0 0 1 0 5" stroke="#EAA639" strokeWidth="2.2" strokeLinecap="round" />
                            <path d="M20.5 7a6.5 6.5 0 0 1 0 9" stroke="#EAA639" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        </div>
                        <span className="prompt-pill-text">{promptText}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Middle Pane: Dynamic Conversation Stream (Auto-scrolls & Communicates) */}
              <div className="voice-chat-stream" ref={chatStreamRef}>
                {chatMessages.map((msg) => {
                  if (msg.sender === 'agent') {
                    return (
                      <div key={msg.id} className="chat-row-agent">
                        <img
                          src="/assets/images/chef_avatar_head.png"
                          alt="Chef"
                          className="chat-avatar-chef"
                        />
                        <div className="chat-agent-bubble-wrap">
                          {msg.text && (
                            <div className="chat-bubble-agent-text">
                              {msg.text}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  // User Message
                  return (
                    <div key={msg.id} className="chat-row-user">
                      <div className="chat-bubble-user-text">
                        {msg.text}
                      </div>
                      <div className="chat-avatar-user-badge">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                    </div>
                  )
                })}

                {/* Typing Indicator */}
                {isAgentTyping && (
                  <div className="chat-row-agent">
                    <img
                      src="/assets/images/chef_avatar_head.png"
                      alt="Chef"
                      className="chat-avatar-chef"
                    />
                    <div className="chat-bubble-agent-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Pane: Input Pill + View Cart Switcher */}
              <div className="voice-agent-bottom-pane">
                <form className="voice-bottom-input-wrap" onSubmit={handleSendInput}>
                  <input
                    type="text"
                    className="voice-bottom-input"
                    placeholder="Tap To Speak Or Type Here...."
                    value={agentInputText}
                    onChange={(e) => {
                      setAgentInputText(e.target.value)
                      scrollToChatBottom()
                    }}
                    onFocus={scrollToChatBottom}
                  />
                  <button className="voice-mic-submit-btn" type="submit" title="Send or Speak">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#EAA639" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <path d="M19 3v2" stroke="#EAA639" strokeWidth="1.8" />
                      <path d="M18 4h2" stroke="#EAA639" strokeWidth="1.8" />
                    </svg>
                  </button>
                </form>

                {!showPrompts && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 0 0' }}>
                    <button
                      type="button"
                      onClick={() => setShowPrompts(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#b47820',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Show suggestion prompts"
                    >
                      <span>💡 Suggestions</span>
                    </button>
                  </div>
                )}

                <div className="sidebar-panel-mode-switch">
                  <button
                    className="sidebar-switch-link"
                    onClick={() => {
                      setIsCartDrawerOpen(true)
                      setIsSidebarOpen(false)
                    }}
                    type="button"
                  >
                    View Cart & Place Order ({cart.length}) ➔
                  </button>
                </div>
              </div>
            </div>
          </aside>
        ) : !isCartDrawerOpen ? (
          /* Separate Feature 4: Chatbot Icon at right side top (like in Dine-In) */
          <div className="menu-sidebar-toggle-wrap">
            <button
              className="menu-sidebar-open-pill"
              onClick={() => {
                setIsSidebarOpen(true)
                setIsCartDrawerOpen(false)
              }}
              title="Open Voice Chatbot"
              type="button"
            >
              <span className="open-pill-chevron">«</span>
              <img src="/assets/images/chef_avatar_head.png" alt="Chef Agent" className="open-pill-avatar" />
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
}
