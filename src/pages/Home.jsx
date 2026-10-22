import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { useVoiceAgent } from '../context/VoiceAgentContext'
import Header from '../components/Header'
import MaitreDLogo from '../components/MaitreDLogo'
import { Html5Qrcode } from 'html5-qrcode'
import '../styles/home.css'

function Home() {
  const navigate = useNavigate()
  const { t, language } = useLanguage()
  const { tableNumber, setTableNumber, addToCart } = useCart()
  const { isAgentOpen, setIsAgentOpen } = useVoiceAgent()

  const [showTableModal, setShowTableModal] = useState(false)
  const [tableInput, setTableInput] = useState('')
  const [scannerError, setScannerError] = useState('')
  const qrCodeInstanceRef = useRef(null)

  useEffect(() => {
    if (!localStorage.getItem('selected_restaurant_id')) {
      localStorage.setItem('selected_restaurant_id', '1');
      localStorage.setItem('selected_restaurant_name', 'MaitreD Restaurant');
    }
  }, [])

  const handleDineInClick = () => {
    if (!tableNumber) setTableNumber('06')
    localStorage.setItem('active_table_number', tableNumber || '06')
    localStorage.setItem('active_order_type', 'dine_in')
    navigate('/dine-in?flow=2')
  }

  const handleTakeAwayClick = () => {
    localStorage.setItem('active_order_type', 'takeaway')
    navigate('/take-away')
  }

  const handleTalkToAgent = () => {
    if (!tableNumber) setTableNumber('06')
    localStorage.setItem('active_table_number', tableNumber || '06')
    localStorage.setItem('active_order_type', 'dine_in')
    navigate('/dine-in?flow=4')
  }

  useEffect(() => {
    const handleOpenTableModal = () => {
      handleDineInClick();
    };
    document.addEventListener('open-table-modal', handleOpenTableModal);
    return () => {
      document.removeEventListener('open-table-modal', handleOpenTableModal);
    };
  }, []);

  const stopAllCameraTracks = () => {
    try {
      const video = document.querySelector('video')
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => {
          track.stop()
        })
        video.srcObject = null
      }
    } catch (e) {
      console.error("Error manually stopping camera tracks:", e)
    }
  }

  const handleCloseModal = async () => {
    stopAllCameraTracks()
    if (qrCodeInstanceRef.current) {
      try {
        if (qrCodeInstanceRef.current.isScanning) {
          await qrCodeInstanceRef.current.stop()
        }
        await qrCodeInstanceRef.current.clear()
      } catch (err) {
        console.error("Error stopping scanner on close:", err)
      }
      qrCodeInstanceRef.current = null
    }
    setShowTableModal(false)
  }

  const formatTableNumber = (val) => {
    const clean = val.trim().toUpperCase()
    if (/^T-\d+$/.test(clean)) {
      return clean.replace('T-', '')
    }
    if (/^T\d+$/.test(clean)) {
      return clean.replace('T', '').padStart(2, '0')
    }
    const digits = clean.replace(/\D/g, '')
    if (digits) {
      return digits.padStart(2, '0')
    }
    return '06'
  }

  const parseTableFromQR = (data) => {
    try {
      if (data.includes('?')) {
        const queryString = data.split('?')[1]
        const params = new URLSearchParams(queryString)
        const tableVal = params.get('table')
        if (tableVal) {
          return tableVal
        }
      }
    } catch (e) {
      console.error("Error parsing QR URL:", e)
    }
    return data
  }

  const validateAndEnterTable = async (tableNum) => {
    if (!tableNum) {
      alert("Please enter a valid table number.")
      return;
    }
    const formattedNum = formatTableNumber(tableNum)
    try {
      const restaurantId = localStorage.getItem('selected_restaurant_id') || '1';
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_BASE}/api/v1/public/tables/${formattedNum}?restaurant_id=${restaurantId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // If backend doesn't have the table registered, still allow table for demo/wireframe flow
          setTableNumber(formattedNum)
          localStorage.setItem('active_table_number', formattedNum)
          localStorage.setItem('active_order_type', 'dine_in')
          handleCloseModal()
          navigate('/dine-in')
          return;
        } else {
          setTableNumber(formattedNum)
          localStorage.setItem('active_table_number', formattedNum)
          localStorage.setItem('active_order_type', 'dine_in')
          handleCloseModal()
          navigate('/dine-in')
          return;
        }
      }
      
      const data = await response.json();
      
      if (data.is_active === false) {
        alert("This table is currently inactive.");
        return;
      }
      
      if (data.status && data.status.toLowerCase() !== 'vacant') {
        alert(`This table is currently ${data.status}. Please select a vacant table.`);
        return;
      }
      
      setTableNumber(formattedNum)
      localStorage.setItem('active_table_number', formattedNum)
      localStorage.setItem('active_order_type', 'dine_in')
      
      handleCloseModal()
      navigate('/dine-in')
      
    } catch (error) {
      console.warn("Table verification falling back to client-side:", error);
      setTableNumber(formattedNum)
      localStorage.setItem('active_table_number', formattedNum)
      localStorage.setItem('active_order_type', 'dine_in')
      handleCloseModal()
      navigate('/dine-in')
    }
  }

  const handleScanSuccess = async (decodedText) => {
    const tableNum = parseTableFromQR(decodedText)
    await validateAndEnterTable(tableNum)
  }

  useEffect(() => {
    let active = true
    let html5QrCode = null

    if (showTableModal) {
      const timer = setTimeout(() => {
        if (!active) return
        
        try {
          html5QrCode = new Html5Qrcode("qr-reader")
          qrCodeInstanceRef.current = html5QrCode
          
          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 220, height: 220 }
            },
            (decodedText) => {
              if (active) {
                handleScanSuccess(decodedText)
              }
            },
            () => {}
          ).then(() => {
            if (!active && html5QrCode) {
              stopAllCameraTracks()
              if (html5QrCode.isScanning) {
                html5QrCode.stop()
                  .then(() => {
                    html5QrCode.clear()
                  })
                  .catch(err => console.error("Stop failed on late cleanup:", err))
              } else {
                stopAllCameraTracks()
              }
            }
          }).catch((err) => {
            if (active) {
              console.error("Camera start error:", err)
              setScannerError("Could not access camera. Please enter table number manually.")
            }
          })
        } catch (e) {
          console.error("Scanner setup error:", e)
          setScannerError("Scanner initialization failed. Please use manual entry.")
        }
      }, 300)

      return () => {
        clearTimeout(timer)
        active = false
        stopAllCameraTracks()
        if (html5QrCode) {
          try {
            if (html5QrCode.isScanning) {
              html5QrCode.stop()
                .then(() => {
                  html5QrCode.clear()
                })
                .catch(err => console.error("Scanner stop error:", err))
            }
          } catch (e) {
            console.error("Scanner cleanup error:", e)
          }
        }
      }
    }
  }, [showTableModal])

  return (
    <div className={`home-page-container ${isAgentOpen ? 'agent-open' : ''}`}>
      {/* Wireframe Header */}
      <Header
        tableNumber={tableNumber || '06'}
        wireframeHeader={true}
        onTableClick={handleDineInClick}
      />

      {/* Center Wrapper: vertically & horizontally centers content for any display */}
      <div className="wf-home-center-wrap">
        {/* 3D Chef Avatar Mascot */}
        <div className="wf-chef-container">
          <img
            src="/assets/images/chef_avatar_bust.png"
            alt="Chef Avatar"
            className="wf-chef-img"
          />
        </div>

        {/* Hero Section */}
        <main className="wf-hero-content">
          <h1 className="wf-welcome-text">{t('welcome') || 'Welcome To'}</h1>

          {/* Brand Logo with golden smile arc under m */}
          <MaitreDLogo />

          {/* Tagline */}
          <p className="wf-tagline">{t('freshFlavours') || 'FRESH FLAVOURS · VEG & NON VEG'}</p>

          {/* Order Here */}
          <div className="wf-order-section">
            <h2 className="wf-order-prompt">{t('orderHere') || 'Order Here :'}</h2>

            {/* 3 Action Buttons */}
            <div className="wf-action-buttons">
              {/* 1. Talk to Agent */}
              <button
                className="wf-action-btn"
                onClick={handleTalkToAgent}
                id="btn-talk-to-agent"
                title="Speak with AI Voice Agent"
              >
                <div className="wf-btn-icon">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v-1a8 8 0 0 1 16 0v1" />
                    <rect x="2" y="12" width="4" height="6" rx="2" />
                    <rect x="18" y="12" width="4" height="6" rx="2" />
                    <path d="M20 16v1a2 2 0 0 1-2 2h-4" />
                  </svg>
                </div>
                <span className="wf-btn-label">{t('talkToAgent') || 'Talk to Agent'}</span>
              </button>

              {/* 2. Dine In */}
              <button
                className="wf-action-btn"
                onClick={handleDineInClick}
                id="btn-dine-in"
                title="Dine In - Select or scan table"
              >
                <div className="wf-btn-icon">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3v5a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
                    <path d="M8 3v5" />
                    <path d="M8 10v11" />
                    <path d="M16 3v9a2 2 0 0 1-2-2V3" />
                    <path d="M16 12v9" />
                  </svg>
                </div>
                <span className="wf-btn-label">{t('dineIn') || 'Dine In'}</span>
              </button>

              {/* 3. Take Away */}
              <button
                className="wf-action-btn"
                onClick={handleTakeAwayClick}
                id="btn-take-away"
                title="Order Take Away"
              >
                <div className="wf-btn-icon">
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="6" width="16" height="15" rx="3" />
                    <path d="M4 8l3-4h10l3 4" />
                    <path d="M9 11a3 3 0 0 0 6 0" />
                  </svg>
                </div>
                <span className="wf-btn-label">{t('takeAway') || 'Take Away'}</span>
              </button>
            </div>
          </div>
        </main>

        {/* Veg & Non-Veg Favourites Section */}
        <section className="wf-favourites-section">
          <h2 className="wf-favourites-heading">
            {t('vegNonVegFavourites') || 'Veg & Non-Veg Favourites'}
          </h2>
        </section>
      </div>

      {/* QR Scanner / Table Modal */}
      {showTableModal && (
        <div className="scanner-modal-overlay">
          <div className="scanner-modal-content">
            <button className="scanner-modal-close" onClick={handleCloseModal}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <h4 className="scanner-modal-title">Scan Table QR Code</h4>
            <p className="scanner-modal-subtitle">Align the QR code on your table to start ordering</p>

            <div className="qr-reader-container">
              <div id="qr-reader"></div>
              <div className="qr-scanner-viewfinder">
                <div className="viewfinder-box">
                  <div className="scan-laser"></div>
                </div>
              </div>
            </div>

            {scannerError && (
              <div className="scanner-error-msg">{scannerError}</div>
            )}

            <div className="scanner-manual-card">
              <h5 className="manual-card-title">Unable to scan?</h5>
              <p className="manual-card-subtitle">Enter the table number manually from your table card</p>
              <div className="manual-input-group">
                <input 
                  type="text" 
                  className="manual-table-input" 
                  placeholder="Table No. (e.g. 06)" 
                  value={tableInput}
                  onChange={(e) => setTableInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && validateAndEnterTable(tableInput)}
                />
                <button className="manual-table-btn" onClick={() => validateAndEnterTable(tableInput)}>Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
