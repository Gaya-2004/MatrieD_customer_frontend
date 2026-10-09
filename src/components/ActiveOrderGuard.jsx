import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const ActiveOrderGuard = ({ children }) => {
  const activeOrderId = localStorage.getItem('active_order_id');
  const activeOrderType = localStorage.getItem('active_order_type');
  const tableNumber = localStorage.getItem('active_table_number');

  // If there's an active order, redirect to the corresponding tracking page
  if (activeOrderId) {
    if (activeOrderType === 'takeaway') {
      return <Navigate to="/takeaway-order-success" state={{ autoTrack: true, orderId: activeOrderId }} replace />;
    } else if (activeOrderType === 'dine-in') {
      return <Navigate to="/order-success" state={{ autoTrack: true, orderId: activeOrderId, tableNumber: tableNumber || '06' }} replace />;
    } else if (activeOrderType === 'agent') {
      // For agent orders, we just redirect back to the home page or invoice
      return <Navigate to="/invoice" state={{ orderId: activeOrderId, autoDownload: false }} replace />;
    }
  }

  // Otherwise, render the requested component
  return children;
};

export default ActiveOrderGuard;
