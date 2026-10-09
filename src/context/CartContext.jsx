import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const location = useLocation();
  const isTakeaway = location.pathname.includes('takeaway') || location.pathname.includes('take-away');
  const [carts, setCarts] = useState(() => {
    localStorage.removeItem('udipi_carts_v2');
    const saved = sessionStorage.getItem('udipi_carts_session_v2');
    try {
      if (saved && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        return typeof parsed === 'object' && parsed !== null ? parsed : { takeaway: [] };
      }
    } catch (e) {
      console.error("Cart init error:", e);
    }
    return { takeaway: [] };
  });

  const [tableNumber, setTableNumberState] = useState(() => {
    let tableParam = new URLSearchParams(window.location.search).get('table');
    if (!tableParam && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1];
      tableParam = new URLSearchParams(hashQuery).get('table');
    }
    if (tableParam) {
      const cleanTable = tableParam.replace(/\D/g, '');
      localStorage.setItem('active_table_number', cleanTable);
      return cleanTable;
    }
    const saved = localStorage.getItem('active_table_number') || '06';
    return saved.replace(/\D/g, '');
  });

  const setTableNumber = (num) => {
    const oldTable = localStorage.getItem('active_table_number') || '06';
    const oldKey = `dinein_${oldTable}`;
    const newKey = `dinein_${num}`;
    
    localStorage.setItem('active_table_number', num);
    setTableNumberState(num);

    if (oldKey !== newKey) {
      setCarts(prev => {
        const oldCart = prev[oldKey] || [];
        const newCart = prev[newKey] || [];
        if (oldCart.length > 0 && newCart.length === 0) {
          return {
            ...prev,
            [newKey]: [...oldCart],
            [oldKey]: []
          };
        }
        return prev;
      });
    }
  };

  const getActiveKeys = () => {
    const isTakeawayCurrent = window.location.pathname.includes('takeaway') || window.location.pathname.includes('take-away');
    const activeTable = localStorage.getItem('active_table_number') || '06';
    const dynDineinKey = `dinein_${activeTable}`;
    return {
      isTakeawayCurrent,
      dynDineinKey,
      dynCartKey: isTakeawayCurrent ? 'takeaway' : dynDineinKey
    };
  };

  const dineinKey = `dinein_${tableNumber}`;
  const cartKey = isTakeaway ? 'takeaway' : dineinKey;

  useEffect(() => {
    let tableParam = new URLSearchParams(location.search).get('table');
    if (!tableParam && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1];
      tableParam = new URLSearchParams(hashQuery).get('table');
    }
    if (tableParam) {
      const cleanTable = tableParam.replace(/\D/g, '');
      localStorage.setItem('active_table_number', cleanTable);
      setTableNumber(cleanTable);
    }
  }, [location.search, location.hash]);



  useEffect(() => {
    sessionStorage.setItem('udipi_carts_session_v2', JSON.stringify(carts));
  }, [carts]);

  const cart = carts[cartKey] || [];

  const setCart = (newCartOrUpdater) => {
    setCarts((prev) => {
      const currentCart = prev[cartKey] || [];
      const updatedCart = typeof newCartOrUpdater === 'function' ? newCartOrUpdater(currentCart) : newCartOrUpdater;
      return { ...prev, [cartKey]: updatedCart };
    });
  };

  const addToCart = (item, initialQuantity = 1) => {
    console.log("addToCart called with item:", item.name, "qty:", initialQuantity, "stack:", new Error().stack);
    const q = isNaN(Number(initialQuantity)) ? 1 : Number(initialQuantity);
    const updateHelper = (prevList) => {
      const existing = prevList.find((c) => c.id === item.id);
      if (existing) {
        return prevList.map((c) =>
          c.id === item.id ? { ...c, ...item, quantity: (Number(c.quantity) || 0) + q } : c
        );
      }
      return [...prevList, { ...item, quantity: q, note: '' }];
    };

    setCarts((prev) => {
      const { isTakeawayCurrent, dynDineinKey, dynCartKey } = getActiveKeys();
      const currentCart = prev[dynCartKey] || [];
      const updatedCart = updateHelper(currentCart);
      const otherKey = isTakeawayCurrent ? dynDineinKey : 'takeaway';
      const otherCart = (!prev[otherKey] || prev[otherKey].length === 0) ? updatedCart : prev[otherKey];
      return { ...prev, [dynCartKey]: updatedCart, [otherKey]: otherCart };
    });
  };

  const syncCartToOtherMode = (targetMode) => {
    const isTargetTakeaway = String(targetMode).toLowerCase().includes('takeaway') || String(targetMode).toLowerCase().includes('take-away');
    setCarts(prev => {
      const { dynDineinKey } = getActiveKeys();
      const targetKey = isTargetTakeaway ? 'takeaway' : dynDineinKey;
      const sourceKey = isTargetTakeaway ? dynDineinKey : 'takeaway';
      const sourceCart = prev[sourceKey] || [];
      const currentTarget = prev[targetKey] || [];
      return {
        ...prev,
        [targetKey]: sourceCart.length > 0 ? [...sourceCart] : currentTarget
      };
    });
  };

  const changeQty = (id, delta) => {
    const d = isNaN(Number(delta)) ? 0 : Number(delta);
    setCarts((prev) => {
      const { dynDineinKey } = getActiveKeys();
      const updater = (list) => (list || [])
        .map((c) => (c.id === id ? { ...c, quantity: Math.max(0, (Number(c.quantity) || 0) + d) } : c))
        .filter((c) => c.quantity > 0);
      return { ...prev, [dynDineinKey]: updater(prev[dynDineinKey]), takeaway: updater(prev.takeaway) };
    });
  };

  const updateItemQuantity = (id, quantity) => {
    const q = isNaN(Number(quantity)) ? -1 : Number(quantity);
    if (q < 0) return;
    setCarts((prev) => {
      const { dynDineinKey } = getActiveKeys();
      const updater = (list) => {
        if (q === 0) return (list || []).filter((c) => c.id !== id);
        return (list || []).map((c) => (c.id === id ? { ...c, quantity: q } : c));
      };
      return { ...prev, [dynDineinKey]: updater(prev[dynDineinKey]), takeaway: updater(prev.takeaway) };
    });
  };

  const removeCartItem = (id) => {
    setCarts((prev) => {
      const { dynDineinKey } = getActiveKeys();
      return {
        ...prev,
        [dynDineinKey]: (prev[dynDineinKey] || []).filter((c) => c.id !== id),
        takeaway: (prev.takeaway || []).filter((c) => c.id !== id)
      };
    });
  };

  const updateNote = (id, note) => {
    setCarts((prev) => {
      const { dynDineinKey } = getActiveKeys();
      return {
        ...prev,
        [dynDineinKey]: (prev[dynDineinKey] || []).map((c) => (c.id === id ? { ...c, note } : c)),
        takeaway: (prev.takeaway || []).map((c) => (c.id === id ? { ...c, note } : c))
      };
    });
  };

  const clearCart = () => {
    setCarts(prev => {
      const { dynDineinKey } = getActiveKeys();
      return { ...prev, [dynDineinKey]: [], takeaway: [] };
    });
  };

  const clearAllCarts = () => {
    setCarts({ dinein: [], takeaway: [] });
  };

  const totalItems = cart.length;
  const subtotal = cart.reduce((s, c) => s + (Number(c.price) || 0) * (Number(c.quantity) || 0), 0);
  const serviceCharge = 0;
  const gst = 0;
  const totalAmount = subtotal;

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  useEffect(() => {
    const checkActive = () => {
      setHasActiveOrder(!!localStorage.getItem('active_order_id'));
    };
    checkActive();
    window.addEventListener('storage', checkActive);
    return () => window.removeEventListener('storage', checkActive);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,
        addToCart,
        syncCartToOtherMode,
        changeQty,
        updateItemQuantity,
        removeCartItem,
        updateNote,
        clearCart,
        clearAllCarts,
        totalItems,
        subtotal,
        serviceCharge,
        gst,
        totalAmount,
        tableNumber,
        setTableNumber,
        isCartOpen,
        setIsCartOpen,
        activeCategory,
        setActiveCategory,
        hasActiveOrder
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
