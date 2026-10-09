/**
 * VoiceAgentContext.jsx
 * Central state manager for the entire voice-agent ordering journey.
 *
 * KEY RULES:
 * - No database access. Ever.
 * - chatbot MCP is READ-ONLY: may fetch menu/categories/order-status.
 * - Orders/payments are created only through the existing frontend flow.
 * - Every browser tab gets a unique conversationSessionId.
 * - State persists to sessionStorage keyed by sessionId → tab isolation.
 */
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  validateIndianPhone,
  extractName,
  derivePageContext,
  getMissingFields,
  getFlowStageForPage,
} from '../utils/voiceAgentUtils';

const VoiceAgentContext = createContext(null);

// ── Session ID — unique per browser tab ──────────────────────────────────
function getOrCreateSessionId() {
  let sid = sessionStorage.getItem('va_session_id');
  if (!sid) {
    sid = `va_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('va_session_id', sid);
  }
  return sid;
}

const SESSION_ID = getOrCreateSessionId();
const STORAGE_KEY = `va_state_${SESSION_ID}`;

// ── Flow stage list ───────────────────────────────────────────────────────
export const FLOW_STAGES = [
  'GREETING', 'COLLECT_NAME', 'COLLECT_PHONE', 'CONFIRM_CUSTOMER',
  'SELECT_ORDER_TYPE', 'COLLECT_TABLE', 'ORDER_BUILDING',
  'WAITING_FOR_ORDER_COMPLETION', 'REVIEW_ORDER', 'CHECKOUT',
  'CHECKOUT_REVIEW', 'PAYMENT_SELECT', 'PAYMENT_PROCESSING',
  'ORDER_PLACED', 'LIVE_ORDER', 'ORDER_TRACKING', 'ORDER_SERVED',
  'FEEDBACK', 'COMPLETED', 'ERROR',
];

// ── Valid stage transitions (application controls these) ──────────────────
const VALID_TRANSITIONS = {
  GREETING:            ['COLLECT_NAME', 'COLLECT_PHONE', 'SELECT_ORDER_TYPE', 'ORDER_BUILDING', 'GREETING'],
  SELECT_ORDER_TYPE:   ['ORDER_BUILDING', 'COLLECT_TABLE', 'COLLECT_NAME', 'COLLECT_PHONE'],
  ORDER_BUILDING:      ['ORDER_BUILDING', 'WAITING_FOR_ORDER_COMPLETION', 'COLLECT_TABLE', 'COLLECT_NAME', 'COLLECT_PHONE', 'REVIEW_ORDER', 'CHECKOUT_REVIEW'],
  COLLECT_TABLE:       ['ORDER_BUILDING', 'COLLECT_NAME', 'COLLECT_PHONE'],
  COLLECT_NAME:        ['COLLECT_PHONE', 'SELECT_ORDER_TYPE', 'ORDER_BUILDING', 'GREETING', 'COLLECT_NAME'],
  COLLECT_PHONE:       ['CONFIRM_CUSTOMER', 'CHECKOUT_REVIEW', 'ORDER_BUILDING', 'SELECT_ORDER_TYPE', 'GREETING', 'COLLECT_NAME', 'COLLECT_PHONE'],
  CONFIRM_CUSTOMER:    ['CHECKOUT_REVIEW', 'ORDER_BUILDING', 'SELECT_ORDER_TYPE'],
  WAITING_FOR_ORDER_COMPLETION: ['REVIEW_ORDER', 'COLLECT_TABLE', 'COLLECT_NAME', 'COLLECT_PHONE', 'CHECKOUT_REVIEW'],
  REVIEW_ORDER:        ['CHECKOUT_REVIEW', 'ORDER_BUILDING'],
  CHECKOUT:            ['CHECKOUT_REVIEW', 'PAYMENT_SELECT'],
  CHECKOUT_REVIEW:     ['PAYMENT_SELECT', 'ORDER_BUILDING'],
  PAYMENT_SELECT:      ['PAYMENT_PROCESSING', 'CHECKOUT_REVIEW'],
  PAYMENT_PROCESSING:  ['ORDER_PLACED', 'ERROR'],
  ORDER_PLACED:        ['LIVE_ORDER', 'ORDER_TRACKING'],
  LIVE_ORDER:          ['ORDER_TRACKING', 'ORDER_SERVED'],
  ORDER_TRACKING:      ['ORDER_SERVED', 'LIVE_ORDER'],
  ORDER_SERVED:        ['FEEDBACK', 'COMPLETED'],
  FEEDBACK:            ['COMPLETED'],
  COMPLETED:           ['GREETING'],     // new order session
  ERROR:               ['GREETING', 'ORDER_BUILDING'],
};

function isTransitionAllowed(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return true; // unknown stage → permissive
  return allowed.includes(to);
}

// ── Initial state ─────────────────────────────────────────────────────────
const INITIAL_STATE = {
  conversationSessionId: SESSION_ID,
  flowStage: 'GREETING',
  customerName: null,
  mobileNumber: null,
  orderType: null,
  tableNumber: null,
  orderId: null,
  paymentMethod: null,
  paymentStatus: 'pending',
  orderStatus: null,
  detectedLanguage: 'english',
  isOrderLocked: false,
  pageContext: null,
  lastIntent: null,
  messages: [],
  isGreeted: false,
};

function loadFromSession() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    const customerName = parsed.customerName || sessionStorage.getItem('customer_name') || null;
    const mobileNumber = parsed.mobileNumber || sessionStorage.getItem('customer_phone') || null;
    return { ...INITIAL_STATE, ...parsed, customerName, mobileNumber };
  } catch {}
  return { ...INITIAL_STATE };
}

// ── Provider ──────────────────────────────────────────────────────────────
export function VoiceAgentProvider({ children }) {
  const [state, setState]       = useState(loadFromSession);
  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const orderTrackingRef        = useRef(null);
  const phoneErrorRef           = useRef(null);   // last phone validation error

  // ── Persist helper ──────────────────────────────────────────────────────
  const persist = useCallback((updates) => {
    setState(prev => {
      const next = { ...prev, ...updates };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Flow stage — validated transitions only ─────────────────────────────
  const setFlowStage = useCallback((stage) => {
    const upper = stage.toUpperCase();
    setState(prev => {
      if (!isTransitionAllowed(prev.flowStage, upper)) {
        console.warn(`[VoiceAgent] Invalid transition: ${prev.flowStage} → ${upper}`);
        return prev;
      }
      const next = { ...prev, flowStage: upper };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Force-set stage (bypasses transition check — used for page-context resets)
  const forceFlowStage = useCallback((stage) => {
    persist({ flowStage: stage.toUpperCase() });
  }, [persist]);

  // ── Customer name — deterministic extraction ────────────────────────────
  /**
   * @param {string} rawInput - Could be full sentence or just the name.
   * @returns {{ success: boolean, name: string|null, error: string|null }}
   */
  const validateAndSetName = useCallback((rawInput) => {
    const clean = extractName(rawInput);
    if (!clean) return { success: false, name: null, error: 'Name not recognised. Could you repeat your name?' };
    persist({ customerName: clean });
    sessionStorage.setItem('customer_name', clean);
    return { success: true, name: clean, error: null };
  }, [persist]);

  // ── Customer phone — deterministic validation ───────────────────────────
  /**
   * @param {string} rawInput - Raw phone string from speech or text.
   * @returns {{ success: boolean, cleaned: string|null, error: string|null }}
   */
  const validateAndSetPhone = useCallback((rawInput) => {
    const result = validateIndianPhone(rawInput);
    if (!result.valid) {
      phoneErrorRef.current = result.error;
      return { success: false, cleaned: null, error: result.error };
    }
    phoneErrorRef.current = null;
    persist({ mobileNumber: result.cleaned });
    sessionStorage.setItem('customer_phone', result.cleaned);
    return { success: true, cleaned: result.cleaned, error: null };
  }, [persist]);

  // ── Set customer (used from ui_actions) ────────────────────────────────
  const setCustomerInfo = useCallback(({ name, phone }) => {
    const results = {};
    if (name) {
      const r = extractName(name) || (typeof name === 'string' && name.trim().length >= 2 ? name.trim() : null);
      if (r) { results.customerName = r; sessionStorage.setItem('customer_name', r); }
    }
    if (phone) {
      const r = validateIndianPhone(phone);
      if (r.valid) {
        results.mobileNumber = r.cleaned;
        sessionStorage.setItem('customer_phone', r.cleaned);
      } else {
        const digits = String(phone).replace(/\D/g, '');
        if (digits.length === 10) {
          results.mobileNumber = digits;
          sessionStorage.setItem('customer_phone', digits);
        }
      }
    }
    if (Object.keys(results).length) persist(results);
    return results;
  }, [persist]);

  // ── Order type ──────────────────────────────────────────────────────────
  const setOrderType = useCallback((type) => {
    const clean = String(type || '').toLowerCase().replace(/\s+/g, '-');
    persist({ orderType: clean });
  }, [persist]);

  // ── Table number ────────────────────────────────────────────────────────
  const setTableNumber = useCallback((num) => {
    const clean = String(num).replace(/\D/g, '') || String(num);
    if (!clean) return;
    localStorage.setItem('active_table_number', clean);
    persist({ tableNumber: clean });
  }, [persist]);

  // ── Route change — derive page context + update orderType if needed ─────
  const updateFromRoute = useCallback((pathname) => {
    const ctx = derivePageContext(pathname);
    setState(prev => {
      const newStage = getFlowStageForPage(ctx, prev.flowStage);
      const orderTypeUpdate = ctx.orderType && !prev.orderType ? { orderType: ctx.orderType } : {};
      // If route explicitly defines orderType and it differs from current — update
      const routeTypeDiffers = ctx.orderType && prev.orderType && ctx.orderType !== prev.orderType;
      const orderTypeFromRoute = routeTypeDiffers ? { orderType: ctx.orderType } : {};
      const next = { ...prev, pageContext: ctx, flowStage: newStage, ...orderTypeUpdate, ...orderTypeFromRoute };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Compute what is still missing ──────────────────────────────────────
  const computeMissingFields = useCallback(() => {
    return getMissingFields(state, state.orderType);
  }, [state]);

  // ── Order placed ────────────────────────────────────────────────────────
  const setOrderPlaced = useCallback(({ orderId, paymentMethod }) => {
    persist({
      orderId,
      paymentMethod,
      paymentStatus: 'paid',
      isOrderLocked: true,
      flowStage: 'ORDER_PLACED',
    });
  }, [persist]);

  // ── Live order status ───────────────────────────────────────────────────
  const setOrderStatus = useCallback((status) => {
    persist({ orderStatus: status });
  }, [persist]);

  // ── Language detection ──────────────────────────────────────────────────
  const setDetectedLanguage = useCallback((lang) => {
    persist({ detectedLanguage: lang });
  }, [persist]);

  // ── Start order tracking poll (read-only — GET /api/orders/{id}) ────────
  const startOrderTracking = useCallback((orderId, onStatusChange) => {
    if (orderTrackingRef.current) clearInterval(orderTrackingRef.current);
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const oid = orderId || state.orderId;
    if (!oid) return;

    const poll = async () => {
      try {
        const cleanId = String(oid).replace(/\D/g, '');
        const res = await fetch(`${API_BASE}/api/orders/${cleanId}`);
        if (!res.ok) return;
        const data = await res.json();
        const newStatus = data.status || data.order_status;
        if (newStatus) {
          persist({ orderStatus: newStatus });
          onStatusChange?.(newStatus);
          document.dispatchEvent(new CustomEvent('order-status-update', { detail: { status: newStatus } }));
          if (['SERVED', 'COMPLETED'].includes(newStatus)) clearInterval(orderTrackingRef.current);
        }
      } catch (e) { console.warn('[VoiceAgent] Tracking poll error:', e); }
    };

    poll();
    orderTrackingRef.current = setInterval(poll, 7000);
    return () => clearInterval(orderTrackingRef.current);
  }, [state.orderId, persist]);

  // ── Detect language from text ───────────────────────────────────────────
  const detectLanguage = useCallback((text) => {
    if (!text) return 'english';
    const checks = [
      [/[\u0B80-\u0BFF]/, 'tamil'],
      [/[\u0D00-\u0D7F]/, 'malayalam'],
      [/[\u0C80-\u0CFF]/, 'kannada'],
      [/[\u0C00-\u0C7F]/, 'telugu'],
      [/[\u0600-\u06FF]/, 'urdu'],
      [/[\u0980-\u09FF]/, 'bengali'],
      [/[\u0A80-\u0AFF]/, 'gujarati'],
      [/[\u0A00-\u0A7F]/, 'punjabi'],
      [/[\u0900-\u097F]/, 'hindi'],
    ];
    for (const [re, lang] of checks) if (re.test(text)) return lang;
    return 'english';
  }, []);

  // ── Set messages helper ──────────────────────────────────────────────────
  const setMessages = useCallback((msgs) => {
    setState(prev => {
      const nextMsgs = typeof msgs === 'function' ? msgs(prev.messages) : msgs;
      const next = { ...prev, messages: nextMsgs };
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Set isGreeted helper ──────────────────────────────────────────────────
  const setIsGreeted = useCallback((greeted) => {
    persist({ isGreeted: greeted });
  }, [persist]);

  // ── Reset journey ───────────────────────────────────────────────────────
  const resetJourney = useCallback(() => {
    if (orderTrackingRef.current) clearInterval(orderTrackingRef.current);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('customer_name');
    sessionStorage.removeItem('customer_phone');
    setState({ ...INITIAL_STATE, conversationSessionId: SESSION_ID });
  }, []);

  // ── Cleanup tracking on unmount ─────────────────────────────────────────
  useEffect(() => () => {
    if (orderTrackingRef.current) clearInterval(orderTrackingRef.current);
  }, []);

  const value = {
    agentState: state,
    sessionId: SESSION_ID,
    setFlowStage,
    forceFlowStage,
    setCustomerInfo,
    validateAndSetName,
    validateAndSetPhone,
    setOrderType,
    setTableNumber,
    setOrderPlaced,
    setOrderStatus,
    setDetectedLanguage,
    startOrderTracking,
    resetJourney,
    detectLanguage,
    updateFromRoute,
    computeMissingFields,
    setMessages,
    setIsGreeted,
    isAgentOpen,
    setIsAgentOpen,
  };

  return (
    <VoiceAgentContext.Provider value={value}>
      {children}
    </VoiceAgentContext.Provider>
  );
}

export function useVoiceAgent() {
  const ctx = useContext(VoiceAgentContext);
  if (!ctx) throw new Error('useVoiceAgent must be used within VoiceAgentProvider');
  return ctx;
}
