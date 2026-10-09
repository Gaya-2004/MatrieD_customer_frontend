/**
 * voiceAgentUtils.js
 * Deterministic, LLM-independent utilities.
 * Phone validation, name extraction, page-context derivation.
 * The LLM extracts values; these functions validate/sanitize them.
 */

// ── Spoken-digit normalisation ─────────────────────────────────────────────
const SPOKEN_DIGITS = {
  zero:'0', one:'1', two:'2', three:'3', four:'4',
  five:'5', six:'6', seven:'7', eight:'8', nine:'9',
  'oh':'0',                    // "oh" for zero is common
};
export function convertSpokenDigits(text) {
  if (!text) return text;
  return String(text)
    .toLowerCase()
    .replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|oh)\b/g,
             m => SPOKEN_DIGITS[m] ?? m);
}

// ── Indian mobile number validation ───────────────────────────────────────
export function validateIndianPhone(rawInput) {
  if (!rawInput) return { valid: false, cleaned: '', error: 'Phone number is required.' };

  // 1. Convert spoken digits
  let s = convertSpokenDigits(String(rawInput));

  // 2. Strip country codes: +91, 0091, 91 (only when followed by 10 digits)
  s = s.replace(/^\+?91[-\s]?/, '').replace(/^0091[-\s]?/, '');

  // 3. Keep only digits
  s = s.replace(/\D/g, '');

  if (!s.length)     return { valid: false, cleaned: '', error: 'No digits found. Please say your 10-digit mobile number.' };
  if (s.length < 10) return { valid: false, cleaned: s, error: `Too short (${s.length} digits). Indian mobile numbers have 10 digits.` };
  if (s.length > 10) return { valid: false, cleaned: s, error: `Too long (${s.length} digits). Please provide exactly 10 digits.` };

  // 4. Must start with 6–9
  if (!/^[6-9]/.test(s)) return { valid: false, cleaned: s, error: 'Indian mobile numbers start with 6, 7, 8 or 9.' };

  // 5. Reject obviously fake numbers (all same digit, sequential runs)
  if (/^(.)\1{9}$/.test(s))         return { valid: false, cleaned: s, error: 'Please provide a valid mobile number.' };
  if (s === '1234567890' || s === '0987654321')
    return { valid: false, cleaned: s, error: 'Please provide a valid mobile number.' };

  return { valid: true, cleaned: s, error: null };
}

// ── Customer name extraction ───────────────────────────────────────────────
const NAME_STRIP_PATTERNS = [
  /^my name is\s+/i,
  /^i am\s+/i,
  /^i'm\s+/i,
  /^this is\s+/i,
  /^you can call me\s+/i,
  /^call me\s+/i,
  /^name is\s+/i,
  /^name[:=\s]+/i,
  /^its\s+/i,
  /^it'?s\s+/i,
  /^am\s+/i,
];
export function extractName(rawInput) {
  if (!rawInput) return null;

  let text = String(rawInput).trim();

  // Strip known prefixes
  for (const pat of NAME_STRIP_PATTERNS) {
    if (pat.test(text)) {
      text = text.replace(pat, '').trim();
      break;
    }
  }

  // Take only the first "word cluster" before conjunctions or order phrases
  text = text
    .split(/[.\n]/)[0]
    .split(/\s+(?:my|i want|i need|give|please|with)\b/i)[0]
    .trim();

  // Remove trailing punctuation
  text = text.replace(/[.,;:!?]+$/, '').trim();

  // Title-case
  text = text.replace(/\b\w/g, c => c.toUpperCase());

  // Validate
  if (!text || text.length < 2 || text.length > 50) return null;
  if (/^\d+$/.test(text)) return null;            // all digits
  if (!/[A-Za-z\u0B80-\u0BFF\u0900-\u097F\u0D00-\u0D7F\u0C80-\u0CFF\u0C00-\u0C7F]/.test(text)) return null;

  return text;
}

// ── Page-context derivation from route ────────────────────────────────────
export function derivePageContext(pathname) {
  if (!pathname) return { page: 'HOME', orderType: null };
  const p = pathname.toLowerCase();
  if (p === '/dine-in'     || p.startsWith('/dine-in'))   return { page: 'DINE_IN',       orderType: 'dine-in'  };
  if (p === '/take-away'   || p.startsWith('/take-away')) return { page: 'TAKEAWAY',       orderType: 'takeaway' };
  if (p.includes('order-success'))                         return { page: 'ORDER_SUCCESS',  orderType: null };
  if (p.includes('takeaway-payment'))                      return { page: 'PAYMENT',        orderType: 'takeaway' };
  if (p.includes('/payment'))                              return { page: 'PAYMENT',        orderType: 'dine-in'  };
  if (p.includes('takeaway-checkout'))                     return { page: 'CHECKOUT',       orderType: 'takeaway' };
  if (p.includes('/checkout'))                             return { page: 'CHECKOUT',       orderType: 'dine-in'  };
  if (p === '/invoice')                                    return { page: 'INVOICE',        orderType: null };
  if (p === '/home')                                       return { page: 'HOME',           orderType: null };
  if (p === '/')                                           return { page: 'LANDING',        orderType: null };
  return { page: 'HOME', orderType: null };
}

// ── Initial system prompt for current page ────────────────────────────────
export function getInitialGreetingForPage(pageCtx, agentState) {
  const { page } = pageCtx;
  switch (page) {
    case 'DINE_IN':
      return '[SYSTEM: Customer is on the Dine-In menu page. orderType=dine-in. flowStage=ORDER_BUILDING. Greet warmly and ask what they would like to order. Do NOT ask for name or phone first. Do NOT ask about Dine-In or Takeaway again.]';
    case 'TAKEAWAY':
      return '[SYSTEM: Customer is on the Takeaway menu page. orderType=takeaway. flowStage=ORDER_BUILDING. Greet warmly and ask what they would like to order. Do NOT ask for name or phone first. Do NOT ask about Dine-In or Takeaway. Do NOT ask for a table number.]';
    case 'ORDER_SUCCESS':
    case 'PAYMENT':
    case 'CHECKOUT':
    case 'INVOICE':
      return null; // no auto-greet on these pages
    case 'LANDING':
      return '[SYSTEM: Customer is on the Landing page. flowStage=GREETING. Greet warmly and ask for their name. Do NOT ask whether they prefer Dine-In or Takeaway yet.]';
    case 'HOME':
      return `[SYSTEM: Customer is on the Home page. flowStage=SELECT_ORDER_TYPE. Greet the customer by their name (${agentState?.customerName || 'Customer'}) and explicitly ask "Would you prefer Dine-In or Takeaway?"]`;
    default:
      return null;
  }
}

// ── Flow stage for a given page ───────────────────────────────────────────
export function getFlowStageForPage(pageCtx, currentStage) {
  const { page } = pageCtx;
  
  if (page === 'DINE_IN' || page === 'TAKEAWAY') return 'ORDER_BUILDING';
  if (page === 'CHECKOUT') return 'CHECKOUT_REVIEW';
  if (page === 'PAYMENT') return currentStage === 'PAYMENT_PROCESSING' ? currentStage : 'PAYMENT_SELECT';
  if (page === 'ORDER_SUCCESS') return currentStage === 'ORDER_TRACKING' ? currentStage : 'ORDER_PLACED';

  if (page === 'HOME') return 'SELECT_ORDER_TYPE';
  if (page === 'LANDING') return ['COLLECT_NAME', 'COLLECT_PHONE', 'SELECT_ORDER_TYPE'].includes(currentStage) ? currentStage : 'GREETING';

  // Never override terminal stages if on generic pages
  if (['ORDER_PLACED', 'LIVE_ORDER', 'ORDER_SERVED', 'FEEDBACK', 'COMPLETED'].includes(currentStage)) {
    return currentStage;
  }
  return currentStage || 'GREETING';
}

// ── Missing fields for checkout ───────────────────────────────────────────
export function getMissingFields(agentState, orderType) {
  const ot = orderType || agentState?.orderType;
  const missing = [];
  // Priority order: table (dine-in), name, phone
  if (ot === 'dine-in' && !agentState?.tableNumber) missing.push('table');
  if (!agentState?.customerName)  missing.push('name');
  if (!agentState?.mobileNumber)  missing.push('phone');
  return missing;
}

// ── Allowed ui_actions per stage ─────────────────────────────────────────
const STAGE_ALLOWED = {
  GREETING:            new Set(['set_flow_stage','set_order_type','navigate']),
  COLLECT_NAME:        new Set(['set_customer','set_flow_stage','add_to_cart']),
  COLLECT_PHONE:       new Set(['set_customer','set_flow_stage']),
  CONFIRM_CUSTOMER:    new Set(['set_flow_stage','navigate','trigger_checkout']),
  SELECT_ORDER_TYPE:   new Set(['set_order_type','navigate','set_flow_stage']),
  COLLECT_TABLE:       new Set(['set_table_number','set_flow_stage','add_to_cart']),
  ORDER_BUILDING:      new Set(['add_to_cart','remove_from_cart','view_cart','set_customer','set_table_number','set_flow_stage','set_order_type']),
  WAITING_FOR_ORDER_COMPLETION: new Set(['set_flow_stage','trigger_checkout','view_cart']),
  REVIEW_ORDER:        new Set(['view_cart','add_to_cart','remove_from_cart','trigger_checkout','set_flow_stage']),
  CHECKOUT:            new Set(['trigger_checkout','auto_navigate_to_payment','set_flow_stage']),
  CHECKOUT_REVIEW:     new Set(['trigger_checkout','auto_navigate_to_payment','set_flow_stage']),
  PAYMENT_SELECT:      new Set(['payment_method','set_flow_stage']),
  PAYMENT_PROCESSING:  new Set(['set_flow_stage']),
  ORDER_PLACED:        new Set(['start_order_tracking','set_flow_stage']),
  LIVE_ORDER:          new Set(['start_order_tracking','set_flow_stage']),
  ORDER_TRACKING:      new Set(['start_order_tracking','set_flow_stage']),
  ORDER_SERVED:        new Set(['request_feedback','set_flow_stage']),
  FEEDBACK:            new Set(['set_flow_stage']),
  COMPLETED:           new Set([]),
  ERROR:               new Set(['set_flow_stage']),
};
export function isActionAllowed(action, flowStage) {
  const allowed = STAGE_ALLOWED[flowStage] || null;
  if (!allowed) return true; // unknown stage → permissive
  return allowed.has(action);
}
