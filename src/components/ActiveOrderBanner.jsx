import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ActiveOrderBanner = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [activeOrderType, setActiveOrderType] = useState(null);
  const [tableNumber, setTableNumber] = useState(null);

  const checkActiveOrder = () => {
    let id = localStorage.getItem('active_order_id');
    if (id === 'null' || id === 'undefined') id = null;
    setActiveOrderId(id);
    setActiveOrderType(localStorage.getItem('active_order_type'));
    setTableNumber(localStorage.getItem('active_table_number'));
  };

  useEffect(() => {
    checkActiveOrder();
    // Also check when location changes in case it was cleared
    window.addEventListener('storage', checkActiveOrder);
    return () => window.removeEventListener('storage', checkActiveOrder);
  }, [location.pathname]);

  const [isValidating, setIsValidating] = useState(false);
  const [isOrderValid, setIsOrderValid] = useState(true); // Assume true initially to prevent flicker

  useEffect(() => {
    let isMounted = true;
    const verifyOrder = async () => {
      if (!activeOrderId) return;
      setIsValidating(true);
      try {
        const selectedRestaurantId = localStorage.getItem('selected_restaurant_id') || '1';
        const res = await fetch(`/api/orders/${activeOrderId}?restaurant_id=${selectedRestaurantId}`);
        if (!res.ok) {
          if (res.status === 404 || res.status === 500) {
            localStorage.removeItem('active_order_id');
            localStorage.removeItem('active_order_type');
            localStorage.removeItem('active_table_number');
            if (isMounted) {
              setIsOrderValid(false);
              setActiveOrderId(null);
            }
          } else {
            if (isMounted) setIsOrderValid(false);
          }
          return;
        }
        const data = await res.json();
        const status = data.order?.status || data.status;
        if (['SERVED', 'COMPLETED', 'CANCELLED'].includes(status)) {
          localStorage.removeItem('active_order_id');
          localStorage.removeItem('active_order_type');
          localStorage.removeItem('active_table_number');
          if (isMounted) {
            setIsOrderValid(false);
            setActiveOrderId(null);
          }
        } else {
          if (isMounted) setIsOrderValid(true);
        }
      } catch (err) {
        console.warn("Failed to verify active order status");
      } finally {
        if (isMounted) setIsValidating(false);
      }
    };
    verifyOrder();
    return () => { isMounted = false; };
  }, [activeOrderId]);

  // Don't show the banner on the tracking pages themselves, or if invalid
  const hidePaths = ['/order-success', '/takeaway-order-success', '/invoice'];
  if (!activeOrderId || !isOrderValid || hidePaths.includes(location.pathname)) return null;

  const handleTrackClick = () => {
    if (activeOrderType === 'takeaway') {
      navigate('/takeaway-order-success', { state: { autoTrack: true, orderId: activeOrderId } });
    } else if (activeOrderType === 'dine-in') {
      navigate('/order-success', { state: { autoTrack: true, orderId: activeOrderId, tableNumber: tableNumber || '06' } });
    } else if (activeOrderType === 'agent') {
      navigate('/invoice', { state: { orderId: activeOrderId, autoDownload: false } });
    }
  };

  return (
    <div className="active-order-corner-widget" onClick={handleTrackClick} style={{
      position: 'fixed',
      top: '100px',
      right: '20px',
      backgroundColor: '#fff',
      border: '2px solid #ff4e00',
      borderRadius: '12px',
      boxShadow: '0 8px 25px rgba(255,78,0,0.25)',
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 9999,
      cursor: 'pointer',
      minWidth: '220px',
      animation: 'slideInRight 0.5s ease-out'
    }}>
      <style>
        {`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .active-order-corner-widget:hover {
            transform: translateY(-2px);
            boxShadow: 0 10px 30px rgba(255,78,0,0.3);
          }
        `}
      </style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>
          <i className="fa-solid fa-circle" style={{ color: '#00c853', fontSize: '8px', marginRight: '6px', animation: 'pulse 2s infinite' }}></i>
          Live Order
        </span>
        <span style={{ fontSize: '12px', color: '#999', fontWeight: 'bold' }}>#{activeOrderId.replace('ORD-', '').replace(/^0+/, '')}</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontWeight: 'bold', color: '#333', fontSize: '15px' }}>
          Track Status
        </span>
        <div style={{
          backgroundColor: '#ff4e00',
          color: 'white',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px'
        }}>
          <i className="fa-solid fa-arrow-right"></i>
        </div>
      </div>
    </div>
  );
};

export default ActiveOrderBanner;
