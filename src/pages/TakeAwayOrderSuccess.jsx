import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import AIAssistantOverlay from '../components/AIAssistantOverlay';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useVoiceAgent } from '../context/VoiceAgentContext';
import '../styles/ordersuccess.css';

const TakeAwayOrderSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { language } = useLanguage();
  const { resetJourney } = useVoiceAgent();
  const {
    cartData = [],
    subtotal = 0,
    total = 0,
    gst = 0,
    formData = {},
    paymentMethod = 'Cash',
    orderId: dbOrderId = null,
    autoTrack = false,
  } = location.state || {};

  const [isTrackMode, setIsTrackMode] = useState(false);
  const [trackStep, setTrackStep] = useState(1); // 1: Received, 2: Preparing, 3: Ready for Pickup, 4: Completed
  const [isFinalScreen, setIsFinalScreen] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);
  const [fetchedOrder, setFetchedOrder] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Clear cart & lock back navigation on mount
  useEffect(() => {
    clearCart();
    sessionStorage.setItem('chatbot_flow_stage', 'payment_done');
    if (autoTrack) setIsTrackMode(true);
    const handleTrackEvent = () => setIsTrackMode(true);
    document.addEventListener('track-order-mode', handleTrackEvent);

    // Lock browser back button so user stays on order status page
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('track-order-mode', handleTrackEvent);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [autoTrack]);

  // Transition to final thank you screen after being completed
  useEffect(() => {
    if (trackStep === 4) {
      setIsFinalScreen(true);
    }
  }, [trackStep]);

  // Auto-redirect removed as per user request to stay on page
  useEffect(() => {
    if (!isFinalScreen) return;
    // Just clear the session data, do not redirect
    sessionStorage.removeItem('chatbot_flow_stage');
    sessionStorage.removeItem('last_placed_order_id');
    resetJourney();
  }, [isFinalScreen, resetJourney]);

  const localActiveId = localStorage.getItem('active_order_id');
  const lastSessionId = sessionStorage.getItem('last_placed_order_id');
  const activeOrderId = dbOrderId || localActiveId || lastSessionId;

  // Save active order id to session storage to prevent dummy order on refresh/back
  useEffect(() => {
    if (activeOrderId) {
      sessionStorage.setItem('last_placed_order_id', activeOrderId);
    }
  }, [activeOrderId]);

  // Poll real-time order status from backend
  useEffect(() => {
    if (!activeOrderId) return;

    let isMounted = true;

    const checkStatus = async () => {
      try {
        const selectedRestaurantId = localStorage.getItem('selected_restaurant_id') || '1';
        const res = await fetch(`/api/orders/${activeOrderId}?restaurant_id=${selectedRestaurantId}`);
        if (!res.ok) {
          if (res.status === 404 || res.status === 500) {
            localStorage.removeItem('active_order_id');
            localStorage.removeItem('active_order_type');
            sessionStorage.removeItem('last_placed_order_id');
            if (isMounted) setDbStatus('CANCELLED');
          }
          return;
        }
        const data = await res.json();
        if (isMounted) {
          const newStatus = data.order?.status || data.status;
          setDbStatus(prevStatus => {
            if (prevStatus !== newStatus) {
              setTimeout(() => {
                document.dispatchEvent(new CustomEvent('order-status-update', { detail: { status: newStatus } }));
              }, 0);
            }
            return newStatus;
          });
          if (data.order && data.items) {
            setFetchedOrder(data);
          }
        }
      } catch (err) {
        console.warn("Could not fetch order status from server:", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isTrackMode, activeOrderId]);

  // Map database status to corresponding stepper timeline index
  useEffect(() => {
    if (!dbStatus) return;

    if (dbStatus === 'PENDING' || dbStatus === 'CONFIRMED') {
      setTrackStep(1);
    } else if (dbStatus === 'PREPARING') {
      setTrackStep(2);
    } else if (dbStatus === 'READY') {
      setTrackStep(3);
    } else if (dbStatus === 'SERVED' || dbStatus === 'COMPLETED') {
      setTrackStep(4);
    } else if (dbStatus === 'CANCELLED') {
      setTrackStep(0);
    }
    
    if (dbStatus === 'SERVED' || dbStatus === 'COMPLETED' || dbStatus === 'CANCELLED') {
      localStorage.removeItem('active_order_id');
      localStorage.removeItem('active_order_type');
      sessionStorage.removeItem('ai_has_greeted');
      sessionStorage.removeItem('chatbot_flow_stage');
      sessionStorage.removeItem('last_placed_order_id');
      resetJourney();
    }
  }, [dbStatus]);



  const orderId = activeOrderId
    ? (String(activeOrderId).startsWith('ORD-') ? activeOrderId : `ORD-${String(activeOrderId).padStart(6, '0')}`)
    : `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

  const handleCallRestaurant = () => {
    setToastMessage(
      language === 'Tamil'
        ? `📞 உணவகத்தைத் தொடர்பு கொள்கிறது: +91 98765 43210`
        : `📞 Calling Restaurant: +91 98765 43210`
    );
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const translate = (en, ta) => (language === 'Tamil' ? ta : en);
  const displayCartData = cartData.length > 0 ? cartData : (fetchedOrder?.items || []);
  const displayTotal = total > 0 ? total : (fetchedOrder?.order?.total_amount || 0);
  const isLoadingOrder = cartData.length === 0 && !fetchedOrder;
  const totalItemsCount = isLoadingOrder ? "..." : displayCartData.reduce((acc, item) => acc + item.quantity, 0);

  const getStatusHeadline = () => {
    if (dbStatus === 'CANCELLED') return translate('Cancelled', 'இரத்து செய்யப்பட்டது');
    if (trackStep === 1) return translate('Order Received', 'ஆர்டர் பெறப்பட்டது');
    if (trackStep === 2) return translate('Preparing', 'தயாரிக்கப்படுகிறது');
    if (trackStep === 3) return translate('Ready for Pickup', 'வாங்க தயாராக உள்ளது');
    return translate('Order Completed', 'ஆர்டர் முடிந்தது');
  };

  const getStatusSubline = () => {
    if (dbStatus === 'CANCELLED') return translate('This order has been cancelled.', 'இந்த ஆர்டர் இரத்து செய்யப்பட்டது.');
    if (trackStep === 1) return translate("We've received your order.", 'உங்கள் ஆர்டர் பெறப்பட்டது.');
    if (trackStep === 2) return translate('Chef is preparing your parcel', 'செஃப் பார்சல் தயாரிக்கிறார்');
    if (trackStep === 3) return translate('Please collect at the counter', 'கவுண்டரில் பெற்றுக் கொள்ளவும்');
    return translate('Thank you for ordering!', 'ஆர்டர் செய்ததற்கு நன்றி!');
  };

  const getProgressBarWidth = () => {
    if (dbStatus === 'CANCELLED') return '0%';
    if (trackStep === 1) return '15%';
    if (trackStep === 2) return '45%';
    if (trackStep === 3) return '75%';
    return '100%';
  };

  const getConnectorHeight = () => {
    if (trackStep <= 1) return '0px';
    if (trackStep === 2) return '42px';
    if (trackStep === 3) return '94px';
    return '146px';
  };

  return (
    <div className="os-page">
      <div className="os-bg" />
      <Header 
        tableNumber="06" 
        showFullHeader={true} 
        useTitleImage={true} 
        showDateTime={true} 
        hideTableIndicator={true} 
        disableNavigation={!isFinalScreen} 
      />

      <main className="os-main">
        {isFinalScreen ? (
          /* FINAL SCREEN: THANK YOU */
          <div className="os-card" style={{ textAlign: 'center', padding: '40px 30px' }}>
            <div className="os-tick-wrap" style={{ width: '120px', height: '120px', margin: '0 auto 20px' }}>
              <svg className="os-checkmark" viewBox="0 0 52 52" style={{ width: '120px', height: '120px' }}>
                <circle className="os-check-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="os-check-path" fill="none" d="M14 27 l7 7 l17-17" />
              </svg>
            </div>
            <h1 className="os-title" style={{ fontSize: '36px', marginBottom: '12px' }}>
              {translate('Thank You!', 'நன்றி!')}
            </h1>
            <p className="os-subtitle" style={{ fontSize: '18px', color: '#555', marginBottom: '12px' }}>
              {translate('Visit again!', 'மீண்டும் வருக!')}
            </p>
            <p className="os-redirect-notice" style={{ fontSize: '15px', color: '#1a7a3b', marginBottom: '32px', fontWeight: '600' }}>
              <i className="fa-solid fa-check" style={{ marginRight: '8px' }}></i>
              {translate(`Order Completed!`, `ஆர்டர் முடிந்தது!`)}
            </p>

            <div className="os-actions" style={{ maxWidth: '400px', margin: '0 auto' }}>
              <button className="os-home-btn" onClick={() => {
                sessionStorage.removeItem('chatbot_flow_stage');
                sessionStorage.removeItem('last_placed_order_id');
                resetJourney();
                navigate('/');
              }}>
                <i className="fa-solid fa-house" /> {translate('Back to Home', 'முகப்பு')}
              </button>
              <button className="os-download-btn" onClick={() => {
                navigate('/invoice', {
                  state: {
                    orderId,
                    cartData: displayCartData,
                    subtotal,
                    gst,
                    finalTotal: displayTotal,
                    mobileNumber: formData.phone || 'WALK-IN',
                    paymentMethod
                  }
                });
              }}>
                <i className="fa-solid fa-download" /> {translate('Download Bill', 'ரசீது')}
              </button>
            </div>
          </div>
        ) : !isTrackMode ? (
          /* SCREEN 1: TAKEAWAY ORDER SUCCESS CONFIRMATION */
          <div className="os-card new-os-card">
            <button className="new-os-back" onClick={() => {
              resetJourney();
              navigate('/');
            }}>
              <i className="fa-solid fa-arrow-left"></i> {translate('Back to Menu', 'மெனுவுக்கு திரும்பு')}
            </button>
            <h1 className="new-os-title">{translate('Order Placed Successfully!', 'ஆர்டர் வெற்றிகரமாக செய்யப்பட்டது!')}</h1>
            
            <div className="new-os-grid">
              <div className="new-os-left">
                <div className="new-os-check-circle">
                  <i className="fa-solid fa-check"></i>
                </div>
                <h2>{translate('Order', 'ஆர்டர்')} #{orderId.replace('ORD-', '').replace(/^0+/, '')}</h2>
                <p>{translate('Kitchen has received your ticket', 'சமையலறை உங்கள் டிக்கெட்டைப் பெற்றுள்ளது')}</p>
              </div>
              
              <div className="new-os-right">
                <div className="new-os-prep-time">
                  <span className="label">{translate('ESTIMATED PREP TIME', 'மதிப்பிடப்பட்ட தயாரிப்பு நேரம்')}</span>
                  <span className="time">15 - 20 Mins</span>
                </div>
                
                <div className="new-os-summary">
                  <h3>{translate('Order Summary', 'ஆர்டர் சுருக்கம்')}</h3>
                  <div className="new-os-summary-items">
                    {displayCartData.map(item => (
                      <div key={item.id} className="new-os-summary-row">
                        <span>{item.quantity} × {item.name}</span>
                        <span>Rs. {item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="new-os-summary-total">
                    <span>{translate('Total Amount (Paid)', 'மொத்த தொகை (செலுத்தப்பட்டது)')}</span>
                    <span>Rs. {Number(displayTotal).toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <button className="new-os-track-btn" onClick={() => setIsTrackMode(true)}>
              {translate('Track Order Status', 'ஆர்டர் நிலையை கண்காணிக்கவும்')} <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        ) : (
          /* SCREENS 2, 3, 4: LIVE TAKEAWAY TRACKING */
          <div className="os-card live-track-card">
            <div className="live-track-header">
              <button className="new-os-back" onClick={() => setIsTrackMode(false)} style={{ marginBottom: 0 }}>
                <i className="fa-solid fa-arrow-left"></i> {translate('Back', 'பின்னே')}
              </button>
              <span className="live-track-order-id">{translate('Order', 'ஆர்டர்')} #{orderId.replace('ORD-', '').replace(/^0+/, '')}</span>
            </div>
            
            <h1 className="live-track-title">{translate('Live Preparation Status', 'நேரடி தயாரிப்பு நிலை')}</h1>

            <div className="live-track-grid">
              {/* Left Column - Stepper */}
              <div className="live-track-stepper">
                {/* Step 1: Order Received */}
                <div className={`lt-step ${trackStep >= 1 ? 'completed' : 'active'}`}>
                  <div className="lt-icon"><i className="fa-solid fa-check"></i></div>
                  <div className="lt-content">
                    <h4>{translate('Order Received', 'ஆர்டர் பெறப்பட்டது')}</h4>
                    <p>{translate('Confirmed by the desk', 'உறுதி செய்யப்பட்டது')}</p>
                  </div>
                </div>

                {/* Step 2: Preparing */}
                <div className={`lt-step ${trackStep > 2 ? 'completed' : trackStep === 2 ? 'active' : ''}`}>
                  <div className="lt-icon">{trackStep > 2 ? <i className="fa-solid fa-check"></i> : trackStep === 2 ? <div className="lt-dot"></div> : null}</div>
                  <div className="lt-content">
                    <h4>
                      {translate('Preparing Your Food', 'உணவு தயாராகிறது')} 
                      {trackStep === 2 && <span className="lt-badge">COOKING</span>}
                    </h4>
                    <p>{translate('Chef is crafting your fresh parcel', 'செஃப் உங்கள் பார்சலை தயார் செய்கிறார்')}</p>
                  </div>
                </div>

                {/* Step 3: Ready for Pickup */}
                <div className={`lt-step ${trackStep > 3 ? 'completed' : trackStep === 3 ? 'active' : ''}`}>
                  <div className="lt-icon">{trackStep > 3 ? <i className="fa-solid fa-check"></i> : trackStep === 3 ? <div className="lt-dot"></div> : null}</div>
                  <div className="lt-content">
                    <h4>{translate('Ready for Pickup', 'வாங்க தயாராக உள்ளது')}</h4>
                    <p>{translate('Please collect at the counter', 'கவுண்டரில் பெற்றுக் கொள்ளவும்')}</p>
                  </div>
                </div>

                {/* Step 4: Order Completed */}
                <div className={`lt-step ${trackStep === 4 ? 'active' : ''}`}>
                  <div className="lt-icon">{trackStep === 4 ? <div className="lt-dot"></div> : null}</div>
                  <div className="lt-content">
                    <h4>{translate('Order Completed', 'ஆர்டர் முடிந்தது')}</h4>
                    <p>{translate('Thank you for ordering!', 'ஆர்டர் செய்ததற்கு நன்றி!')}</p>
                  </div>
                </div>
              </div>

              {/* Right Column - Timer */}
              <div className="live-track-timer-box">
                <div className="lt-timer-circle">
                   <span className="lt-time">{trackStep === 4 ? '0' : trackStep === 3 ? '1' : trackStep === 2 ? '12' : '15'}</span>
                   <span className="lt-unit">MINS LEFT</span>
                </div>
                <h4>{trackStep >= 3 ? translate('Almost there!', 'கிட்டத்தட்ட தயார்!') : translate('Cooking in progress', 'சமையல் நடக்கிறது')}</h4>
                <p>{translate('Prep is running on schedule', 'தயாரிப்பு அட்டவணைப்படி நடக்கிறது')}</p>
              </div>
            </div>

            <div className="live-track-footer">
              <p>{translate('Please wait near the counter. We will notify you when it\'s ready.', 'தயவுசெய்து கவுண்டருக்கு அருகில் காத்திருக்கவும்.')}</p>
              <button className="new-os-back" onClick={handleCallRestaurant} style={{ color: '#ff4e00', marginBottom: 0, fontWeight: 700 }}>
                <i className="fa-solid fa-phone"></i> {translate('Need Help?', 'உதவி தேவையா?')}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Toast Notification */}
      <div className={`os-toast-notif ${showToast ? 'show' : ''}`}>
        {toastMessage}
      </div>
    </div>
  );
};

export default TakeAwayOrderSuccess;
