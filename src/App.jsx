import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Home from './pages/Home'
import Agent from './pages/Agent'
import DineIn from './pages/DineIn'
import TakeAway from './pages/TakeAway'
import Invoice from './pages/Invoice'

import Payment from './pages/Payment'
import OrderSuccess from './pages/OrderSuccess'
import PaymentFailed from './pages/PaymentFailed'

import TakeAwayPayment from './pages/TakeAwayPayment'
import TakeAwayOrderSuccess from './pages/TakeAwayOrderSuccess'
import Checkout from './pages/Checkout'
import { CartProvider } from './context/CartContext'
import { VoiceAgentProvider } from './context/VoiceAgentContext'
import AIAssistantOverlay from './components/AIAssistantOverlay'
import ActiveOrderGuard from './components/ActiveOrderGuard'
import ActiveOrderBanner from './components/ActiveOrderBanner'

function ActiveOrderRedirector() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const activeOrderId = localStorage.getItem('active_order_id');
    const activeOrderType = localStorage.getItem('active_order_type');
    const tableNumber = localStorage.getItem('active_table_number') || '06';

    if (activeOrderId) {
      const isSuccessPage = location.pathname === '/order-success' || location.pathname === '/takeaway-order-success';
      if (!isSuccessPage) {
        if (activeOrderType === 'takeaway') {
          navigate('/takeaway-order-success', { replace: true, state: { autoTrack: true, orderId: activeOrderId } });
        } else {
          navigate('/order-success', { replace: true, state: { autoTrack: true, orderId: activeOrderId, tableNumber } });
        }
      }
    }
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <VoiceAgentProvider>
        <CartProvider>
          <ActiveOrderRedirector />
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/" element={<Agent />} />
            <Route path="/dine-in" element={<DineIn />} />
            <Route path="/take-away" element={<TakeAway />} />
            <Route path="/invoice" element={<Invoice />} />
          <Route path="/checkout" element={<ActiveOrderGuard><Checkout isTakeaway={false} /></ActiveOrderGuard>} />
          <Route path="/payment" element={<ActiveOrderGuard><Payment /></ActiveOrderGuard>} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/payment-failed" element={<PaymentFailed />} />

          <Route path="/takeaway-checkout" element={<ActiveOrderGuard><Checkout isTakeaway={true} /></ActiveOrderGuard>} />
          <Route path="/takeaway-payment" element={<ActiveOrderGuard><TakeAwayPayment /></ActiveOrderGuard>} />
          <Route path="/takeaway-order-success" element={<TakeAwayOrderSuccess />} />
        </Routes>
        <ActiveOrderBanner />
        <AIAssistantOverlay />
        </CartProvider>
      </VoiceAgentProvider>
    </Router>
  )
}


export default App

