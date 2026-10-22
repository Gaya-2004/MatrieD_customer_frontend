import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import AIAssistantOverlay from '../components/AIAssistantOverlay';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useVoiceAgent } from '../context/VoiceAgentContext';
import '../styles/ordersuccess.css';
import '../styles/flow_screens.css';

const OrderSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart, tableNumber } = useCart();
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
  const [trackStep, setTrackStep] = useState(1); // 1: Received, 2: Preparing, 3: Ready, 4: Served
  const [dbStatus, setDbStatus] = useState(null);
  const [fetchedOrder, setFetchedOrder] = useState(null);
  const [isFinalScreen, setIsFinalScreen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // Clear cart, set payment_done stage, & prevent browser back button
  useEffect(() => {
    clearCart();
    sessionStorage.setItem('chatbot_flow_stage', 'payment_done');
    if (autoTrack) setIsTrackMode(true);
    const handleTrackEvent = () => setIsTrackMode(true);
    document.addEventListener('track-order-mode', handleTrackEvent);

    // Prevent going back after order success
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

  // Transition to final thank you screen immediately after being served
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
  const [activeOrderId, setActiveOrderId] = useState(dbOrderId || localActiveId || lastSessionId);

  // Save active order id to session storage to prevent dummy order on refresh/back
  useEffect(() => {
    if (activeOrderId) {
      sessionStorage.setItem('last_placed_order_id', activeOrderId);
    }
  }, [activeOrderId]);

  // If no dbOrderId is provided, try to fetch the active order for this table
  useEffect(() => {
    if (!activeOrderId && tableNumber) {
      const fetchTableOrder = async () => {
        try {
          const selectedRestaurantId = localStorage.getItem('selected_restaurant_id') || '1';
          const res = await fetch(`/api/v1/public/orders/table/${tableNumber}?restaurant_id=${selectedRestaurantId}`);
          if (res.ok) {
            const data = await res.json();
            const retrievedId = data.orderId || data.order_id || data.id;
            setActiveOrderId(retrievedId);
            setDbStatus(data.status);
            setIsTrackMode(true);
          }
        } catch (err) {
          console.warn("No active order for table found");
        }
      };
      fetchTableOrder();
    }
  }, [activeOrderId, tableNumber]);

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
            localStorage.removeItem('active_table_number');
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
      localStorage.removeItem('active_table_number');
      sessionStorage.removeItem('ai_has_greeted');
      sessionStorage.removeItem('chatbot_flow_stage');
      sessionStorage.removeItem('last_placed_order_id');
      resetJourney();
    }
  }, [dbStatus]);



  const orderId = activeOrderId
    ? (String(activeOrderId).startsWith('ORD-') ? activeOrderId : `ORD-${String(activeOrderId).padStart(6, '0')}`)
    : `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

  const handleCallStaff = () => {
    const tableStr = formData.table || tableNumber || '06';
    setToastMessage(
      language === 'Tamil'
        ? `🛎️ ஊழியர் மேஜை ${tableStr}-க்கு வரவழைக்கப்பட்டார்!`
        : `🛎️ Staff notified for Table ${tableStr}! Someone will be with you shortly.`
    );
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const translate = (en, ta) => (language === 'Tamil' ? ta : en);
  const displayCartData = cartData.length > 0 ? cartData : (fetchedOrder?.items || []);
  const displayTotal = total > 0 ? total : (fetchedOrder?.order?.total_amount || 0);
  const isLoadingOrder = cartData.length === 0 && !fetchedOrder;
  const totalItemsCount = isLoadingOrder ? "..." : displayCartData.reduce((acc, item) => acc + item.quantity, 0);

  const rawNum = orderId ? String(orderId).replace('ORD-', '').replace(/^0+/, '') : '';
  const displayOrderNum = rawNum && rawNum.length <= 4 ? rawNum : '1042';

  const itemsToDisplay = displayCartData.length > 0
    ? displayCartData
    : [
        { name: 'Onion Rava Dosa', quantity: 2, price: 100 },
        { name: 'Chicken Biryani', quantity: 1, price: 210 },
        { name: 'Special Filter Coffee', quantity: 2, price: 45 }
      ];

  const isManualFlow = location.state?.manualFlow || false;
  // Manual Flow Steps: 1 = Confirmed (Screen 12), 2 = Live Tracking (Screen 13), 3 = Ready for Pickup (Screen 14)
  const [manualStep, setManualStep] = useState(
    location.state?.manualStep || (location.state?.isManualOrderConfirmed ? 1 : 1)
  );

  useEffect(() => {
    if (location.state?.manualStep) {
      setManualStep(location.state.manualStep);
    }
  }, [location.state?.manualStep]);

  // Render Manual Flow (Screens 12, 13, 14)
  if (isManualFlow) {
    const orderNumberStr = location.state?.orderId || '1042';

    return (
      <div className="flow-page-bg">
        <div className="flow-top-breadcrumbs">
          {manualStep === 1 && 'Maitre D · Manual order confirmed'}
          {manualStep === 2 && 'Maitre D · Manual live tracking'}
          {manualStep === 3 && 'Maitre D · Manual ready for pickup'}
        </div>

        <Header
          tableNumber={tableNumber || '06'}
          menuWireframeHeader={true}
          showDateTime={true}
          showServiceBell={true}
          onTableClick={() => {
            const next = prompt('Enter Table Number:', tableNumber || '06');
            if (next) setTableNumber(next);
          }}
        />

        <main className="manual-flow-center-wrap">
          {/* ================================================================
              SCREEN 12: ORDER PLACED SUCCESSFULLY
              ================================================================ */}
          {manualStep === 1 && (
            <div className="manual-success-card">
              <button
                className="manual-back-to-menu-btn"
                onClick={() => navigate('/dine-in')}
                type="button"
              >
                <i className="fa-solid fa-arrow-left" />
                <span>Back to Menu</span>
              </button>

              <h1 className="manual-success-title">Order Placed Successfully!</h1>

              <div className="manual-success-body-grid">
                {/* Left Ticket Box */}
                <div className="manual-ticket-box">
                  <div className="manual-check-circle-large">
                    <i className="fa-solid fa-check" />
                  </div>
                  <div className="manual-ticket-order-id">Order #{orderNumberStr}</div>
                  <div className="manual-ticket-caption">Kitchen has received your ticket</div>
                </div>

                {/* Right Prep & Summary Box */}
                <div className="manual-prep-summary-box">
                  <div className="manual-prep-label">ESTIMATED PREP TIME</div>
                  <div className="manual-prep-time">15 – 20 Mins</div>

                  <div className="manual-confirmed-summary-box">
                    <div className="manual-confirmed-summary-title">Order Summary</div>
                    <div className="manual-confirmed-summary-rows">
                      <div className="manual-confirmed-row">
                        <span>1 × Onion Rava Dosa</span>
                        <span>Rs. 100</span>
                      </div>
                      <div className="manual-confirmed-row">
                        <span>1 × Butter Chicken</span>
                        <span>Rs. 240</span>
                      </div>
                      <div className="manual-confirmed-row">
                        <span>Tax & service charges</span>
                        <span>Rs. 78.20</span>
                      </div>
                      <div className="manual-confirmed-row total">
                        <span>Total Amount (Paid)</span>
                        <span>Rs. 418.20</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="manual-action-btn"
                onClick={() => setManualStep(2)}
                type="button"
              >
                <span>Track Order Status</span>
                <span style={{ fontSize: '1.2rem' }}>➔</span>
              </button>
            </div>
          )}

          {/* ================================================================
              SCREEN 13: LIVE PREPARATION STATUS
              ================================================================ */}
          {manualStep === 2 && (
            <div className="manual-tracking-card">
              <button
                className="manual-back-to-menu-btn"
                onClick={() => navigate('/dine-in')}
                type="button"
              >
                <i className="fa-solid fa-arrow-left" />
                <span>Back to Menu</span>
              </button>

              <div className="manual-tracking-header-row">
                <h1 className="manual-tracking-title">Live Preparation Status</h1>
                <div className="manual-tracking-order-badge">Order #{orderNumberStr}</div>
              </div>

              <div className="manual-tracking-body-grid">
                {/* Left Stepper */}
                <div className="manual-stepper-container">
                  {/* Step 1: Done */}
                  <div className="manual-step-item done">
                    <div className="manual-step-indicator">
                      <div className="manual-step-dot done">
                        <i className="fa-solid fa-check" />
                      </div>
                      <div className="manual-step-line done" />
                    </div>
                    <div className="manual-step-content">
                      <div className="manual-step-title">Order Received</div>
                      <div className="manual-step-desc">Confirmed by the desk at 16:54 PM</div>
                    </div>
                  </div>

                  {/* Step 2: In-Progress */}
                  <div className="manual-step-item active">
                    <div className="manual-step-indicator">
                      <div className="manual-step-dot active">
                        <div className="manual-step-dot-inner" />
                      </div>
                      <div className="manual-step-line" />
                    </div>
                    <div className="manual-step-content">
                      <div className="manual-step-title-row">
                        <span className="manual-step-title">Preparing Your Food</span>
                        <span className="manual-step-badge">COOKING</span>
                      </div>
                      <div className="manual-step-desc">Chef is preparing your dosa and Butter Chicken</div>
                    </div>
                  </div>

                  {/* Step 3: Pending / Clickable to advance */}
                  <div
                    className="manual-step-item pending"
                    onClick={() => setManualStep(3)}
                    title="Click to view Ready for Pickup screen"
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="manual-step-indicator">
                      <div className="manual-step-dot" />
                    </div>
                    <div className="manual-step-content">
                      <div className="manual-step-title">Ready for Pickup</div>
                      <div className="manual-step-desc">Counter 3 ticket calling</div>
                    </div>
                  </div>
                </div>

                {/* Right Timer Box */}
                <div className="manual-timer-panel">
                  <div className="manual-circle-progress" onClick={() => setManualStep(3)} title="Click to view Ready for Pickup" style={{ cursor: 'pointer' }}>
                    <div className="manual-circle-number">12</div>
                    <div className="manual-circle-sub">MINS LEFT</div>
                  </div>
                  <div className="manual-timer-caption">Almost there!</div>
                  <div className="manual-timer-sub">Prep is running on schedule</div>
                </div>
              </div>

              {/* Bottom Help and Info */}
              <div className="manual-tracking-footer-row">
                <div className="manual-tracking-note">
                  Please stay near your table. We will notify you when it's ready.
                </div>
                <button
                  className="manual-need-help-btn"
                  onClick={handleCallStaff}
                  type="button"
                >
                  <i className="fa-regular fa-comment-dots" />
                  <span>Need Help?</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================
              SCREEN 14: READY FOR PICKUP
              ================================================================ */}
          {manualStep === 3 && (
            <div className="manual-pickup-card">
              <button
                className="manual-back-to-menu-btn"
                onClick={() => navigate('/dine-in')}
                type="button"
              >
                <i className="fa-solid fa-arrow-left" />
                <span>Back to Menu</span>
              </button>

              <h1 className="manual-pickup-title">Your Order is Ready!</h1>

              <div className="manual-pickup-body-grid">
                {/* Left Counter Box */}
                <div className="manual-counter-box">
                  <div className="manual-counter-label">PROCEED TO COUNTER</div>
                  <div className="manual-counter-pill">Counter 3</div>
                  <div className="manual-counter-note">Show your screen token to the server</div>
                </div>

                {/* Right Checklist Box */}
                <div className="manual-token-info-col">
                  <div className="manual-token-id-label">Token ID</div>
                  <div className="manual-token-id-num">#MD-{orderNumberStr}</div>

                  <div className="manual-items-collect-box">
                    <div className="manual-items-collect-heading">Please collect the following items:</div>
                    <div className="manual-items-checklist">
                      <div className="manual-check-item">
                        <i className="fa-solid fa-check" />
                        <span>1 × Onion Rava Dosa</span>
                      </div>
                      <div className="manual-check-item">
                        <i className="fa-solid fa-check" />
                        <span>1 × Butter Chicken</span>
                      </div>
                      <div className="manual-check-item">
                        <i className="fa-solid fa-check" />
                        <span>Served with basmati rice</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="manual-action-btn"
                onClick={() => {
                  resetJourney();
                  navigate('/dine-in');
                }}
                type="button"
              >
                <span>Place New Order</span>
                <span style={{ fontSize: '1.2rem', marginLeft: '4px' }}>+</span>
              </button>
            </div>
          )}
        </main>

        <div className={`os-toast-notif ${showToast ? 'show' : ''}`}>
          {toastMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="flow-page-bg">
      <div className="flow-top-breadcrumbs">
        {isTrackMode ? 'Maitre D · Live order tracking' : 'Maitre D · Order confirmation'}
      </div>

      <Header
        tableNumber={tableNumber || '06'}
        menuWireframeHeader={true}
        showDateTime={true}
        showServiceBell={true}
        onTableClick={() => {
          const next = prompt('Enter Table Number:', tableNumber || '06');
          if (next) setTableNumber(next);
        }}
      />

      <main className="flow-modal-center-wrap">
        {!isTrackMode ? (
          /* ================================================================
             SCREEN 4: ORDER CONFIRMED MODAL
             ================================================================ */
          <div className="flow-confirmed-card">
            <div className="flow-confirm-check-badge">
              <i className="fa-solid fa-check" />
            </div>

            <h1 className="flow-confirmed-title">Order Confirmed!</h1>
            <div className="flow-confirmed-sub">Your Maitre D dining experience has begun.</div>

            <div className="flow-order-meta-pill-box">
              <div className="flow-order-meta-col">
                <span className="flow-order-meta-label">Order Number</span>
                <span className="flow-order-meta-val">#{displayOrderNum}</span>
              </div>
              <div className="flow-order-meta-col">
                <span className="flow-order-meta-label">Est. Wait Time</span>
                <span className="flow-order-meta-val">15–20 Mins</span>
              </div>
            </div>

            <div className="flow-confirmed-items-section">
              <div className="flow-confirmed-items-header">Items Ordered</div>
              <div className="flow-confirmed-items-list">
                {itemsToDisplay.map((item, idx) => (
                  <div key={idx} className="flow-confirmed-item-row">
                    <span>{item.name} ×{item.quantity}</span>
                    <span>Rs. {(Number(item.price) * Number(item.quantity)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flow-confirmed-actions">
              <button
                className="flow-btn-outline"
                onClick={() => setIsTrackMode(true)}
                type="button"
              >
                Track Real-Time Status
              </button>
              <button
                className="flow-btn-filled"
                onClick={() => {
                  resetJourney();
                  navigate('/dine-in');
                }}
                type="button"
              >
                Back to Menu
              </button>
            </div>
          </div>
        ) : (
          /* ================================================================
             SCREEN 5: LIVE ORDER TRACKING
             ================================================================ */
          <div className="flow-tracking-card">
            <div className="flow-tracking-header">
              <div>
                <div className="flow-tracking-sublabel">Current Status</div>
                <h1 className="flow-tracking-title">Tracking Order #{displayOrderNum}</h1>
              </div>
              <div className="flow-eta-badge">ETA: 12 Mins</div>
            </div>

            {/* Stepper Progress Bar */}
            <div className="flow-tracking-stepper-wrap">
              <div className="flow-stepper-bar-bg" />
              <div
                className="flow-stepper-bar-fill"
                style={{ width: trackStep === 1 ? '0%' : trackStep === 2 ? '50%' : '100%' }}
              />

              <div className="flow-stepper-nodes">
                {/* Step 1 */}
                <div className="flow-stepper-node done">
                  <div className="flow-stepper-circle" />
                  <div className="flow-stepper-node-title">Order Received</div>
                  <div className="flow-stepper-node-sub">16:55 PM</div>
                </div>

                {/* Step 2 */}
                <div className="flow-stepper-node active">
                  <div className="flow-stepper-circle" />
                  <div className="flow-stepper-node-title">Preparing</div>
                  <div className="flow-stepper-node-sub">In Progress</div>
                </div>

                {/* Step 3 */}
                <div className="flow-stepper-node">
                  <div className="flow-stepper-circle" />
                  <div className="flow-stepper-node-title">Ready for Pickup</div>
                  <div className="flow-stepper-node-sub">Pending</div>
                </div>
              </div>
            </div>

            {/* Chef Cooking In-Progress Box */}
            <div className="flow-chef-cooking-box">
              <img
                src="/assets/images/chef_cooking.png"
                alt="Chef preparing meal"
                className="flow-chef-illustration"
              />
              <div className="flow-chef-cooking-info">
                <div className="flow-chef-cooking-title">Chef is preparing your meal!</div>
                <div className="flow-chef-cooking-desc">
                  Your Chicken Biryani is cooking with aromatic basmati rice, marinated chicken and freshly ground spices.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flow-tracking-footer">
              <div className="flow-tracking-mic-hint">
                Need something else? Tap the microphone button or talk to your agent.
              </div>
              <button
                className="flow-tracking-back-btn"
                onClick={() => {
                  resetJourney();
                  navigate('/dine-in');
                }}
                type="button"
              >
                Back to Menu
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

export default OrderSuccess;
