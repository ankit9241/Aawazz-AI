require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Direct API function for Gemini
async function callGemini(input, prompt) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${prompt}\n\nInput: "${input}"` 
                }
              ]
            }
          ]
        })
      }
    );

    const data = await res.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || input;

    return text.trim();

  } catch (err) {
    console.log("Gemini error:", err);
    return input; // fallback
  }
}

// Validate API key on startup
if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is required in .env file');
  process.exit(1);
}

/**
 * Call Gemini 1.5 Flash model to process text
 * @param {string} inputText - The input text to process
 * @param {string} prompt - The processing prompt
 * @param {string} formLanguage - The form language for fallback logic
 * @returns {Promise<string>} - The processed result
 */
async function callGeminiFlash(inputText, prompt, formLanguage = null) {
  try {
    console.log(`Calling Gemini 1.5 Flash with input: "${inputText.substring(0, 100)}${inputText.length > 100 ? '...' : ''}"`);
    console.log(`FULL PROMPT:\n${prompt}\n=== END PROMPT ===`);

    // Use direct API call
    const processedText = await callGemini(inputText, prompt);

    // Clean the result
    const cleanedResult = cleanGeminiOutput(processedText);

    console.log(`Gemini 1.5 Flash result: "${cleanedResult}"`);

    // Fallback: If AI returns Hindi for English form, do basic transliteration
    console.log(`Checking for Hindi in result: "${cleanedResult}"`);
    console.log(`Form language: "${formLanguage}"`);
    console.log(`Contains Hindi: ${containsHindi(cleanedResult)}`);
    
    if (containsHindi(cleanedResult)) {
      const transliterated = basicHindiToEnglish(cleanedResult);
      console.log(`AI returned Hindi, applying transliteration: "${transliterated}"`);
      return transliterated;
    }

    return cleanedResult;

  } catch (error) {
    console.error('Error calling Gemini 1.5 Flash:', error);
    
    // Handle specific error types
    if (error.message.includes('API_KEY')) {
      throw new Error('Invalid Gemini API key');
    }
    
    if (error.message.includes('quota') || error.message.includes('limit')) {
      throw new Error('Gemini API quota exceeded');
    }
    
    if (error.message.includes('network') || error.message.includes('timeout')) {
      throw new Error('Network error while calling Gemini API');
    }
    
    if (error.message.includes('content') || error.message.includes('policy')) {
      throw new Error('Content policy violation');
    }
    
    // Generic error
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

/**
 * Clean Gemini output by removing common artifacts
 * @param {string} text - Raw output from Gemini
 * @returns {string} - Minimal output cleaning - preserve valid content
 */
function cleanGeminiOutput(output) {
  if (!output) return '';
  
  let cleaned = output
    .trim()
    // Remove surrounding quotes only
    .replace(/^["']|["']$/g, '');
  
  return cleaned;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Aawazz Form Processor'
  });
});

// Main processing endpoint with failsafe handling
app.post('/process', async (req, res) => {
  try {
    const { input, field, options, userLanguage, formLanguage, detectedInputLanguage } = req.body;
    
    if (!input || !field) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing input or field parameter'
      });
    }
    
    console.log(`RAW INPUT: "${input}"`);
    console.log(`FIELD: "${field}"`);
    if (options) console.log(`OPTIONS:`, options);
    if (userLanguage) console.log(`USER LANG: ${userLanguage}`);
    if (formLanguage) console.log(`FORM LANG: ${formLanguage}`);
    if (detectedInputLanguage) console.log(`DETECTED INPUT LANG: ${detectedInputLanguage}`);
    
    // Create processing prompt based on field type and context
    const prompt = createProcessingPrompt(field, input, options, userLanguage, formLanguage, detectedInputLanguage);
    console.log(`PROMPT: ${prompt}`);
    
    // Process with Gemini
    const geminiRaw = await callGeminiFlash(input, prompt, formLanguage);
    console.log(`GEMINI RAW: "${geminiRaw}"`);
    
    // Clean output with minimal processing
    const cleaned = cleanGeminiOutput(geminiRaw);
    console.log(`CLEANED: "${cleaned}"`);
    
    // Apply field-specific formatting
    const formattedValue = applyFieldSpecificFormatting(cleaned, field);
    console.log(`FINAL: "${formattedValue}"`);
    
    // FAILSAFE: If result is empty or invalid, fallback to original input
    let finalValue = formattedValue;
    if (!formattedValue || formattedValue.trim().length === 0) {
      console.log(`FAILSAFE: Using original input "${input}"`);
      finalValue = input.trim();
    }
    
    // Ensure language correctness
    if (formLanguage && formLanguage.startsWith('en') && finalValue) {
      // For English forms, ensure output is reasonable English
      console.log(`ENGLISH FORM CHECK: "${finalValue}"`);
    } else if (formLanguage && formLanguage.startsWith('hi') && finalValue) {
      // For Hindi forms, ensure output is reasonable Hindi
      console.log(`HINDI FORM CHECK: "${finalValue}"`);
    }
    
    // Return the processed value
    res.json({
      value: finalValue,
      field: field,
      originalInput: input,
      model: 'gemini-1.5-flash',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("FULL ERROR:", error);
    
    if (error.message.includes('API key') || error.message.includes('authentication')) {
      return res.status(401).json({
        error: 'Invalid Gemini API key',
        message: 'Please check your GEMINI_API_KEY in .env file'
      });
    }

    if (error.message.includes('quota exceeded')) {
      return res.status(429).json({
        error: 'API quota exceeded',
        message: 'Gemini API quota limit reached'
      });
    }

    if (error.message.includes('Network error')) {
      return res.status(500).json({
        error: 'Network error',
        message: 'Failed to connect to Gemini API'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process the request'
    });
  }
});

// Get field type from label for processing
function getFieldTypeFromLabel(field) {
  const fieldLower = field.toLowerCase();
  
  // Remove conversion markers
  const cleanField = field.replace(/\s*\(.*?\)/, '').toLowerCase().trim();
  
  // Check for specific field type indicators
  if (cleanField.includes('name') || cleanField.includes('full name') || cleanField.includes('first name') || cleanField.includes('last name')) {
    return 'name';
  } else if (cleanField.includes('email') || cleanField.includes('email address') || cleanField.includes('e-mail')) {
    return 'email';
  } else if (cleanField.includes('phone') || cleanField.includes('telephone') || cleanField.includes('mobile') || cleanField.includes('contact')) {
    return 'phone';
  } else if (cleanField.includes('address') || cleanField.includes('street') || cleanField.includes('city') || cleanField.includes('state') || cleanField.includes('zip') || cleanField.includes('postal')) {
    return 'address';
  } else if (cleanField.includes('age') || cleanField.includes('birthday') || cleanField.includes('birth') || cleanField.includes('date')) {
    return 'date';
  } else if (cleanField.includes('company') || cleanField.includes('work') || cleanField.includes('job') || cleanField.includes('occupation') || cleanField.includes('position')) {
    return 'company';
  } else if (cleanField.includes('comment') || cleanField.includes('message') || cleanField.includes('notes') || cleanField.includes('description')) {
    return 'text';
  } else {
    return 'text'; // Default fallback
  }
}

// Simplified prompt design for accurate processing
function createProcessingPrompt(field, input, options = null, userLanguage = null, formLanguage = null, detectedInputLanguage = null) {
  const fieldType = getFieldTypeFromLabel(field);
  let actualField = field.replace(/\s*\(.*?\)/, '').trim(); // Remove conversion markers
  
  // Handle mixed-language scenarios
  const isMixedLanguage = userLanguage && detectedInputLanguage && userLanguage !== detectedInputLanguage;
  console.log(`Mixed language scenario: ${isMixedLanguage} (User: ${userLanguage}, Input: ${detectedInputLanguage})`);
  
  // Base prompt structure with strict language rules
  let prompt = `Extract the correct value for "${actualField}" from this input: "${input}".

CRITICAL RULES:
- Return ONLY the final value
- No explanation`;

  // Handle mixed-language scenarios
  if (isMixedLanguage) {
    prompt += `

MIXED LANGUAGE DETECTED:
- User selected: ${userLanguage}
- Input detected as: ${detectedInputLanguage}

ULTIMATE ENGLISH CORRECTION RULES:
- IF INPUT IS HINDI: Transliterate to English
- IF INPUT IS BROKEN ENGLISH: CORRECT TO PROPER ENGLISH
- IF INPUT IS ALREADY CORRECT ENGLISH: KEEP AS-IS

SPECIFIC CORRECTIONS REQUIRED:
- "maithmetik" -> "mathematics" (MUST CORRECT)
- "phijiks" -> "physics" (MUST CORRECT)
- "kemistri" -> "chemistry" (MUST CORRECT)
- "main sbse achhha hoon" -> "I am the best"
- "boreevlee rod munbee" -> "very good number"

DO NOT CREATE NEW MISSPELLINGS!
ALWAYS RETURN PROPER ENGLISH WORDS!

Examples:
- "mathematics" -> "mathematics" (KEEP EXACT)
- "physics" -> "physics" (KEEP EXACT)  
- "chemistry" -> "chemistry" (KEEP EXACT)
- "main sbse achhha hoon" -> "I am the best"
- "boreevlee rod munbee" -> "very good number"
- "maithmetik" -> "mathematics" (CORRECT TO PROPER ENGLISH)
- "phijiks" -> "physics" (CORRECT TO PROPER ENGLISH)`;
  } else {
    prompt += `

CRITICAL ENGLISH PRESERVATION RULES:
- PRESERVE exact English spelling and grammar
- DO NOT alter correct English words
- ONLY transliterate Hindi characters to English

Examples:
- "mathematics" -> "mathematics" (KEEP EXACT)
- "physics" -> "physics" (KEEP EXACT)
- "chemistry" -> "chemistry" (KEEP EXACT)
- "main sbse achhha hoon" -> "I am the best"
- "maithmetik" -> "mathematics" (CORRECT TO PROPER ENGLISH)
- "phijiks" -> "physics" (CORRECT TO PROPER ENGLISH)`;
  }

  prompt += `

Return ONLY the final English value.`;
  
  // Special handling for dropdown fields
  if (options && Array.isArray(options) && options.length > 0) {
    const optionTexts = options.map(opt => opt.text).join(', ');
    prompt += `\n\nOptions: ${optionTexts}`;
  }
  
  return prompt;
}

// Helper function to detect Hindi characters
function containsHindi(text) {
  if (!text) return false;
  // Check for Devanagari script range (U+0900 to U+097F)
  return /[\u0900-\u097F]/.test(text);
}

// Basic Hindi to English transliteration map
function basicHindiToEnglish(text) {
  if (!text) return text;
  
  const transliterationMap = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ं': 'n', 'ः': 'h', 'ँ': 'an', 'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ा': 'a',
    'ृ': 'ri', 'ॄ': 'ree', 'ॢ': 'li', 'ॣ': 'lii'
  };
  
  // Simple character-by-character transliteration
  let result = '';
  for (let char of text) {
    result += transliterationMap[char] || char;
  }
  
  // Clean up common patterns
  result = result.replace(/a+/g, 'a').replace(/i+/g, 'i').replace(/u+/g, 'u');
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

// Safe field-specific formatting - minimal modifications
function applyFieldSpecificFormatting(text, field) {
  if (!text) return '';
  
  let formatted = text.trim();
  const fieldLower = field.toLowerCase();
  
  // Only apply specific formatting for structured fields
  if (fieldLower.includes('email')) {
    // Extract email pattern only if it exists
    const emailMatch = formatted.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      formatted = emailMatch[0];
    }
  }
  
  if (fieldLower.includes('phone')) {
    // Extract phone numbers only
    const phoneMatch = formatted.match(/[\d\s\-\(\)\+]+/);
    if (phoneMatch) {
      formatted = phoneMatch[0];
    }
  }
  
  if (fieldLower.includes('date')) {
    // Extract date patterns only
    const dateMatch = formatted.match(/\d{1,4}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{1,4}/);
    if (dateMatch) {
      formatted = dateMatch[0];
    }
  }
  
  if (fieldLower.includes('zip') || fieldLower.includes('postal')) {
    // Extract postal codes only
    const zipMatch = formatted.match(/\b\d{5,6}\b/);
    if (zipMatch) {
      formatted = zipMatch[0];
    }
  }
  
  // Simple name formatting - capitalize first letter only
  if (fieldLower.includes('name') && formatted.length > 0) {
    // Only capitalize if it looks like a name (no numbers, special chars)
    if (!/[\d@#$%^&*()]/.test(formatted)) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
  }
  
  if (fieldLower.includes('age')) {
    // Extract numeric age
    const ageMatch = formatted.match(/\d{1,3}/);
    if (ageMatch) {
      formatted = ageMatch[0];
    }
  }
  
  return formatted;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Aawazz Form Processor Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Process endpoint: http://localhost:${PORT}/process`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
