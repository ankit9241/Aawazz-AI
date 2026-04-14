require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Direct API function for Gemini
async function callGemini(input, prompt) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${prompt}\n\nInput: "${input}"`,
                },
              ],
            },
          ],
        }),
      },
    );

    const data = await res.json();

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || input;

    return text.trim();
  } catch (err) {
    console.log("Gemini error:", err);
    return input; // fallback
  }
}

// Validate API key on startup
if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is required in .env file");
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
    console.log(
      `Calling Gemini 1.5 Flash with input: "${inputText.substring(0, 100)}${inputText.length > 100 ? "..." : ""}"`,
    );
    console.log(`FULL PROMPT:\n${prompt}\n=== END PROMPT ===`);

    // Use direct API call with try-catch
    let processedText;
    try {
      processedText = await callGemini(inputText, prompt);
    } catch (apiError) {
      console.log("=== GEMINI API ERROR (callGemini) ===");
      console.log(apiError);
      if (apiError.response) {
        console.log("Response Data:", apiError.response.data);
      }
      console.log("=== END GEMINI API ERROR ===");
      // Fall back to original input if API fails
      return inputText;
    }

    // Clean the result
    const cleanedResult = cleanGeminiOutput(processedText);

    console.log(`Gemini 1.5 Flash result: "${cleanedResult}"`);

    // Fallback: If AI returns Hindi for English form, do basic transliteration
    console.log(`Checking for Hindi in result: "${cleanedResult}"`);
    console.log(`Form language: "${formLanguage}"`);
    console.log(`Contains Hindi: ${containsHindi(cleanedResult)}`);

    if (containsHindi(cleanedResult)) {
      const transliterated = basicHindiToEnglish(cleanedResult);
      console.log(
        `AI returned Hindi, applying transliteration: "${transliterated}"`,
      );
      return transliterated;
    }

    return cleanedResult;
  } catch (error) {
    console.log("=== ERROR in callGeminiFlash ===");
    console.log(error);
    if (error.response) {
      console.log("Response Data:", error.response.data);
    }
    console.log("=== END ERROR ===");

    // Always return something (fallback to input)
    return inputText;
  }
}

/**
 * Clean Gemini output by removing common artifacts
 * @param {string} text - Raw output from Gemini
 * @returns {string} - Minimal output cleaning - preserve valid content
 */
function cleanGeminiOutput(output) {
  if (!output) return "";

  // Remove common AI artifacts and quotes
  let cleaned = output
    .replace(/^["']|["']$/g, "") // Remove surrounding quotes
    .replace(/\n/g, " ") // Convert newlines to spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  return cleaned;
}

// Fix weird text and bad transliterations from AI output
function fixWeirdText(text) {
  if (!text) return "";

  return text
    .replace(/्/g, "") // remove weird Hindi marks (virama)
    .replace(/bhe(e)+/g, "be") // fix repeated 'e' in 'be'
    .replace(/nheen/g, "nothing") // fix 'nheen' to 'nothing'
    .replace(/maithmetik/g, "mathematics") // fix common bad transliterations
    .replace(/phijik/g, "physics") // fix common bad transliterations
    .replace(/kemistri/g, "chemistry") // fix common bad transliterations
    .replace(/borivilee/g, "borivali") // fix place name transliterations
    .replace(/munbee/g, "mumbai") // fix place name transliterations
    .trim();
}

// Deprecated: Use normalizeIndianText() instead
// Kept for backward compatibility
function normalizeHindiToEnglish(text) {
  // Delegate to the new comprehensive normalization function
  return normalizeIndianText(text);
}

// Comprehensive normalization for Hindi to English phonetic outputs
// Handles common transliteration errors and phonetic variations
function normalizeIndianText(text) {
  if (!text) return "";

  let normalized = text.toLowerCase().trim();

  // === CITIES MAPPING ===
  // Handle phonetic variations and spelling mistakes for Indian cities
  const cityMappings = {
    // Mumbai variations
    मुंबई: "Mumbai",
    mumbai: "Mumbai",
    munbee: "Mumbai",
    mumbei: "Mumbai",
    mumbay: "Mumbai",
    mombai: "Mumbai",
    mumbaee: "Mumbai",
    mumbhee: "Mumbai",

    // Delhi variations
    दिल्ली: "Delhi",
    delhi: "Delhi",
    dillee: "Delhi",
    dilli: "Delhi",
    delhee: "Delhi",
    delhe: "Delhi",

    // Bangalore variations
    बेंगलुरु: "Bangalore",
    bangalore: "Bangalore",
    bengaluru: "Bangalore",
    bangaluru: "Bangalore",
    bengalore: "Bangalore",

    // Other major cities
    चेन्नई: "Chennai",
    chennai: "Chennai",
    chenai: "Chennai",
    कोलकाता: "Kolkata",
    kolkata: "Kolkata",
    calcutta: "Kolkata",
    हैदराबाद: "Hyderabad",
    hyderabad: "Hyderabad",
    hydrabad: "Hyderabad",
    पुणे: "Pune",
    pune: "Pune",
    poona: "Pune",

    // Mumbai suburbs
    बोरीवली: "Borivali",
    borivalie: "Borivali",
    borivli: "Borivali",
    borivlee: "Borivali",
    borivili: "Borivali",
    boriwali: "Borivali",
    अंधेरी: "Andheri",
    andheri: "Andheri",
    andharu: "Andheri",
    बांद्रा: "Bandra",
    bandra: "Bandra",
    banda: "Bandra",
    goa: "Goa",
    गोवा: "Goa",
    गोरेगांव: "Goregaon",
    goregaon: "Goregaon",
    goregon: "Goregaon",
    वडाला: "Vadala",
    vadala: "Vadala",
    vadalaa: "Vadala",
    dadar: "Dadar",
    दादर: "Dadar",
    powai: "Powai",
    पोवई: "Powai",
  };

  // === COMMON WORDS MAPPING ===
  // Handle phonetic variations for common street/location terms
  const commonWordMappings = {
    // Road/Street related
    रोड: "Road",
    road: "Road",
    rod: "Road",
    raad: "Road",
    रास्ता: "Road",
    rasta: "Road",
    स्ट्रीट: "Street",
    street: "Street",
    stret: "Street",
    streat: "Street",

    // Nagar (area/locality)
    नगर: "Nagar",
    nagar: "Nagar",
    nagur: "Nagar",
    nagaar: "Nagar",
    nagar: "Nagar",
    colony: "Colony",
    कॉलोनी: "Colony",

    // Sector
    सेक्टर: "Sector",
    sector: "Sector",
    sectr: "Sector",
    sectore: "Sector",
    सेक्ट: "Sector",

    // Phase/Block
    फेज: "Phase",
    phase: "Phase",
    phas: "Phase",
    faze: "Phase",
    ब्लॉक: "Block",
    block: "Block",
    blok: "Block",
    블록: "Block",

    // Building/Apartment Terms
    बिल्डिंग: "Building",
    building: "Building",
    bilding: "Building",
    अपार्टमेंट: "Apartment",
    apartment: "Apartment",
    apartmnt: "Apartment",
    flatbuilding: "Flat Building",
    फ्लैट: "Flat",
    flat: "Flat",
    flate: "Flat",
    apt: "Apartment",
    अपार्टमेंट: "Apartment",

    // Floor
    मंजिल: "Floor",
    floor: "Floor",
    flor: "Floor",
    floar: "Floor",
    फ्लोर: "Floor",

    // Wing/Section
    विंग: "Wing",
    wing: "Wing",
    wung: "Wing",
    विभाग: "Section",
    section: "Section",
    secton: "Section",

    // Shop/Office
    शॉप: "Shop",
    shop: "Shop",
    shoap: "Shop",
    ऑफिस: "Office",
    office: "Office",
    offic: "Office",
    ofis: "Office",

    // Directions
    पूर्व: "East",
    east: "East",
    पश्चिम: "West",
    west: "West",
    उत्तर: "North",
    north: "North",
    दक्षिण: "South",
    south: "South",
  };

  // === GENERAL PHRASES MAPPING ===
  // Handle common phrases with phonetic variations
  const phraseMappings = {
    // Nothing
    "कुछ नहीं": "Nothing",
    "कुछ भी नहीं": "Nothing",
    nothing: "Nothing",
    nothung: "Nothing",
    nohthing: "Nothing",
    nahee: "Nothing",
    nahi: "Nothing",
    nahin: "Nothing",
    नहीं: "No",
    no: "No",
    ना: "No",
    na: "No",
    nheen: "Nothing",
    "kuch nahi": "Nothing",
    कुछनहीं: "Nothing",

    // Yes
    हां: "Yes",
    "जी हां": "Yes",
    yes: "Yes",
    हाँ: "Yes",
    जी: "Yes",
    jee: "Yes",
    haa: "Yes",
    hann: "Yes",

    // Thank you
    शुक्रिया: "Thank you",
    धन्यवाद: "Thank you",
    "thank you": "Thank you",
    thankyou: "Thank you",
    shukriya: "Thank you",
    dhanyavaad: "Thank you",
    thanks: "Thanks",

    // Sorry
    "माफ कीजिए": "Sorry",
    "माफ करो": "Sorry",
    sorry: "Sorry",
    sorree: "Sorry",
    "maf kijiye": "Sorry",

    // Please
    कृपया: "Please",
    please: "Please",
    pls: "Please",
    pleaze: "Please",
    "कृपया करें": "Please",

    // Good/Bad
    अच्छा: "Good",
    "बहुत अच्छा": "Very good",
    good: "Good",
    gud: "Good",
    बुरा: "Bad",
    bad: "Bad",
    bada: "Big",
    बड़ा: "Big",
    big: "Big",
    छोटा: "Small",
    small: "Small",
    छोटे: "Small",

    // New/Old
    नया: "New",
    new: "New",
    पुराना: "Old",
    old: "Old",
    pooran: "Old",

    // Academic subjects (as phrases)
    मैथमेटिक्स: "Mathematics",
    mathematics: "Mathematics",
    math: "Math",
    maths: "Maths",
    गणित: "Mathematics",
    फिजिक्स: "Physics",
    physics: "Physics",
    bhautiki: "Physics",
    भौतिकी: "Physics",
    केमिस्ट्री: "Chemistry",
    chemistry: "Chemistry",
    रसायन: "Chemistry",
    biology: "Biology",
    बायोलॉजी: "Biology",
    जीवविज्ञान: "Biology",
    history: "History",
    हिस्ट्री: "History",
    इतिहास: "History",
    geography: "Geography",
    ज्योग्राफी: "Geography",
    भूगोल: "Geography",
    computer: "Computer",
    कंप्यूटर: "Computer",
    english: "English",
    अंग्रेजी: "English",
    hindi: "Hindi",
    हिंदी: "Hindi",
  };

  // Combine all mappings
  const allMappings = {
    ...cityMappings,
    ...commonWordMappings,
    ...phraseMappings,
  };

  // Apply mappings with word boundary checking
  for (const [pattern, replacement] of Object.entries(allMappings)) {
    const regex = new RegExp(`\\b${pattern}\\b`, "gi");
    normalized = normalized.replace(regex, replacement);
  }

  // Additional cleanup: Fix spacing around words
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Capitalize proper nouns (cities)
  const properNouns = [
    "mumbai",
    "delhi",
    "bangalore",
    "chennai",
    "kolkata",
    "hyderabad",
    "pune",
    "borivali",
    "andheri",
    "bandra",
    "goregaon",
    "vadala",
    "dadar",
    "powai",
    "goa",
  ];

  normalized = normalized.replace(/\b\w+/g, (word) => {
    if (properNouns.includes(word.toLowerCase())) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word;
  });

  return normalized.trim();
}

// Fix email-specific issues with Indian language input
function fixEmail(text) {
  if (!text) return "";

  return text
    .replace(/at the rate|एट द रेट/gi, "@")
    .replace(/dot|डॉट/gi, ".")
    .replace(/\s+/g, "");
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Aawazz Form Processor",
  });
});

// Check if field should skip AI processing (sensitive or structured fields)
function shouldSkipAI(field, fieldType) {
  const fieldLower = field.toLowerCase();

  // Sensitive fields that should never go to AI
  const sensitiveFields = [
    "password",
    "pass",
    "pwd",
    "passwd",
    "confirm password",
    "confirm pass",
    "pin",
    "secret",
    "key",
    "token",
    "auth",
    "authentication",
  ];

  // Structured fields that should use raw input
  const structuredFields = [
    "phone",
    "telephone",
    "mobile",
    "contact",
    "otp",
    "verification code",
    "code",
    "zip",
    "zip code",
    "postal",
    "postal code",
    "ssn",
    "credit card",
    "card number",
    "cvv",
    "expiry",
    "account number",
    "routing number",
  ];

  // Check if field matches any sensitive or structured patterns
  const isSensitive = sensitiveFields.some((sensitive) =>
    fieldLower.includes(sensitive),
  );
  const isStructured = structuredFields.some((structured) =>
    fieldLower.includes(structured),
  );
  const isNumeric = /^\d+$/.test(fieldLower); // Numeric-only fields

  return (
    isSensitive ||
    isStructured ||
    isNumeric ||
    fieldType === "phone" ||
    fieldType === "email"
  );
}

// Enforce output language based on formLanguage
// Check if text should be translated from Hindi to English
function shouldTranslateToEnglish(text, formLanguage) {
  if (!text) return false;

  const hasHindi = /[\u0900-\u097F]/.test(text);
  console.log(
    `shouldTranslateToEnglish: hasHindi=${hasHindi}, formLanguage=${formLanguage}`,
  );

  return hasHindi && formLanguage === "en";
}

// Clean password input - remove ALL spaces (passwords don't have spaces)
function cleanPasswordInput(value) {
  if (!value) return "";

  // Remove ALL spaces from password
  // Also remove common speech artifacts
  return value
    .replace(/\s+/g, "") // Remove all spaces
    .trim();
}

// Main processing endpoint with failsafe handling - NEVER CRASHES
app.post("/process", async (req, res) => {
  let input = req.body?.input || "";
  let field = req.body?.field || "Unknown";
  let finalValue = input; // Default fallback

  try {
    const { options, userLanguage, formLanguage } = req.body;

    if (!input || !field) {
      console.log("Missing input or field parameter");
      return res.status(200).json({
        value: input || "",
        field: field,
        originalInput: input || "",
        error: "Missing parameters",
      });
    }

    console.log(`RAW INPUT: "${input}"`);
    console.log(`FIELD: "${field}"`);
    if (options) console.log(`OPTIONS:`, options);
    if (userLanguage) console.log(`USER LANG: ${userLanguage}`);
    if (formLanguage) console.log(`FORM LANG: ${formLanguage}`);

    // Get field type for processing decisions
    const fieldType = getFieldTypeFromLabel(field);
    console.log(`FIELD TYPE: ${fieldType}`);

    // Check if we should skip AI processing for this field
    const skipAI = shouldSkipAI(field, fieldType);
    console.log(`SKIP AI: ${skipAI}`);

    if (skipAI) {
      // For sensitive/structured fields, use raw input with minimal cleaning
      console.log(
        "SKIPPING AI - Using raw input for sensitive/structured field",
      );
      let cleanedInput = input.replace(/\s+/g, " ").trim(); // Only clean spacing

      // Special handling for password fields - remove ALL spaces
      if (isPasswordField(field)) {
        cleanedInput = cleanPasswordInput(cleanedInput);
        console.log(
          `PASSWORD FIELD - Removed spaces: "${input}" → "${cleanedInput}"`,
        );
      }

      finalValue = cleanedInput;
      console.log(`DIRECT OUTPUT: "${finalValue}"`);
    } else {
      try {
        // Create processing prompt based on field type and context
        const prompt = createProcessingPrompt(
          field,
          input,
          options,
          userLanguage,
          formLanguage,
        );
        console.log(`PROMPT: ${prompt}`);

        // Process with Gemini - wrapped with error handling
        let geminiRaw;
        try {
          geminiRaw = await callGeminiFlash(input, prompt, formLanguage);
          console.log(`GEMINI RAW: "${geminiRaw}"`);
        } catch (geminiError) {
          console.log("=== GEMINI PROCESSING ERROR ===");
          console.log(geminiError);
          if (geminiError.response) {
            console.log("Response Data:", geminiError.response.data);
          }
          console.log("=== END GEMINI ERROR ===");
          // Fallback to input on Gemini error
          geminiRaw = input;
        }

        // Clean output with minimal processing
        const cleaned = cleanGeminiOutput(geminiRaw || input);
        console.log(`CLEANED: "${cleaned}"`);

        // Fix weird text and bad transliterations
        const fixed = fixWeirdText(cleaned);
        console.log(`FIXED: "${fixed}"`);

        // Apply comprehensive normalization
        const normalized = normalizeIndianText(fixed);
        console.log(`NORMALIZED: "${normalized}"`);

        // Apply email-specific fixes if this is an email field
        let processedValue = normalized;
        if (fieldType === "email") {
          processedValue = fixEmail(normalized);
          console.log(`EMAIL FIXED: "${processedValue}"`);
        }

        // Apply field-specific formatting
        const formattedValue = applyFieldSpecificFormatting(
          processedValue,
          field,
        );
        console.log(`FINAL: "${formattedValue}"`);

        // FAILSAFE: If result is empty or invalid, fallback to original input
        finalValue = formattedValue;
        if (!formattedValue || formattedValue.trim().length === 0) {
          console.log(`FAILSAFE: Using original input "${input}"`);
          finalValue = input.trim();
        }
      } catch (processingError) {
        console.log("=== PROCESSING ERROR ===");
        console.log(processingError);
        if (processingError.response) {
          console.log("Response Data:", processingError.response.data);
        }
        console.log("=== END PROCESSING ERROR ===");
        // Fallback to input on any processing error
        finalValue = input.trim();
      }
    }

    // === CONDITIONAL PROCESSING ===
    // Only process with Gemini if we have Hindi input and English form
    if (
      !skipAI &&
      finalValue &&
      shouldTranslateToEnglish(finalValue, formLanguage)
    ) {
      console.log(`\n=== RE-PROCESSING FOR TRANSLATION ===`);
      console.log(`Current value: "${finalValue}"`);

      try {
        const retryPrompt = createProcessingPrompt(
          field,
          finalValue,
          options,
          userLanguage,
          formLanguage,
        );
        const retryGeminiRaw = await callGeminiFlash(
          finalValue,
          retryPrompt,
          formLanguage,
        );
        const retryCleaned = cleanGeminiOutput(retryGeminiRaw);
        const retryFixed = fixWeirdText(retryCleaned);
        finalValue = normalizeIndianText(retryFixed);
        console.log(`After re-processing: "${finalValue}"`);
      } catch (retryError) {
        console.log("Re-processing error, keeping current value");
      }
      console.log(`=== END RE-PROCESSING ===\n`);
    }

    // ALWAYS return success with processed value
    console.log(`RETURNING VALUE: "${finalValue}"`);
    return res.status(200).json({
      value: finalValue || input,
      field: field,
      originalInput: input,
      model: "gemini-1.5-flash",
      formLanguage: formLanguage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // FINAL CATCH - Should rarely happen due to inner try-catches
    console.log("=== CRITICAL ENDPOINT ERROR ===");
    console.log(error);
    if (error.response) {
      console.log("Response Data:", error.response.data);
    }
    console.log("=== END CRITICAL ERROR ===");

    // Still return a successful HTTP response with fallback value
    console.log(`FALLBACK TO INPUT: "${input}"`);
    return res.status(200).json({
      value: input || "",
      field: field,
      originalInput: input || "",
      error: "Processing failed, returning original input",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get field type from label for processing
function getFieldTypeFromLabel(field) {
  const fieldLower = field.toLowerCase();

  // Remove conversion markers
  const cleanField = field
    .replace(/\s*\(.*?\)/, "")
    .toLowerCase()
    .trim();

  // Check for specific field type indicators
  if (
    cleanField.includes("name") ||
    cleanField.includes("full name") ||
    cleanField.includes("first name") ||
    cleanField.includes("last name")
  ) {
    return "name";
  } else if (
    cleanField.includes("email") ||
    cleanField.includes("email address") ||
    cleanField.includes("e-mail")
  ) {
    return "email";
  } else if (
    cleanField.includes("phone") ||
    cleanField.includes("telephone") ||
    cleanField.includes("mobile") ||
    cleanField.includes("contact")
  ) {
    return "phone";
  } else if (
    cleanField.includes("address") ||
    cleanField.includes("street") ||
    cleanField.includes("city") ||
    cleanField.includes("state") ||
    cleanField.includes("zip") ||
    cleanField.includes("postal")
  ) {
    return "address";
  } else if (
    cleanField.includes("age") ||
    cleanField.includes("birthday") ||
    cleanField.includes("birth") ||
    cleanField.includes("date")
  ) {
    return "date";
  } else if (
    cleanField.includes("company") ||
    cleanField.includes("work") ||
    cleanField.includes("job") ||
    cleanField.includes("occupation") ||
    cleanField.includes("position")
  ) {
    return "company";
  } else if (
    cleanField.includes("comment") ||
    cleanField.includes("message") ||
    cleanField.includes("notes") ||
    cleanField.includes("description")
  ) {
    return "text";
  } else {
    return "text"; // Default fallback
  }
}

// Simplified prompt design for accurate processing
function createProcessingPrompt(
  field,
  input,
  options = null,
  userLanguage = null,
  formLanguage = null,
) {
  const fieldType = getFieldTypeFromLabel(field);
  let actualField = field.replace(/\s*\(.*?\)/, "").trim(); // Remove conversion markers

  // Base prompt structure with strict language rules
  let basePrompt = `Extract correct value for "${actualField}" from this input: "${input}".

CRITICAL RULES:
- Return ONLY the final value
- No explanation

- If input contains Hindi characters and form is English:
  → DO NOT perform phonetic transliteration
  → Convert to correct real-world English spelling
  → Use commonly known English words instead of phonetic spelling
  → Use common known spellings (e.g., Mumbai, Borivali)
  → Fix grammar and spacing
  → Return natural, readable English

Examples:
- "बोरीवली रोड मुंबई" → "Borivali Road Mumbai"
- "मैथमेटिक्स" → "Mathematics"
- "कुछ भी नहीं" → "Nothing"
- "अंकित कुमार" → "Ankit Kumar"
- "राहुल" → "Rahul"
- "प्रिया" → "Priya"

- NEVER translate meaning
- NEVER return Hindi if form is English
- ALWAYS return proper English for English forms`;

  // Add field-specific processing rules
  if (fieldType === "address") {
    basePrompt += `
- Convert to proper English address format
- Use correct city and place names
- Example: "बोरीवली रोड मुंबई" → "Borivali Road Mumbai"`;
  }

  if (fieldType === "name") {
    basePrompt += `
- Use proper human name spelling
- Capitalize correctly
- Example: "अंकित कुमार" → "Ankit Kumar"`;
  }

  if (fieldType === "text") {
    basePrompt += `
- Convert to natural English sentence
- Fix grammar
- Example: "कुछ भी नहीं" → "Nothing"`;
  }

  basePrompt += `

Return ONLY the final clean value.`;

  // Special handling for dropdown fields
  if (options && Array.isArray(options) && options.length > 0) {
    const optionTexts = options.map((opt) => opt.text).join(", ");
    basePrompt += `\n\nOptions: ${optionTexts}`;
  }

  return basePrompt;
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
    अ: "a",
    आ: "aa",
    इ: "i",
    ई: "ee",
    उ: "u",
    ऊ: "oo",
    ए: "e",
    ऐ: "ai",
    ओ: "o",
    औ: "au",
    क: "k",
    ख: "kh",
    ग: "g",
    घ: "gh",
    ङ: "ng",
    च: "ch",
    छ: "chh",
    ज: "j",
    झ: "jh",
    ञ: "ny",
    ट: "t",
    ठ: "th",
    ड: "d",
    ढ: "dh",
    ण: "n",
    त: "t",
    थ: "th",
    द: "d",
    ध: "dh",
    न: "n",
    प: "p",
    फ: "ph",
    ब: "b",
    भ: "bh",
    म: "m",
    य: "y",
    र: "r",
    ल: "l",
    व: "v",
    श: "sh",
    ष: "sh",
    स: "s",
    ह: "h",
    "ं": "n",
    "ः": "h",
    "ँ": "an",
    "ा": "a",
    "ि": "i",
    "ी": "ee",
    "ु": "u",
    "ू": "oo",
    "े": "e",
    "ै": "ai",
    "ो": "o",
    "ौ": "au",
    "ॉ": "o",
    "ा": "a",
    "ृ": "ri",
    "ॄ": "ree",
    "ॢ": "li",
    "ॣ": "lii",
  };

  // Simple character-by-character transliteration
  let result = "";
  for (let char of text) {
    result += transliterationMap[char] || char;
  }

  // Clean up common patterns
  result = result.replace(/a+/g, "a").replace(/i+/g, "i").replace(/u+/g, "u");
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

// Safe field-specific formatting - minimal modifications
function applyFieldSpecificFormatting(text, field) {
  if (!text) return "";

  let formatted = text.trim();
  const fieldLower = field.toLowerCase();

  // Only apply specific formatting for structured fields
  if (fieldLower.includes("email")) {
    // Extract email pattern only if it exists
    const emailMatch = formatted.match(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    );
    if (emailMatch) {
      formatted = emailMatch[0];
    }
  }

  if (fieldLower.includes("phone")) {
    // Extract phone numbers only
    const phoneMatch = formatted.match(/[\d\s\-\(\)\+]+/);
    if (phoneMatch) {
      formatted = phoneMatch[0];
    }
  }

  if (fieldLower.includes("date")) {
    // Extract date patterns only
    const dateMatch = formatted.match(
      /\d{1,4}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{1,4}/,
    );
    if (dateMatch) {
      formatted = dateMatch[0];
    }
  }

  if (fieldLower.includes("zip") || fieldLower.includes("postal")) {
    // Extract postal codes only
    const zipMatch = formatted.match(/\b\d{5,6}\b/);
    if (zipMatch) {
      formatted = zipMatch[0];
    }
  }

  // Simple name formatting - capitalize first letter only
  if (fieldLower.includes("name") && formatted.length > 0) {
    // Only capitalize if it looks like a name (no numbers, special chars)
    if (!/[\d@#$%^&*()]/.test(formatted)) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
  }

  if (fieldLower.includes("age")) {
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
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "Endpoint not found",
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
