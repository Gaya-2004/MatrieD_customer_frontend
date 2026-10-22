import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import Header from '../components/Header'
import { DEFAULT_CATEGORIES, DEFAULT_MENU_ITEMS, FLOW5_MENU_ITEMS } from '../data/menuData'
import '../styles/dinein.css'
import '../styles/home.css'

export default function DineIn() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const { t, language } = useLanguage()
  const {
    cart,
    addToCart,
    changeQty,
    removeCartItem,
    updateNote,
    clearCart,
    tableNumber,
    setTableNumber
  } = useCart()

  // Parse initial flow: 1=Home, 2=Full Menu, 3=Prompt Bubble, 4=Voice Agent, 5=Conversation
  const initialFlow = (() => {
    const p = searchParams.get('flow')
    if (p) return parseInt(p, 10)
    if (location.state?.flow) return location.state.flow
    if (location.state?.openVoiceAgent) return 4
    return 2
  })()

  const [flow, setFlowState] = useState(initialFlow)
  const [showGreetingBubble, setShowGreetingBubble] = useState(initialFlow === 3)
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialFlow === 4 || initialFlow === 5)
  const [sidebarMode, setSidebarMode] = useState(
    initialFlow === 5 ? 'voice_conversation' : (initialFlow === 4 ? 'voice_prompt' : 'cart')
  )
  const [agentInputText, setAgentInputText] = useState('')
  const menuContainerRef = useRef(null)

  // Dynamic voice chat messages starting with greeting
  const INITIAL_AGENT_GREETING = {
    id: 'agent-greet-1',
    sender: 'agent',
    text: 'Hello, what would you like to eat today?'
  }

  const [chatMessages, setChatMessages] = useState([INITIAL_AGENT_GREETING])
  const [isAgentTyping, setIsAgentTyping] = useState(false)
  const chatStreamRef = useRef(null)

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

  // Switch flow handler
  const setFlow = (newFlow) => {
    setFlowState(newFlow)
    setSearchParams({ flow: newFlow })
    setManualDrawerOpen(false)
    if (newFlow === 1) {
      navigate('/')
      return
    }
    if (newFlow === 2) {
      setIsSidebarOpen(false)
      setShowGreetingBubble(false)
    } else if (newFlow === 3) {
      setIsSidebarOpen(false)
      setShowGreetingBubble(true)
    } else if (newFlow === 4) {
      setIsSidebarOpen(true)
      setShowGreetingBubble(false)
      setSidebarMode('voice_prompt')
    } else if (newFlow === 5) {
      setIsSidebarOpen(true)
      setShowGreetingBubble(false)
      setSidebarMode('voice_conversation')
    }
  }

  // Speech bubble greeting is active when on Flow 3
  useEffect(() => {
    if (flow === 3) {
      setShowGreetingBubble(true)
    } else {
      setShowGreetingBubble(false)
    }
  }, [flow])

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [filterOption, setFilterOption] = useState('all') // 'all', 'available', 'veg', 'non-veg'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // Parse initial flow: 1=Home, 2=Full Menu, 3=Prompt Bubble, 4=Voice Agent, 5=Conversation, 6=Manual Empty, 7=Manual Badge, 8=Manual Overlay
  const [manualDrawerOpen, setManualDrawerOpen] = useState(initialFlow === 8)

  // Pre-seed sample cart item based on flow
  useEffect(() => {
    if (flow === 6) {
      clearCart()
      setIsSidebarOpen(false)
      setManualDrawerOpen(false)
    } else if (flow === 7) {
      clearCart()
      setIsSidebarOpen(false)
      setManualDrawerOpen(false)
      const chicken65 = DEFAULT_MENU_ITEMS.find(i => i.name === 'Chicken 65')
      if (chicken65) addToCart(chicken65, 1)
    } else if (flow === 8) {
      clearCart()
      setIsSidebarOpen(false)
      setManualDrawerOpen(true)
      const dosa = {
        id: 101,
        name: 'Onion Rava Dosa',
        tamilName: 'வெங்காய ரவா தோசை',
        category: 'dosa',
        price: 100,
        description: 'Crispy semolina dosa with fine chopped onions, green chillies & spice blend.',
        image: '/assets/images/dishes/onion_rava_dosa.png',
        serves: '1',
        note: 'Please, Just a little bit spicy only....'
      }
      const butterChicken = DEFAULT_MENU_ITEMS.find(i => i.name === 'Butter Chicken') || {
        id: 8,
        name: 'Butter Chicken',
        price: 240,
        serves: '1',
        description: 'Tender chicken in rich butter tomato gravy served with basmati rice.',
        image: '/assets/images/dishes/butter_chicken.png',
        note: 'Please, Just a little bit spicy only....'
      }
      addToCart(dosa, 1)
      addToCart(butterChicken, 1)
    } else if (cart.length === 0) {
      const sampleItem = DEFAULT_MENU_ITEMS.find(i => i.name === 'Chicken Biryani')
      if (sampleItem) {
        addToCart(sampleItem, 1)
        setTimeout(() => {
          updateNote(sampleItem.id, 'Please, Just a little bit spicy only....')
        }, 100)
      }
    }
  }, [flow])

  // In Flow 4: exactly 8 dishes matching Flow 4 screenshot (4x2)
  // In Flow 5: Onion Rava Dosa + Chicken selections matching Flow 5 screenshot
  // In Flow 2 & 3: full 10 dishes (5x2)
  const activeDataset = useMemo(() => {
    if (flow === 5) {
      return FLOW5_MENU_ITEMS
    }
    if (flow === 4) {
      // Flow 4 displays the 8 dishes: Chicken 65, Tandoori Chicken, Fish Fry, Mutton Curry, Egg Curry, Tikka, Butter, Biryani
      return DEFAULT_MENU_ITEMS.filter(i => i.name !== 'Prawn Fry' && i.name !== 'Chicken Korma')
    }
    return DEFAULT_MENU_ITEMS
  }, [flow])

  // Filter items based on category, search, and availability
  const filteredItems = useMemo(() => {
    return activeDataset.filter(item => {
      // Category filter
      if (activeCategory !== 'all') {
        const matchesCategory =
          item.category === activeCategory ||
          (item.categoryName && item.categoryName.toLowerCase().includes(activeCategory.toLowerCase()))
        if (!matchesCategory) return false
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesTamil = item.tamilName && item.tamilName.toLowerCase().includes(q)
        const matchesDesc = item.description && item.description.toLowerCase().includes(q)
        if (!matchesName && !matchesTamil && !matchesDesc) return false
      }

      // Availability filter
      if (filterOption === 'available' && !item.available) return false
      if (filterOption === 'veg' && !item.isVeg) return false
      if (filterOption === 'non-veg' && item.isVeg) return false

      return true
    })
  }, [activeDataset, activeCategory, searchQuery, filterOption])

  // Get current cart quantity for an item
  const getItemQty = (id) => {
    const found = cart.find(i => i.id === id)
    return found ? (Number(found.quantity) || 0) : 0
  }

  // Handle Stepper increment/decrement
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

  // Flow 4 Suggestion prompts
  const PROMPTS = [
    'Show me popular items',
    'Add 2 Masala Dosa to my cart',
    "What are today's specials?",
    'Talk to waiter'
  ]

  // Dynamic chat responder based on user input
  const handleSendMessage = (userText) => {
    if (!userText || !userText.trim()) return
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

      // 1. Specific Order / Add commands
      if (lower.includes('order') || lower.includes('add') || lower.includes('want') || lower.includes('please order')) {
        let matched = null
        if (lower.includes('biryani')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('biryani')) || {
            id: 9,
            name: 'Chicken Biryani',
            price: 210,
            image: '/assets/images/dishes/chicken_biryani.png'
          }
        } else if (lower.includes('butter chicken') || lower.includes('butter')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('butter')) || {
            id: 8,
            name: 'Butter Chicken',
            price: 240,
            image: '/assets/images/dishes/butter_chicken.png'
          }
        } else if (lower.includes('tikka')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('tikka')) || {
            id: 7,
            name: 'Chicken Tikka Masala',
            price: 220,
            image: '/assets/images/dishes/chicken_tikka_masala.png'
          }
        } else if (lower.includes('dosa') || lower.includes('rava')) {
          matched = FLOW5_MENU_ITEMS.find(i => i.name.toLowerCase().includes('dosa')) || {
            id: 101,
            name: 'Onion Rava Dosa',
            price: 100,
            image: '/assets/images/dishes/onion_rava_dosa.png'
          }
        } else if (lower.includes('coffee') || lower.includes('filter')) {
          matched = FLOW5_MENU_ITEMS.find(i => i.name.toLowerCase().includes('coffee')) || {
            id: 102,
            name: 'Special Filter Coffee',
            price: 45,
            image: '/assets/images/dishes/filter_coffee.png'
          }
        } else if (lower.includes('chicken 65')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('chicken 65')) || {
            id: 1,
            name: 'Chicken 65',
            price: 180,
            image: '/assets/images/dishes/chicken_65.png'
          }
        } else if (lower.includes('chicken')) {
          matched = DEFAULT_MENU_ITEMS.find(i => i.name.toLowerCase().includes('biryani')) || {
            id: 9,
            name: 'Chicken Biryani',
            price: 210,
            image: '/assets/images/dishes/chicken_biryani.png'
          }
        }

        if (matched) {
          addToCart(matched, 1)
          agentReply.text = `I have added 1x ${matched.name} (Rs. ${matched.price}) to your cart! Would you like anything else or a drink with it?`
        } else {
          agentReply.text = "I'd be glad to add that for you! Could you please specify which dish from the menu you would like?"
        }
      }
      // 2. Chicken / Non-veg inquiry
      else if (lower.includes('chicken') || lower.includes('non-veg') || lower.includes('non veg') || lower.includes('meat')) {
        setFilterOption('non-veg')
        agentReply.text = 'Here are our popular Non-Veg Favourites! You can choose a category below or explore the dishes on the left.'
        agentReply.richCard = {
          title: 'Non-Veg Favourites :',
          categories: [
            { name: 'Breakfast', img: '/assets/images/dishes/cat_breakfast.png' },
            { name: 'Lunch', img: '/assets/images/dishes/cat_lunch.png' },
            { name: 'Dinner', img: '/assets/images/dishes/cat_dinner.png' }
          ]
        }
      }
      // 3. Veg inquiry
      else if (lower.includes('veg') || lower.includes('vegetarian') || lower.includes('dosa')) {
        setFilterOption('veg')
        agentReply.text = "We have wonderful vegetarian dishes! Crispy Onion Rava Dosa, Masala Dosa, and fresh Filter Coffee. I've highlighted them for you on the left."
      }
      // 4. Specials / Popular
      else if (lower.includes('special') || lower.includes('popular') || lower.includes('recommend') || lower.includes('best')) {
        agentReply.text = "Today's chef specials are our aromatic Chicken Biryani, Butter Chicken with Naan, and South Indian Filter Coffee. Would you like me to order one for you?"
      }
      // 5. Waiter / Service
      else if (lower.includes('waiter') || lower.includes('service') || lower.includes('call') || lower.includes('manager')) {
        agentReply.text = 'I have alerted your server for Table 06. A staff member will be at your table shortly!'
      }
      // 6. Greetings
      else if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
        agentReply.text = "Hello! What can I get for you today? Ask me for recommendations or let me know what you'd like to order."
      }
      // 7. Cart / Checkout
      else if (lower.includes('cart') || lower.includes('bill') || lower.includes('checkout') || lower.includes('total')) {
        agentReply.text = `You currently have items in your cart. You can tap "View Cart & Place Order" below to review and confirm!`
      }
      // 8. Fallback
      else {
        agentReply.text = "I'm your Maitre D assistant! Feel free to ask me to show chicken or vegetarian dishes, recommend specials, or say 'Please order one Chicken Biryani'."
      }

      setIsAgentTyping(false)
      setChatMessages(prev => [...prev, agentReply])
      scrollToChatBottom()
    }, 450)
  }

  const handlePromptClick = (promptText) => {
    setFlow(5)
    setTimeout(() => {
      handleSendMessage(promptText)
    }, 150)
  }

  const handleSendInput = (e) => {
    e?.preventDefault()
    if (!agentInputText.trim()) return
    const text = agentInputText
    if (flow !== 5) {
      setFlow(5)
    }
    handleSendMessage(text)
  }

  const scrollToLeftMenu = () => {
    if (menuContainerRef.current) {
      menuContainerRef.current.scrollIntoView({ behavior: 'smooth' })
      menuContainerRef.current.classList.add('highlight-flash')
      setTimeout(() => {
        menuContainerRef.current?.classList.remove('highlight-flash')
      }, 1000)
    }
  }

  // Get wireframe title header
  const getWireframeTitle = () => {
    if (flow === 2 || flow === 3) return 'Maitre D · Home full menu'
    if (flow === 4) return 'Maitre D · Home voice agent'
    if (flow === 5) return 'Maitre D · Home agent conversation'
    if (flow === 6) return 'Maitre D · Manual menu empty cart'
    if (flow === 7) return 'Maitre D · Manual menu cart badge'
    if (flow === 8) return 'Maitre D · Manual cart overlay'
    return 'Maitre D · Home'
  }

  return (
    <div className="menu-page-container">
      {/* Top Header Navigation matching the Wireframe */}
      <Header
        tableNumber={tableNumber || '06'}
        menuWireframeHeader={true}
        showDateTime={true}
        showServiceBell={false}
        onTableClick={() => {
          const next = prompt('Enter Table Number:', tableNumber || '06')
          if (next) setTableNumber(next)
        }}
      />

      {/* Main 2-Column Content */}
      <main className={`menu-main-layout ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
        {/* Left Column: Menu Items */}
        <section className="menu-left-column" ref={menuContainerRef}>
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
                    {/* Dish Photo */}
                    <div className="dish-image-wrap">
                      <img src={item.image} alt={item.name} className="dish-img" />
                    </div>

                    {/* Dish Body */}
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

                    {/* Dish Footer Controls */}
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

            {/* Scroll Indicator Bar at Bottom */}
            <div className="menu-scroll-indicator">
              <div className="menu-scroll-thumb" />
            </div>

            {/* Floating View Cart Pill (Screens 7 & 8) */}
            {cart.length > 0 && !isSidebarOpen && !manualDrawerOpen && (
              <button
                className="floating-view-cart-btn"
                onClick={() => setManualDrawerOpen(true)}
                type="button"
              >
                <i className="fa-solid fa-cart-shopping" />
                <span>View Cart</span>
                <span className="floating-cart-count-badge">
                  {cart.reduce((s, it) => s + (Number(it.quantity) || 1), 0)}
                </span>
              </button>
            )}

            {/* Screen 8: Slide-in Cart Overlay / Drawer */}
            {manualDrawerOpen && (
              <>
                <div
                  className="manual-cart-backdrop"
                  onClick={() => setManualDrawerOpen(false)}
                  title="Close Cart"
                />
                <aside className="manual-cart-drawer">
                  <div>
                    <div className="manual-cart-drawer-header">
                      <span className="manual-cart-drawer-title">Cart</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="manual-cart-drawer-table">Table No : {tableNumber || '06'} ⌄</span>
                        <button
                          className="manual-cart-drawer-close"
                          onClick={() => setManualDrawerOpen(false)}
                          title="Close Cart"
                          type="button"
                          aria-label="Close Cart"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                  <div className="manual-cart-order-id-label"># Order ID : 2002</div>

                  {/* Dine In vs Take Away Mode Tabs */}
                  <div className="manual-cart-type-tabs">
                    <button className="manual-cart-type-tab active" type="button">
                      <span>Dine In</span>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3v5a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
                        <path d="M8 3v5" />
                        <path d="M8 10v11" />
                        <path d="M16 3v9a2 2 0 0 1-2-2V3" />
                        <path d="M16 12v9" />
                      </svg>
                    </button>
                    <button className="manual-cart-type-tab" type="button">
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
                    {cart.map(item => {
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
                              <div className="manual-cart-serves">Serves : {item.serves || '1'}</div>
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
                            {item.note || 'Please, Just a little bit spicy only....'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <button
                    className="manual-cart-place-btn"
                    onClick={() => navigate('/checkout', { state: { manualFlow: true } })}
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

        {/* Right Column: Voice Agent Sidebar (Flow 4 & 5) or My Orders Cart */}
        {isSidebarOpen ? (
          <aside className={`menu-right-sidebar ${sidebarMode !== 'cart' ? 'voice-panel-mode' : ''}`}>
            {/* FLOW 4: Voice Agent Prompts */}
            {sidebarMode === 'voice_prompt' && (
              <div className="voice-agent-container">
                <div className="voice-agent-top-pane">
                  <div className="voice-agent-header-row">
                    <span className="voice-agent-header-title">Talk to your agent</span>
                    <button
                      className="voice-agent-close-btn"
                      onClick={() => {
                        setIsSidebarOpen(false)
                        setFlow(2)
                      }}
                      title="Close Voice Assistant"
                      type="button"
                      aria-label="Close Voice Assistant"
                    >
                      ✕
                    </button>
                  </div>

                  {/* 3D Chef Avatar with Waveform Graphic & Audio Badge */}
                  <div className="voice-agent-visual-center">
                    <div className="voice-agent-waveform-bars">
                      {Array.from({ length: 32 }).map((_, i) => (
                        <div
                          key={i}
                          className="voice-wave-bar"
                          style={{
                            animationDelay: `${(i % 6) * 0.18}s`,
                            height: `${10 + (Math.sin(i) + 1) * 14}px`
                          }}
                        />
                      ))}
                    </div>
                    <img
                      src="/assets/images/chef_avatar_bust.png"
                      alt="AI Voice Agent"
                      className="voice-agent-chef-img"
                    />
                    <div className="voice-agent-mic-badge" onClick={() => setFlow(5)} title="Tap to talk">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <circle cx="9.5" cy="7.5" r="3.5" fill="#ffffff" />
                        <path d="M3.5 18c0-3 2.7-5 6-5s6 2 6 5" fill="#ffffff" />
                        <path d="M17.5 9a3.5 3.5 0 0 1 0 5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                        <path d="M20.5 7a6.5 6.5 0 0 1 0 9" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>

                  {/* 4 Suggestion Prompt Pills */}
                  <div className="voice-prompt-list">
                    {PROMPTS.map((promptText, idx) => (
                      <button
                        key={idx}
                        className="voice-prompt-pill"
                        onClick={() => handlePromptClick(promptText)}
                        type="button"
                      >
                        <div className="prompt-pill-icon">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
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
                </div>

                {/* Bottom Input Pill */}
                <div className="voice-agent-bottom-pane">
                  <form className="voice-bottom-input-wrap" onSubmit={handleSendInput}>
                    <input
                      type="text"
                      className="voice-bottom-input"
                      placeholder="Tap To Speak Or Just Hey...."
                      value={agentInputText}
                      onChange={(e) => setAgentInputText(e.target.value)}
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

                  <div className="sidebar-panel-mode-switch">
                    <button
                      className="sidebar-switch-link"
                      onClick={() => setSidebarMode('cart')}
                      type="button"
                    >
                      View Cart & Place Order ({cart.length}) ➔
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* FLOW 5: Agent Conversation Stream */}
            {sidebarMode === 'voice_conversation' && (
              <div className="voice-agent-container">
                {/* Top Pane: Header and Chef Avatar (Pinned) */}
                <div className="voice-agent-top-pane">
                  <div className="voice-agent-header-row">
                    <span className="voice-agent-header-title">Talk to your Maitre D</span>
                    <button
                      className="voice-agent-close-btn"
                      onClick={() => {
                        setIsSidebarOpen(false)
                        setFlow(2)
                      }}
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
                </div>

                {/* Middle Pane: Dynamic Conversation Stream (Auto-scrolls & Fully Visible) */}
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
                            {msg.richCard && (
                              <div className="chat-agent-rich-card" style={{ marginTop: msg.text ? '6px' : '0' }}>
                                <div className="chat-rich-card-title">{msg.richCard.title}</div>
                                <div className="chat-category-chips-row">
                                  {(msg.richCard.categories || []).map((cat, ci) => (
                                    <div key={ci} className="chat-mini-chip-btn" onClick={scrollToLeftMenu}>
                                      <img src={cat.img} alt={cat.name} className="chat-mini-chip-img" />
                                      <span className="chat-mini-chip-name">{cat.name}</span>
                                    </div>
                                  ))}
                                </div>
                                <span className="chat-see-menu-link" onClick={scrollToLeftMenu}>
                                  ← See menu list in the left column
                                </span>
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

                {/* Bottom Pane: Input Pill + Order Button (Pinned) */}
                <div className="voice-agent-bottom-pane">
                  <form className="voice-bottom-input-wrap" onSubmit={handleSendInput}>
                    <input
                      type="text"
                      className="voice-bottom-input"
                      placeholder="Tap To Speak Or Just Hey...."
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

                  <div className="sidebar-panel-mode-switch">
                    <button
                      className="sidebar-switch-link"
                      onClick={() => setSidebarMode('cart')}
                      type="button"
                    >
                      View Cart & Place Order ({cart.length}) ➔
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MY ORDERS / CART VIEW (Traditional Order View) */}
            {sidebarMode === 'cart' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <div>
                  {/* Top Card: Talk to your agent mini banner */}
                  <div className="sidebar-agent-card">
                    <div className="sidebar-agent-header">
                      <span className="sidebar-agent-title">Talk to your agent</span>
                      <button
                        className="sidebar-close-btn"
                        onClick={() => setIsSidebarOpen(false)}
                        title="Close sidebar"
                        type="button"
                      >
                        ✕
                      </button>
                    </div>

                    <div
                      className="sidebar-agent-visual"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSidebarMode('voice_prompt')}
                      title="Open full Voice Assistant"
                    >
                      <div className="sidebar-waveform-bg">
                        {Array.from({ length: 28 }).map((_, i) => (
                          <div
                            key={i}
                            className="sidebar-wave-bar"
                            style={{
                              animationDelay: `${(i % 5) * 0.2}s`,
                              height: `${8 + (i % 6) * 5}px`
                            }}
                          />
                        ))}
                      </div>
                      <img
                        src="/assets/images/chef_avatar_bust.png"
                        alt="AI Voice Agent"
                        className="sidebar-chef-img"
                      />
                      <div className="sidebar-mic-badge">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* My Orders Section */}
                  <div className="sidebar-orders-section">
                    <div className="sidebar-orders-header">
                      <span className="sidebar-orders-title">My Orders</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          className="sidebar-table-tag"
                          onClick={() => {
                            const next = prompt('Change Table Number:', tableNumber || '06')
                            if (next) setTableNumber(next)
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Click to edit table number"
                        >
                          Table No : {tableNumber || '06'} ⌄
                        </span>
                        <button
                          className="sidebar-close-btn"
                          onClick={() => setIsSidebarOpen(false)}
                          title="Close sidebar"
                          type="button"
                          aria-label="Close sidebar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Dine In vs Take Away Mode Tabs */}
                    <div className="sidebar-type-tabs">
                      <button className="sidebar-type-tab active" type="button">
                        <span>Dine In</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 3v5a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
                          <path d="M8 3v5" />
                          <path d="M8 10v11" />
                          <path d="M16 3v9a2 2 0 0 1-2-2V3" />
                          <path d="M16 12v9" />
                        </svg>
                      </button>
                      <button
                        className="sidebar-type-tab"
                        onClick={() => navigate('/take-away')}
                        type="button"
                      >
                        <span>Take Away</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="6" width="16" height="15" rx="3" />
                          <path d="M4 8l3-4h10l3 4" />
                          <path d="M9 11a3 3 0 0 0 6 0" />
                        </svg>
                      </button>
                    </div>

                    {/* Cart Items List */}
                    <div className="sidebar-cart-list">
                      {cart.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '16px', color: '#9ca3af', fontSize: '0.85rem' }}>
                          Your cart is empty. Add dishes from the menu!
                        </div>
                      ) : (
                        cart.map(item => {
                          const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0)
                          return (
                            <div key={item.id} className="sidebar-cart-item">
                              <div className="cart-item-top">
                                <img
                                  src={item.image || '/assets/images/dishes/chicken_biryani.png'}
                                  alt={item.name}
                                  className="cart-item-thumb"
                                />
                                <div className="cart-item-info">
                                  <div className="cart-item-name">{item.name}</div>
                                  <div className="cart-item-serves">Serves : {item.serves || '1'}</div>
                                  <div className="cart-item-unit-price">Rs. {item.price}</div>
                                </div>
                                <div className="cart-item-total-col">
                                  <div className="cart-item-total-label">Total</div>
                                  <div className="cart-item-total-val">{itemTotal.toFixed(2)}</div>
                                  <div className="cart-item-gst">+ GST</div>
                                </div>
                              </div>

                              <div className="cart-item-actions">
                                <button
                                  className="cart-item-remove"
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

                              <input
                                type="text"
                                className="cart-item-note-input"
                                placeholder="Special instructions..."
                                value={item.note || ''}
                                onChange={(e) => updateNote(item.id, e.target.value)}
                              />
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    className="sidebar-place-order-btn"
                    onClick={() => {
                      if (cart.length === 0) {
                        alert('Please add at least one dish to your order.')
                        return
                      }
                      navigate('/checkout')
                    }}
                    type="button"
                  >
                    <span>Place Order</span>
                    <span style={{ fontSize: '1.1rem' }}>➔</span>
                  </button>

                  <div className="sidebar-panel-mode-switch" style={{ marginTop: '8px' }}>
                    <button
                      className="sidebar-switch-link"
                      onClick={() => setSidebarMode('voice_prompt')}
                      type="button"
                    >
                      Back to Voice Agent 💬
                    </button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        ) : !manualDrawerOpen ? (
          <div className="menu-sidebar-toggle-wrap">
            {/* Flow 3 Speech bubble prompt */}
            {showGreetingBubble && (
              <div
                className="agent-greeting-bubble"
                onClick={() => setFlow(4)}
                title="Click to talk to Voice Agent"
              >
                <span>Hi! I'm your Voice Agent. How can I help you today?</span>
              </div>
            )}

            <button
              className="menu-sidebar-open-pill"
              onClick={() => setFlow(4)}
              title="Open Voice Agent"
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
