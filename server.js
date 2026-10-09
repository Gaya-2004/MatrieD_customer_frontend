import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Serve static files from the Vite build output
app.use(express.static(path.join(__dirname, 'dist')));

// Proxy endpoint for Gemini API
app.post('/api/chat', async (req, res) => {
    try {
        let { contents, systemInstruction, generationConfig } = req.body;

        // Fallback default systemInstruction if not present
        if (!systemInstruction) {
            systemInstruction = {
                parts: [{
                    text: "You are a helpful restaurant voice assistant. You must always return a strictly valid JSON object. " +
                          "Do NOT use unescaped newlines. " +
                          "If the user provides audio, accurately transcribe their EXACT words into the 'transcript' field — " +
                          "do NOT correct, normalize, or improve their pronunciation. " +
                          "CRITICAL: When setting parameters.name for ADD_ITEM actions, you MUST use the EXACT item name " +
                          "as spoken by the user (e.g., if they say 'kambu dosa', use 'kambu dosa' — do NOT change it to " +
                          "'masala dosa' or any other menu item). The frontend will handle menu item matching. " +
                          "LANGUAGE & MULTILINGUAL RESPONSE RULE: Detect the language, dialect, and script of the user's " +
                          "input. You MUST respond in the exact same language, dialect, and script in the 'speech' field. " +
                          "For example: " +
                          "- If the user speaks in Tanglish (Tamil transliterated in English script, e.g. 'oru masala dosa add pannunga'), " +
                          "you MUST reply in Tanglish (e.g. 'Sure, oru masala dosa add pannitten'). " +
                          "- If the user speaks in Hinglish (Hindi transliterated in English script, e.g. 'ek masala dosa add karo'), " +
                          "you MUST reply in Hinglish (e.g. 'Sure, ek masala dosa add kar diya'). " +
                          "- If the user speaks in Tamil (Tamil script, e.g. 'ஒரு மசாலா தோசை சேர்க்கவும்'), " +
                          "you MUST reply in Tamil script (e.g. 'நிச்சயமாக, ஒரு மசாலா தோசை உங்கள் கார்ட்டில் சேர்க்கப்பட்டது'). " +
                          "- If the user speaks in Hindi (Hindi script, e.g. 'एक मसाला डोसा जोड़ें'), " +
                          "you MUST reply in Hindi script (e.g. 'बिलकुल, एक मसाला डोसा आपके कार्ट में जोड़ दिया गया है'). " +
                          "- If the user speaks in English, reply in English. " +
                          "- If the user speaks in any other multilingual language (like Spanish, Telugu, Kannada, Malayalam, etc.), " +
                          "you MUST respond in that specific language and script. " +
                          "Then determine the appropriate 'action' and 'speech' response."
                }]
            };
        }

        // Fallback generationConfig if not present
        if (!generationConfig) {
            generationConfig = {};
        }
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseSchema = {
            type: "OBJECT",
            properties: {
                transcript: {
                    type: "STRING",
                    description: "The exact words spoken by the user, transcribed from audio. Omit if no audio was provided."
                },
                speech: {
                    type: "STRING",
                    description: "What the AI says back to the user. Ensure no unescaped newlines."
                },
                action: {
                    type: "STRING",
                    description: "Action command like ADD_ITEM, REMOVE_ITEM, OPEN_MENU, CLEAR_CART, TRACK_ORDER, SHOW_HELP, UPDATE_DETAILS, PROCEED_TO_PAYMENT."
                },
                parameters: {
                    type: "OBJECT",
                    description: "Key-value pairs for the action, e.g. {'name': 'curd', 'quantity': 1}.",
                    properties: {
                        name: {
                            type: "STRING",
                            description: "The name of the item, category, or parameter."
                        },
                        quantity: {
                            type: "INTEGER",
                            description: "The numerical quantity of items to add or modify."
                        },
                        category: {
                            type: "STRING",
                            description: "The menu category name."
                        },
                        method: {
                            type: "STRING",
                            description: "Payment method (e.g. Cash, UPI)."
                        },
                        phone: {
                            type: "STRING",
                            description: "Phone number."
                        },
                        fullName: {
                            type: "STRING",
                            description: "Full name of the customer."
                        }
                    }
                },
                intent: {
                    type: "BOOLEAN",
                    description: "True if there is an action, false otherwise."
                }
            },
            required: ["speech", "intent"]
        };
        
        // Use GEMINI_API_KEY (WITHOUT VITE_ prefix to keep it safe on backend)
        const apiKey = process.env.GEMINI_API_KEY;
        const apiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`;

        if (!apiKey) {
            console.error("GEMINI_API_KEY is missing from environment variables");
            return res.status(500).json({ error: { message: "API Configuration missing on server." } });
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contents, systemInstruction, generationConfig })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API error:", data);
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error("Server error during chat:", error);
        res.status(500).json({ error: { message: "Internal server error" } });
    }
});

// Handle SPA routing: serve index.html for any unknown routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
