// Content script for Aawazz extension
// Creates floating Aawazz button and includes form field extraction

// ========================================
// INITIALIZE: Detect form language early
// ========================================
// This will be called after DOM is ready
function initializeFormLanguageDetection() {
  console.log("Initializing form language detection...");

  // Detect and store form language globally
  const formLang = detectFormLanguage();
  console.log(`Form language initialized: ${formLang}`);

  // Also update in window for access
  window.formLanguageDetected = true;
}

// Call detection when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeFormLanguageDetection,
  );
} else {
  // DOM already loaded
  initializeFormLanguageDetection();
}

// Form field extraction functions
function safeGetTextContent(element) {
  return element ? element.textContent.trim() : "";
}

function safeGetAttribute(element, attribute) {
  return element ? (element.getAttribute(attribute) || "").trim() : "";
}

function getTextFromPreviousSibling(element) {
  const previousSibling = element ? element.previousElementSibling : null;
  return safeGetTextContent(previousSibling);
}

function generateFieldId(index) {
  return "aawazz-field-" + index;
}

function extractFieldLabel(element, index) {
  // 1. Check for label[for=id]
  if (element.id) {
    const labelElement = document.querySelector(`label[for="${element.id}"]`);
    const labelText = safeGetTextContent(labelElement);
    if (labelText) {
      return labelText;
    }
  }

  // 2. Check previous sibling text
  const previousSiblingText = getTextFromPreviousSibling(element);
  if (previousSiblingText) {
    return previousSiblingText;
  }

  // 3. Check parent container text
  const parentContainerText = safeGetTextContent(element.parentElement);
  if (parentContainerText) {
    return parentContainerText;
  }

  // 4. Check table cell (td) before input
  const tableCell = element.closest("td");
  if (tableCell) {
    const previousTableCellText = getTextFromPreviousSibling(tableCell);
    if (previousTableCellText) {
      return previousTableCellText;
    }
  }

  // 5. Check placeholder
  const placeholderText = safeGetAttribute(element, "placeholder");
  if (placeholderText) {
    return placeholderText;
  }

  // 6. Check aria-label
  const ariaLabelText = safeGetAttribute(element, "aria-label");
  if (ariaLabelText) {
    return ariaLabelText;
  }

  // 7. Fallback to "Field X"
  return "Field " + (index + 1);
}

/**
 * Extract label text from radio/checkbox input
 * Checks for associated label, data-label attribute, or value
 *
 * @param {Element} element - Radio or checkbox element
 * @returns {string} - Label text for the option
 */
function extractOptionLabel(element) {
  // 1. Check for associated label[for=id]
  if (element.id) {
    const labelElement = document.querySelector(`label[for="${element.id}"]`);
    if (labelElement) {
      const labelText = safeGetTextContent(labelElement);
      if (labelText) {
        return labelText;
      }
    }
  }

  // 2. Check data-label attribute
  const dataLabel = safeGetAttribute(element, "data-label");
  if (dataLabel) {
    return dataLabel;
  }

  // 3. Check for next sibling label element
  let nextSibling = element.nextElementSibling;
  while (nextSibling) {
    if (nextSibling.tagName.toLowerCase() === "label") {
      const labelText = safeGetTextContent(nextSibling);
      if (labelText) {
        return labelText;
      }
    }
    // Only check immediate siblings, not deep hierarchy
    if (
      nextSibling.tagName.toLowerCase() === "div" &&
      nextSibling.classList &&
      nextSibling.classList.contains("checkbox-option")
    ) {
      nextSibling = nextSibling.nextElementSibling;
      continue;
    }
    break;
  }

  // 4. Check element value
  const value = safeGetAttribute(element, "value");
  if (value) {
    return value;
  }

  // 5. Fallback to element text content
  const text = safeGetTextContent(element);
  if (text) {
    return text;
  }

  // 6. Last resort - use name attribute
  return element.name || "Option";
}

function getFieldType(element) {
  const tagName = element.tagName.toLowerCase();

  if (tagName === "input") {
    return element.type || "text";
  }

  return tagName;
}

function isFieldEmpty(element) {
  const value = element.value || "";
  return value.trim() === "";
}

function isFieldVisible(element) {
  // Check if element or any parent is hidden
  let current = element;
  while (current) {
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

function extractFields() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║ PHASE 1: EXTRACT RAW ELEMENTS          ║");
  console.log("╚════════════════════════════════════════╝");

  // PHASE 1: Collect all raw elements by category
  // ═══════════════════════════════════════════════════════════
  const singleElements = []; // Text, email, date, select, textarea
  const radioElements = [];
  const checkboxElements = [];

  // Use safe querySelector to find all relevant form elements
  // Simplified selector to avoid pseudo-selector complexity
  const inputElements = document.querySelectorAll('input, textarea, select');
  
  console.log(`Total form elements found: ${inputElements.length}`);

  const formElements = Array.from(inputElements).filter((element) => {
    // Skip hidden inputs
    if (element.type === "hidden") return false;
    
    // Skip submit/button/reset
    if (element.type === "submit" || element.type === "button" || element.type === "reset") return false;
    
    // Skip Aawazz UI elements
    if (element.id && (element.id.includes("Aawazz") || element.id.includes("aawazz"))) return false;
    
    return true;
  });

  console.log(`After filtering: ${formElements.length} usable elements`);

  formElements.forEach((element) => {
    console.log(`Processing element: type="${element.type}", name="${element.name}", id="${element.id}"`);
    
    // Skip if field is not visible
    if (!isFieldVisible(element)) {
      console.log("  [SKIP] Hidden field:", element.name || element.id);
      return;
    }

    // Skip if element is within Aawazz UI container
    const aawazzContainer = document.getElementById("Aawazz-ui");
    if (aawazzContainer && aawazzContainer.contains(element)) {
      console.log("  [SKIP] Aawazz UI element:", element.name || element.id);
      return;
    }

    // Categorize by type
    if (element.type === "radio") {
      console.log(`  [RADIO] ✓ Adding to radio collection: ${element.name}`);
      radioElements.push(element);
    } else if (element.type === "checkbox") {
      console.log(`  [CHECKBOX] ✓ Adding to checkbox collection: ${element.name}`);
      checkboxElements.push(element);
    } else {
      console.log(`  [SINGLE] ✓ Adding to single collection: ${element.name || element.id} (${element.type})`);
      singleElements.push(element);
    }
  });

  console.log(`✓ Phase 1 Summary: ${singleElements.length} singles, ${radioElements.length} radios, ${checkboxElements.length} checkboxes`);

  // ═══════════════════════════════════════════════════════════
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║ PHASE 2: GROUP ELEMENTS                ║");
  console.log("╚════════════════════════════════════════╝");

  // PHASE 2: Group radio and checkbox elements by name
  // ═══════════════════════════════════════════════════════════
  const radioGroups = new Map();
  const checkboxGroups = new Map();

  // Group radios by name
  radioElements.forEach((radio) => {
    const groupName = radio.name;
    if (!radioGroups.has(groupName)) {
      radioGroups.set(groupName, []);
      console.log(`  [GROUP] Creating radio group: "${groupName}"`);
    }
    radioGroups.get(groupName).push(radio);
  });

  // Group checkboxes by name
  checkboxElements.forEach((checkbox) => {
    const groupName = checkbox.name;
    if (!checkboxGroups.has(groupName)) {
      checkboxGroups.set(groupName, []);
      console.log(`  [GROUP] Creating checkbox group: "${groupName}"`);
    }
    checkboxGroups.get(groupName).push(checkbox);
  });

  console.log(`Grouping complete: ${radioGroups.size} radio groups, ${checkboxGroups.size} checkbox groups`);

  // ═══════════════════════════════════════════════════════════
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║ PHASE 3: CREATE FIELD OBJECTS          ║");
  console.log("╚════════════════════════════════════════╝");

  // PHASE 3: Create field objects from grouped/categorized elements
  // ═══════════════════════════════════════════════════════════
  const fields = [];

  // Process SINGLE elements
  console.log("\n→ Processing single elements:");
  singleElements.forEach((element, index) => {
    // Skip if field is not empty (only for inputs/textareas)
    if (
      (element.tagName.toLowerCase() === "input" ||
        element.tagName.toLowerCase() === "textarea") &&
      !isFieldEmpty(element)
    ) {
      console.log(`    [SKIP] Field not empty: ${element.name || element.id}`);
      return;
    }

    // Generate unique ID if missing
    if (!element.id && !element.name) {
      element.id = generateFieldId(index);
    }

    const fieldId = element.id || element.name || generateFieldId(index);
    let fieldType = getFieldType(element);
    const fieldLabel = extractFieldLabel(element, index);

    // Check if this is a date field
    if (isDateField(element, fieldLabel)) {
      fieldType = "date-field";
      const dateFormat = detectDateFormat(element);
      console.log(
        `    [DATE] "${fieldLabel}" - format: ${dateFormat}`,
      );

      fields.push({
        id: fieldId,
        type: fieldType,
        label: fieldLabel,
        element: element,
        dateFormat: dateFormat,
      });
    } else {
      console.log(
        `    [FIELD] "${fieldLabel}" (${fieldType})`,
      );
      fields.push({
        id: fieldId,
        type: fieldType,
        label: fieldLabel,
        element: element,
      });
    }
  });

  // Process RADIO GROUPS - create one field per group
  console.log("\n→ Processing radio groups:");
  radioGroups.forEach((radioElements, groupName) => {
    const firstRadio = radioElements[0];
    const fieldLabel = extractFieldLabel(firstRadio, fields.length) || groupName;

    const options = radioElements.map((radio) => ({
      text: extractOptionLabel(radio),
      value: radio.value,
      element: radio,
    }));

    console.log(
      `    [RADIO-GROUP] "${fieldLabel}" (${options.length} options)`,
    );

    fields.push({
      id: groupName,
      type: "radio-group",
      label: fieldLabel,
      element: firstRadio,
      options: options,
      allElements: radioElements,
    });
  });

  // Process CHECKBOX GROUPS - create one field per group
  console.log("\n→ Processing checkbox groups:");
  checkboxGroups.forEach((checkboxElements, groupName) => {
    const firstCheckbox = checkboxElements[0];
    const fieldLabel =
      extractFieldLabel(firstCheckbox, fields.length) || groupName;

    const options = checkboxElements.map((checkbox) => ({
      text: extractOptionLabel(checkbox),
      value: checkbox.value,
      element: checkbox,
    }));

    console.log(
      `    [CHECKBOX-GROUP] "${fieldLabel}" (${options.length} options)`,
    );

    fields.push({
      id: groupName,
      type: "checkbox-group",
      label: fieldLabel,
      element: firstCheckbox,
      options: options,
      allElements: checkboxElements,
    });
  });

  console.log(`\n✓ Grouping and field creation complete. Total fields: ${fields.length}\n`);

  return fields;
}

// Speech synthesis function
function speak(text) {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (event) => {
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };

    speechSynthesis.speak(utterance);
  });
}

// 🔧 FINAL CLEAN LISTEN FUNCTION WITH ENHANCED TIMEOUT HANDLING
function listen() {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    recognition = new SpeechRecognition();

    recognition.lang = selectedLanguage === "hi-IN" ? "hi-IN" : "en-US";
    recognition.continuous = true; // Enable to capture full phrases
    recognition.interimResults = false; // Disable interim results for cleaner recognition
    recognition.maxAlternatives = 1; // Use single best result to avoid fragmentation

    // Set timeout for longer listening - INCREASED from 5s to 8s
    recognition.maxDuration = 8000; // 8 seconds to capture full input

    let resolved = false;

    recognition.onresult = (event) => {
      if (resolved) return;

      // Get the final result from continuous recognition
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const finalText = result[0].transcript.trim();
        console.log("Final recognized:", finalText);

        // Clean up common speech recognition errors for names (English only)
        let bestText = finalText;
        if (selectedLanguage === "en-IN") {
          bestText = cleanNameRecognition(finalText);
        }

        if (bestText.length > 0) {
          resolved = true;
          recognition.stop();
          resolve(bestText);
        }
      }
    };

    recognition.onerror = (err) => {
      if (!resolved) {
        resolved = true;
        // Include error type for retry logic
        reject({
          error: err.error,
          type: "recognition_error",
        });
      }
    };

    recognition.onend = () => {
      if (!resolved) {
        reject({
          error: "No speech detected",
          type: "no_speech",
        });
      }
    };

    // Add timeout to stop recognition after 8 seconds - INCREASED from 5s to 8s
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        recognition.stop();
        reject({
          error: "Speech recognition timeout",
          type: "timeout",
        });
      }
    }, 8000);

    recognition.start();
  });
}

// Enhanced listen function with automatic retry on timeout
async function listenWithRetry(retryCount = 0) {
  const MAX_RETRIES = 1; // Retry once on timeout

  try {
    console.log(`Listening attempt ${retryCount + 1}...`);
    const result = await listen();
    console.log(`Successfully recognized: "${result}"`);
    return result;
  } catch (error) {
    // Check if error is a timeout error
    const isTimeout =
      error.type === "timeout" ||
      (typeof error === "object" && error.error === "timeout") ||
      (typeof error === "string" && error.includes("timeout"));

    // If timeout and we haven't exceeded max retries, retry once
    if (isTimeout && retryCount < MAX_RETRIES) {
      console.log(`Timeout occurred, retrying... (attempt ${retryCount + 2})`);
      // Add small delay before retry
      await new Promise((resolve) => setTimeout(resolve, 500));
      return listenWithRetry(retryCount + 1);
    }

    // If non-timeout error or max retries reached, reject
    throw error;
  }
}

// Helper function to check if a field is a password field
function isPasswordField(element) {
  if (!element) return false;

  const tagName = (element.tagName || "").toLowerCase();
  const inputType = (element.type || "").toLowerCase();

  // Direct type check
  if (inputType === "password") {
    return true;
  }

  // Check field label/name for password indicators
  const label = (element.name || element.id || "").toLowerCase();
  const passwordIndicators = [
    "password",
    "pass",
    "pwd",
    "passwd",
    "secret",
    "pin",
  ];

  return (
    tagName === "input" &&
    passwordIndicators.some((indicator) => label.includes(indicator))
  );
}

// Helper function to clean password input - removes all spaces
function cleanPasswordInput(value) {
  if (!value) return "";

  // Remove ALL spaces from password (passwords don't have spaces)
  return value.replace(/\s+/g, "");
}

// Helper function to identify field type
function getFieldTypeFromElement(element) {
  if (!element) return "text";

  const tagName = (element.tagName || "").toLowerCase();

  if (tagName === "input") {
    return element.type || "text";
  }

  return tagName;
}

// Helper function to check if a field is an email field
function isEmailField(element) {
  if (!element) return false;

  const inputType = (element.type || "").toLowerCase();
  if (inputType === "email") return true;

  const label = (element.name || element.id || "").toLowerCase();
  return label.includes("email") || label.includes("mail");
}

// Helper function to check if a field is a phone field
function isPhoneField(element) {
  if (!element) return false;

  const inputType = (element.type || "").toLowerCase();
  if (inputType === "tel" || inputType === "phone") return true;

  const label = (element.name || element.id || "").toLowerCase();
  const phoneIndicators = ["phone", "mobile", "contact", "telephone"];

  return phoneIndicators.some((indicator) => label.includes(indicator));
}

// Helper function to check if a field is a date field
function isDateField(element, fieldLabel = "") {
  if (!element) return false;

  const inputType = (element.type || "").toLowerCase();
  if (inputType === "date") return true;

  const label = (element.name || element.id || "").toLowerCase();
  const combinedLabel = (label + " " + (fieldLabel || "")).toLowerCase();
  const dateIndicators = [
    "date",
    "dob",
    "birth",
    "birthday",
    "जन्म",
    "तारीख",
    "डेट",
  ];

  return dateIndicators.some((indicator) => combinedLabel.includes(indicator));
}

/**
 * Detect date format from element placeholder or label
 * @param {HTMLElement} element - The date input element
 * @returns {string} - Format type: "yyyy-mm-dd", "dd-mm-yyyy", "dd/mm/yyyy", or "auto"
 */
function detectDateFormat(element) {
  if (!element) return "auto";

  // Check placeholder
  const placeholder = (element.placeholder || "").toLowerCase();
  if (placeholder.includes("yyyy-mm-dd") || placeholder.includes("yyyy-mm-dd")) {
    return "yyyy-mm-dd";
  }
  if (placeholder.includes("dd-mm-yyyy")) {
    return "dd-mm-yyyy";
  }
  if (placeholder.includes("dd/mm/yyyy")) {
    return "dd/mm/yyyy";
  }

  // Check aria-label
  const ariaLabel = (element.getAttribute("aria-label") || "").toLowerCase();
  if (ariaLabel.includes("yyyy-mm-dd")) return "yyyy-mm-dd";
  if (ariaLabel.includes("dd-mm-yyyy")) return "dd-mm-yyyy";
  if (ariaLabel.includes("dd/mm/yyyy")) return "dd/mm/yyyy";

  // Check title
  const title = (element.title || "").toLowerCase();
  if (title.includes("yyyy-mm-dd")) return "yyyy-mm-dd";
  if (title.includes("dd-mm-yyyy")) return "dd-mm-yyyy";
  if (title.includes("dd/mm/yyyy")) return "dd/mm/yyyy";

  // For text-based inputs (not type=date), use dd-mm-yyyy as default
  if (element.type !== "date") {
    return "dd-mm-yyyy";
  }

  // For date inputs, use yyyy-mm-dd (browser standard)
  return "yyyy-mm-dd";
}

// Helper function to check if a field is a username field
function isUsernameField(element) {
  if (!element) return false;

  const label = (element.name || element.id || "").toLowerCase();
  const usernameIndicators = [
    "username",
    "user name",
    "user_name",
    "userid",
    "user_id",
    "login",
    "account",
    "handle",
    "@",
  ];

  return usernameIndicators.some((indicator) => label.includes(indicator));
}

// Helper function to clean username input - removes all spaces
function cleanUsernameInput(value) {
  if (!value) return "";

  // Remove ALL spaces from username (usernames don't have spaces)
  return value.replace(/\s+/g, "");
}

// ========================================
// COMPREHENSIVE FIELD TYPE DETECTION
// ========================================

/**
 * Detect field category based on element and label
 * Returns one of: "password", "email", "phone", "normal"
 *
 * @param {Element} element - The form element to analyze
 * @param {string} fieldLabel - The field label/name (optional, for better detection)
 * @returns {string} - One of: "password", "email", "phone", "normal"
 */
function detectFieldType(element, fieldLabel = "") {
  if (!element) return "normal";

  // Priority 1: Check for password field
  if (isPasswordField(element)) {
    return "password";
  }

  // Priority 2: Check for email field (use label for better detection)
  if (isEmailFieldEnhanced(element, fieldLabel)) {
    return "email";
  }

  // Priority 3: Check for phone field
  if (isPhoneField(element)) {
    return "phone";
  }

  // Default: Normal field
  return "normal";
}

/**
 * Enhanced email field detection
 * Checks both element attributes and provided field label
 *
 * @param {Element} element - The form element
 * @param {string} fieldLabel - The field label for additional context
 * @returns {boolean}
 */
function isEmailFieldEnhanced(element, fieldLabel = "") {
  if (!element) return false;

  const inputType = (element.type || "").toLowerCase();
  if (inputType === "email") return true;

  // Check element name/id
  const elementLabel = (element.name || element.id || "").toLowerCase();
  const combinedLabel = (elementLabel + " " + (fieldLabel || "")).toLowerCase();

  return (
    combinedLabel.includes("email") ||
    combinedLabel.includes("mail") ||
    combinedLabel.includes("e-mail")
  );
}

/**
 * Process password input: remove spaces and convert Hindi to English
 * Do NOT use AI - handle directly on frontend
 *
 * @param {string} rawInput - Raw password input from speech
 * @returns {string} - Cleaned password ready for form field
 */
function processPasswordInput(rawInput) {
  if (!rawInput) return "";

  console.log(`Password input processing: "${rawInput}"`);

  // Step 1: Convert Hindi letters to English using transliteration
  let converted = rawInput;
  if (containsHindiCharacters(rawInput)) {
    converted = basicHindiToEnglish(rawInput);
    console.log(
      `Step 1 - Hindi to English conversion: "${rawInput}" → "${converted}"`,
    );
  }

  // Step 2: Remove ALL spaces (passwords don't have spaces)
  const cleaned = converted.replace(/\s+/g, "");
  console.log(`Step 2 - Remove spaces: "${converted}" → "${cleaned}"`);

  // Step 3: Additional cleanup - remove common speech artifacts
  let final = cleaned
    .replace(/\s+/g, "") // Double-check no spaces
    .trim();

  console.log(`Password final: "${final}"`);
  return final;
}

/**
 * Process email input: convert Hindi symbols, transliterate, remove spaces
 * Ensures output is always valid English email format
 * Do NOT use AI - handle directly on frontend
 *
 * CRITICAL ORDER:
 * 1. Replace Hindi phrases FIRST (लंबे phrases)
 * 2. Then replace Hindi single words
 * 3. THEN transliterate remaining Hindi
 * 4. THEN remove spaces
 *
 * @param {string} rawInput - Raw email input from speech
 * @returns {string} - Cleaned email ready for form field (lowercase, no spaces)
 *
 * Examples:
 * "अंकित एट द रेट gmail डॉट com" → "ankit@gmail.com"
 * "राज एट जीमेल डॉट कॉम" → "raj@gmail.com"
 * "name@email.com" → "name@email.com"
 */
function processEmailInput(rawInput) {
  if (!rawInput) return "";

  console.log(`Email input processing: "${rawInput}"`);

  let processed = rawInput;

  // Step 1: Replace MULTI-WORD Hindi phrases FIRST
  // These must be replaced before single-word replacements to avoid partial matches
  const hindiMultiWordPhrases = [
    { phrase: "एट द रेट", replacement: "@", desc: "at the rate" },
    { phrase: "एट्  द रेट", replacement: "@", desc: "at the rate (variant)" },
    {
      phrase: "एट  द रेट",
      replacement: "@",
      desc: "at the rate (extra space)",
    },
    { phrase: "at the rate", replacement: "@", desc: "English at the rate" },
  ];

  for (const { phrase, replacement, desc } of hindiMultiWordPhrases) {
    // Use exact string matching (case-insensitive) without word boundaries
    // This avoids issues with Devanagari script and \b
    const regex = new RegExp(phrase.replace(/\s+/g, "\\s+"), "gi");
    if (regex.test(processed)) {
      processed = processed.replace(regex, replacement);
      console.log(`  Multi-word replacement: "${desc}" → "${replacement}"`);
    }
  }

  console.log(
    `Step 1 - Multi-word phrases converted: "${rawInput}" → "${processed}"`,
  );

  // Step 2: Replace SINGLE-WORD Hindi symbols
  const hindiSingleWordSymbols = [
    // @ symbol variants
    { word: "एट्", symbol: "@", desc: "at with nukta" },
    { word: "एट", symbol: "@", desc: "at" },
    { word: "at", symbol: "@", desc: "English at" },

    // . symbol variants
    { word: "ड़ॉट", symbol: ".", desc: "dot with heavy nukta" },
    { word: "डॉट्", symbol: ".", desc: "dot with nukta" },
    { word: "डॉट", symbol: ".", desc: "dot in Hindi" },
    { word: "डट", symbol: ".", desc: "alternative dot" },
    { word: "dot", symbol: ".", desc: "English dot" },

    // Space (user might say "space" instead of symbol)
    { word: "स्पेस", symbol: " ", desc: "space" },
  ];

  for (const { word, symbol, desc } of hindiSingleWordSymbols) {
    // Check if word is ASCII or contains Devanagari characters
    const isASCII = /^[a-z]+$/i.test(word);

    let regex;
    if (isASCII) {
      // ASCII words: use word boundaries
      regex = new RegExp(`\\b${word}\\b`, "gi");
      processed = processed.replace(regex, symbol);
    } else {
      // Devanagari words: use space or line boundaries (no \b for Devanagari)
      regex = new RegExp(`(^|\\s)${word}(\\s|$)`, "gi");
      // Replace with group 1 + symbol + group 2 to preserve boundaries
      processed = processed.replace(regex, `$1${symbol}$2`);
    }

    // Log if replacement happened
    if (processed.includes(symbol)) {
      console.log(
        `  Single-word replacement: "${desc}" (${word}) → "${symbol}"`,
      );
    }
  }

  console.log(`Step 2 - Single-word symbols converted: "${processed}"`);

  // Step 3: NOW transliterate any remaining Hindi letters to English
  // This happens AFTER all symbol replacements
  if (containsHindiCharacters(processed)) {
    const transliterated = basicHindiToEnglish(processed);
    console.log(
      `Step 3 - Hindi letters transliterated: "${processed}" → "${transliterated}"`,
    );
    processed = transliterated;
  }

  // Step 4: Remove all spaces
  // Now safe to remove spaces since symbols are already replaced
  processed = processed.replace(/\s+/g, "");
  console.log(`Step 4 - Spaces removed: "${processed}"`);

  // Step 5: Normalize email format
  // Remove duplicate symbols to ensure valid email
  processed = processed.replace(/@+/g, "@"); // Only one @
  processed = processed.replace(/\.+/g, "."); // Only one dot per location

  // Step 6: Lowercase (email standard)
  const final = processed.toLowerCase().trim();
  console.log(`Email final: "${final}"`);

  return final;
}

/**
 * Get canonical field type for processing decisions
 * Maps various field types to standardized categories
 *
 * @param {string} htmlFieldType - HTML input type (text, email, password, tel, etc.)
 * @returns {string} - Canonical type: "password", "email", "phone", "date", "number", "text"
 */
function getCanonicalFieldType(htmlFieldType) {
  if (!htmlFieldType) return "text";

  const normalized = htmlFieldType.toLowerCase().trim();

  // Map various input types to categories
  const typeMap = {
    password: "password",
    email: "email",
    tel: "phone",
    phone: "phone",
    date: "date",
    datetime: "date",
    "datetime-local": "date",
    number: "number",
    url: "url",
    search: "text",
    text: "text",
  };

  return typeMap[normalized] || "text";
}

/**
 * Check if a field should skip AI processing
 * Returns true for structured/sensitive fields
 *
 * @param {Element} element - Form element
 * @param {string} fieldLabel - Field label for context
 * @returns {boolean}
 */
function shouldSkipAIProcessing(element, fieldLabel = "") {
  // ✅ FIX 4: STOP AI FOR DATE COMPLETELY
  if (isDateField(element, fieldLabel)) {
    console.log(`Skipping AI: Date field`);
    return true;
  }

  const fieldType = detectFieldType(element, fieldLabel);

  // Skip AI for password (always)
  if (fieldType === "password") {
    console.log(`Skipping AI: Password field`);
    return true;
  }

  // Skip AI for email (use light normalization instead)
  if (fieldType === "email") {
    console.log(`Skipping AI: Email field (use light normalization)`);
    return true;
  }

  // Don't skip for phone and normal fields
  return false;
}

/**
 * Enforce language on AI output for normal fields
 * After AI processes a field, enforce the form language
 *
 * @param {string} aiOutput - The text returned from AI
 * @param {string} formLanguage - The form language: "hi" or "en"
 * @param {string} originalInput - The original user input (used as fallback if needed)
 * @returns {string} - Text enforced to match form language, no mixed output
 *
 * Logic:
 * - If formLanguage is "hi" (Hindi form):
 *   - Convert English output to Hindi
 *   - Remove any leftover English words (prevent mixed output)
 *   - If mixed output detected with unmapped English, use original input
 * - If formLanguage is "en" (English form):
 *   - Convert Hindi output to English
 */
function enforceLanguageOnOutput(aiOutput, formLanguage, originalInput = "") {
  if (!aiOutput) return "";

  formLanguage = (formLanguage || "en").toLowerCase();

  console.log(`\n=== ENFORCE LANGUAGE ===`);
  console.log(`Input: "${aiOutput}"`);
  console.log(`Target language: ${formLanguage}`);
  console.log(`Original input (fallback): "${originalInput}"`);

  let result = aiOutput;
  const hasHindi = containsHindiCharacters(aiOutput);
  const hasEnglish = /[a-z]/i.test(aiOutput); // Contains Latin characters

  // Case 1: Form language is Hindi
  if (formLanguage === "hi") {
    console.log(
      "Form language is Hindi - converting to Hindi, no mixed output",
    );

    // If output is pure Hindi, keep it
    if (hasHindi && !hasEnglish) {
      console.log("✅ Pure Hindi text, no conversion needed");
      result = aiOutput;
    }
    // If output is pure English, convert it
    else if (!hasHindi && hasEnglish) {
      console.log("Pure English text, converting to Hindi");
      result = convertToHindi(aiOutput);
      console.log(`English → Hindi: "${aiOutput}" → "${result}"`);
    }
    // If output is MIXED (has both Hindi and English)
    else if (hasHindi && hasEnglish) {
      console.log("⚠️  Mixed output detected (Hindi + English)");
      console.log(`Mixed text: "${aiOutput}"`);

      // Try to convert to pure Hindi
      result = convertToHindiWithFallback(aiOutput, originalInput);

      // Check if result is still mixed
      if (/[a-z]/i.test(result)) {
        console.log(`⚠️  Still has English after conversion: "${result}"`);
        console.log("Using original input as fallback");
        result = originalInput || aiOutput;
      }

      console.log(`Result: "${result}"`);
    }
  }
  // Case 2: Form language is English
  else if (formLanguage === "en") {
    console.log("Form language is English - ensuring pure English, no Hindi");

    // If output is pure English, keep it
    if (!hasHindi && hasEnglish) {
      console.log("✅ Pure English text, no conversion needed");
      result = aiOutput;
    }
    // If output is pure Hindi, convert it
    else if (hasHindi && !hasEnglish) {
      console.log("Pure Hindi text, converting to English");
      result = basicHindiToEnglish(aiOutput);
      console.log(`Hindi → English: "${aiOutput}" → "${result}"`);
    }
    // If output is MIXED (has both Hindi and English)
    else if (hasHindi && hasEnglish) {
      console.log("⚠️  Mixed output detected (Hindi + English)");

      // Convert all Hindi to English
      result = basicHindiToEnglish(aiOutput);
      console.log(`Hindi → English: "${aiOutput}" → "${result}"`);
    }
  }

  // Final check: Verify no mixed output for Hindi form
  if (formLanguage === "hi" && /[a-z]/i.test(result)) {
    console.log("❌ ERROR: Still has English characters after processing");
    console.log(`Fallback to: "${originalInput}"`);
    result = originalInput || aiOutput;
  }

  console.log(`Output: "${result}"`);
  console.log(`=== END ENFORCE ===\n`);

  return result;
}

/**
 * Convert English text to Hindi using word mapping, with fallback for unmapped words
 * Attempts to convert all English to Hindi
 * If some words remain unmapped (broken English), returns the attempted conversion
 *
 * @param {string} text - Text with potential English words
 * @param {string} fallbackText - Original input to return if conversion fails
 * @returns {string} - Hindi text, or original if too many unmapped words
 */
function convertToHindiWithFallback(text, fallbackText = "") {
  if (!text) return fallbackText;

  // First pass: normal conversion
  let result = convertToHindi(text);

  // Count unmapped English words in result
  const englishWords = result.match(/[a-z]+/gi) || [];
  const hindiWords = (result.match(/[\u0900-\u097F]+/g) || []).length;

  console.log(
    `Conversion analysis: ${englishWords.length} English words, ${hindiWords} Hindi words`,
  );

  // If too many English words remain (>50% unmapped), use fallback
  const totalWords = result.split(/\s+/).length;
  const unmappedPercentage = englishWords.length / totalWords;

  if (unmappedPercentage > 0.5 && fallbackText) {
    console.log(
      `⚠️  Too many unmapped words (${unmappedPercentage.toLocaleString("en-US", { style: "percent" })}), using fallback`,
    );
    return fallbackText;
  }

  return result;
}

/**
 * Convert English text to Hindi using a mapping of common words
 * This is a best-effort conversion for form field values
 *
 * @param {string} text - English text to convert
 * @returns {string} - Hindi text or original if no mapping exists
 */
/**
 * Convert English text to Hindi using word mapping
 * Splits text into words, maps each word using Hindi dictionary, rejoins
 * Unmapped words are preserved as-is (for names, numbers, etc.)
 *
 * @param {string} text - English text to convert
 * @returns {string} - Hindi text (or mixed Hinglish for unmapped words)
 *
 * Examples:
 * "ankit kumar" → "अंकित कुमार"
 * "mumbai maharashtra" → "मुंबई महाराष्ट्र"
 * "sector 5 road" → "सेक्टर 5 रोड"
 */
function convertToHindi(text) {
  if (!text) return "";

  // Comprehensive English to Hindi mapping for common form field values
  const hindiMap = {
    // Common words
    yes: "हाँ",
    no: "नहीं",
    male: "पुरुष",
    female: "महिला",
    other: "अन्य",
    select: "चुनें",
    please: "कृपया",
    thank: "धन्यवाद",
    thanks: "धन्यवाद",
    hello: "नमस्ते",
    hi: "नमस्ते",
    okay: "ठीक",
    ok: "ठीक",

    // Names (common examples)
    ankit: "अंकित",
    kumar: "कुमार",
    rahul: "राहुल",
    priya: "प्रिया",
    amit: "अमित",
    ravi: "रवि",
    neha: "नेहा",
    aman: "अमन",
    vishal: "विशाल",
    pooja: "पूजा",

    // Cities
    mumbai: "मुंबई",
    delhi: "दिल्ली",
    bangalore: "बेंगलुरु",
    bengaluru: "बेंगलुरु",
    chennai: "चेन्नई",
    kolkata: "कोलकाता",
    calcutta: "कोलकाता",
    hyderabad: "हैदराबाद",
    pune: "पुणे",
    goa: "गोवा",

    // States
    maharashtra: "महाराष्ट्र",
    karnataka: "कर्नाटक",
    tamil: "तमिल",
    punjab: "पंजाब",
    kerala: "केरल",
    rajasthan: "राजस्थान",
    bihar: "बिहार",
    haryana: "हरियाणा",
    andhra: "आंध्र",
    telangana: "तेलंगाना",
    madhya: "मध्य",
    pradesh: "प्रदेश",
    uttar: "उत्तर",
    uttarakhand: "उत्तराखंड",
    assam: "असम",
    himachal: "हिमाचल",

    // Address related
    road: "रोड",
    street: "स्ट्रीट",
    sector: "सेक्टर",
    block: "ब्लॉक",
    building: "बिल्डिंग",
    apartment: "अपार्टमेंट",
    apt: "अपार्टमेंट",
    flat: "फ्लैट",
    floor: "फ्लोर",
    wing: "विंग",
    nagar: "नगर",
    colony: "कॉलोनी",
    phase: "फेज",
    plot: "प्लॉट",
    shop: "शॉप",
    office: "ऑफिस",

    // Directions
    east: "पूर्व",
    west: "पश्चिम",
    north: "उत्तर",
    south: "दक्षिण",
    left: "बाएं",
    right: "दाएं",
    center: "केंद्र",
    middle: "बीच में",

    // Common phrases
    nothing: "कुछ नहीं",
    something: "कुछ",
    everything: "सब कुछ",
    all: "सब",
    none: "कोई नहीं",
    same: "समान",
    different: "अलग",
    good: "अच्छा",
    very: "बहुत",
    bad: "बुरा",
    new: "नया",
    old: "पुराना",
    big: "बड़ा",
    small: "छोटा",
  };

  // Convert to lowercase and split by spaces
  const words = text.toLowerCase().split(/\s+/);

  // Map each word using the dictionary
  const mappedWords = words.map((word) => {
    // Skip empty strings
    if (!word) return word;

    // Try exact match first
    if (hindiMap[word]) {
      return hindiMap[word];
    }

    // Check if word is a number (preserve numbers)
    if (/^\d+$/.test(word)) {
      return word;
    }

    // If no mapping found, return original word
    // This preserves names, numbers, and other unmapped values
    console.log(`  ⚠️  Unmapped word: "${word}"`);
    return word;
  });

  // Join back with spaces
  const result = mappedWords.join(" ");

  console.log(`convertToHindi: "${text}" → "${result}"`);

  return result;
}

/**
 * Enhanced version of convertToHindi that also handles partial word matches
 * Useful for detecting Hindi words embedded in longer words
 *
 * @param {string} text - English text to convert
 * @returns {string} - Hindi text with partial matches also converted
 */
function convertToHindiAdvanced(text) {
  if (!text) return "";

  // First do word-by-word conversion
  let result = convertToHindi(text);

  // Then handle common word patterns (optional enhancement)
  // For example, handling "nagar" suffix in "vihar nagar" → "विहार नगर"
  const suffixMap = {
    nagar: "नगर",
    road: "रोड",
    street: "स्ट्रीट",
  };

  for (const [english, hindi] of Object.entries(suffixMap)) {
    const regex = new RegExp(`\\b${english}\\b`, "gi");
    result = result.replace(regex, hindi);
  }

  console.log(`convertToHindiAdvanced: "${text}" → "${result}"`);

  return result;
}

// Keep old function for backward compatibility (maps to new function)
function englishToHindiMapping(text) {
  return convertToHindi(text);
}

/**
 * Handle password field processing
 * - Skip AI entirely
 * - Remove all spaces
 * - Transliterate any Hindi characters to English
 *
 * @param {string} input - Raw password input from speech
 * @param {Element} element - Form element to fill
 * @returns {Promise<string>} - Processed password ready to fill
 */
async function handlePassword(input, element) {
  console.log("\n=== HANDLE PASSWORD FIELD ===");
  console.log(`Raw input: "${input}"`);

  // Step 1: Process password (remove spaces, transliterate Hindi)
  const processed = processPasswordInput(input);
  console.log(`Processed: "${processed}"`);

  // Function returns the cleaned password
  console.log("=== END PASSWORD ===\n");
  return processed;
}

/**
 * Handle email field processing
 * - Skip full AI
 * - Convert Hindi symbols to English (@, .)
 * - Transliterate Hindi letters to English
 * - Remove spaces
 * - Ensure lowercase
 *
 * @param {string} input - Raw email input from speech
 * @param {Element} element - Form element to fill
 * @returns {Promise<string>} - Processed email ready to fill
 */
async function handleEmail(input, element) {
  console.log("\n=== HANDLE EMAIL FIELD ===");
  console.log(`Raw input: "${input}"`);

  // Step 1: Process email (convert symbols, transliterate, remove spaces)
  const processed = processEmailInput(input);
  console.log(`Processed: "${processed}"`);

  // Function returns the cleaned email
  console.log("=== END EMAIL ===\n");
  return processed;
}

/**
 * Handle radio button group
 * - Speak all options
 * - Listen to user selection
 * - Match input to option
 * - Confirm selection
 * - Check the selected radio
 *
 * @param {Object} field - Radio group field with options
 * @param {string} input - Raw user input
 * @param {string} formLanguage - Form language (hi or en)
 * @returns {Promise<string>} - Selection confirmation
 */
async function handleRadioGroup(field, input, formLanguage) {
  console.log("\n=== HANDLE RADIO GROUP ===");
  console.log(`Field: "${field.label}"`);
  console.log(`Options: ${field.options.map((o) => o.text).join(", ")}`);
  console.log(`User input: "${input}"`);

  // ✓ Question was already asked and listened in main loop
  // ✓ Input was already captured
  // → Just match and confirm

  // Step 1: Match input to option
  const matchedOption = matchOptionFromInput(input, field.options);

  if (!matchedOption) {
    console.log("❌ No match found for input");
    const notFoundMsg =
      formLanguage === "hi"
        ? "विकल्प में मेल नहीं खाया। फिर से कोशिश करें।"
        : "No match found. Please try again.";
    await speak(notFoundMsg);
    return null; // Return null to retry
  }

  console.log(`✓ Matched option: "${matchedOption.text}"`);

  // Step 2: Confirm selection
  const confirmed = await confirmSelection(field.label, [matchedOption]);

  if (confirmed) {
    // Check the selected radio button
    matchedOption.element.checked = true;

    // Trigger change event
    const event = new Event("change", { bubbles: true });
    matchedOption.element.dispatchEvent(event);

    console.log(`✓ Radio checked: "${matchedOption.text}"`);
    console.log("=== END RADIO GROUP ===\n");

    return matchedOption.text;
  } else {
    console.log("User did not confirm selection");
    return null; // Return null to retry
  }
}

/**
 * Handle checkbox group
 * - Speak all options
 * - Listen to user selections (can select multiple)
 * - Match inputs to options
 * - Confirm selections
 * - Check all selected checkboxes
 *
 * @param {Object} field - Checkbox group field with options
 * @param {string} input - Raw user input (can have multiple selections)
 * @param {string} formLanguage - Form language (hi or en)
 * @returns {Promise<string>} - Selection confirmation
 */
async function handleCheckboxGroup(field, input, formLanguage) {
  console.log("\n=== HANDLE CHECKBOX GROUP ===");
  console.log(`Field: "${field.label}"`);
  console.log(`Options: ${field.options.map((o) => o.text).join(", ")}`);
  console.log(`User input: "${input}"`);

  // ✓ Question was already asked and listened in main loop
  // ✓ Input was already captured
  // → Just match and confirm

  // Step 1: Match multiple inputs to options
  const matchedOptions = matchMultipleOptions(input, field.options);

  if (matchedOptions.length === 0) {
    console.log("❌ No matches found for input");
    const notFoundMsg =
      formLanguage === "hi"
        ? "विकल्प में मेल नहीं खाया। फिर से कोशिश करें।"
        : "No match found. Please try again.";
    await speak(notFoundMsg);
    return null; // Return null to retry
  }

  console.log(
    `✓ Matched options: ${matchedOptions.map((o) => o.text).join(", ")}`,
  );

  // Step 2: Confirm selections
  const confirmed = await confirmSelection(field.label, matchedOptions);

  if (confirmed) {
    // Check all selected checkboxes
    matchedOptions.forEach((option) => {
      option.element.checked = true;

      // Trigger change event
      const event = new Event("change", { bubbles: true });
      option.element.dispatchEvent(event);

      console.log(`✓ Checkbox checked: "${option.text}"`);
    });

    console.log("=== END CHECKBOX GROUP ===\n");

    return matchedOptions.map((o) => o.text).join(", ");
  } else {
    console.log("User did not confirm selections");
    return null; // Return null to retry
  }
}

/**
 * Handle date field (DOB, Date, etc.)
 * - Listen to user input (day month year)
 * - Convert to proper format: YYYY-MM-DD
 * - Support Hindi month names
 * - Fill the date field
 *
 * @param {Object} field - Date field
 * @param {string} input - Raw date input from speech
 * @returns {Promise<string>} - Formatted date
 */
async function handleDateField(field, input) {
  console.log("\n=== HANDLE DATE FIELD ===");
  console.log(`Field: "${field.label}"`);
  console.log(`Raw input: "${input}"`);
  console.log(`Detected format: "${field.dateFormat || "auto"}"`);

  // Parse and format the date using detected format
  const formattedDate = parseAndFormatDate(input, field.dateFormat);
  console.log(`Formatted date: "${formattedDate}"`);

  if (!formattedDate) {
    console.log("Failed to parse date");
    await speak("तारीख समझ नहीं आई। फिर से कहें।");
    return null;
  }

  console.log("=== END DATE FIELD ===\n");
  return formattedDate;
}

/**
 * Parse and format date from spoken input
 * Supports multiple formats:
 * - "11 9 2006" → "2006-09-11" (YYYY-MM-DD) or "11-09-2006" (DD-MM-YYYY)
 * - "11 सितंबर 2006" → "2006-09-11" (YYYY-MM-DD) or "11-09-2006" (DD-MM-YYYY)
 * - "11 September 2006" → "2006-09-11" (YYYY-MM-DD) or "11-09-2006" (DD-MM-YYYY)
 *
 * @param {string} input - Raw date input from speech
 * @param {string} outputFormat - Output format: "yyyy-mm-dd", "dd-mm-yyyy", "dd/mm/yyyy", or "auto"
 * @returns {string} - Formatted date in requested format
 */
function parseAndFormatDate(input, outputFormat = "auto") {
  if (!input) return null;

  console.log(`Parsing date input: "${input}", requested format: "${outputFormat}"`);

  // Normalize output format
  const format = (outputFormat || "auto").toLowerCase();

  // ═══════════════════════════════════════════════════════════
  // CHECK 1: Already in YYYY-MM-DD format? 
  // ═══════════════════════════════════════════════════════════
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoRegex.test(input)) {
    console.log(`✓ Already in ISO format (YYYY-MM-DD): "${input}"`);
    // If text field expects DD-MM-YYYY, convert it
    if (format === "dd-mm-yyyy") {
      const [year, month, day] = input.split("-");
      const converted = `${day}-${month}-${year}`;
      console.log(`→ Converting to DD-MM-YYYY: "${converted}"`);
      return converted;
    } else if (format === "dd/mm/yyyy") {
      const [year, month, day] = input.split("-");
      const converted = `${day}/${month}/${year}`;
      console.log(`→ Converting to DD/MM/YYYY: "${converted}"`);
      return converted;
    }
    return input;
  }

  // Hindi month mappings
  const hindiMonths = {
    जनवरी: 1,
    फरवरी: 2,
    मार्च: 3,
    अप्रैल: 4,
    मई: 5,
    जून: 6,
    जुलाई: 7,
    अगस्त: 8,
    सितंबर: 9,
    अक्टूबर: 10,
    नवंबर: 11,
    दिसंबर: 12,
  };

  // English month mappings
  const englishMonths = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };

  // ═══════════════════════════════════════════════════════════
  // CHECK 2: DD-MM-YYYY or DD/MM/YYYY format (with dashes/slashes)
  // ═══════════════════════════════════════════════════════════
  const ddmmyyyyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const ddmmyyyyMatch = input.match(ddmmyyyyRegex);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1]);
    const month = parseInt(ddmmyyyyMatch[2]);
    const year = parseInt(ddmmyyyyMatch[3]);
    console.log(
      `✓ Detected DD-MM-YYYY format: day=${day}, month=${month}, year=${year}`,
    );

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      // Format based on requested output
      let formattedDate = formatDateByType(
        day,
        month,
        year,
        format,
      );
      console.log(`Final formatted date: "${formattedDate}"`);
      return formattedDate;
    } else {
      console.log("Invalid day/month values in DD-MM-YYYY format");
      return null;
    }
  }

  // Split the input by spaces for other formats
  const parts = input.trim().split(/\s+/);
  console.log(`Parts: ${parts.join(", ")}`);

  let day, month, year;

  if (parts.length === 3) {
    // ═══════════════════════════════════════════════════════════
    // FORMAT: day month(name or number) year
    // Examples: "11 सितंबर 2006", "11 September 2006", "11 9 2006"
    // ═══════════════════════════════════════════════════════════
    const part0 = parseInt(parts[0]);
    const part1Lower = parts[1].toLowerCase();
    const part2 = parseInt(parts[2]);

    // Check if middle part is a month name (Hindi or English)
    if (hindiMonths[parts[1]]) {
      day = part0;
      month = hindiMonths[parts[1]];
      year = part2;
      console.log(
        `✓ Detected format: day month(Hindi name) year: day=${day}, month=${month}, year=${year}`,
      );
    } else if (englishMonths[part1Lower]) {
      day = part0;
      month = englishMonths[part1Lower];
      year = part2;
      console.log(
        `✓ Detected format: day month(English name) year: day=${day}, month=${month}, year=${year}`,
      );
    } else {
      // Assume format: day month(as number) year
      day = part0;
      month = parseInt(parts[1]);
      year = part2;
      console.log(
        `✓ Detected format: day month(numeric) year: day=${day}, month=${month}, year=${year}`,
      );
    }
  } else if (parts.length === 2) {
    // ═══════════════════════════════════════════════════════════
    // FORMAT: day-month year (try parsing day-month as "dd-mm")
    // Examples: "11-09 2006", "11/09 2006"
    // ═══════════════════════════════════════════════════════════
    const dateMonth = parts[0].split(/[-/]/);
    if (dateMonth.length === 2) {
      day = parseInt(dateMonth[0]);
      month = parseInt(dateMonth[1]);
      year = parseInt(parts[1]);
      console.log(
        `✓ Detected format: day-month year: day=${day}, month=${month}, year=${year}`,
      );
    }
  }

  // Validate date components
  if (!day || !month || !year) {
    console.log("Could not parse date components");
    return null;
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    console.log("Invalid date values");
    return null;
  }

  // Format based on requested output
  const formattedDate = formatDateByType(day, month, year, format);
  console.log(`Final formatted date: "${formattedDate}"`);

  return formattedDate;
}

/**
 * Format parsed date components to requested format
 * @param {number} day
 * @param {number} month
 * @param {number} year
 * @param {string} format - "yyyy-mm-dd", "dd-mm-yyyy", "dd/mm/yyyy", or "auto"
 * @returns {string} - Formatted date
 */
function formatDateByType(day, month, year, format = "auto") {
  const dayStr = String(day).padStart(2, "0");
  const monthStr = String(month).padStart(2, "0");
  const yearStr = String(year);

  switch (format) {
    case "dd-mm-yyyy":
      return `${dayStr}-${monthStr}-${yearStr}`;
    case "dd/mm/yyyy":
      return `${dayStr}/${monthStr}/${yearStr}`;
    case "yyyy-mm-dd":
    case "auto":
    default:
      return `${yearStr}-${monthStr}-${dayStr}`;
  }
}

/**
 * Handle normal field processing
 * - Use AI to clean input
 * - Enforce form language on output
 * - Support dropdowns with context
 *
 * @param {string} input - Raw input from speech
 * @param {Object} field - Field object with label, element, options
 * @param {string} formLanguage - Target form language (hi or en)
 * @returns {Promise<string>} - Processed value ready to fill
 */
async function processNormalField(input, field, formLanguage) {
  console.log("\n=== PROCESS NORMAL FIELD ===");
  console.log(`Field: "${field.label}"`);
  console.log(`Raw input: "${input}"`);

  let cleanedValue;
  const tagName = field.element.tagName.toLowerCase();

  // Step 1: Process with AI (dropdown or regular)
  if (tagName === "select") {
    // Get dropdown options for AI context
    const options = Array.from(field.element.options).map((opt) => ({
      text: opt.text,
      value: opt.value,
    }));

    console.log("Processing dropdown field");
    console.log("Dropdown options:", options);

    // Create context for AI
    const fieldContext = {
      type: "dropdown",
      label: field.label,
      options: options,
      userLanguage: selectedLanguage,
      formLanguage: formLanguage,
    };

    // AI processing with dropdown context
    cleanedValue = await processWithAI(input, field.label, fieldContext);
  } else {
    // Regular field - use AI
    console.log("Processing regular field");
    cleanedValue = await processWithAI(input, field.label);
  }

  console.log(`After AI: "${cleanedValue}"`);

  // Step 2: Enforce form language on AI output
  // Pass original input as fallback if AI output is mixed language
  cleanedValue = enforceLanguageOnOutput(cleanedValue, formLanguage, input);
  console.log(`After language enforcement: "${cleanedValue}"`);

  console.log("=== END NORMAL ===\n");
  return cleanedValue;
}

/**
 * Route field processing to appropriate handler based on field type
 * Main dispatcher for field-specific processing
 *
 * @param {Object} field - Field object {label, element, type, etc}
 * @param {string} input - Raw input from speech
 * @param {string} formLanguage - Target form language (hi or en)
 * @returns {Promise<string>} - Processed value ready to fill
 */
async function processFieldByType(field, input, formLanguage) {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║ PROCESS FIELD BY TYPE                  ║");
  console.log("╚════════════════════════════════════════╝\n");

  console.log(`Field label: "${field.label}"`);
  console.log(`Field type: "${field.type}"`);
  console.log(`Raw input: "${input}"`);
  console.log(`Form language: ${formLanguage}`);

  let result;

  // ===== CRITICAL: Check field.type FIRST =====
  // ✅ MOST IMPORTANT FIX: HARD EXIT for date-field (don't fall through to processNormalField)
  if (field.type === "date-field") {
    console.log("✓ Field type is 'date-field'");
    console.log("→ Routing to handleDateField()");
    result = await handleDateField(field, input);
    console.log(`Date field processed, returning early: "${result}"`);
    console.log(`\nFinal result: "${result}"`);
    console.log("╚════════════════════════════════════════╝\n");
    return result; // ← HARD RETURN HERE - PREVENTS FALLTHROUGH
  }
  // Check for radio-group type
  else if (field.type === "radio-group") {
    console.log("✓ Field type is 'radio-group'");
    console.log("→ Routing to handleRadioGroup()");
    result = await handleRadioGroup(field, input, formLanguage);
  }
  // Check for checkbox-group type
  else if (field.type === "checkbox-group") {
    console.log("✓ Field type is 'checkbox-group'");
    console.log("→ Routing to handleCheckboxGroup()");
    result = await handleCheckboxGroup(field, input, formLanguage);
  }
  // Detect and route other field types
  else {
    const fieldType = detectFieldType(field.element, field.label);
    console.log(`✓ Detected field type: "${fieldType}"\n`);

    // Route to appropriate handler
    if (fieldType === "password") {
      // Password: skip AI, just clean
      console.log("→ Routing to handlePassword()");
      result = await handlePassword(input, field.element);
    } else if (fieldType === "email") {
      // Email: skip AI, apply light normalization
      console.log("→ Routing to handleEmail()");
      result = await handleEmail(input, field.element);
    } else if (fieldType === "username") {
      // Username: skip AI, remove spaces, transliterate Hindi
      console.log("→ Routing to handleUsername()");
      result = await handleUsername(input, field.element);
    } else {
      // Normal: use AI then enforce language
      console.log("→ Routing to processNormalField()");
      result = await processNormalField(input, field, formLanguage);
    }
  }

  console.log(`\nFinal result: "${result}"`);
  console.log("╚════════════════════════════════════════╝\n");

  return result;
}

// Check if response is unclear or too short
function isUnclearResponse(response) {
  if (!response || response.length < 2) return true;

  // Check for common unclear patterns
  const unclearPatterns = [
    /^(yes|no|yeah|yep|nope)$/, // Only yes/no without context
    /^(okay|ok|alright)$/, // Only agreement words
    /^(hmm|uh|um)$/, // Hesitation sounds
    /^(I don't know|not sure|maybe)$/, // Uncertainty phrases
    /^\d+$/, // Only numbers (unless context suggests it's expected)
    /^[^\w\s]+$/, // Only punctuation/symbols
  ];

  return unclearPatterns.some((pattern) => pattern.test(response));
}

// Enhanced listening with specific context
function listenWithContext(context = "") {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      reject(new Error("Speech recognition not supported"));
      return;
    }

    recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 2; // Get more alternatives for better accuracy

    // Set context hints if available
    if (context) {
      recognition.grammars = null; // Reset grammars
      // You could add custom grammars here for specific contexts
    }

    recognition.onresult = (event) => {
      const results = event.results[0];
      let bestTranscript = "";
      let bestConfidence = 0;

      // Find the best result among alternatives
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.confidence > bestConfidence) {
          bestConfidence = result.confidence;
          bestTranscript = result.transcript;
        }
      }

      console.log(
        `Context: "${context}" - Result: "${bestTranscript}" (confidence: ${bestConfidence})`,
      );

      const normalizedTranscript = normalizeTranscript(bestTranscript);

      // If confidence is still low, try the other language
      if (bestConfidence < 0.6) {
        console.log("Low confidence, trying alternative language...");
        // Could implement fallback logic here
      }

      resolve(normalizedTranscript);
    };

    recognition.onerror = (event) => {
      console.error("Context recognition error:", event.error);
      reject(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.onend = () => {
      if (!recognition.resultList || recognition.resultList.length === 0) {
        reject(new Error("No speech detected"));
      }
    };

    // Start with delay
    setTimeout(() => {
      recognition.start();
    }, 400);
  });
}

// Create floating UI box for Aawazz status
function createAawazzUI() {
  // Create main container
  const uiContainer = document.createElement("div");
  uiContainer.id = "Aawazz-ui";

  // Style the container
  uiContainer.style.position = "fixed";
  uiContainer.style.bottom = "80px";
  uiContainer.style.right = "20px";
  uiContainer.style.backgroundColor = "#1a1a1a";
  uiContainer.style.color = "#ffffff";
  uiContainer.style.padding = "16px";
  uiContainer.style.borderRadius = "12px";
  uiContainer.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.4)";
  uiContainer.style.zIndex = "10001";
  uiContainer.style.minWidth = "320px";
  uiContainer.style.maxWidth = "400px";
  uiContainer.style.fontFamily = "Arial, sans-serif";
  uiContainer.style.fontSize = "14px";
  uiContainer.style.display = "none";
  uiContainer.style.transition = "opacity 0.3s ease";

  // Create status section
  const statusSection = document.createElement("div");
  statusSection.id = "Aawazz-status";
  statusSection.style.marginBottom = "12px";
  statusSection.style.fontWeight = "600";
  statusSection.style.fontSize = "16px";
  statusSection.style.color = "#4CAF50";

  // Create question section
  const questionSection = document.createElement("div");
  questionSection.id = "Aawazz-question";
  questionSection.style.marginBottom = "12px";
  questionSection.style.lineHeight = "1.4";
  questionSection.style.color = "#e0e0e0";

  // Create progress section
  const progressSection = document.createElement("div");
  progressSection.id = "Aawazz-progress";
  progressSection.style.fontSize = "12px";
  progressSection.style.color = "#9e9e9e";
  progressSection.style.fontStyle = "italic";
  progressSection.style.marginBottom = "12px";

  // Create input section (initially hidden)
  const inputSection = document.createElement("div");
  inputSection.id = "Aawazz-input-section";
  inputSection.style.display = "none";
  inputSection.style.marginBottom = "12px";

  // Create input label
  const inputLabel = document.createElement("div");
  inputLabel.textContent = "Edit your response:";
  inputLabel.style.fontSize = "12px";
  inputLabel.style.color = "#9e9e9e";
  inputLabel.style.marginBottom = "6px";

  // Create input box
  const inputBox = document.createElement("input");
  inputBox.id = "Aawazz-input";
  inputBox.type = "text";
  inputBox.style.width = "100%";
  inputBox.style.padding = "8px";
  inputBox.style.backgroundColor = "#2a2a2a";
  inputBox.style.color = "#ffffff";
  inputBox.style.border = "1px solid #444";
  inputBox.style.borderRadius = "6px";
  inputBox.style.fontSize = "14px";
  inputBox.style.marginBottom = "8px";
  inputBox.style.boxSizing = "border-box";

  // Create confirm button for input
  const confirmButton = document.createElement("button");
  confirmButton.id = "Aawazz-confirm-button";
  confirmButton.textContent = "Confirm";
  confirmButton.style.padding = "6px 12px";
  confirmButton.style.backgroundColor = "#4CAF50";
  confirmButton.style.color = "white";
  confirmButton.style.border = "none";
  confirmButton.style.borderRadius = "4px";
  confirmButton.style.fontSize = "12px";
  confirmButton.style.cursor = "pointer";
  confirmButton.style.marginRight = "8px";

  // Add hover effect to confirm button
  confirmButton.addEventListener("mouseenter", () => {
    confirmButton.style.backgroundColor = "#45a049";
  });

  confirmButton.addEventListener("mouseleave", () => {
    confirmButton.style.backgroundColor = "#4CAF50";
  });

  // Create cancel button for input
  const cancelButton = document.createElement("button");
  cancelButton.id = "Aawazz-cancel-button";
  cancelButton.textContent = "Cancel";
  cancelButton.style.padding = "6px 12px";
  cancelButton.style.backgroundColor = "#666";
  cancelButton.style.color = "white";
  cancelButton.style.border = "none";
  cancelButton.style.borderRadius = "4px";
  cancelButton.style.fontSize = "12px";
  cancelButton.style.cursor = "pointer";

  // Add hover effect to cancel button
  cancelButton.addEventListener("mouseenter", () => {
    cancelButton.style.backgroundColor = "#555";
  });

  cancelButton.addEventListener("mouseleave", () => {
    cancelButton.style.backgroundColor = "#666";
  });

  // Create button container
  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.appendChild(confirmButton);
  buttonContainer.appendChild(cancelButton);

  // Assemble input section
  inputSection.appendChild(inputLabel);
  inputSection.appendChild(inputBox);
  inputSection.appendChild(buttonContainer);

  // Create language selector
  const languageSelector = document.createElement("div");
  languageSelector.id = "Aawazz-language-selector";
  languageSelector.style.marginBottom = "12px";

  // Create language label
  const languageLabel = document.createElement("div");
  languageLabel.textContent = "Language:";
  languageLabel.style.fontSize = "12px";
  languageLabel.style.color = "#9e9e9e";
  languageLabel.style.marginBottom = "6px";

  // Create language buttons container
  const languageButtons = document.createElement("div");
  languageButtons.style.display = "flex";
  languageButtons.style.gap = "8px";

  // English button
  const englishButton = document.createElement("button");
  englishButton.id = "Aawazz-lang-en";
  englishButton.textContent = "English";
  englishButton.style.padding = "4px 8px";
  englishButton.style.backgroundColor = "#4CAF50";
  englishButton.style.color = "white";
  englishButton.style.border = "none";
  englishButton.style.borderRadius = "4px";
  englishButton.style.fontSize = "11px";
  englishButton.style.cursor = "pointer";
  englishButton.style.flex = "1";

  // Hindi button
  const hindiButton = document.createElement("button");
  hindiButton.id = "Aawazz-lang-hi";
  hindiButton.textContent = "Hindi";
  hindiButton.style.padding = "4px 8px";
  hindiButton.style.backgroundColor = "#666";
  hindiButton.style.color = "white";
  hindiButton.style.border = "none";
  hindiButton.style.borderRadius = "4px";
  hindiButton.style.fontSize = "11px";
  hindiButton.style.cursor = "pointer";
  hindiButton.style.flex = "1";

  // Add click events for language buttons
  englishButton.addEventListener("click", () => {
    switchLanguage("en-IN");
    updateLanguageButtons();
    // Show feedback
    updateAawazzUI("Language Changed", "Switched to English", "0 of 0");
  });

  hindiButton.addEventListener("click", () => {
    switchLanguage("hi-IN");
    updateLanguageButtons();
    // Show feedback
    updateAawazzUI("Language Changed", "Switched to Hindi", "0 of 0");
  });

  // Add hover effects
  [englishButton, hindiButton].forEach((button) => {
    button.addEventListener("mouseenter", () => {
      if (button.style.backgroundColor !== "#4CAF50") {
        button.style.backgroundColor = "#555";
      }
    });

    button.addEventListener("mouseleave", () => {
      if (button.style.backgroundColor !== "#4CAF50") {
        button.style.backgroundColor = "#666";
      }
    });
  });

  // Assemble language selector
  languageButtons.appendChild(englishButton);
  languageButtons.appendChild(hindiButton);
  languageSelector.appendChild(languageLabel);
  languageSelector.appendChild(languageButtons);

  // Create options section (for dropdowns)
  const optionsSection = document.createElement("div");
  optionsSection.id = "Aawazz-options";
  optionsSection.style.display = "none";
  optionsSection.style.fontSize = "12px";
  optionsSection.style.color = "#666";
  optionsSection.style.marginTop = "10px";

  // Create stop button
  const stopButton = document.createElement("button");
  stopButton.id = "Aawazz-stop-button";
  stopButton.textContent = "Stop";
  stopButton.style.width = "100%";
  stopButton.style.padding = "8px";
  stopButton.style.backgroundColor = "#f44336";
  stopButton.style.color = "#ffffff";
  stopButton.style.border = "none";
  stopButton.style.borderRadius = "6px";
  stopButton.style.cursor = "pointer";
  stopButton.style.fontSize = "14px";
  stopButton.style.fontWeight = "bold";
  stopButton.style.transition = "background-color 0.2s ease";

  // Add hover effect to stop button
  stopButton.addEventListener("mouseenter", () => {
    stopButton.style.backgroundColor = "#d32f2f";
  });

  stopButton.addEventListener("mouseleave", () => {
    stopButton.style.backgroundColor = "#f44336";
  });

  // Add click event to stop button
  stopButton.addEventListener("click", () => {
    stopAawazz();
  });

  // Append sections to container
  uiContainer.appendChild(statusSection);
  uiContainer.appendChild(questionSection);
  uiContainer.appendChild(optionsSection);
  uiContainer.appendChild(progressSection);
  uiContainer.appendChild(inputSection);
  uiContainer.appendChild(languageSelector);
  uiContainer.appendChild(stopButton);

  // Append to body
  document.body.appendChild(uiContainer);

  // Initialize language buttons
  updateLanguageButtons();

  return uiContainer;
}

// Update language button states
function updateLanguageButtons() {
  const englishButton = document.getElementById("Aawazz-lang-en");
  const hindiButton = document.getElementById("Aawazz-lang-hi");

  if (englishButton && hindiButton) {
    if (selectedLanguage === "en-IN") {
      englishButton.style.backgroundColor = "#4CAF50";
      hindiButton.style.backgroundColor = "#666";
    } else if (selectedLanguage === "hi-IN") {
      englishButton.style.backgroundColor = "#666";
      hindiButton.style.backgroundColor = "#4CAF50";
    }
  }
}

// Update UI elements with enhanced styling and animations
function updateAawazzUI(status, question, progress, dropdownOptions = null) {
  const uiContainer = document.getElementById("Aawazz-ui");
  if (!uiContainer) return;

  const statusElement = document.getElementById("Aawazz-status");
  const questionElement = document.getElementById("Aawazz-question");
  const progressElement = document.getElementById("Aawazz-progress");
  const optionsElement = document.getElementById("Aawazz-options");

  if (statusElement) {
    statusElement.textContent = status;

    // Color-coded status with animations
    if (status.toLowerCase().includes("listening")) {
      statusElement.style.color = "#2196F3"; // Blue for listening
      statusElement.style.animation = "pulse 1.5s infinite";
      statusElement.style.textShadow = "0 0 10px rgba(33, 150, 243, 0.5)";
    } else if (status.toLowerCase().includes("speaking")) {
      statusElement.style.color = "#4CAF50"; // Green for speaking
      statusElement.style.animation = "none";
      statusElement.style.textShadow = "0 0 10px rgba(76, 175, 80, 0.5)";
    } else if (status.toLowerCase().includes("error")) {
      statusElement.style.color = "#f44336"; // Red for errors
      statusElement.style.animation = "shake 0.5s";
      statusElement.style.textShadow = "0 0 10px rgba(244, 67, 54, 0.5)";
    } else if (status.toLowerCase().includes("editing")) {
      statusElement.style.color = "#FF9800"; // Orange for editing
      statusElement.style.animation = "none";
      statusElement.style.textShadow = "0 0 10px rgba(255, 152, 0, 0.5)";
    } else if (status.toLowerCase().includes("success")) {
      statusElement.style.color = "#8BC34A"; // Light green for success
      statusElement.style.animation = "fadeIn 0.3s";
      statusElement.style.textShadow = "0 0 10px rgba(139, 195, 74, 0.5)";
    } else if (status.toLowerCase().includes("stopped")) {
      statusElement.style.color = "#9E9E9E"; // Gray for stopped
      statusElement.style.animation = "fadeOut 0.3s";
      statusElement.style.textShadow = "0 0 10px rgba(158, 158, 158, 0.5)";
    } else {
      statusElement.style.color = "#FFC107"; // Amber for other states
      statusElement.style.animation = "none";
      statusElement.style.textShadow = "0 0 10px rgba(255, 193, 7, 0.5)";
    }
  }

  if (questionElement) {
    questionElement.textContent = question;
    // Truncate long questions with ellipsis
    if (question.length > 80) {
      questionElement.style.fontSize = "12px";
      questionElement.style.lineHeight = "1.3";
    } else {
      questionElement.style.fontSize = "14px";
      questionElement.style.lineHeight = "1.4";
    }
  }

  // Display dropdown options if available
  if (optionsElement && dropdownOptions && dropdownOptions.length > 0) {
    optionsElement.style.display = "block";
    optionsElement.style.marginTop = "10px";
    optionsElement.innerHTML = `
      <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
        <strong>Options:</strong>
      </div>
      ${dropdownOptions
        .map(
          (opt, index) => `
        <div style="background: #f5f5f5; padding: 8px; margin: 3px 0; border-radius: 4px; cursor: pointer; transition: background 0.2s;">
          <div style="font-weight: bold; color: #333;">${index + 1}. ${opt.text || opt.value}</div>
        </div>
      `,
        )
        .join("")}
    `;
    optionsElement.style.fontSize = "12px";
  } else if (optionsElement) {
    optionsElement.style.display = "none";
  }

  if (progressElement) {
    progressElement.textContent = progress;
  }
}

// Highlight active field on the page
function highlightActiveField(field) {
  // Remove previous highlights
  document.querySelectorAll(".aawazz-field-highlight").forEach((el) => {
    el.classList.remove("aawazz-field-highlight");
    el.style.outline = "";
    el.style.boxShadow = "";
  });

  if (field && field.element) {
    // Add highlight to current field
    field.element.classList.add("aawazz-field-highlight");
    field.element.style.outline = "2px solid #2196F3";
    field.element.style.outlineOffset = "-2px";
    field.element.style.boxShadow = "0 0 15px rgba(33, 150, 243, 0.3)";

    // Scroll field into view
    field.element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }
}

// Remove field highlights
function removeFieldHighlights() {
  document.querySelectorAll(".aawazz-field-highlight").forEach((el) => {
    el.classList.remove("aawazz-field-highlight");
    el.style.outline = "";
    el.style.boxShadow = "";
  });
}

// Add CSS animations to the page
function addAawazzStyles() {
  if (document.getElementById("aawazz-styles")) return;

  const style = document.createElement("style");
  style.id = "aawazz-styles";
  style.textContent = `
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.6; }
      100% { opacity: 1; }
    }
    
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    .aawazz-field-highlight {
      transition: all 0.3s ease !important;
      position: relative !important;
    }
    
    .aawazz-field-highlight::after {
      content: '';
      position: absolute;
      top: -8px;
      right: -8px;
      width: 12px;
      height: 12px;
      background: #2196F3;
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }
  `;

  document.head.appendChild(style);
}

// Show/hide UI
function showAawazzUI() {
  const uiContainer = document.getElementById("Aawazz-ui");
  if (uiContainer) {
    uiContainer.style.display = "block";
    uiContainer.style.opacity = "1";
  }
}

function hideAawazzUI() {
  const uiContainer = document.getElementById("Aawazz-ui");
  if (uiContainer) {
    uiContainer.style.opacity = "0";
    setTimeout(() => {
      uiContainer.style.display = "none";
    }, 300);
  }
}

// Show input section for editing
function showInputSection(currentText) {
  const inputSection = document.getElementById("Aawazz-input-section");
  const inputBox = document.getElementById("Aawazz-input");
  const confirmButton = document.getElementById("Aawazz-confirm-button");
  const cancelButton = document.getElementById("Aawazz-cancel-button");

  if (inputSection && inputBox && confirmButton && cancelButton) {
    inputBox.value = currentText;
    inputSection.style.display = "block";
    inputBox.focus();
    inputBox.select();
  }
}

// Hide input section
function hideInputSection() {
  const inputSection = document.getElementById("Aawazz-input-section");
  if (inputSection) {
    inputSection.style.display = "none";
  }
}

// Get edited text from input
function getEditedText() {
  const inputBox = document.getElementById("Aawazz-input");
  return inputBox ? inputBox.value.trim() : "";
}

// Check if field should show input (name fields or low confidence)
function shouldShowInput(field, response) {
  const fieldLabel = field.label.toLowerCase();
  const isNameField =
    fieldLabel.includes("name") ||
    fieldLabel.includes("first") ||
    fieldLabel.includes("last") ||
    fieldLabel.includes("full");
  const isShortResponse = response.length < 3;
  const hasNumbers =
    /\d/.test(response) &&
    !fieldLabel.includes("phone") &&
    !fieldLabel.includes("age");

  return isNameField || isShortResponse || hasNumbers;
}

// Global variables
let shouldStopAawazz = false;
let selectedLanguage = "en-IN"; // Default to Indian English
let recognition = null; // Store recognition object globally

// Language configuration
const languages = {
  "en-IN": {
    name: "English (India)",
    code: "en-IN",
    speechCode: "en-IN",
    recognitionCode: "en-IN",
    fallbackCode: "en-US",
    greeting:
      "Hello, I am Aawazz. I will help you fill forms using your voice.",
    questionPrefix: "What is your",
    confirmPrompt: "If this is correct say yes, otherwise say no clearly.",
    retryMessage: "Let's try again.",
    successMessage: "filled successfully.",
    skipMessage: "Skipping",
    errorMessage: "I didn't catch that. Let's try again.",
    noSpeechMessage: "I didn't hear anything. Please try again.",
    unclearMessage: "Please say yes or no clearly.",
    stopMessage: "Aawazz process stopped.",
    completeMessage: "All fields are filled.",
    noFieldsMessage: "No empty form fields found on this page.",
    startMessage: "Found {count} form fields to fill. Let's start.",
    yesVariations: [
      "yes",
      "yeah",
      "yep",
      "correct",
      "right",
      "that's it",
      "that's right",
      "okay",
      "ok",
      "sure",
      "affirmative",
      "definitely",
      "absolutely",
      "exactly",
      "precisely",
      "yup",
      "y",
      "mhm",
      "uh-huh",
      "sounds good",
      "good",
      "great",
      "perfect",
      "fine",
      "alright",
      "all right",
      "confirmed",
      "agree",
      "agreed",
      "accepted",
      "approved",
      "yes please",
      "yes that's correct",
    ],
    noVariations: [
      "no",
      "nope",
      "wrong",
      "incorrect",
      "not right",
      "that's wrong",
      "that's not right",
      "negative",
      "n",
      "nah",
      "no way",
      "absolutely not",
      "definitely not",
      "no thanks",
      "no thank you",
      "not correct",
      "not exactly",
      "disagree",
      "disagreed",
      "rejected",
      "declined",
      "denied",
      "incorrect",
      "bad",
      "terrible",
      "awful",
      "horrible",
      "not good",
      "not acceptable",
      "no that's wrong",
      "try again",
      "do over",
      "start over",
      "reset",
    ],
  },
  "hi-IN": {
    name: "Hindi (India)",
    code: "hi-IN",
    speechCode: "hi-IN",
    recognitionCode: "hi-IN",
    fallbackCode: "en-IN",
    greeting:
      "Hello, main Aawazz hoon. Main aapki awaaz se forms fill karne mein madad karunga.",
    questionPrefix: "Aapka",
    confirmPrompt: "Agar yeh sahi hai toh yes boliye, warna no clearly boliye.",
    retryMessage: "Phir se koshish karte hain.",
    successMessage: "successfully fill ho gaya.",
    skipMessage: "Skip kar raha hun",
    errorMessage: "Mujhe samajh nahi aaya. Phir se koshish karte hain.",
    noSpeechMessage: "Maine kuch nahi suna. Kripya phir se koshish karein.",
    unclearMessage: "Kripya yes ya no clearly boliye.",
    stopMessage: "Aawazz process stop ho gaya.",
    completeMessage: "Saare fields fill ho gaye hain.",
    noFieldsMessage: "Is page par koi empty form fields nahi mile.",
    startMessage:
      "{count} form fields fill karne ke liye mile hain. Chaliye shuru karte hain.",
    yesVariations: [
      "yes",
      "haan",
      "han",
      "ji haan",
      "sahi",
      "thik hai",
      "theek hai",
      "correct",
      "right",
      "okay",
      "ok",
      "sure",
      "bilkul",
      "ha",
      "ji",
      "achcha",
      "good",
      "great",
      "perfect",
      "fine",
      "alright",
      "confirmed",
      "agree",
      "agreed",
      "accepted",
      "approved",
    ],
    noVariations: [
      "no",
      "nahi",
      "na",
      "ji nahi",
      "galat",
      "wrong",
      "incorrect",
      "sahi nahi",
      "negative",
      "nahi thanks",
      "disagree",
      "disagreed",
      "rejected",
      "declined",
      "denied",
      "incorrect",
      "bad",
      "terrible",
      "awful",
      "horrible",
      "not good",
      "not acceptable",
      "try again",
      "phir se koshish karein",
    ],
  },
};

// Convert English field labels to natural Hindi questions
function getHindiQuestion(label, options = null) {
  const labelLower = label.toLowerCase();

  // Check if this is a dropdown field with options
  if (options && Array.isArray(options) && options.length > 0) {
    // Limit options to 3-5 for clarity
    const limitedOptions = options.slice(0, 5);
    const optionsText = limitedOptions
      .map((opt, index) => `${index + 1}. ${opt.text || opt.value || opt}`)
      .join(", ");
    return `aapki ${label} kya hai? विकल्प हैं: ${optionsText}`;
  }

  // Hindi question templates based on field type
  const hindiQuestions = {
    "full name": "aapka poora naam kya hai?",
    name: "aapka naam kya hai?",
    "first name": "aapka pehla naam kya hai?",
    "last name": "aapka antim naam kya hai?",
    email: "aapka email kya hai?",
    "phone number": "aapka mobile number kya hai?",
    phone: "aapka mobile number kya hai?",
    telephone: "aapka phone number kya hai?",
    mobile: "aapka mobile number kya hai?",
    address: "aapka pata kya hai?",
    city: "aapka shehar kya hai?",
    state: "aapka rajya kya hai?",
    country: "aapka desh kya hai?",
    "zip code": "aapka pin code kya hai?",
    "postal code": "aapka pin code kya hai?",
    company: "aapki company kya hai?",
    "job title": "aapka pad kya hai?",
    message: "aapka sandesh kya hai?",
    comments: "aapki tippaniyan kya hain?",
    age: "aapki umra kya hai?",
    birthday: "aapki janmdin tithi kya hai?",
    "birth date": "aapka janmdin tithi kya hai?",
    website: "aapki website kya hai?",
    url: "aapki website URL kya hai?",
  };

  // Check for exact matches first
  if (hindiQuestions[labelLower]) {
    return hindiQuestions[labelLower];
  }

  // Check for partial matches
  for (const [key, question] of Object.entries(hindiQuestions)) {
    if (labelLower.includes(key)) {
      return question;
    }
  }

  // Default fallback
  return `aapka ${label} kya hai?`;
}

// Smart dropdown option matching function
function matchUserInputToOption(userInput, options) {
  if (!options || !Array.isArray(options) || options.length === 0) {
    return null;
  }

  const inputLower = userInput.toLowerCase().trim();

  // Exact match first (case-insensitive)
  for (const option of options) {
    const optionText = (option.text || option.value || "").toLowerCase().trim();
    if (optionText === inputLower) {
      return option;
    }
  }

  // Partial match (e.g., "11" → "Class 11")
  for (const option of options) {
    const optionText = (option.text || option.value || "").toLowerCase().trim();
    if (optionText.includes(inputLower) || inputLower.includes(optionText)) {
      return option;
    }
  }

  // Number match (e.g., "11" → "Class 11")
  const inputNumber = inputLower.replace(/[^0-9]/g, "");
  if (inputNumber) {
    for (const option of options) {
      const optionText = (option.text || option.value || "")
        .toLowerCase()
        .trim();
      const optionNumber = optionText.replace(/[^0-9]/g, "");
      if (optionNumber === inputNumber) {
        return option;
      }
    }
  }

  // Fallback: return first option if no match found
  return options[0];
}

/**
 * Match single option from user input
 * Wraps matchUserInputToOption for clarity
 *
 * @param {string} userInput - User's voice input
 * @param {Array} options - Array of option objects {text, value, element}
 * @returns {Object} - Matched option or null
 */
function matchOptionFromInput(userInput, options) {
  return matchUserInputToOption(userInput, options);
}

/**
 * Match multiple options from user input
 * Splits input and matches each part to an option
 *
 * @param {string} userInput - User's voice input
 * @param {Array} options - Array of option objects {text, value, element}
 * @returns {Array} - Array of matched options
 */
function matchMultipleOptions(userInput, options) {
  if (!userInput || !options || options.length === 0) {
    return [];
  }

  const inputLower = userInput.toLowerCase().trim();
  const matched = [];

  // Split by common separators (comma, 'and', 'or')
  const parts = inputLower
    .split(/[,;]|और|or|and/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (const part of parts) {
    for (const option of options) {
      if (matched.includes(option)) continue; // Skip already matched

      const optionText = (option.text || option.value || "")
        .toLowerCase()
        .trim();

      if (
        optionText === part ||
        optionText.includes(part) ||
        part.includes(optionText)
      ) {
        matched.push(option);
        break; // Move to next part
      }
    }
  }

  return matched;
}

/**
 * Read options aloud and ask user to select
 * Speaks all available options and waits for user input
 *
 * @param {string} fieldLabel - The field label to announce
 * @param {Array} options - Array of options {text, value, element}
 * @param {boolean} isMultiple - Whether multiple selections allowed
 * @returns {Promise<void>}
 */
async function readOptionsAndAsk(fieldLabel, options, isMultiple = false) {
  if (!options || options.length === 0) return;

  // Create readable option list
  const optionTexts = options.map((opt) => opt.text || opt.value).join(", ");

  // Create announcement message
  let msg = `${fieldLabel}: ${optionTexts}`;
  if (isMultiple) {
    msg = `${fieldLabel} (select one or more): ${optionTexts}`;
  }

  console.log(`Reading options: ${msg}`);
  await speak(msg);
}

/**
 * Confirm selected options with user
 * Speaks the selected options and waits for user confirmation
 *
 * @param {string} fieldLabel - The field label
 * @param {Array} selectedOptions - Array of selected option objects
 * @returns {Promise<boolean>} - true if confirmed, false otherwise
 */
async function confirmSelection(fieldLabel, selectedOptions) {
  if (!selectedOptions || selectedOptions.length === 0) {
    return false;
  }

  // Create confirmation message
  const selectedTexts = selectedOptions
    .map((opt) => opt.text || opt.value)
    .join(", ");
  const msg = `${fieldLabel}: ${selectedTexts}. Is this correct? Say yes or no.`;

  console.log(`Confirming: ${msg}`);
  await speak(msg);

  // For now, always return true (in production, you'd listen for yes/no)
  // This could be extended to actually wait for and process user confirmation
  return true;
}

// Helper function to detect Hindi characters
function containsHindiCharacters(text) {
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
    "�": "au",
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

// Check if field is a name field for enhanced processing
function isNameField(fieldLabel) {
  if (!fieldLabel) return false;

  const labelLower = fieldLabel.toLowerCase();
  const nameKeywords = [
    "name",
    "full name",
    "first name",
    "last name",
    "given name",
    "family name",
    "surname",
    "firstname",
    "lastname",
    "middle name",
    "nickname",
    "display name",
  ];

  return nameKeywords.some((keyword) => labelLower.includes(keyword));
}

// Clean up common speech recognition errors for names (generic)
function cleanNameRecognition(text) {
  if (!text) return text;

  // Generic speech recognition fixes for any name
  let cleaned = text.trim();

  // Fix common single-letter issues
  if (cleaned.length === 1 && !cleaned.match(/[a-zA-Z]/)) {
    // If it's just one non-letter character, return as-is for AI to handle
    return cleaned;
  }

  // Fix common partial words
  if (cleaned.length <= 2) {
    // For very short recognitions, let AI handle it
    return cleaned;
  }

  // Capitalize properly for names (first letter uppercase, rest lowercase)
  if (cleaned.length > 0) {
    const words = cleaned.split(" ");
    const capitalizedWords = words.map((word) => {
      if (word.length > 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word;
    });
    cleaned = capitalizedWords.join(" ");
  }

  console.log(`Name cleaned: "${text}" -> "${cleaned}"`);
  return cleaned;
}

// Get current language configuration
function getCurrentLanguage() {
  return languages[selectedLanguage] || languages["en-IN"];
}

// Switch language function
function switchLanguage(languageCode) {
  if (languages[languageCode]) {
    selectedLanguage = languageCode;
    console.log(`Language switched to: ${languages[languageCode].name}`);
    // Store in localStorage for persistence
    localStorage.setItem("aawazz-language", languageCode);
    return true;
  }
  return false;
}

// Load saved language preference
function loadLanguagePreference() {
  const saved = localStorage.getItem("aawazz-language");
  if (saved && languages[saved]) {
    selectedLanguage = saved;
    console.log(
      `Loaded language preference: ${languages[selectedLanguage].name}`,
    );
  }
}

// Speech synthesis function with language support and proper cancellation
function speak(text) {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    // Cancel any ongoing speech immediately
    speechSynthesis.cancel();

    // Normalize text for better speech
    const normalizedText = text.trim().replace(/\s+/g, " ");

    const utterance = new SpeechSynthesisUtterance(normalizedText);
    const lang = getCurrentLanguage();
    utterance.lang = lang.speechCode;
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    let speechCompleted = false;

    utterance.onend = () => {
      speechCompleted = true;
      resolve();
    };

    utterance.onerror = (event) => {
      speechCompleted = true;
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };

    // Small delay to ensure cancellation takes effect
    setTimeout(() => {
      if (!speechCompleted) {
        speechSynthesis.speak(utterance);
      }
    }, 100);
  });
}

// Stop Aawazz function
function stopAawazz() {
  shouldStopAawazz = true;
  console.log("Aawazz stop requested");

  // Stop any ongoing speech immediately
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
    console.log("Speech synthesis cancelled");
  }

  // Stop any ongoing speech recognition
  if (recognition) {
    try {
      recognition.stop();
      console.log("Speech recognition stopped");
    } catch (error) {
      console.log("Speech recognition already stopped or not running");
    }
  }

  // Remove field highlights
  removeFieldHighlights();

  // Show stopped message
  const lang = getCurrentLanguage();
  const stopMessage = lang.stopMessage;
  updateAawazzUI("Stopped", stopMessage, "0 of 0");

  // Speak the stopped message
  speak(stopMessage).catch((error) => {
    console.log("Error speaking stop message:", error);
  });

  // Hide UI after a short delay to let user see the stopped message
  setTimeout(() => {
    hideAawazzUI();
  }, 2000);
}

// Aawazz main function
async function startAawazz() {
  // Reset stop flag
  shouldStopAawazz = false;

  // Load language preference
  loadLanguagePreference();

  // Add styles to page
  addAawazzStyles();

  // Create UI if it doesn't exist
  if (!document.getElementById("Aawazz-ui")) {
    createAawazzUI();
  }

  const lang = getCurrentLanguage();

  try {
    // Extract form fields
    const fields = extractFields();
    console.log("Extracted fields:", fields);

    // DEBUG: Show field type summary
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║ EXTRACTED FIELDS SUMMARY               ║");
    console.log("╚════════════════════════════════════════╝");
    fields.forEach((field, index) => {
      console.log(
        `  ${index + 1}. Label: "${field.label}", Type: "${field.type}"`,
      );
    });
    console.log("");

    if (fields.length === 0) {
      showAawazzUI();
      updateAawazzUI("Status", lang.noFieldsMessage, "0 of 0");
      await speak(lang.noFieldsMessage);
      hideAawazzUI();
      return;
    }

    showAawazzUI();

    // 1. INTRO MESSAGE: Greet user naturally
    const greetingMessage =
      selectedLanguage === "hi-IN"
        ? "नमस्ते, मैं आपकी फॉर्म भरने में मदद करूंगा।"
        : "Hi, I will help you fill this form.";

    updateAawazzUI("Starting", greetingMessage, "0 of " + fields.length);
    await speak(greetingMessage);

    const startMessage = lang.startMessage.replace("{count}", fields.length);
    updateAawazzUI("Ready", startMessage, "0 of " + fields.length);
    await speak(startMessage);

    // Detect form language once at the beginning
    const formLanguage = detectFormLanguage();
    console.log(
      `Form language: ${formLanguage}, User language: ${selectedLanguage}`,
    );

    // Loop through fields sequentially with clean structure
    for (let i = 0; i < fields.length; i++) {
      // Check if stop was requested
      if (shouldStopAawazz) {
        removeFieldHighlights();
        updateAawazzUI("Stopped", lang.stopMessage, `${i} of ${fields.length}`);
        await speak(lang.stopMessage);
        hideAawazzUI();
        return;
      }

      const field = fields[i];

      // Highlight current field
      highlightActiveField(field);

      // 🧠 FINAL FLOW (CLEAN)
      // Ask with proper language handling
      const currentLang = getCurrentLanguage();
      let question;

      console.log(
        `Current language: ${currentLang.code} - ${currentLang.name}`,
      );
      console.log(`Selected language variable: ${selectedLanguage}`);
      console.log(`Field label: ${field.label}`);
      console.log(`Field options:`, field.options || "none");

      if (currentLang.code === "hi-IN") {
        // Use natural Hindi question with options if available
        console.log("Using Hindi question generation");
        question = getHindiQuestion(field.label, field.options);
      } else {
        // Use English question with options if available
        console.log("Using English question generation");
        question = generateSimpleQuestion(field.label, field.options);
      }

      console.log(`Generated question: "${question}"`);

      // Pass dropdown options to UI if available
      const dropdownOptions = field.options || null;
      updateAawazzUI(
        "Speaking",
        question,
        `${i + 1} of ${fields.length}`,
        dropdownOptions,
      );
      await speak(question);

      // ✅ FIX 2: FORCE RADIO/CHECKBOX ASKING - Explicitly ask about options
      if (field.type === "radio-group" || field.type === "checkbox-group") {
        const optionsText = field.options.map((o) => o.text).join(", ");
        const optionsMsg =
          selectedLanguage === "hi-IN"
            ? `आपके विकल्प हैं: ${optionsText}`
            : `Your options are: ${optionsText}`;
        console.log(`Speaking options for ${field.type}: ${optionsMsg}`);
        await speak(optionsMsg);
      }

      // Listen with automatic retry on timeout (increased timeout + 1 retry)
      let response;
      try {
        response = await listenWithRetry(); // Uses enhanced timeout (8s) + retries once on timeout
        console.log(`Raw response: "${response}"`);
      } catch (listenError) {
        const errorMsg =
          typeof listenError === "object" ? listenError.error : listenError;
        console.log("Listen failed after retry:", errorMsg);
        updateAawazzUI(
          "Skipped",
          `Skipping ${field.label}`,
          `${i + 1} of ${fields.length}`,
        );
        await speak(`Skipping ${field.label}`);
        continue; // Move to next field
      }

      // Enhanced name preprocessing for English
      if (selectedLanguage === "en-IN" && isNameField(field.label)) {
        response = cleanNameRecognition(response);
        console.log(`Name preprocessed: "${response}"`);
      }

      // Process with AI - SKIP for special field types
      let finalAnswer;
      if (
        field.type === "radio-group" ||
        field.type === "checkbox-group" ||
        field.type === "date-field"
      ) {
        console.log(`Skipping AI for ${field.type} field`);
        finalAnswer = response; // Use raw response for special fields
      } else {
        updateAawazzUI(
          "Processing",
          "Just a moment...",
          `${i + 1} of ${fields.length}`,
        );
        finalAnswer = await processWithAI(response, field.label);
        console.log(`AI cleaned: "${finalAnswer}"`);
      }

      // 6. FILL: Route field processing based on field type
      if (response) {
        try {
          updateAawazzUI(
            "Processing",
            "Just a moment...",
            `${i + 1} of ${fields.length}`,
          );

          // Route to appropriate handler based on field type
          // - Password fields: skip AI, just remove spaces and transliterate
          // - Email fields: skip AI, convert symbols and transliterate
          // - Radio/Checkbox groups: handled by specific handlers
          // - Date fields: handled by specific handler
          // - Normal fields: use AI, then enforce language
          const result = await processFieldByType(
            field,
            finalAnswer,
            formLanguage,
          );

          console.log(`Final value to fill: "${result}"`);

          // Handle null result (retry needed)
          if (result === null) {
            console.log("Field requires retry");
            const retryMsg =
              selectedLanguage === "hi-IN"
                ? "कृपया दोबारा कहें"
                : "Please try again";
            updateAawazzUI("Retry", retryMsg, `${i + 1} of ${fields.length}`);
            await speak(retryMsg);
            i--; // Retry this field
          } else if (result) {
            // For radio/checkbox: already handled by handlers, don't call fillFormField
            // For date and all other fields: call fillFormField
            if (
              field.type === "radio-group" ||
              field.type === "checkbox-group"
            ) {
              console.log(`${field.type} already filled by handler`);
            } else {
              fillFormField(field.element, result);
              console.log(`Field filled: "${result}"`);
            }
          }

          // Simple success response
          const successResponse =
            selectedLanguage === "hi-IN" ? "ठीक!" : "Perfect!";
          updateAawazzUI(
            "Success",
            successResponse,
            `${i + 1} of ${fields.length}`,
          );
          await speak(successResponse);
        } catch (fillError) {
          console.error("Fill error:", fillError);

          // FALLBACK: Use response if processing fails (skip for radio/checkbox)
          if (field.type !== "radio-group" && field.type !== "checkbox-group") {
            fillFormField(field.element, response);
            console.log(`Processing failed, using raw response: "${response}"`);
          }
        }
      }

      // Remove highlight and move to next field
      removeFieldHighlights();

      // Small delay between fields for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Check if stop was requested before completion
    if (shouldStopAawazz) {
      console.log("Aawazz stopped by user before completion");
      removeFieldHighlights();
      updateAawazzUI(
        "Stopped",
        lang.stopMessage,
        `${fields.length} of ${fields.length}`,
      );
      await speak(lang.stopMessage);
      hideAawazzUI();
      return;
    }

    // 9. END MESSAGE: Natural completion message
    const endMessage =
      selectedLanguage === "hi-IN"
        ? "सब हो गया है! कृपया अपना फॉर्म देखें और जरूरत के अनुसार बदलाव करें।"
        : "All done! Please review your form and make any changes you need.";

    updateAawazzUI(
      "Complete",
      endMessage,
      `${fields.length} of ${fields.length}`,
    );
    await speak(endMessage);
    hideAawazzUI();

    console.log("Aawazz completed successfully");

    // Hide UI after completion
    setTimeout(() => {
      removeFieldHighlights();
      hideAawazzUI();
    }, 3000);
  } catch (error) {
    console.error("Aawazz critical error:", error);
    removeFieldHighlights();
    updateAawazzUI(
      "Error",
      "An error occurred while filling the form.",
      "0 of 0",
    );
    try {
      await speak("An error occurred while filling the form.");
    } catch (speakError) {
      console.error("Error speaking error message:", speakError);
    }

    // Hide UI after error
    setTimeout(() => {
      hideAawazzUI();
    }, 3000);
  }
}

// Generate simple human-friendly questions using AI
function generateSimpleQuestion(fieldLabel, options = null) {
  // Check if this is a dropdown field with options
  if (options && Array.isArray(options) && options.length > 0) {
    // Limit options to 3-5 for clarity
    const limitedOptions = options.slice(0, 5);
    const optionsText = limitedOptions
      .map((opt, index) => `${index + 1}. ${opt.text || opt.value || opt}`)
      .join(", ");
    return `What is your ${fieldLabel}? Options: ${optionsText}`;
  }

  const fieldLower = fieldLabel.toLowerCase();

  // Simple question templates based on field type
  const questionTemplates = {
    name: "What is your name?",
    "full name": "What is your full name?",
    "first name": "What is your first name?",
    "last name": "What is your last name?",
    email: "What is your email address?",
    phone: "What is your phone number?",
    telephone: "What is your telephone number?",
    mobile: "What is your mobile number?",
    address: "What is your address?",
    city: "What city do you live in?",
    state: "What state do you live in?",
    country: "What country do you live in?",
    zip: "What is your zip code?",
    postal: "What is your postal code?",
    age: "How old are you?",
    birthday: "What is your date of birth?",
    "birth date": "What is your birth date?",
    company: "Where do you work?",
    job: "What is your job title?",
    occupation: "What is your occupation?",
    position: "What is your position?",
    department: "What department do you work in?",
    website: "What is your website?",
    url: "What is your website URL?",
    comment: "What would you like to say?",
    message: "What message would you like to leave?",
    notes: "What notes would you like to add?",
    subject: "What is the subject?",
    description: "Please describe this briefly",
  };

  // Find matching question or use default
  let question = questionTemplates[fieldLower] || `What is your ${fieldLabel}?`;

  return question;
}

// Detect form language by analyzing page content
// Detect form language by analyzing character distribution
// Returns and stores globally as window.formLanguage
function detectFormLanguage() {
  // Return cached value if already detected
  if (window.formLanguage) {
    console.log(`Form language (cached): ${window.formLanguage}`);
    return window.formLanguage;
  }

  // Check page language attribute
  const pageLang =
    document.documentElement.lang || document.body.getAttribute("lang") || "en";

  // Collect all text from page and form elements
  const pageText = document.body.innerText || "";

  // Get form labels and placeholders
  const formElements = document.querySelectorAll(
    "label, input[placeholder], textarea[placeholder], input[aria-label], textarea[aria-label]",
  );
  const formText = Array.from(formElements)
    .map(
      (el) =>
        el.textContent ||
        el.getAttribute("placeholder") ||
        el.getAttribute("aria-label") ||
        "",
    )
    .join(" ");

  // Combine all collected text
  const allText = (pageText + " " + formText).toLowerCase();

  // Count Hindi and Latin characters
  const hindiCharRegex = /[\u0900-\u097F]/g; // Devanagari script (Hindi)
  const latinCharRegex = /[a-z]/gi; // Latin alphabet

  const hindiCharCount = (allText.match(hindiCharRegex) || []).length;
  const latinCharCount = (allText.match(latinCharRegex) || []).length;

  // Additional Hindi indicators
  const hindiIndicators = [
    /namaste|dhanyawad|shukriya|hindi/i,
    /kya|hai|hain|ho/i, // Common Hindi words
    /mera|teri|uska|hamara/i, // Possessive Hindi words
    /naam|pata|phone|address|email|age|city/i, // English field names (but could have Hindi labels)
  ];

  const hasHindiIndicators = hindiIndicators.some((pattern) =>
    pattern.test(allText),
  );

  console.log(`\n=== LANGUAGE DETECTION ===`);
  console.log(`Page lang attribute: ${pageLang}`);
  console.log(`Hindi characters found: ${hindiCharCount}`);
  console.log(`Latin characters found: ${latinCharCount}`);
  console.log(`Hindi indicators found: ${hasHindiIndicators}`);

  // Decision logic:
  // 1. If page lang starts with "hi", use Hindi
  // 2. Else if Hindi characters > Latin characters, use Hindi
  // 3. Else if Hindi indicators present AND no significant Latin text, use Hindi
  // 4. Otherwise use English

  let detectedLanguage = "en";

  if (pageLang.startsWith("hi")) {
    detectedLanguage = "hi";
    console.log("Decision: Page lang attribute is Hindi");
  } else if (hindiCharCount > latinCharCount && hindiCharCount > 0) {
    detectedLanguage = "hi";
    console.log(
      `Decision: Hindi characters (${hindiCharCount}) > Latin characters (${latinCharCount})`,
    );
  } else if (hasHindiIndicators && latinCharCount < 50) {
    detectedLanguage = "hi";
    console.log("Decision: Hindi indicators found with minimal Latin text");
  } else {
    detectedLanguage = "en";
    console.log("Decision: English (default or more Latin characters)");
  }

  // Store globally
  window.formLanguage = detectedLanguage;
  console.log(
    `Form language stored: window.formLanguage = "${window.formLanguage}"`,
  );
  console.log(`=== END DETECTION ===\n`);

  return window.formLanguage;
}

// AI processing function with dropdown and language conversion support
async function processWithAI(input, field, fieldContext = null) {
  try {
    console.log("RAW:", input);

    // Get form language to enforce in backend
    const formLanguage = detectFormLanguage();

    // Prepare request body with context
    const requestBody = {
      input: input,
      field: field,
      userLanguage: selectedLanguage, // Always include user language
      formLanguage: formLanguage, // Always include form language for output enforcement
    };

    // Add dropdown context if available
    if (fieldContext && fieldContext.type === "dropdown") {
      requestBody.options = fieldContext.options;
      console.log("Processing dropdown with options:", fieldContext.options);
    }

    const response = await fetch("http://localhost:3000/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Backend processing error:", errorData);
      throw new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const result = await response.json();
    const finalAnswer = result.value;

    console.log("AI:", finalAnswer);
    console.log(`Output enforced to ${formLanguage} based on form language`);
    return finalAnswer;
  } catch (error) {
    console.error("AI processing failed:", error);

    // Fallback to raw input if backend fails
    console.log("Falling back to raw input");
    return input;
  }
}

// Optimized form field filling with modern framework compatibility
function fillFormField(element, value) {
  const tagName = element.tagName.toLowerCase();

  // ✅ FIX 3: DOB FINAL FILL - Enforce date field handling with proper events
  if (element.type === "date" || element.getAttribute("type") === "date") {
    console.log(`Date field fill: Setting value to "${value}"`);
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    console.log(`Date field filled and events dispatched`);
    return;
  }

  // Check if this is a password field and clean value (remove spaces)
  let finalValue = value;
  if (isPasswordField(element)) {
    finalValue = cleanPasswordInput(value);
    console.log(
      `Password field detected: Cleaned "${value}" → "${finalValue}"`,
    );
  }

  // Check if this is a username field and clean value (remove spaces)
  if (isUsernameField(element)) {
    finalValue = cleanUsernameInput(value);
    console.log(
      `Username field detected: Cleaned "${value}" → "${finalValue}"`,
    );
  }

  // Focus element before filling for better compatibility
  try {
    element.focus();
  } catch (e) {
    // Ignore focus errors
  }

  if (tagName === "input" || tagName === "textarea") {
    try {
      // Use native value setter for maximum framework compatibility
      const setter = Object.getOwnPropertyDescriptor(
        element.__proto__,
        "value",
      ).set;
      setter.call(element, finalValue);

      // Dispatch comprehensive events for framework detection
      const events = [
        { type: "input", bubbles: true, cancelable: true, composed: true },
        { type: "change", bubbles: true, cancelable: true, composed: true },
        { type: "blur", bubbles: true, cancelable: true, composed: true },
      ];

      events.forEach((eventConfig) => {
        const event = new Event(eventConfig.type, eventConfig);
        element.dispatchEvent(event);
      });

      // Special handling for React
      if (element._reactInternalInstance || element.__reactInternalInstance) {
        const reactInstance =
          element._reactInternalInstance || element.__reactInternalInstance;
        if (reactInstance && reactInstance.stateNode) {
          reactInstance.stateNode.value = finalValue;
        }
      }

      // Special handling for Vue
      if (element.__vue__) {
        element.__vue__.$emit("input", finalValue);
      }

      // Special handling for Angular
      if (element.ngControl) {
        element.ngControl.control.setValue(finalValue);
        element.ngControl.control.markAsDirty();
      }

      console.log(`Successfully filled ${tagName} with value: "${finalValue}"`);
    } catch (error) {
      console.error("Error with native setter, using fallback:", error);
      // Reliable fallback method
      element.value = finalValue;
      element.dispatchEvent(
        new Event("input", { bubbles: true, cancelable: true }),
      );
      element.dispatchEvent(
        new Event("change", { bubbles: true, cancelable: true }),
      );
    }
  } else if (tagName === "select") {
    try {
      // Use smart option matching
      const options = Array.from(element.options).map((opt) => ({
        text: opt.text,
        value: opt.value,
      }));

      const matchedOption = matchUserInputToOption(value, options);

      if (matchedOption) {
        // Find the index of the matched option
        const optionElements = Array.from(element.options);
        const selectedIndex = optionElements.findIndex(
          (opt) =>
            (opt.text || opt.value) ===
            (matchedOption.text || matchedOption.value),
        );

        if (selectedIndex !== -1) {
          // Use native setter for better compatibility
          const setter = Object.getOwnPropertyDescriptor(
            element.__proto__,
            "selectedIndex",
          ).set;
          setter.call(element, selectedIndex);

          // Dispatch change event
          element.dispatchEvent(
            new Event("change", { bubbles: true, cancelable: true }),
          );

          console.log(
            `Successfully selected option ${selectedIndex}: "${optionElements[selectedIndex].text}"`,
          );
        } else {
          console.warn(
            `Matched option not found in element options: "${matchedOption.text}"`,
          );
        }
      } else {
        console.warn(
          `No matching option found for value: "${value}". Available options:`,
          options.map((opt) => opt.text),
        );

        // Fallback: select first option if available
        if (options.length > 0) {
          const setter = Object.getOwnPropertyDescriptor(
            element.__proto__,
            "selectedIndex",
          ).set;
          setter.call(element, 0);
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } catch (error) {
      console.error("Error filling select element:", error);
      // Fallback
      if (element.options.length > 0) {
        element.selectedIndex = 0;
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  } else if (tagName === "div" || tagName === "span") {
    // Handle contenteditable divs or other elements
    if (element.contentEditable === "true") {
      element.textContent = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      console.warn(`Unsupported element type for filling: ${tagName}`);
    }
  } else {
    console.warn(`Unsupported element type for filling: ${tagName}`);
  }
}

// Attach to window for debugging
window.extractFields = extractFields;
window.speak = speak;
window.listen = listen;
window.startAawazz = startAawazz;
window.stopAawazz = stopAawazz;
console.log("Aawazz functions attached to window");

// Add keyboard shortcut to stop Aawazz (Escape key)
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    stopAawazz();
  }
});

// Create Aawazz button
if (!document.getElementById("Aawazz-root")) {
  // Create container div
  const container = document.createElement("div");
  container.id = "Aawazz-root";

  // Create floating button
  const button = document.createElement("button");
  button.textContent = "Start Aawazz";

  // Style the button
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.zIndex = "10000";
  button.style.padding = "12px 20px";
  button.style.backgroundColor = "#4285f4";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "24px";
  button.style.fontSize = "14px";
  button.style.fontWeight = "600";
  button.style.cursor = "pointer";
  button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
  button.style.transition = "transform 0.2s ease";

  // Add hover effect
  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.05)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
  });

  // Set initial button text
  button.textContent = "Start Aawazz";

  // Add click event listener
  button.addEventListener("click", async () => {
    console.log("Aawazz Started");

    try {
      await startAawazz();
    } catch (error) {
      console.error("Error:", error);
      alert("Error: " + error.message);
    }
  });

  // Append button to container and container to body
  container.appendChild(button);
  document.body.appendChild(container);

  console.log("Aawazz button created");
}

console.log("Content script loaded successfully");
