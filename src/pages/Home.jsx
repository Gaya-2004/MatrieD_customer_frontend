import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useCart } from '../context/CartContext'
import { useVoiceAgent } from '../context/VoiceAgentContext'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { Html5Qrcode } from 'html5-qrcode'
import '../styles/home.css'
const dataudipiTitleImg = `/assets/images/Dataudupi-Title.png`;
const dineinLogoImg = `/assets/images/dinein-logo.png`;
const takeawayLogoImg = `/assets/images/takeaway-logo.png`;

function Home() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { tableNumber, setTableNumber } = useCart()
  const { isAgentOpen } = useVoiceAgent()

  const [showTableModal, setShowTableModal] = useState(false)
  const [tableInput, setTableInput] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [scannerError, setScannerError] = useState('')
  const qrCodeInstanceRef = useRef(null)

  useEffect(() => {
    if (!localStorage.getItem('selected_restaurant_id')) {
      localStorage.setItem('selected_restaurant_id', '1');
      localStorage.setItem('selected_restaurant_name', 'Data Udipi — Mugalivakkam');
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleDineInClick = () => {
    setShowTableModal(true)
    setTableInput('')
    setScannerError('')
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
          alert("Table not found. Please enter a valid table number.");
        } else {
          alert("Error verifying table status. Please try again.");
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.is_active === false) {
        alert("This table is currently inactive.");
        return;
      }
      
      if (data.status.toLowerCase() !== 'vacant') {
        alert(`This table is currently ${data.status}. Please select a vacant table.`);
        return;
      }
      
      setTableNumber(formattedNum)
      localStorage.setItem('active_table_number', formattedNum)
      
      handleCloseModal()
      
      navigate('/dine-in')
      
    } catch (error) {
      console.error("Error verifying table:", error);
      alert("Failed to verify table. Please check your connection.");
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
            // If the cleanup happened while start() was pending
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
    <div className={`app-container home-page-container ${isAgentOpen ? 'agent-open' : ''}`}>
      <div className="background-image"></div>
      <Header tableNumber={tableNumber} showFullHeader={true} useTitleImage={false} showDateTime={false} hideTableIndicator={true} showBranchSelector={true} />

      <main className="main-content">
        <h2 className="welcome-text">{t('welcome')}</h2>
        <div className="main-title">
          <img src={dataudipiTitleImg} alt="Data Udipi" className="title-image" />
        </div>
        <p className="subtitle">{t('excellence')}</p>

        <div className="order-section">

          <h3 className="order-text">{t('orderHere')}</h3>
          <div className="action-buttons">
            <button className="action-btn" onClick={handleDineInClick}>
              <img src={dineinLogoImg} alt="Dine In Icon" className="btn-icon-img" />
              <span>{t('dineIn')}</span>
            </button>
            <button className="action-btn" onClick={() => {
              navigate('/take-away')
            }}>
              <img src={takeawayLogoImg} alt="Take Away Icon" className="btn-icon-img" />
              <span>{t('takeAway')}</span>
            </button>
          </div>
        </div>
      </main>

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
                  placeholder="Table No. (e.g. 05)" 
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

      <Footer />
    </div>
  )
}

export default Home
