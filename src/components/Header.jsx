import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import '../styles/components.css'
const dataudipiTitleImg = `/assets/images/Dataudupi-Title.png`;
const udupiBannerImg = `/assets/images/udupi-banner.png`;

function Header({ tableNumber = '06', showFullHeader = false, useTitleImage = false, showDateTime = true, hideTableIndicator = false, onTableClick, showBranchSelector = false, children }) {
  const navigate = useNavigate()
  const { language, setLanguage, t } = useLanguage()
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const [currentDate, setCurrentDate] = useState('')
  const [currentTime, setCurrentTime] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const dateStr = now.toLocaleDateString(language === 'English' ? 'en-US' : 'ta-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      const timeStr = now.toLocaleTimeString(language === 'English' ? 'en-US' : 'ta-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      setCurrentDate(dateStr)
      setCurrentTime(timeStr)
    }

    updateDateTime()
    const interval = setInterval(updateDateTime, 1000)
    return () => clearInterval(interval)
  }, [language])

  const shouldUseTitleImage = useTitleImage || isMobile

  return (
    <header className={`header ${showFullHeader ? 'full-header' : ''}`}>
      {/* Table Indicator or Branch Selector */}
      {!hideTableIndicator ? (
        <div
          className="table-indicator"
          onClick={onTableClick}
          style={onTableClick ? { cursor: 'pointer' } : {}}
        >
          <span className="table-text">{t('tableNo')}</span>
          <div className="table-number">{tableNumber}</div>
        </div>
      ) : showBranchSelector ? (
        <div className="header-branch-selector">
          <span className="branch-label">Branch:</span>
          <select
            value={localStorage.getItem('selected_restaurant_id') || '1'}
            onChange={(e) => {
              const val = e.target.value;
              const name = val === '1' ? 'Data Udipi — Mugalivakkam' : 'Data Udipi — MGR Nagar';
              localStorage.setItem('selected_restaurant_id', val);
              localStorage.setItem('selected_restaurant_name', name);
              sessionStorage.removeItem('udipi_carts_session_v1'); // Clear cart on branch change
              window.dispatchEvent(new Event('storage'));
              window.location.reload();
            }}
            className="branch-select"
          >
            <option value="1">Mugalivakkam</option>
            <option value="2">MGR Nagar</option>
          </select>
        </div>
      ) : null}

      {/* Logo Sign */}
      <div 
        className={`logo-sign ${shouldUseTitleImage ? 'title-mode' : ''}`}
        onClick={() => navigate('/')}
        style={{ cursor: 'pointer' }}
      >
        <img
          src={shouldUseTitleImage ? dataudipiTitleImg : udupiBannerImg}
          alt="Data Udipi Logo"
          className={shouldUseTitleImage ? "title-image-header" : "banner-image"}
        />
      </div>

      {/* Right Side Elements */}
      <div className="header-right">
        <div className="header-top-right">
          {/* Date-Time (for full header) */}
          {showFullHeader && showDateTime && (
            <div className="date-time-box">
              <i className="fa-regular fa-calendar"></i>
              <span>{currentDate}</span>
              <div className="divider"></div>
              <i className="fa-regular fa-clock"></i>
              <span>{currentTime}</span>
            </div>
          )}

          {/* Language Selector */}
          <div className="language-selector">
            <button
              className="lang-btn"
              onClick={() => setShowLangDropdown(!showLangDropdown)}
            >
              <span className="lang-icon"><i className="fa-solid fa-globe"></i></span>
              <span>{t('languages')}</span>
            </button>
            {showLangDropdown && (
              <div className="lang-dropdown show">
                <div
                  className="lang-option"
                  onClick={() => { setLanguage('English'); setShowLangDropdown(false); }}
                >
                  English
                </div>
                <div
                  className="lang-option"
                  onClick={() => { setLanguage('Tamil'); setShowLangDropdown(false); }}
                >
                  Tamil
                </div>
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    </header>
  )
}

export default Header
