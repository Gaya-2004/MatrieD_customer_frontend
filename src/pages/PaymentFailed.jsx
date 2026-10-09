import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import AIAssistantOverlay from '../components/AIAssistantOverlay';
import { useCart } from '../context/CartContext';
import '../styles/ordersuccess.css';

const PaymentFailed = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tableNumber } = useCart();
  const {
    total = 0,
    isTakeAway = false,
    formData = {},
    cart = []
  } = location.state || {};

  const handleTryAgain = () => {
    // Navigate back to the payment page, carrying forward the state (cart, total, customer info)
    const targetPath = isTakeAway ? '/takeaway-payment' : '/payment';
    navigate(targetPath, {
      state: location.state
    });
  };

  return (
    <div className="os-page">
      <div className="os-bg" />
      <Header tableNumber={tableNumber} showFullHeader={true} useTitleImage={true} showDateTime={true} hideTableIndicator={isTakeAway} />

      <main className="os-main">
        <div className="os-card">
          
          {/* Animated red cross mark */}
          <div className="os-tick-wrap">
            <svg className="os-checkmark failed" viewBox="0 0 52 52">
              <circle className="os-check-circle failed" cx="26" cy="26" r="25" fill="none" />
              <path className="os-check-path failed" fill="none" d="M16 16 L36 36 M36 16 L16 36" />
            </svg>
          </div>

          <h1 className="os-title" style={{ color: '#ff3b30' }}>Oops! Transaction Failed</h1>
          <p className="os-subtitle" style={{ fontSize: '15px', lineHeight: '1.5', margin: '10px 0 20px' }}>
            The payment transaction could not be processed.
          </p>

          {/* Failed payment metadata */}
          <div className="os-meta" style={{ background: '#fff5f5', border: '1px solid #ffebeb' }}>
            <div className="os-meta-item" style={{ borderColor: '#ffd6d6' }}>
              <span className="os-meta-label">Payment Method</span>
              <span className="os-meta-value" style={{ color: '#ff3b30' }}>UPI</span>
            </div>
            <div className="os-meta-item" style={{ borderColor: '#ffd6d6' }}>
              <span className="os-meta-label">Amount</span>
              <span className="os-meta-value" style={{ color: '#ff3b30' }}>Rs. {Number(total).toFixed(2)}</span>
            </div>
          </div>

          <p className="os-message" style={{ margin: '20px 0 24px', fontWeight: '500', color: '#555' }}>
            Please click "Try Again" to retry the payment or select another option.
          </p>

          <div className="os-actions">
            <button className="os-home-btn failed-btn" onClick={() => navigate('/')}>
              🏠 Back to Home
            </button>
            <button className="os-download-btn" style={{ background: '#ff3b30', boxShadow: '0 6px 24px rgba(255, 59, 48, 0.3)' }} onClick={handleTryAgain}>
              🔄 Try Again
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentFailed;
