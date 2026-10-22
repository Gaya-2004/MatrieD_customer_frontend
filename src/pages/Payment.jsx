import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import { useCart } from '../context/CartContext';
import { useVoiceAgent } from '../context/VoiceAgentContext';
import '../styles/payment.css';
import '../styles/flow_screens.css';

const Payment = ({ isTakeaway: propIsTakeaway }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isTakeaway = propIsTakeaway !== undefined ? propIsTakeaway : (location.pathname.includes('takeaway') || location.pathname.includes('take-away'));
  const { agentState, setOrderPlaced, startOrderTracking, setFlowStage } = useVoiceAgent();
  const {
    cart,
    changeQty,
    updateItemQuantity,
    removeCartItem,
    updateNote,
    totalItems,
    subtotal,
    serviceCharge,
    gst,
    totalAmount: total,
    tableNumber,
    isCartOpen,
    setIsCartOpen
  } = useCart();
  const [selectedMethod, setSelectedMethod] = useState('Cash');
  const [isPollingCash, setIsPollingCash] = useState(false);

  const { formData: rawFormData = {}, autoConfirmMethod } = location.state || {};
  const formData = {
    name:  agentState?.customerName  || rawFormData.name  || sessionStorage.getItem('customer_name')  || '',
    phone: agentState?.mobileNumber  || rawFormData.phone || sessionStorage.getItem('customer_phone') || ''
  };

  useEffect(() => {
    if (cart.length === 0) {
      navigate(isTakeaway ? '/take-away' : '/dine-in', { replace: true });
    }
  }, [cart, navigate, isTakeaway]);

  useEffect(() => {
    setIsCartOpen(false);

    if (autoConfirmMethod) {
      setSelectedMethod(autoConfirmMethod);
      setTimeout(() => {
        handleConfirm(autoConfirmMethod);
      }, 500);
    }

    const handleSelectPayment = (e) => {
      if (e.detail && e.detail.method) {
        const method = e.detail.method === 'Cash' ? 'Cash' : 'UPI';
        setSelectedMethod(method);
      }
    };
    const handleConfirmOrder = (e) => {
      let currentMethod = 'Cash';
      if (e && e.detail && e.detail.method) {
        currentMethod = e.detail.method;
      } else {
        const pmElement = document.querySelector('.payment-method-card.selected .pm-name');
        currentMethod = pmElement && pmElement.innerText.includes('Online') ? 'UPI' : 'Cash';
      }
      handleConfirm(currentMethod);
    };

    document.addEventListener('select-payment', handleSelectPayment);
    document.addEventListener('confirm-place-order', handleConfirmOrder);

    return () => {
      setIsCartOpen(false);
      document.removeEventListener('select-payment', handleSelectPayment);
      document.removeEventListener('confirm-place-order', handleConfirmOrder);
    };
  }, []);

  const isSubmittingRef = useRef(false);

  const handleConfirm = async (methodOverride) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    const methodToUse = typeof methodOverride === 'string' ? methodOverride : selectedMethod;
    setIsCartOpen(false);

    if (cart.length === 0) {
      console.warn("Cannot place order: cart is empty");
      isSubmittingRef.current = false;
      return;
    }

    if (methodToUse === 'Cash') {
      const orderData = {
        table_number: isTakeaway ? 'Take Away' : (tableNumber || '06'),
        payment_method: 'Cash',
        phone: formData.phone || '',
        cart: cart.map(item => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          note: item.note || ''
        })),
        subtotal: subtotal,
        gst: gst,
        service_charge: serviceCharge,
        total_amount: total
      };

      try {
        const selectedRestaurantId = localStorage.getItem('selected_restaurant_id') || '1';
        const res = await fetch(`/api/orders?restaurant_id=${selectedRestaurantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });
        const data = await res.json();
        const dbId = data.dbOrderId || data.order_id || data.id;
        const generatedOrderId = data.orderId || (dbId ? `ORD-${String(dbId).padStart(6, '0')}` : `ORD-${Math.floor(100000 + Math.random() * 900000)}`);
        sessionStorage.setItem('chatbot_flow_stage', 'payment_done');
        localStorage.setItem('active_order_id', generatedOrderId);
        localStorage.setItem('active_order_type', isTakeaway ? 'takeaway' : 'dine-in');
        localStorage.setItem('active_table_number', tableNumber || '06');
        setFlowStage('ORDER_TRACKING');
        navigate(isTakeaway ? '/takeaway-order-success' : '/order-success', {
          state: {
            orderId: generatedOrderId,
            cartData: cart,
            subtotal, gst, total, formData, paymentMethod: 'Cash',
            autoTrack: true
          }
        });
      } catch (err) {
        console.error('Order placement error:', err);
        sessionStorage.setItem('chatbot_flow_stage', 'payment_done');
        isSubmittingRef.current = false;
        navigate(isTakeaway ? '/takeaway-order-success' : '/order-success', {
          state: {
            orderId: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
            cartData: cart,
            subtotal, gst, total, formData, paymentMethod: 'Cash'
          }
        });
      }
      return;
    }

    // Razorpay Integration
    const orderData = {
      table_number: isTakeaway ? 'Take Away' : (tableNumber || '06'),
      payment_method: 'Razorpay',
      phone: formData.phone || '',
      cart: cart.map(item => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        note: item.note || ''
      })),
      subtotal: subtotal,
      gst: gst,
      service_charge: serviceCharge,
      total_amount: total
    };

    try {
      const selectedRestaurantId = localStorage.getItem('selected_restaurant_id') || '1';
      const orderRes = await fetch(`/api/orders?restaurant_id=${selectedRestaurantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const orderResult = await orderRes.json();
      const dbId = orderResult.dbOrderId || orderResult.order_id || orderResult.id;
      const generatedOrderId = orderResult.orderId || (dbId ? `ORD-${String(dbId).padStart(6, '0')}` : `ORD-${Math.floor(100000 + Math.random() * 900000)}`);

      const res = await new Promise((resolve) => {
        if (window.Razorpay) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      if (!res) {
        throw new Error('Razorpay SDK failed to load');
      }

      let razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
      try {
        const keyRes = await fetch(`/api/razorpay-key`);
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          razorpayKeyId = keyData.key_id || razorpayKeyId;
        }
      } catch (keyErr) {
        console.error('Failed to fetch Razorpay key from backend:', keyErr);
      }

      let rzpOrder = { success: false };
      try {
        const rzpOrderRes = await fetch(`/api/create-razorpay-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: total, order_id: dbId })
        });
        if (rzpOrderRes.ok) {
          rzpOrder = await rzpOrderRes.json();
        } else {
          console.error('Razorpay order creation failed:', await rzpOrderRes.text());
        }
      } catch (e) {
        console.warn('Failed to create Razorpay order on backend:', e);
      }

      if (!razorpayKeyId || !rzpOrder.success) {
        console.warn('Razorpay configuration or order creation failed. Redirecting to payment failed page.');
        isSubmittingRef.current = false;
        navigate('/payment-failed', { state: { total, isTakeAway: isTakeaway, formData, cart } });
        return;
      }

      const options = {
        key: razorpayKeyId,
        amount: rzpOrder.order.amount,
        currency: rzpOrder.order.currency,
        name: 'MaitreD',
        description: 'Food Order Payment',
        image: '',
        order_id: rzpOrder.order.id,
        handler: async function (response) {
          sessionStorage.setItem('chatbot_flow_stage', 'payment_done');
          localStorage.setItem('active_order_id', generatedOrderId);
          localStorage.setItem('active_order_type', isTakeaway ? 'takeaway' : 'dine-in');
          localStorage.setItem('active_table_number', tableNumber || '06');
          setFlowStage('ORDER_TRACKING');
          // On successful payment
          navigate(isTakeaway ? '/takeaway-order-success' : '/order-success', {
            state: {
              orderId: generatedOrderId,
              cartData: cart,
              subtotal, gst, total, formData, paymentMethod: 'Razorpay',
              autoTrack: true
            }
          });
        },
        prefill: {
          contact: formData.phone || ''
        },
        theme: {
          color: '#EAA639'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        console.error('Payment failed:', response.error);
        isSubmittingRef.current = false;
        navigate('/payment-failed', { state: { total, isTakeAway: isTakeaway, formData, cart } });
      });
      rzp.open();
      isSubmittingRef.current = false;

    } catch (err) {
      console.error('Payment error:', err);
      isSubmittingRef.current = false;
      navigate('/payment-failed', { state: { total, isTakeAway: isTakeaway, formData, cart } });
    }
  };

  const isManualPayment = location.state?.manualFlow || false;
  const initialMethod = location.state?.initialMethod || 'Cash';
  const grandTotalFromState = location.state?.grandTotal || (isManualPayment ? 418.20 : (total || 525.00));
  const subtotalFromState = location.state?.subtotal || (isManualPayment ? 340.00 : (subtotal || 500.00));

  useEffect(() => {
    if (location.state?.initialMethod) {
      setSelectedMethod(location.state.initialMethod);
    }
  }, [location.state?.initialMethod]);

  if (isManualPayment) {
    const isUpi = selectedMethod === 'UPI';

    const handleManualConfirm = () => {
      navigate('/order-success', {
        state: {
          manualFlow: true,
          isManualOrderConfirmed: true,
          orderId: '1042',
          prepTime: '15 – 20 Mins',
          paymentMethod: selectedMethod,
          total: 418.20,
          subtotal: 340.00
        }
      });
    };

    return (
      <div className="flow-page-bg">
        <div className="flow-top-breadcrumbs">
          {isUpi ? 'Maitre D · Manual UPI payment' : 'Maitre D · Manual cash payment'}
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

        <main className="manual-payment-center-wrap">
          <div className="manual-payment-card">
            <button
              className="manual-back-to-menu-btn"
              onClick={() => navigate('/dine-in')}
              type="button"
            >
              <i className="fa-solid fa-arrow-left" />
              <span>Back to Menu</span>
            </button>

            <h1 className="manual-payment-title">Payment</h1>
            <div className="manual-payment-subtitle">Choose Your Payment Method</div>

            {/* Payment Method Cards */}
            <div className="manual-pm-grid">
              <div
                className={`manual-pm-card ${selectedMethod === 'Cash' ? 'selected' : ''}`}
                onClick={() => setSelectedMethod('Cash')}
              >
                <div className="manual-pm-card-top">
                  <div className="manual-pm-icon-wrap">
                    <i className="fa-solid fa-money-bill-wave" />
                  </div>
                  <div className="flow-radio-circle">
                    {selectedMethod === 'Cash' && <div className="flow-radio-circle-inner" />}
                  </div>
                </div>
                <div className="manual-pm-card-title">Cash</div>
                <div className="manual-pm-card-sub">Pay at the counter</div>
              </div>

              <div
                className={`manual-pm-card ${selectedMethod === 'UPI' ? 'selected' : ''}`}
                onClick={() => setSelectedMethod('UPI')}
              >
                <div className="manual-pm-card-top">
                  <div className="manual-pm-icon-wrap" style={{ background: '#EAA639' }}>
                    <i className="fa-solid fa-mobile-screen-button" />
                  </div>
                  <div className="flow-radio-circle">
                    {selectedMethod === 'UPI' && <div className="flow-radio-circle-inner" />}
                  </div>
                </div>
                <div className="manual-pm-card-title">UPI</div>
                <div className="manual-pm-card-sub">GPay, phone pe, Paytym</div>
              </div>
            </div>

            {/* UPI QR & Calculation Section */}
            {isUpi ? (
              <div className="manual-upi-body-grid">
                {/* Left QR Box */}
                <div className="manual-upi-qr-card">
                  <div className="manual-upi-qr-frame">
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=maitred@upi&pn=MaitreD&am=418.20&cu=INR"
                      alt="UPI QR Code"
                      className="manual-upi-qr-image"
                    />
                    <div className="manual-upi-center-badge">
                      <i className="fa-solid fa-p" style={{ fontSize: '11px', color: '#fff' }} />
                    </div>
                  </div>
                  <div className="manual-upi-scan-text">SCAN HERE TO PAY!</div>
                </div>

                {/* Right Calculation Box */}
                <div className="manual-payment-calc-box upi-calc-box">
                  <div className="manual-calc-row">
                    <span>Sub total</span>
                    <span>Rs. 340.00</span>
                  </div>
                  <div className="manual-calc-row">
                    <span>Service Charge (5%)</span>
                    <span>Rs. 17.00</span>
                  </div>
                  <div className="manual-calc-row">
                    <span>GST (18%)</span>
                    <span>Rs. 61.20</span>
                  </div>
                  <div className="manual-calc-row">
                    <span>Service Charge (0)</span>
                    <span>Rs. 0</span>
                  </div>
                  <div className="manual-calc-row total-row">
                    <span>Total :</span>
                    <span>Rs. 418.20</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Cash Calculation Box */
              <div className="manual-payment-calc-box">
                <div className="manual-calc-row">
                  <span>Sub total</span>
                  <span>Rs. 340.00</span>
                </div>
                <div className="manual-calc-row">
                  <span>Service Charge (5%)</span>
                  <span>Rs. 17.00</span>
                </div>
                <div className="manual-calc-row">
                  <span>GST (18%)</span>
                  <span>Rs. 61.20</span>
                </div>
                <div className="manual-calc-row">
                  <span>Service Charge (0)</span>
                  <span>Rs. 0</span>
                </div>
                <div className="manual-calc-row total-row">
                  <span>Total :</span>
                  <span>Rs. 418.20</span>
                </div>
              </div>
            )}

            <button
              className="manual-confirm-btn"
              onClick={handleManualConfirm}
              type="button"
            >
              Confirm & Place Order
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flow-page-bg">
      <div className="flow-top-breadcrumbs">Maitre D · Payment</div>
      <Header
        tableNumber={tableNumber || '06'}
        menuWireframeHeader={true}
        showDateTime={true}
        showServiceBell={!isTakeaway}
        onTableClick={() => {
          const next = prompt('Enter Table Number:', tableNumber || '06');
          if (next) setTableNumber(next);
        }}
      />

      <main className="flow-two-col-layout">
        {/* Left Column: Choose Payment Method */}
        <section className="flow-card-panel flow-left-panel">
          <div className="flow-panel-header">
            <h1 className="flow-panel-title">Choose Payment Method</h1>
          </div>

          <div className="flow-payment-options">
            {/* Option 1: UPI / QR Code */}
            <div
              className={`flow-payment-option-card ${selectedMethod === 'UPI' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedMethod('UPI');
                sessionStorage.setItem('payment_method', 'UPI');
              }}
            >
              <div className="flow-pm-left">
                <div className="flow-radio-circle">
                  {selectedMethod === 'UPI' && <div className="flow-radio-circle-inner" />}
                </div>
                <div className="flow-pm-info">
                  <div className="flow-pm-title">UPI / QR Code</div>
                  <div className="flow-pm-sub">Google Pay, PhonePe, Paytm, BHIM</div>
                </div>
              </div>
              <div className="flow-pm-icon-right">
                <i className="fa-solid fa-qrcode" />
              </div>
            </div>

            {/* Option 2: Credit / Debit Card */}
            <div
              className={`flow-payment-option-card ${selectedMethod === 'Card' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedMethod('Card');
                sessionStorage.setItem('payment_method', 'Card');
              }}
            >
              <div className="flow-pm-left">
                <div className="flow-radio-circle">
                  {selectedMethod === 'Card' && <div className="flow-radio-circle-inner" />}
                </div>
                <div className="flow-pm-info">
                  <div className="flow-pm-title">Credit / Debit Card</div>
                  <div className="flow-pm-sub">Visa, Mastercard, RuPay, Maestro</div>
                </div>
              </div>
              <div className="flow-pm-icon-right">
                <i className="fa-regular fa-credit-card" />
              </div>
            </div>

            {/* Option 3: Pay at Counter (Cash / Card) */}
            <div
              className={`flow-payment-option-card ${selectedMethod === 'Cash' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedMethod('Cash');
                sessionStorage.setItem('payment_method', 'Cash');
              }}
            >
              <div className="flow-pm-left">
                <div className="flow-radio-circle">
                  {selectedMethod === 'Cash' && <div className="flow-radio-circle-inner" />}
                </div>
                <div className="flow-pm-info">
                  <div className="flow-pm-title">Pay at Counter (Cash / Card)</div>
                  <div className="flow-pm-sub">{isTakeaway ? 'Pay at pickup counter' : 'Generate token and pay cashier directly'}</div>
                </div>
              </div>
              <div className="flow-pm-icon-right">
                <i className="fa-solid fa-money-bill" />
              </div>
            </div>
          </div>

          {/* UPI QR Fast Scan Box (visible when UPI selected) */}
          {selectedMethod === 'UPI' && (
            <div className="flow-upi-scan-box">
              <div className="flow-upi-scan-label">UPI QR Fast Scan</div>
              <div className="flow-upi-scan-content">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=restaurant@bank&pn=MaitreD&am=525.00&cu=INR"
                  alt="UPI QR Code"
                  className="flow-qr-code-img"
                />
                <div className="flow-qr-info">
                  <div className="flow-qr-info-title">Scan this QR code using any UPI app on your phone</div>
                  <div className="flow-qr-info-desc">Once scanned, wait a few seconds while we confirm the transaction.</div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Summary & Pay */}
        <section className="flow-card-panel flow-right-panel">
          <div>
            <div className="flow-panel-header">
              <h2 className="flow-panel-title">Summary & Pay</h2>
            </div>

            <div className="flow-summary-box">
              <div className="flow-summary-row">
                <span>Total Amount</span>
                <span>Rs. {Number(grandTotalFromState).toFixed(2)}</span>
              </div>
              <div className="flow-summary-row">
                <span>{isTakeaway ? 'Order Type' : 'Table No.'}</span>
                <span>{isTakeaway ? 'Take Away' : `Table ${tableNumber || '06'}`}</span>
              </div>
              <div className="flow-summary-row">
                <span>Payment Mode</span>
                <span>{selectedMethod === 'UPI' ? 'UPI QR Code' : selectedMethod === 'Card' ? 'Credit / Debit Card' : 'Pay at Counter'}</span>
              </div>
            </div>

            <div className="flow-secure-badge">
              <i className="fa-solid fa-shield-halved" />
              <span>100% Secure Encrypted Payment Gateway</span>
            </div>
          </div>

          <div>
            <button
              className="flow-btn-primary"
              onClick={() => handleConfirm(selectedMethod === 'Card' ? 'Razorpay' : selectedMethod)}
              type="button"
            >
              <span>Pay Now (Rs. {Number(grandTotalFromState).toFixed(2)})</span>
              <i className="fa-solid fa-arrow-right" />
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                className="flow-back-link-btn"
                onClick={() => navigate(isTakeaway ? '/takeaway-checkout' : '/checkout', { state: location.state })}
                type="button"
              >
                Back to Checkout
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Payment;
