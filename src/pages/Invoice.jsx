import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AIAssistantOverlay from '../components/AIAssistantOverlay';
import '../styles/invoice.css';
const restaurantBgImg = `/assets/images/restaurant_bg.png`;
const udupiBannerImg = `/assets/images/udupi-banner.png`;

export default function Invoice({ embeddedData }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [rating, setRating] = useState(null);

  const data = embeddedData || location.state || {};
  const {
    cartData = [],
    subtotal = 0,
    gst = 0,
    finalTotal = 0,
    mobileNumber = 'WALK-IN',
    paymentMethod = 'CASH'
  } = data;

  const isEmbedded = !!embeddedData;

  const totalQty = cartData.reduce((acc, item) => acc + item.quantity, 0);
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const captureAndDownload = () => {
    const element = document.querySelector('.invoice-container');
    if (!element) return;

    const btnContainers = element.querySelectorAll('.download-btn-container');
    btnContainers.forEach(btn => btn.style.display = 'none');

    // Add a temporary style to ensure it captures well
    const originalBackground = element.style.background;
    element.style.background = '#f5f5f5';

    window.html2canvas(element, { scale: 2, useCORS: true }).then(canvas => {
      btnContainers.forEach(btn => btn.style.display = '');
      element.style.background = originalBackground;
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
      link.download = `dataudipi bill_${dateStr}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }).catch(err => {
      console.error('Download failed', err);
      btnContainers.forEach(btn => btn.style.display = '');
      element.style.background = originalBackground;
      window.print();
    });
  };

  const handleDownload = () => {
    if (!window.html2canvas) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => captureAndDownload();
      document.body.appendChild(script);
    } else {
      captureAndDownload();
    }
  };

  React.useEffect(() => {
    const handleVoiceDownload = () => {
      handleDownload();
    };
    document.addEventListener('download-invoice', handleVoiceDownload);
    document.addEventListener('trigger-download-bill', handleVoiceDownload);

    if (location.state?.autoDownload) {
      setTimeout(() => {
        handleDownload();
      }, 500);
    }

    return () => {
      document.removeEventListener('download-invoice', handleVoiceDownload);
      document.removeEventListener('trigger-download-bill', handleVoiceDownload);
    };
  }, [location.state]);

  // UPI payment string if method is UPI
  const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=dataudipi@upi%26pn=DataUdipi%26am=${finalTotal.toFixed(2)}%26cu=INR`;

  const content = (
    <div className="invoice-container" style={isEmbedded ? { margin: '0 auto' } : {}}>

      {/* Banner */}
      <div className="invoice-banner">
        <img src={restaurantBgImg} alt="Restaurant Background" className="banner-img" onError={(e) => e.target.style.display = 'none'} />
        <p className="banner-text">40 years of excellence</p>
        <div className="banner-indicators">
          <div className="indicator active"></div>
          <div className="indicator"></div>
          <div className="indicator"></div>
        </div>
      </div>

      {/* Header */}
      <div className="invoice-header">
        <img src={udupiBannerImg} alt="Data Udipi banner" className="invoice-logo" />
        <div className="invoice-address-bar">
          <span className="bold-text">Data Udipi :</span>
          <span className="address-text">MGR Nagar, Nesapakkam, Chennai, Tamil Nadu 600078</span>
          <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="location-link">
            📍 Location
          </a>
        </div>
      </div>


      {/* Invoice Section */}
      <div className="invoice-details">

        <div className="company-header">
          <p className="company-name">Data Udipi Limited</p>
          <p className="company-info"><span className="bold-text">Place Of Supply :</span> Data Udipi - 51, Anna Main Rd, Ponnambalam Colony, MGR Nagar, Nesapakkam, Chennai, Tamil Nadu 600078.</p>
          <p className="company-info">Regd. Office: Chennai.</p>
          <p className="company-gst">GSTIN NO: 29AAACT1836J1ZC</p>
        </div>

        <div className="invoice-title">
          TAX INVOICE
        </div>

        <div className="invoice-meta">
          <div className="meta-left">
            <span className="bold-text">Invoice No :</span> DU104-100034372te<br />
            <span className="bold-text">Counter :</span> 4<br />
            <span className="bold-text">Customer :</span> {mobileNumber === 'WALK-IN' ? 'WALK-IN' : 'REGISTERED'}<br />
            <span className="bold-text">Mobile No :</span> {mobileNumber}
          </div>
          <div className="meta-right">
            {formattedDate}
          </div>
        </div>

        {/* Items Table */}
        <div className="invoice-table">
          <div className="table-header">
            <div>Description</div>
            <div>Price</div>
            <div>QTY</div>
            <div>Net Amt</div>
          </div>
          {cartData.map((item, idx) => (
            <div className="table-row" key={idx}>
              <div>{item.name}</div>
              <div>₹{item.price.toFixed(2)}</div>
              <div>{String(item.quantity).padStart(3, '0')}</div>
              <div>₹{(item.price * item.quantity).toFixed(2)}</div>
            </div>
          ))}
          {cartData.length === 0 && (
            <div className="table-row" style={{ justifyContent: 'center', gridColumn: 'span 4' }}>
              <div>No items in bill</div>
            </div>
          )}
        </div>

        <div className="invoice-totals">
          <div className="totals-labels">
            <p>Gross Total :</p>
            <p>Discount Total :</p>
            <p>Total Invoice Amount :</p>
          </div>
          <div className="totals-values">
            <p>₹{subtotal.toFixed(2)}</p>
            <p>₹0.00</p>
            <p>₹{finalTotal.toFixed(2)}</p>
          </div>
        </div>



        <div className="payment-delivery">
          <p className="payment-title">Payment & Delivery</p>
          <div className="payment-row">
            <p>{paymentMethod.toUpperCase()}</p>
            <p className="bold-text">₹{finalTotal.toFixed(2)}</p>
          </div>
          <div className="payment-row total-received">
            <p className="bold-text">Total received<br />amount :</p>
            <p className="bold-text">₹{finalTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="items-summary">
          <p>No of items : {String(cartData.length).padStart(2, '0')}</p>
          <p>Total qty : {totalQty.toFixed(2)}</p>
        </div>


        <div className="invoice-terms">
          <p>No return / exchange on prepared food items.</p>
          <p>Thank you for dining with us!</p>
          <p>Call to Action: Love what's in? Explore more from Instagram</p>
          <p>Rewards: DATA UDIPI REWARDS - Scan for loyalty points and offers.</p>
          <p>Billing Provider: Digital billing powered by Razorpay</p>
        </div>
      </div>

      {/* Follow Us */}
      <div className="follow-us">
        <p className="follow-title">Follow Us On</p>
        {/* Replace this src with the colorful Instagram QR code image when you have it exported from Figma */}
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.instagram.com/data_udipi_restaurant/" alt="Instagram QR" className="social-qr" />
        <p className="insta-handle">@data_udipi_restaurant</p>

        <div className="download-btn-container">
          <button className="download-btn" onClick={handleDownload}>
            <i className="fa-solid fa-cloud-arrow-down" style={{ marginRight: '8px' }}></i> Download Bill
          </button>
        </div>
        <div className="download-btn-container" style={{ marginTop: '10px' }}>
          {!isEmbedded && (
            <button className="download-btn" style={{ backgroundColor: '#ff4e00' }} onClick={() => {
              sessionStorage.removeItem('chatbot_flow_stage');
              sessionStorage.removeItem('last_placed_order_id');
              navigate('/');
            }}>
              <i className="fa-solid fa-house" style={{ marginRight: '8px' }}></i> Back to Home
            </button>
          )}
        </div>
      </div>

    </div>
  );

  if (isEmbedded) return content;

  return (
    <div className="invoice-page">
      {content}
    </div>
  );
}
