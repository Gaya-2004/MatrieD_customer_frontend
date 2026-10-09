/**
 * mcpCustomerService.js
 *
 * Wraps the public /api/v1/public/mcp/customer-chat backend endpoint.
 * Sends text or audio (base64 webm from MediaRecorder) to the MCP server
 * and returns assistant_text, tool_result, audio_payload (base64 MP3 gTTS), etc.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Send a text or audio message to the MCP customer chat endpoint.
 *
 * @param {Object} opts
 * @param {string}      opts.prompt       - The user text message (empty string if audio only)
 * @param {Array}       opts.chatHistory  - [{role:'user'|'assistant', text:string}]
 * @param {string|null} opts.audioBase64  - Base64 audio/webm from MediaRecorder, or null
 * @param {boolean}     opts.isVoice      - true = request gTTS audio payload in response
 * @param {number|null} opts.restaurantId - optional restaurant_id filter
 * @returns {Promise<{
 *   assistant_text: string,
 *   transcribed_user_text: string|null,
 *   tool_name: string|null,
 *   tool_result: any,
 *   audio_payload: string|null  // base64 MP3; play: new Audio(`data:audio/mp3;base64,${payload}`)
 * }>}
 */
export async function sendToCustomerMCP({
  prompt = '',
  chatHistory = [],
  audioBase64 = null,
  isVoice = false,
  restaurantId = null,
  orderId = null,
  currentPage = null,
  orderType = null,
  cartData = null,
  customerName = null,
  customerPhone = null,
  flowStage = null,
  tableNumber = null,
  paymentStatus = null,
  orderStatus = null,
  detectedLanguage = null,
  sessionId = null,
} = {}) {

  const body = {
    prompt,
    chat_history: chatHistory.map(m => ({
      role: m.role,
      text: m.text || m.content || '',
    })),
    is_voice: isVoice,
  };
  if (audioBase64) body.audio_base64 = audioBase64;
  if (restaurantId) body.restaurant_id = restaurantId;
  if (orderId) body.order_id = orderId;
  if (currentPage) body.current_page = currentPage;
  if (orderType) body.order_type = orderType;
  if (cartData) body.cart_data = cartData;
  if (customerName) body.customer_name = customerName;
  if (customerPhone) body.customer_phone = customerPhone;
  if (flowStage) body.flow_stage = flowStage;
  if (tableNumber) body.table_number = tableNumber;
  if (paymentStatus) body.payment_status = paymentStatus;
  if (orderStatus) body.order_status = orderStatus;
  if (detectedLanguage) body.detected_language = detectedLanguage;
  if (sessionId) body.session_id = sessionId;


  const res = await fetch(`${API_BASE}/api/v1/public/mcp/customer-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MCP customer-chat failed (${res.status}): ${errText}`);
  }

  return res.json();
}
