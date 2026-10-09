import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import { useCart } from '../context/CartContext';
import { useVoiceAgent } from '../context/VoiceAgentContext';
import '../styles/payment.css';

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
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
      navigate('/dine-in', { replace: true });
    }
  }, [cart, navigate]);

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
        table_number: tableNumber || '06',
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
        localStorage.setItem('active_order_type', 'dine-in');
        localStorage.setItem('active_table_number', tableNumber || '06');
        setFlowStage('ORDER_TRACKING');
        navigate('/order-success', {
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
        navigate('/order-success', {
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
      table_number: tableNumber || '06',
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
        navigate('/payment-failed', { state: { total, isTakeAway: false, formData, cart } });
        return;
      }

      const options = {
        key: razorpayKeyId,
        amount: rzpOrder.order.amount,
        currency: rzpOrder.order.currency,
        name: 'Data Udipi',
        description: 'Food Order Payment',
        image: '',
        order_id: rzpOrder.order.id,
        handler: async function (response) {
          sessionStorage.setItem('chatbot_flow_stage', 'payment_done');
          localStorage.setItem('active_order_id', generatedOrderId);
          localStorage.setItem('active_order_type', 'dine-in');
          localStorage.setItem('active_table_number', tableNumber || '06');
          setFlowStage('ORDER_TRACKING');
          // On successful payment
          navigate('/order-success', {
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
          color: '#ff4e00'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        console.error('Payment failed:', response.error);
        isSubmittingRef.current = false;
        navigate('/payment-failed', { state: { total, isTakeAway: false, formData, cart } });
      });
      rzp.open();
      isSubmittingRef.current = false;

    } catch (err) {
      console.error('Payment error:', err);
      isSubmittingRef.current = false;
      navigate('/payment-failed', { state: { total, isTakeAway: false, formData, cart } });
    }
  };

  return (
    <div className="payment-page">
      <div className="payment-bg" />
      <Header tableNumber={tableNumber} showFullHeader={true} useTitleImage={true} showDateTime={true} />

      <main className="payment-main">
        <div className="payment-card">
          <Link to="/checkout" state={location.state} className="payment-back-link">
            ← Back to Checkout
          </Link>

          <h2 className="payment-title">Payment</h2>
          <p className="payment-subtitle">Choose Your Payment Method</p>

          <div className="payment-methods">
            <div
              className={`payment-method-card ${selectedMethod === 'Cash' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedMethod('Cash');
                sessionStorage.setItem('payment_method', 'Cash');
              }}
            >
              <div className="pm-icon-wrap">
                <i className="fa-solid fa-money-bill-wave"></i>
              </div>
              <div>
                <p className="pm-name">Cash</p>
                <p className="pm-desc">Pay at the counter</p>
              </div>
            </div>
            <div
              className={`payment-method-card ${selectedMethod === 'UPI' ? 'selected' : ''}`}
              onClick={() => {
                setSelectedMethod('UPI');
                sessionStorage.setItem('payment_method', 'UPI');
              }}
            >
              <div className="pm-icon-wrap">
                <i className="fa-solid fa-mobile-screen-button"></i>
              </div>
              <div>
                <p className="pm-name">Online Payment</p>
                <p className="pm-desc">GPay, PhonePe, Cards, UPI</p>
              </div>
            </div>
          </div>

          <div className="payment-billing">
            <div className="pb-row">
              <span>Sub total</span>
              <span>Rs. {subtotal.toFixed(2)}</span>
            </div>
            <div className="pb-row pb-total">
              <span>Total :</span>
              <span>Rs. {total.toFixed(2)}</span>
            </div>
          </div>

          {/* CTA */}
          <button id="payment-confirm-btn" className="payment-confirm-btn" onClick={handleConfirm}>
            Confirm & Place Order
          </button>
        </div>
      </main>

      {totalItems > 0 && (
        <button className="pm-view-cart-btn" onClick={() => setIsCartOpen(true)}>
          <i className="fa-solid fa-cart-shopping" />
          <span>View Cart</span>
          <span className="pm-cart-badge">{totalItems}</span>
        </button>
      )}

      {/* Cart sidebar (Floating) - Exact Design Match */}
      {isCartOpen && (
        <div className="di-sidebar di-cart-mode active">
          <div className="di-cart-header">
            <div className="di-cart-header-left">
              <span className="di-cart-title">Cart</span>
              <span className="di-cart-table-pill">Table No : {tableNumber} <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.6rem' }} /></span>
            </div>
            <button className="di-cart-close" onClick={() => setIsCartOpen(false)}>✕</button>
          </div>
          <div className="di-cart-order-id"># New Order</div>

          <div className="di-order-type-tabs">
            <button className="di-ot-tab active"><i className="fa-solid fa-utensils" /> Dine In</button>
            <button className="di-ot-tab" onClick={() => navigate('/take-away')}><i className="fa-solid fa-bag-shopping" /> Take Away</button>
          </div>

          <div className="di-cart-items">
            {cart.length === 0
              ? <p className="di-cart-empty">Cart is empty. Add items from the menu.</p>
              : cart.map(item => (
                <div key={item.id} className="di-cart-item-container">
                  <button className="di-cart-remove-circle" onClick={() => removeCartItem(item.id)}>✕</button>
                  <div className="di-cart-item-body">
                    <div className="di-cart-item-thumb">
                      {item.image ? <img src={item.image} alt={item.name} /> : <span className="di-cart-thumb-emoji">{item.emoji || '🍽️'}</span>}
                    </div>
                    <div className="di-cart-item-details">
                      <p className="di-cart-item-name">{item.name}</p>
                      <p className="di-cart-serves">Serves : 1</p>
                      <p className="di-cart-item-price">Rs. {item.price}</p>
                    </div>
                    <div className="di-cart-item-right">
                      <p className="di-cart-total-label">Total</p>
                      <p className="di-cart-total-amount">{(item.price * item.quantity).toFixed(2)}</p>
                      <div className="di-cart-stepper">
                        <button className="di-cart-qty-btn minus" onClick={() => changeQty(item.id, -1)}>−</button>
                        <input
                          className="di-cart-qty-num"
                          type="text"
                          inputMode="numeric"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9]/g, '');
                            if (val === '') {
                              updateItemQuantity(item.id, '');
                              return;
                            }
                            const num = parseInt(val, 10);
                            if (!isNaN(num) && num >= 0) {
                              updateItemQuantity(item.id, num);
                            }
                          }}
                          onBlur={(e) => {
                            if (item.quantity === '' || parseInt(item.quantity, 10) === 0) {
                              updateItemQuantity(item.id, 0);
                            }
                          }}
                          style={{
                            width: '40px',
                            border: 'none',
                            textAlign: 'center',
                            background: 'transparent',
                            fontWeight: 'bold',
                            fontFamily: 'inherit',
                            fontSize: '1rem',
                            color: 'inherit',
                            outline: 'none'
                          }}
                        />
                        <button className="di-cart-qty-btn plus" onClick={() => changeQty(item.id, 1)}>+</button>
                      </div>
                    </div>
                  </div>
                  <div className="di-cart-note-wrap">
                    <input className="di-cart-note-input" placeholder="Please, Just a little bit spicy only...." value={item.note || ''} onChange={e => updateNote(item.id, e.target.value)} />
                  </div>
                </div>
              ))
            }
          </div>

          <div className="di-cart-footer">
            <button className="di-add-more-btn" onClick={() => navigate('/dine-in')}>
              <i className="fa-solid fa-plus" /> Add More Food
            </button>
            <button className="di-place-order-btn" onClick={() => setIsCartOpen(false)}>
              Close & Continue
            </button>
          </div>
        </div>
      )}

      {isPollingCash && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff'
        }}>
          <div className="spinner" style={{
            border: '4px solid rgba(255,255,255,0.3)', borderTop: '4px solid #ff4e00',
            borderRadius: '50%', width: '50px', height: '50px', animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h3 style={{ marginBottom: '10px' }}>Waiting for Cash Payment...</h3>
          <p>Please pay at the counter. The order will be placed once payment is confirmed.</p>
        </div>
      )}

    </div>
  );
};

export default Payment;
