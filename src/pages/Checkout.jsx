import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import { useCart } from '../context/CartContext';
import '../styles/checkout.css';
import '../styles/flow_screens.css';
import { useLanguage } from '../context/LanguageContext';
import { useVoiceAgent } from '../context/VoiceAgentContext';
const Checkout = ({ isTakeaway }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  const { agentState, setFlowStage, isAgentOpen } = useVoiceAgent();
  const autoFillRef = useRef(false);
  const {
    cart,
    addToCart,
    subtotal,
    totalAmount: total,
    tableNumber,
    changeQty,
    updateItemQuantity,
    isCartOpen,
    setIsCartOpen
  } = useCart();

  // Priority: VoiceAgentContext > location.state > sessionStorage
  const [formData, setFormData] = useState(() => ({
    name:  agentState?.customerName  || location.state?.formData?.name  || sessionStorage.getItem('customer_name')  || '',
    phone: agentState?.mobileNumber  || location.state?.formData?.phone || sessionStorage.getItem('customer_phone') || ''
  }));
  const isAgentFilled = !!(agentState?.customerName && agentState?.mobileNumber);

  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [autoTransitioning, setAutoTransitioning] = useState(false);
  const [countdown, setCountdown] = useState(null);

  // Cart items sync

  // Sync agent-provided data when context updates
  useEffect(() => {
    if (agentState?.customerName && agentState?.mobileNumber && !autoFillRef.current) {
      setFormData({ name: agentState.customerName, phone: agentState.mobileNumber });
    }
  }, [agentState?.customerName, agentState?.mobileNumber]);

  // Auto-transition to payment when agent navigates to checkout
  useEffect(() => {
    if (!isAgentFilled) return;
    if (agentState?.flowStage === 'CHECKOUT_REVIEW') {
      setAutoTransitioning(true);
      let c = 3;
      setCountdown(c);
      const tick = setInterval(() => {
        c -= 1;
        setCountdown(c);
        if (c <= 0) {
          clearInterval(tick);
          const paymentRoute = isTakeaway ? '/takeaway-payment' : '/payment';
          setFlowStage('PAYMENT_SELECT');
          navigate(paymentRoute, { state: { ...location.state, formData } });
        }
      }, 1000);
      return () => clearInterval(tick);
    }
  }, [agentState?.flowStage, isAgentFilled]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      const onlyNums = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({ ...prev, [name]: onlyNums }));
      sessionStorage.setItem('customer_phone', onlyNums);

      if (hasAttemptedSubmit) {
        if (!/^\d{10}$/.test(onlyNums)) {
          setPhoneError(language === 'Tamil' ? 'தயவுசெய்து சரியான தொலைபேசி எண்ணை உள்ளிடவும்.' : 'Please enter a valid phone number.');
        } else {
          setPhoneError('');
        }
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'name') {
      sessionStorage.setItem('customer_name', value);
    }

    if (hasAttemptedSubmit && name === 'name') {
      if (!value.trim()) {
        setNameError(language === 'Tamil' ? 'தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்.' : 'Please enter your full name.');
      } else {
        setNameError('');
      }
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      sessionStorage.setItem('customer_phone', value);
      if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
        setPhoneError(language === 'Tamil' ? 'தயவுசெய்து சரியான தொலைபேசி எண்ணை உள்ளிடவும்.' : 'Please enter a valid phone number.');
      } else {
        setPhoneError('');
      }
    }
    if (name === 'name') {
      sessionStorage.setItem('customer_name', value);
      if (!formData.name.trim()) {
        setNameError(language === 'Tamil' ? 'தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்.' : 'Please enter your full name.');
      } else {
        setNameError('');
      }
    }
  };


  useEffect(() => {
    const handleUpdateName = (e) => {
      if (e.detail && e.detail.name) {
        setFormData(prev => ({ ...prev, name: e.detail.name }));
      }
    };
    const handleUpdatePhone = (e) => {
      if (e.detail && e.detail.phone) {
        const cleanedPhone = String(e.detail.phone).replace(/\D/g, '');
        if (/^\d{10}$/.test(cleanedPhone)) {
          setFormData(prev => ({ ...prev, phone: cleanedPhone }));
        }
      }
    };

    const handleContinueToPayment = (e) => {
      setFormData(currentFormData => {
        setHasAttemptedSubmit(true);
        let valid = true;

        if (!currentFormData.name.trim()) {
          setNameError(language === 'Tamil' ? 'தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்.' : 'Please enter your full name.');
          valid = false;
        } else {
          setNameError('');
        }

        if (!/^\d{10}$/.test(currentFormData.phone)) {
          setPhoneError(language === 'Tamil' ? 'தயவுசெய்து சரியான தொலைபேசி எண்ணை உள்ளிடவும்.' : 'Please enter a valid phone number.');
          valid = false;
        } else {
          setPhoneError('');
        }

        if (!valid) {
          return currentFormData;
        }

        const paymentRoute = isTakeaway ? '/takeaway-payment' : '/payment';
        navigate(paymentRoute, {
          state: {
            ...(location.state || {}),
            formData: currentFormData,
            autoConfirmMethod: e?.detail?.autoConfirm ? e.detail.method : undefined
          }
        });
        return currentFormData;
      });
    };

    document.addEventListener('update-name', handleUpdateName);
    document.addEventListener('update-phone', handleUpdatePhone);
    document.addEventListener('continue-to-payment', handleContinueToPayment);

    return () => {
      document.removeEventListener('update-name', handleUpdateName);
      document.removeEventListener('update-phone', handleUpdatePhone);
      document.removeEventListener('continue-to-payment', handleContinueToPayment);
    };
  }, [navigate, isTakeaway, location.state, language]);

  const handleContinue = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setHasAttemptedSubmit(true);
    let valid = true;

    if (!formData.name.trim()) {
      setNameError(language === 'Tamil' ? 'தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்.' : 'Please enter your full name.');
      valid = false;
    } else {
      setNameError('');
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      setPhoneError(language === 'Tamil' ? 'தயவுசெய்து சரியான தொலைபேசி எண்ணை உள்ளிடவும்.' : 'Please enter a valid phone number.');
      valid = false;
    } else {
      setPhoneError('');
    }

    if (!valid) {
      return;
    }
    const paymentRoute = isTakeaway ? '/takeaway-payment' : '/payment';
    navigate(paymentRoute, {
      state: {
        ...(location.state || {}),
        formData: formData
      }
    });
  };

  const [cookingInstructions, setCookingInstructions] = useState('');

  // Pre-populate with default items from screenshot if cart is empty or only 1 item
  useEffect(() => {
    if (cart.length === 0) {
      // Seed Onion Rava Dosa x 2, Chicken Biryani x 1, Special Filter Coffee x 2
      const dosa = {
        id: 101,
        name: 'Onion Rava Dosa',
        tamilName: 'வெங்காய ரவா தோசை',
        category: 'dosa',
        price: 100,
        description: 'Crispy semolina dosa with fine chopped onions, green chillies & spice blend.',
        image: '/assets/images/dishes/onion_rava_dosa.png',
        serves: '1'
      };
      const biryani = {
        id: 9,
        name: 'Chicken Biryani',
        tamilName: 'சிக்கன் பிரியாணி',
        category: 'rice',
        price: 210,
        description: 'Aromatic basmati rice with marinated chicken, spices and herbs.',
        image: '/assets/images/dishes/chicken_biryani.png',
        serves: '1',
        note: 'Please, Just a little bit spicy only....'
      };
      const coffee = {
        id: 11,
        name: 'Special Filter Coffee',
        tamilName: 'ஸ்பெஷல் பில்டர் காபி',
        category: 'beverages',
        price: 45,
        description: 'Authentic South Indian chicory-blend coffee frothed with hot milk.',
        image: '/assets/images/dishes/special_filter_coffee.png',
        serves: '1'
      };

      addToCart(dosa, 2);
      addToCart(biryani, 1);
      addToCart(coffee, 2);
    }
  }, []);

  const totalCalculated = cart.reduce((s, c) => s + (Number(c.price) || 0) * (Number(c.quantity) || 0), 0);
  const subtotalVal = totalCalculated > 0 ? totalCalculated : 500.00;
  const cgstVal = Number((subtotalVal * 0.025).toFixed(2));
  const sgstVal = Number((subtotalVal * 0.025).toFixed(2));
  const grandTotalVal = Number((subtotalVal + cgstVal + sgstVal).toFixed(2));
  const isManualCheckout = location.state?.manualFlow || false;
  const backLink = isTakeaway ? '/take-away' : '/dine-in';
  const totalItemCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  // For manual checkout (Screen 9): Onion Rava Dosa (Rs. 100) + Butter Chicken (Rs. 240) = Subtotal Rs. 340
  const manualSubtotal = 340.00;
  const manualServiceCharge = 17.00; // 5%
  const manualGst = 61.20; // 18%
  const manualTotal = 418.20;

  const handleManualContinue = () => {
    navigate('/payment', {
      state: {
        manualFlow: true,
        subtotal: manualSubtotal,
        serviceCharge: manualServiceCharge,
        gst: manualGst,
        grandTotal: manualTotal,
        formData: {
          name: formData.name || 'Jon',
          phone: formData.phone || '',
          table: tableNumber || '06',
          instructions: cookingInstructions || 'less spicy,No Onions'
        }
      }
    });
  };

  const handleProceedToPayment = () => {
    navigate(isTakeaway ? '/takeaway-payment' : '/payment', {
      state: {
        ...(location.state || {}),
        formData,
        cookingInstructions,
        subtotal: subtotalVal,
        cgst: cgstVal,
        sgst: sgstVal,
        grandTotal: grandTotalVal,
        cartData: cart
      }
    });
  };

  if (isManualCheckout) {
    return (
      <div className="flow-page-bg">
        <div className="flow-top-breadcrumbs">Maitre D · Manual checkout</div>
        <Header
          tableNumber={tableNumber || '06'}
          menuWireframeHeader={true}
          showDateTime={true}
          onTableClick={() => {
            const next = prompt('Enter Table Number:', tableNumber || '06');
            if (next) setTableNumber(next);
          }}
        />

        <main className="manual-checkout-container">
          {/* Left Column: Customer Details */}
          <section className="manual-checkout-left">
            <button
              className="manual-back-to-menu-btn"
              onClick={() => navigate('/dine-in?flow=8')}
              type="button"
            >
              <i className="fa-solid fa-arrow-left" />
              <span>Back to Menu</span>
            </button>

            <h1 className="manual-checkout-title">Checkout</h1>
            <div className="manual-checkout-subtitle">Dine In Order</div>

            <div className="manual-section-heading">Customer details</div>

            <div className="manual-form-group">
              <label className="manual-form-label">FULL NAME*</label>
              <input
                type="text"
                className="manual-form-input"
                placeholder="Jon"
                value={formData.name || 'Jon'}
                onChange={handleChange}
                name="name"
              />
            </div>

            <div className="manual-form-group">
              <label className="manual-form-label">PHONE NUMBER*</label>
              <input
                type="tel"
                className="manual-form-input"
                placeholder="10 digit number"
                value={formData.phone || ''}
                onChange={handleChange}
                name="phone"
                maxLength="10"
              />
            </div>

            <div className="manual-form-group">
              <label className="manual-form-label">TABLE NO*</label>
              <input
                type="text"
                className="manual-form-input readonly"
                value={tableNumber || '06'}
                readOnly
              />
            </div>

            <div className="manual-form-group">
              <label className="manual-form-label">SPECIAL INSTRUCTIONS</label>
              <textarea
                className="manual-form-textarea"
                placeholder="less spicy,No Onions"
                value={cookingInstructions || 'less spicy,No Onions'}
                onChange={(e) => setCookingInstructions(e.target.value)}
              />
            </div>
          </section>

          {/* Right Column: Order Summary */}
          <section className="manual-checkout-right">
            <div>
              <div className="manual-summary-heading">Order Summary</div>

              <div className="manual-summary-item-card">
                <div className="manual-summary-item-header">
                  <span>Onion Rava Dosa</span>
                  <span>Rs. 100</span>
                </div>
                <div className="manual-summary-item-sub">
                  Crispy, lacy semolina crepes infused with sautéed onions, green chilies.
                </div>
              </div>

              <div className="manual-summary-item-card">
                <div className="manual-summary-item-header">
                  <span>Butter Chicken</span>
                  <span>Rs. 240</span>
                </div>
                <div className="manual-summary-item-sub">
                  Tender chicken in buttery tomato gravy with basmati rice.
                </div>
              </div>

              <div className="manual-calc-rows">
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

            <div>
              <button
                className="manual-continue-btn"
                onClick={handleManualContinue}
                type="button"
              >
                Continue to Payment
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="flow-page-bg">
      <div className="flow-top-breadcrumbs">Maitre D · Cart</div>
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
        {/* Left Column: Your Cart (X Items) */}
        <section className="flow-card-panel flow-left-panel">
          <div className="flow-panel-header">
            <h1 className="flow-panel-title">Your Cart ({totalItemCount || cart.length} Items)</h1>
            <button
              className="flow-continue-link"
              onClick={() => navigate(backLink)}
              type="button"
            >
              Continue Ordering ›
            </button>
          </div>

          <div className="flow-cart-list">
            {cart.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                padding: '48px 24px',
                textAlign: 'center',
                gap: '14px',
                color: '#71717a'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(234, 166, 57, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EAA639',
                  fontSize: '1.6rem'
                }}>
                  <i className="fa-solid fa-basket-shopping" />
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#18181b' }}>Your cart is empty</div>
                <div style={{ fontSize: '0.88rem', maxWidth: '280px', color: '#71717a', lineHeight: 1.4 }}>
                  Looks like you haven&apos;t added any delicious dishes yet.
                </div>
                <button
                  type="button"
                  onClick={() => navigate(backLink)}
                  style={{
                    marginTop: '8px',
                    background: '#EAA639',
                    color: '#1e1e1e',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '10px 24px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(234, 166, 57, 0.3)'
                  }}
                >
                  Explore Menu
                </button>
              </div>
            ) : (
              cart.map((item) => {
                const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                return (
                  <div key={item.id} className="flow-cart-item-card">
                    <img
                      src={item.image || '/assets/images/dishes/chicken_biryani.png'}
                      alt={item.name}
                      className="flow-cart-item-thumb"
                    />

                    <div className="flow-cart-item-details">
                      <div className="flow-cart-item-name">{item.name}</div>
                      <div className="flow-cart-item-desc">{item.description}</div>
                      <div className="flow-cart-item-unit-price">Rs. {item.price}</div>
                    </div>

                    <div className="flow-stepper-box">
                      <button
                        className="flow-stepper-btn-minus"
                        onClick={() => changeQty(item.id, -1)}
                        type="button"
                        title="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="flow-stepper-val">{item.quantity}</span>
                      <button
                        className="flow-stepper-btn-plus"
                        onClick={() => changeQty(item.id, 1)}
                        type="button"
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <div className="flow-cart-item-total-col">
                      <div className="flow-cart-item-total-price">Rs. {itemTotal}</div>
                      <div className="flow-cart-item-tax-incl">Tax Incl.</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column: Bill Summary */}
        <section className="flow-card-panel flow-right-panel">
          <div>
            <div className="flow-panel-header">
              <h2 className="flow-panel-title">Bill Summary</h2>
            </div>

            <div className="flow-bill-rows">
              <div className="flow-bill-row">
                <span>Subtotal</span>
                <span>Rs. {subtotalVal.toFixed(2)}</span>
              </div>
              <div className="flow-bill-row">
                <span>CGST (2.5%)</span>
                <span>Rs. {cgstVal.toFixed(2)}</span>
              </div>
              <div className="flow-bill-row">
                <span>SGST (2.5%)</span>
                <span>Rs. {sgstVal.toFixed(2)}</span>
              </div>
              <div className="flow-bill-row grand-total">
                <span>Grand Total</span>
                <span>Rs. {grandTotalVal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flow-cooking-box">
              <div className="flow-cooking-title">Add Cooking Instructions</div>
              <textarea
                className="flow-cooking-textarea"
                placeholder="E.g., Make the rava dosa extra crisp, less spicy..."
                value={cookingInstructions}
                onChange={(e) => setCookingInstructions(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              className="flow-btn-primary"
              onClick={handleProceedToPayment}
              type="button"
            >
              <span>Proceed to Payment</span>
              <i className="fa-solid fa-arrow-right" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Checkout;
