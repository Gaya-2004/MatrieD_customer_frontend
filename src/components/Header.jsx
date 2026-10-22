import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import MaitreDLogo from './MaitreDLogo'
import '../styles/components.css'
const dataudipiTitleImg = `/assets/images/Dataudupi-Title.png`;
const udupiBannerImg = `/assets/images/udupi-banner.png`;

function Header({ tableNumber = '06', showFullHeader = false, useTitleImage = false, showDateTime = true, hideTableIndicator = false, onTableClick, showBranchSelector = false, wireframeHeader = false, menuWireframeHeader = false, showServiceBell = true, onCallStaff, children }) {
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

  if (menuWireframeHeader) {
    return (
      <header className="wf-menu-header">
        {/* Table Indicator */}
        {tableNumber === 'Take Away' ? (
          <div className="wf-table-group" style={{ cursor: 'default' }}>
            <div className="wf-table-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, padding: '10px 20px', borderRadius: '9999px' }}>
              <span>Take Away</span>
              <span style={{ fontSize: '1.1rem' }}>🛍️</span>
            </div>
          </div>
        ) : (
          <div
            className="wf-table-group"
            onClick={onTableClick}
            style={onTableClick ? { cursor: 'pointer' } : {}}
            title="Click to change table"
          >
            <div className="wf-table-pill">{t('tableNo') || 'Table no :'}</div>
            <div className="wf-table-badge">{tableNumber || '06'}</div>
          </div>
        )}

        {/* Brand Logo in Center */}
        <div className="wf-menu-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <MaitreDLogo />
        </div>

        {/* Right Info: Date, Time, Language */}
        <div className="wf-menu-header-right">
          {showDateTime && (
            <>
              <div className="wf-meta-pill">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>{currentDate}</span>
              </div>
              <div className="wf-meta-pill">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{currentTime}</span>
              </div>
            </>
          )}

          {/* Language Selector */}
          <div className="wf-lang-container">
            <button
              className="wf-lang-btn"
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              type="button"
            >
              <svg className="wf-translate-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 8 6 6" />
                <path d="m4 14 6-6 2-3" />
                <path d="M2 5h12" />
                <path d="M7 2h1" />
                <path d="m22 22-5-10-5 10" />
                <path d="M14 18h6" />
              </svg>
              <span>{t('languages') || 'Languages'}</span>
            </button>
            {showLangDropdown && (
              <div className="wf-lang-dropdown">
                <div
                  className={`wf-lang-item ${language === 'English' ? 'active' : ''}`}
                  onClick={() => { setLanguage('English'); setShowLangDropdown(false); }}
                >
                  English
                </div>
                <div
                  className={`wf-lang-item ${language === 'Tamil' ? 'active' : ''}`}
                  onClick={() => { setLanguage('Tamil'); setShowLangDropdown(false); }}
                >
                  தமிழ் (Tamil)
                </div>
              </div>
            )}
          </div>

          {/* Service Bell Button (Screen 6-10) */}
          {showServiceBell && (
            <button
              className="header-service-bell"
              onClick={onCallStaff || (() => alert('Staff notified!'))}
              title="Call Staff / Service"
              type="button"
            >
              <span>«</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
          )}
        </div>
      </header>
    );
  }

  if (wireframeHeader) {
    return (
      <header className="wf-header">
        {/* Table Indicator */}
        <div
          className="wf-table-group"
          onClick={onTableClick}
          style={onTableClick ? { cursor: 'pointer' } : {}}
          title="Click to change table"
        >
          <div className="wf-table-pill">{t('tableNo') || 'Table no :'}</div>
          <div className="wf-table-badge">{tableNumber || '06'}</div>
        </div>

        {/* Language Selector */}
        <div className="wf-lang-container">
          <button
            className="wf-lang-btn"
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            type="button"
          >
            <svg className="wf-translate-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 8 6 6" />
              <path d="m4 14 6-6 2-3" />
              <path d="M2 5h12" />
              <path d="M7 2h1" />
              <path d="m22 22-5-10-5 10" />
              <path d="M14 18h6" />
            </svg>
            <span>{t('languages') || 'Languages'}</span>
          </button>
          {showLangDropdown && (
            <div className="wf-lang-dropdown">
              <div
                className={`wf-lang-item ${language === 'English' ? 'active' : ''}`}
                onClick={() => { setLanguage('English'); setShowLangDropdown(false); }}
              >
                English
              </div>
              <div
                className={`wf-lang-item ${language === 'Tamil' ? 'active' : ''}`}
                onClick={() => { setLanguage('Tamil'); setShowLangDropdown(false); }}
              >
                தமிழ் (Tamil)
              </div>
            </div>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="wf-menu-header">
      {/* Table Indicator or Takeaway badge */}
      {!hideTableIndicator ? (
        <div
          className="wf-table-group"
          onClick={onTableClick}
          style={onTableClick ? { cursor: 'pointer' } : {}}
          title="Click to change table"
        >
          <div className="wf-table-pill">{t('tableNo') || 'Table no :'}</div>
          <div className="wf-table-badge">{tableNumber || '06'}</div>
        </div>
      ) : (
        <div className="wf-table-group" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="wf-table-pill">Take Away 🛍</div>
        </div>
      )}

      {/* Brand Logo in Center */}
      <div className="wf-menu-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <MaitreDLogo />
      </div>

      {/* Right Info: Date, Time, Language */}
      <div className="wf-menu-header-right">
        {showDateTime && (
          <>
            <div className="wf-meta-pill">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{currentDate}</span>
            </div>
            <div className="wf-meta-pill">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{currentTime}</span>
            </div>
          </>
        )}

        {/* Language Selector */}
        <div className="wf-lang-container">
          <button
            className="wf-lang-btn"
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            type="button"
          >
            <svg className="wf-translate-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 8 6 6" />
              <path d="m4 14 6-6 2-3" />
              <path d="M2 5h12" />
              <path d="M7 2h1" />
              <path d="m22 22-5-10-5 10" />
              <path d="M14 18h6" />
            </svg>
            <span>{t('languages') || 'Languages'}</span>
          </button>
          {showLangDropdown && (
            <div className="wf-lang-dropdown">
              <div
                className={`wf-lang-item ${language === 'English' ? 'active' : ''}`}
                onClick={() => { setLanguage('English'); setShowLangDropdown(false); }}
              >
                English
              </div>
              <div
                className={`wf-lang-item ${language === 'Tamil' ? 'active' : ''}`}
                onClick={() => { setLanguage('Tamil'); setShowLangDropdown(false); }}
              >
                தமிழ் (Tamil)
              </div>
            </div>
          )}
        </div>
        {children}
      </div>
    </header>
  );
}

export default Header
