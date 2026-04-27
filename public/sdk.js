/**
 * Aawazz SDK - Voice-powered form filling for any website
 * Works without any browser extension dependencies
 * Include via: <script src="https://yourdomain.com/sdk.js"></script>
 */

(function() {
    'use strict';

    // ========================================
    // GLOBAL STATE MANAGEMENT
    // ========================================
    
    let AawazzState = {
        fields: [],
        currentIndex: 0,
        isRunning: false,
        completed: {},
        totalFields: 0
    };

    // ========================================
    // FIELD HIGHLIGHTING MODULE
    // ========================================
    
    const FieldHighlighter = {
        addAawazzStyles() {
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
                    to: opacity: 1; transform: scale(1); }
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
        },

        highlightActiveField(field) {
            // Remove previous highlights
            document.querySelectorAll(".aawazz-field-highlight").forEach((el) => {
                el.classList.remove("aawazz-field-highlight");
                el.style.outline = "";
                el.style.boxShadow = "";
            });

            if (field && field.element) {
                let elementsToHighlight = [];
                
                if (field.type === "radio-group" || field.type === "checkbox-group") {
                    // For radio and checkbox groups, highlight all elements in the group
                    elementsToHighlight = field.allElements || [field.element];
                } else {
                    // For single elements, just highlight the main element
                    elementsToHighlight = [field.element];
                }

                // Add highlight to all relevant elements
                elementsToHighlight.forEach(element => {
                    element.classList.add("aawazz-field-highlight");
                    element.style.outline = "2px solid #2196F3";
                    element.style.outlineOffset = "-2px";
                    element.style.boxShadow = "0 0 15px rgba(33, 150, 243, 0.3)";
                });

                // Scroll first element into view
                if (elementsToHighlight.length > 0) {
                    elementsToHighlight[0].scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                        inline: "nearest",
                    });
                }
            }
        },

        removeFieldHighlights() {
            document.querySelectorAll(".aawazz-field-highlight").forEach((el) => {
                el.classList.remove("aawazz-field-highlight");
                el.style.outline = "";
                el.style.boxShadow = "";
            });
        }
    };

    // ========================================
    // FIELD DETECTION MODULE
    // ========================================
    
    const FieldDetector = {
        safeGetTextContent(element) {
            return element ? element.textContent.trim() : "";
        },

        safeGetAttribute(element, attribute) {
            return element ? (element.getAttribute(attribute) || "").trim() : "";
        },

        getTextFromPreviousSibling(element) {
            const previousSibling = element ? element.previousElementSibling : null;
            return this.safeGetTextContent(previousSibling);
        },

        generateFieldId(index) {
            return "aawazz-field-" + index;
        },

        extractFieldLabel(element, index) {
            // 1. Check for label[for=id]
            if (element.id) {
                const labelElement = document.querySelector(`label[for="${element.id}"]`);
                const labelText = this.safeGetTextContent(labelElement);
                if (labelText) {
                    return labelText;
                }
            }

            // 2. Check previous sibling text
            const previousSiblingText = this.getTextFromPreviousSibling(element);
            if (previousSiblingText) {
                return previousSiblingText;
            }

            // 3. Check parent container text
            const parentContainerText = this.safeGetTextContent(element.parentElement);
            if (parentContainerText) {
                return parentContainerText;
            }

            // 4. Check table cell (td) before input
            const tableCell = element.closest("td");
            if (tableCell) {
                const previousTableCellText = this.getTextFromPreviousSibling(tableCell);
                if (previousTableCellText) {
                    return previousTableCellText;
                }
            }

            // 5. Check placeholder
            const placeholderText = this.safeGetAttribute(element, "placeholder");
            if (placeholderText) {
                return placeholderText;
            }

            // 6. Check aria-label
            const ariaLabelText = this.safeGetAttribute(element, "aria-label");
            if (ariaLabelText) {
                return ariaLabelText;
            }

            // 7. Fallback to "Field X"
            return "Field " + (index + 1);
        },

        extractRadioGroupLabel(radioElements, groupName) {
            // Try to find a proper label for the radio group
            const firstRadio = radioElements[0];
            
            // 1. Check for legend element (for fieldsets)
            const fieldset = firstRadio.closest("fieldset");
            if (fieldset) {
                const legend = fieldset.querySelector("legend");
                if (legend) {
                    const legendText = this.safeGetTextContent(legend);
                    if (legendText && !this.isOptionText(legendText)) {
                        return legendText;
                    }
                }
            }

            // 2. Check for label elements that don't point to specific radios
            const allLabels = document.querySelectorAll("label");
            for (const label of allLabels) {
                const labelFor = this.safeGetAttribute(label, "for");
                const labelText = this.safeGetTextContent(label);
                
                // Skip if this label points to one of the radio buttons
                if (labelFor && radioElements.some(radio => radio.id === labelFor)) {
                    continue;
                }
                
                // Check if this label contains any of the radio buttons
                if (labelText && radioElements.some(radio => label.contains(radio))) {
                    // Extract text before the first radio button
                    const radioIndex = Array.from(label.children).indexOf(
                        label.querySelector("input[type=\"radio\"]")
                    );
                    if (radioIndex > 0) {
                        return labelText.split(/\s+/).slice(0, radioIndex).join(" ");
                    }
                }
            }

            // 3. Check parent container for non-option text
            const parent = firstRadio.parentElement;
            if (parent) {
                const parentText = this.safeGetTextContent(parent);
                const cleanText = this.removeOptionText(parentText, radioElements);
                if (cleanText && cleanText.trim() !== "") {
                    return cleanText.trim();
                }
            }

            // 4. Check common Hindi field names by group name
            const hindiFieldNames = {
                'gender': 'लिंग',
                'ling': 'लिंग',
                'sex': 'लिंग',
                'education': 'शिक्षा स्तर',
                'category': 'श्रेणी'
            };

            const groupNameLower = (groupName || "").toLowerCase();
            if (hindiFieldNames[groupNameLower]) {
                return hindiFieldNames[groupNameLower];
            }

            return null;
        },

        isOptionText(text) {
            // Check if text looks like an option (short, single words)
            const words = text.trim().split(/\s+/);
            return words.length <= 2 && words.length > 0;
        },

        removeOptionText(containerText, radioElements) {
            // Remove option text from container text
            let cleanText = containerText;
            
            radioElements.forEach(radio => {
                const optionText = this.extractOptionLabel(radio);
                if (optionText) {
                    cleanText = cleanText.replace(optionText, "");
                }
            });
            
            return cleanText.replace(/\s+/g, " ").trim();
        },

        extractOptionLabel(element) {
            // 1. Check for associated label[for=id]
            if (element.id) {
                const labelElement = document.querySelector(`label[for="${element.id}"]`);
                if (labelElement) {
                    const labelText = this.safeGetTextContent(labelElement);
                    if (labelText) {
                        return labelText;
                    }
                }
            }

            // 2. Check parent label
            const parentLabel = element.closest("label");
            if (parentLabel) {
                const labelText = this.safeGetTextContent(parentLabel);
                if (labelText) {
                    return labelText;
                }
            }

            // 3. Check next sibling text
            const nextSibling = element ? element.nextElementSibling : null;
            if (nextSibling) {
                const labelText = this.safeGetTextContent(nextSibling);
                if (labelText) {
                    return labelText;
                }
            }

            // 4. Check element value
            const value = this.safeGetAttribute(element, "value");
            if (value) {
                return value;
            }

            // 5. Fallback to element text content
            const text = this.safeGetTextContent(element);
            if (text) {
                return text;
            }

            // 6. Last resort - use name attribute
            return element.name || "Option";
        },

        getFieldType(element) {
            const tagName = element.tagName.toLowerCase();
            if (tagName === "input") {
                return element.type || "text";
            }
            return tagName;
        },

        isFieldEmpty(element) {
            const value = element.value || "";
            return value.trim() === "";
        },

        isFieldVisible(element) {
            let current = element;
            while (current) {
                const style = window.getComputedStyle(current);
                if (style.display === "none" || style.visibility === "hidden") {
                    return false;
                }
                current = current.parentElement;
            }
            return true;
        },

        isDateField(element, fieldLabel = "") {
            if (!element) return false;
            const inputType = (element.type || "").toLowerCase();
            if (inputType === "date") return true;
            
            const label = (element.name || element.id || "").toLowerCase();
            const combinedLabel = (label + " " + (fieldLabel || "")).toLowerCase();
            const dateIndicators = [
                "date", "dob", "birth", "birthday", 
                "जन्म", "तारीख", "डेट"
            ];
            return dateIndicators.some((indicator) => combinedLabel.includes(indicator));
        },

        detectDateFormat(element) {
            if (!element) return "auto";
            
            const placeholder = (element.placeholder || "").toLowerCase();
            if (placeholder.includes("yyyy-mm-dd")) return "yyyy-mm-dd";
            if (placeholder.includes("dd-mm-yyyy")) return "dd-mm-yyyy";
            if (placeholder.includes("dd/mm/yyyy")) return "dd/mm/yyyy";
            
            if (element.type !== "date") {
                return "dd-mm-yyyy";
            }
            return "yyyy-mm-dd";
        },

        detectFieldType(element, fieldLabel = "") {
            if (!element) return "normal";

            // Priority 1: Check for password field
            if (this.isPasswordField(element)) {
                return "password";
            }

            // Priority 2: Check for email field
            if (this.isEmailField(element, fieldLabel)) {
                return "email";
            }

            // Priority 3: Check for phone field
            if (this.isPhoneField(element)) {
                return "phone";
            }

            // Default: Normal field
            return "normal";
        },

        isPasswordField(element) {
            if (!element) return false;
            const tagName = (element.tagName || "").toLowerCase();
            const inputType = (element.type || "").toLowerCase();
            
            if (inputType === "password") return true;
            
            const label = (element.name || element.id || "").toLowerCase();
            const passwordIndicators = [
                "password", "pass", "pwd", "passwd", "secret", "pin"
            ];
            return tagName === "input" && passwordIndicators.some((indicator) => label.includes(indicator));
        },

        isEmailField(element, fieldLabel = "") {
            if (!element) return false;
            const inputType = (element.type || "").toLowerCase();
            if (inputType === "email") return true;
            
            const elementLabel = (element.name || element.id || "").toLowerCase();
            const combinedLabel = (elementLabel + " " + (fieldLabel || "")).toLowerCase();
            return combinedLabel.includes("email") || combinedLabel.includes("mail") || combinedLabel.includes("e-mail");
        },

        isPhoneField(element) {
            if (!element) return false;
            const inputType = (element.type || "").toLowerCase();
            if (inputType === "tel" || inputType === "phone") return true;
            
            const label = (element.name || element.id || "").toLowerCase();
            const phoneIndicators = ["phone", "mobile", "contact", "telephone"];
            return phoneIndicators.some((indicator) => label.includes(indicator));
        },

        extractFields() {
            console.log("Extracting form fields...");
            
            const singleElements = [];
            const radioElements = [];
            const checkboxElements = [];

            const inputElements = document.querySelectorAll('input, textarea, select');
            console.log(`Total form elements found: ${inputElements.length}`);

            const formElements = Array.from(inputElements).filter((element) => {
                if (element.type === "hidden") return false;
                if (element.type === "submit" || element.type === "button" || element.type === "reset") return false;
                if (element.id && (element.id.includes("Aawazz") || element.id.includes("aawazz"))) return false;
                return true;
            });

            console.log(`After filtering: ${formElements.length} usable elements`);

            formElements.forEach((element) => {
                if (!this.isFieldVisible(element)) {
                    console.log("  [SKIP] Hidden field:", element.name || element.id);
                    return;
                }

                if (element.type === "radio") {
                    radioElements.push(element);
                } else if (element.type === "checkbox") {
                    checkboxElements.push(element);
                } else {
                    singleElements.push(element);
                }
            });

            // Group radio and checkbox elements by name
            const radioGroups = new Map();
            const checkboxGroups = new Map();

            radioElements.forEach((radio) => {
                const groupName = radio.name;
                if (!radioGroups.has(groupName)) {
                    radioGroups.set(groupName, []);
                }
                radioGroups.get(groupName).push(radio);
            });

            checkboxElements.forEach((checkbox) => {
                const groupName = checkbox.name;
                if (!checkboxGroups.has(groupName)) {
                    checkboxGroups.set(groupName, []);
                }
                checkboxGroups.get(groupName).push(checkbox);
            });

            const fields = [];

            // Process single elements
            singleElements.forEach((element, index) => {
                if ((element.tagName.toLowerCase() === "input" || element.tagName.toLowerCase() === "textarea") &&
                    !this.isFieldEmpty(element)) {
                    console.log(`    [SKIP] Field not empty: ${element.name || element.id}`);
                    return;
                }

                if (!element.id && !element.name) {
                    element.id = this.generateFieldId(index);
                }

                const fieldId = element.id || element.name || this.generateFieldId(index);
                let fieldType = this.getFieldType(element);
                const fieldLabel = this.extractFieldLabel(element, index);

                if (this.isDateField(element, fieldLabel)) {
                    fieldType = "date-field";
                    const dateFormat = this.detectDateFormat(element);
                    
                    fields.push({
                        id: fieldId,
                        type: fieldType,
                        label: fieldLabel,
                        element: element,
                        dateFormat: dateFormat,
                    });
                } else {
                    fields.push({
                        id: fieldId,
                        type: fieldType,
                        label: fieldLabel,
                        element: element,
                    });
                }
            });

            // Process radio groups
            radioGroups.forEach((radioElements, groupName) => {
                const firstRadio = radioElements[0];
                let fieldLabel = this.extractRadioGroupLabel(radioElements, groupName) || groupName;

                const options = radioElements.map((radio) => ({
                    text: this.extractOptionLabel(radio),
                    value: radio.value,
                    element: radio,
                }));

                const radioField = {
                    id: groupName,
                    type: "radio-group",
                    label: fieldLabel,
                    element: firstRadio,
                    options: options,
                    allElements: radioElements,
                };
                console.log("DEBUG: Radio field extracted:", JSON.stringify(radioField));
                fields.push(radioField);
            });

            // Process checkbox groups
            checkboxGroups.forEach((checkboxElements, groupName) => {
                const firstCheckbox = checkboxElements[0];
                const fieldLabel = this.extractFieldLabel(firstCheckbox, fields.length) || groupName;

                const options = checkboxElements.map((checkbox) => ({
                    text: this.extractOptionLabel(checkbox),
                    value: checkbox.value,
                    element: checkbox,
                }));

                fields.push({
                    id: groupName,
                    type: "checkbox-group",
                    label: fieldLabel,
                    element: firstCheckbox,
                    options: options,
                    allElements: checkboxElements,
                });
            });

            console.log(`Extracted ${fields.length} fields`);
            return fields;
        }
    };

    // ========================================
    // VOICE SYSTEM MODULE
    // ========================================
    
    const VoiceSystem = {
        selectedLanguage: "en-IN",
        recognition: null,

        languages: {
            "en-IN": {
                name: "English (India)",
                code: "en-IN",
                speechCode: "en-IN",
                recognitionCode: "en-IN",
                greeting: "Hello, I am Aawazz. I will help you fill forms using your voice.",
                questionPrefix: "What is your",
                confirmPrompt: "If this is correct say yes, otherwise say no clearly.",
                retryMessage: "Let's try again.",
                successMessage: "filled successfully.",
                errorMessage: "I didn't catch that. Let's try again.",
                noSpeechMessage: "I didn't hear anything. Please try again.",
                stopMessage: "Aawazz process stopped.",
                completeMessage: "All fields are filled.",
                noFieldsMessage: "No empty form fields found on this page.",
                startMessage: "Found {count} form fields to fill. Let's start.",
            },
            "hi-IN": {
                name: "Hindi (India)",
                code: "hi-IN",
                speechCode: "hi-IN",
                recognitionCode: "hi-IN",
                greeting: "Hello, Main aapki awaaz se forms fill karne mein madad karungi.",
                questionPrefix: "Aapka",
                confirmPrompt: "Agar yeh sahi hai toh yes boliye, warna no clearly boliye.",
                retryMessage: "Phir se koshish karte hain.",
                successMessage: "successfully fill ho gaya.",
                errorMessage: "Mujhe samajh nahi aaya. Phir se koshish karte hain.",
                noSpeechMessage: "Maine kuch nahi suna. Kripya phir se koshish karein.",
                stopMessage: "Aawazz process stop ho gaya.",
                completeMessage: "Saare fields fill ho gaye hain.",
                noFieldsMessage: "Is page par koi empty form fields nahi mile.",
                startMessage: "{count} form fields fill karne ke liye mile hain. Chaliye shuru karte hain.",
            }
        },

        getCurrentLanguage() {
            return this.languages[this.selectedLanguage] || this.languages["en-IN"];
        },

        switchLanguage(languageCode) {
            if (this.languages[languageCode]) {
                this.selectedLanguage = languageCode;
                localStorage.setItem("aawazz-language", languageCode);
                return true;
            }
            return false;
        },

        loadLanguagePreference() {
            const saved = localStorage.getItem("aawazz-language");
            if (saved && this.languages[saved]) {
                this.selectedLanguage = saved;
            }
        },

        speak(text) {
            return new Promise((resolve, reject) => {
                if (!("speechSynthesis" in window)) {
                    reject(new Error("Speech synthesis not supported"));
                    return;
                }

                speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                const lang = this.getCurrentLanguage();
                utterance.lang = lang.speechCode;
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;

                utterance.onend = () => resolve();
                utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));

                setTimeout(() => {
                    speechSynthesis.speak(utterance);
                }, 100);
            });
        },

        listen() {
            return new Promise((resolve, reject) => {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition) {
                    reject(new Error("Speech recognition not supported"));
                    return;
                }

                this.recognition = new SpeechRecognition();
                this.recognition.lang = this.selectedLanguage === "hi-IN" ? "hi-IN" : "en-US";
                this.recognition.continuous = true;
                this.recognition.interimResults = false;
                this.recognition.maxAlternatives = 1;
                this.recognition.maxDuration = 8000;

                let resolved = false;

                this.recognition.onresult = (event) => {
                    if (resolved) return;
                    const result = event.results[event.results.length - 1];
                    if (result.isFinal) {
                        const finalText = result[0].transcript.trim();
                        console.log("Final recognized:", finalText);
                        
                        if (finalText.length > 0) {
                            resolved = true;
                            this.recognition.stop();
                            resolve(finalText);
                        }
                    }
                };

                this.recognition.onerror = (err) => {
                    if (!resolved) {
                        resolved = true;
                        reject({ error: err.error, type: "recognition_error" });
                    }
                };

                this.recognition.onend = () => {
                    if (!resolved) {
                        reject({ error: "No speech detected", type: "no_speech" });
                    }
                };

                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        this.recognition.stop();
                        reject({ error: "Speech recognition timeout", type: "timeout" });
                    }
                }, 8000);

                this.recognition.start();
            });
        },

        async listenWithRetry(retryCount = 0) {
            const MAX_RETRIES = 1;
            try {
                console.log(`Listening attempt ${retryCount + 1}...`);
                const result = await this.listen();
                console.log(`Successfully recognized: "${result}"`);
                return result;
            } catch (error) {
                const isTimeout = error.type === "timeout" || 
                    (typeof error === "object" && error.error === "timeout") ||
                    (typeof error === "string" && error.includes("timeout"));

                if (isTimeout && retryCount < MAX_RETRIES) {
                    console.log(`Timeout occurred, retrying... (attempt ${retryCount + 2})`);
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    return this.listenWithRetry(retryCount + 1);
                }
                throw error;
            }
        },

        stop() {
            if ("speechSynthesis" in window) {
                speechSynthesis.cancel();
            }
            if (this.recognition) {
                try {
                    this.recognition.stop();
                } catch (error) {
                    console.log("Speech recognition already stopped or not running");
                }
            }
        }
    };

    // ========================================
    // FORM FILLING ENGINE
    // ========================================
    
    const FormFiller = {
        // Helper function to check if a field is a password field (from content.js)
        isPasswordField(element) {
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
        },

        // Helper function to check if a field is a username field (from content.js)
        isUsernameField(element) {
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
        },

        // Helper function to clean password input - removes all spaces (from content.js)
        cleanPasswordInput(value) {
            if (!value) return "";

            // Remove ALL spaces from password (passwords don't have spaces)
            return value.replace(/\s+/g, "");
        },

        // Helper function to clean username input - removes all spaces (from content.js)
        cleanUsernameInput(value) {
            if (!value) return "";

            // Remove ALL spaces from username (usernames don't have spaces)
            return value.replace(/\s+/g, "");
        },

        // Basic Hindi to English transliteration map (from content.js)
        basicHindiToEnglish(text) {
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
                "": "au",
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
        },

        containsHindiCharacters(text) {
            if (!text) return false;
            return /[\u0900-\u097F]/.test(text);
        },

        // Email processing function from content.js
        processEmailInput(rawInput) {
            if (!rawInput) return "";

            console.log(`Email input processing: "${rawInput}"`);

            let processed = rawInput;

            // Step 1: Replace MULTI-WORD Hindi phrases FIRST
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
                const regex = new RegExp(phrase.replace(/\s+/g, "\\s+"), "gi");
                if (regex.test(processed)) {
                    processed = processed.replace(regex, replacement);
                    console.log(`  Multi-word replacement: "${desc}" → "${replacement}"`);
                }
            }

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
                const isASCII = /^[a-z]+$/i.test(word);

                let regex;
                if (isASCII) {
                    regex = new RegExp(`\\b${word}\\b`, "gi");
                    processed = processed.replace(regex, symbol);
                } else {
                    regex = new RegExp(`(^|\\s)${word}(\\s|$)`, "gi");
                    processed = processed.replace(regex, `$1${symbol}$2`);
                }
            }

            // Step 3: NOW transliterate any remaining Hindi letters to English
            if (this.containsHindiCharacters(processed)) {
                const transliterated = this.basicHindiToEnglish(processed);
                console.log(`Step 3 - Hindi letters transliterated: "${processed}" → "${transliterated}"`);
                processed = transliterated;
            }

            // Step 4: Remove all spaces
            processed = processed.replace(/\s+/g, "");

            // Step 5: Normalize email format
            processed = processed.replace(/@+/g, "@"); // Only one @
            processed = processed.replace(/\.+/g, "."); // Only one dot per location

            // Step 6: Lowercase (email standard)
            const final = processed.toLowerCase().trim();
            console.log(`Email final: "${final}"`);

            return final;
        },

        processPasswordInput(rawInput) {
            if (!rawInput) return "";
            let converted = rawInput;
            if (this.containsHindiCharacters(rawInput)) {
                converted = this.basicHindiToEnglish(rawInput);
            }
            return converted.replace(/\s+/g, "");
        },

        parseAndFormatDate(input, outputFormat = "auto") {
            if (!input) return null;
            const format = (outputFormat || "auto").toLowerCase();

            // Check if already in YYYY-MM-DD format
            const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (isoRegex.test(input)) {
                if (format === "dd-mm-yyyy") {
                    const [year, month, day] = input.split("-");
                    return `${day}-${month}-${year}`;
                } else if (format === "dd/mm/yyyy") {
                    const [year, month, day] = input.split("-");
                    return `${day}/${month}/${year}`;
                }
                return input;
            }

            // Hindi month mappings
            const hindiMonths = {
                'जनवरी': 1, 'फरवरी': 2, 'मार्च': 3, 'अप्रैल': 4,
                'मई': 5, 'जून': 6, 'जुलाई': 7, 'अगस्त': 8,
                'सितंबर': 9, 'अक्टूबर': 10, 'नवंबर': 11, 'दिसंबर': 12
            };

            // English month mappings
            const englishMonths = {
                'january': 1, 'february': 2, 'march': 3, 'april': 4,
                'may': 5, 'june': 6, 'july': 7, 'august': 8,
                'september': 9, 'october': 10, 'november': 11, 'december': 12,
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5,
                'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10,
                'nov': 11, 'dec': 12
            };

            // Try DD-MM-YYYY format
            const ddmmyyyyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
            const ddmmyyyyMatch = input.match(ddmmyyyyRegex);
            if (ddmmyyyyMatch) {
                const day = parseInt(ddmmyyyyMatch[1]);
                const month = parseInt(ddmmyyyyMatch[2]);
                const year = parseInt(ddmmyyyyMatch[3]);
                if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                    return this.formatDateByType(day, month, year, format);
                }
            }

            // Try day month year format
            const parts = input.trim().split(/\s+/);
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const monthName = parts[1].toLowerCase();
                const year = parseInt(parts[2]);
                
                let month = hindiMonths[parts[1]] || englishMonths[monthName];
                if (month && day >= 1 && day <= 31 && year > 1900) {
                    return this.formatDateByType(day, month, year, format);
                }
            }

            return null;
        },

        formatDateByType(day, month, year, format = "auto") {
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
        },

        matchUserInputToOption(userInput, options) {
            if (!options || !Array.isArray(options) || options.length === 0) {
                return null;
            }

            const inputLower = userInput.toLowerCase().trim();

            // Exact match
            for (const option of options) {
                const optionText = (option.text || option.value || "").toLowerCase().trim();
                if (optionText === inputLower) {
                    return option;
                }
            }

            // Partial match
            for (const option of options) {
                const optionText = (option.text || option.value || "").toLowerCase().trim();
                if (optionText.includes(inputLower) || inputLower.includes(optionText)) {
                    return option;
                }
            }

            // Number match
            const inputNumber = inputLower.replace(/[^0-9]/g, "");
            if (inputNumber) {
                for (const option of options) {
                    const optionText = (option.text || option.value || "").toLowerCase().trim();
                    const optionNumber = optionText.replace(/[^0-9]/g, "");
                    if (optionNumber === inputNumber) {
                        return option;
                    }
                }
            }

            return options[0]; // Fallback
        },

        fillFormField(element, value) {
            const tagName = element.tagName.toLowerCase();

            // Handle date fields
            if (element.type === "date" || element.getAttribute("type") === "date") {
                element.value = value;
                element.dispatchEvent(new Event("input", { bubbles: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
                return;
            }

            // Apply field-specific normalization BEFORE filling
            let finalValue = value;
            
            if (this.isPasswordField(element)) {
                // Password: remove all spaces, convert Hindi to English
                finalValue = this.cleanPasswordInput(value);
                if (this.containsHindiCharacters(value)) {
                    finalValue = this.basicHindiToEnglish(value);
                    finalValue = finalValue.replace(/\s+/g, "");
                }
                console.log(`Password field filling: "${value}" → "${finalValue}"`);
            } else if (this.isUsernameField(element)) {
                // Username: remove spaces, convert to lowercase, convert Hindi to English
                finalValue = this.cleanUsernameInput(value);
                if (this.containsHindiCharacters(value)) {
                    finalValue = this.basicHindiToEnglish(value);
                    finalValue = finalValue.replace(/\s+/g, "");
                }
                finalValue = finalValue.toLowerCase();
                console.log(`Username field filling: "${value}" → "${finalValue}"`);
            } else if (FieldDetector.isEmailField(element)) {
                // Email: apply strict email normalization
                finalValue = this.processEmailInput(value);
                console.log(`Email field filling: "${value}" → "${finalValue}"`);
            }

            // Focus element
            try {
                element.focus();
            } catch (e) {
                // Ignore focus errors
            }

            if (tagName === "input" || tagName === "textarea") {
                try {
                    // Use native value setter
                    const setter = Object.getOwnPropertyDescriptor(element.__proto__, "value").set;
                    setter.call(element, finalValue);

                    // Dispatch events
                    const events = [
                        { type: "input", bubbles: true, cancelable: true, composed: true },
                        { type: "change", bubbles: true, cancelable: true, composed: true },
                        { type: "blur", bubbles: true, cancelable: true, composed: true },
                    ];

                    events.forEach((eventConfig) => {
                        const event = new Event(eventConfig.type, eventConfig);
                        element.dispatchEvent(event);
                    });

                    // Framework-specific handling
                    if (element._reactInternalInstance || element.__reactInternalInstance) {
                        const reactInstance = element._reactInternalInstance || element.__reactInternalInstance;
                        if (reactInstance && reactInstance.stateNode) {
                            reactInstance.stateNode.value = finalValue;
                        }
                    }

                    if (element.__vue__) {
                        element.__vue__.$emit("input", finalValue);
                    }

                    if (element.ngControl) {
                        element.ngControl.control.setValue(finalValue);
                        element.ngControl.control.markAsDirty();
                    }
                } catch (error) {
                    // Fallback method
                    element.value = finalValue;
                    element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
                    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
                }
            } else if (tagName === "select") {
                try {
                    const options = Array.from(element.options).map((opt) => ({
                        text: opt.text,
                        value: opt.value,
                    }));

                    const matchedOption = this.matchUserInputToOption(value, options);

                    if (matchedOption) {
                        const optionElements = Array.from(element.options);
                        const selectedIndex = optionElements.findIndex(
                            (opt) => (opt.text || opt.value) === (matchedOption.text || matchedOption.value)
                        );

                        if (selectedIndex !== -1) {
                            const setter = Object.getOwnPropertyDescriptor(element.__proto__, "selectedIndex").set;
                            setter.call(element, selectedIndex);
                            element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
                        }
                    }
                } catch (error) {
                    // Fallback
                    if (element.options.length > 0) {
                        element.selectedIndex = 0;
                        element.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                }
            }
        }
    };

    // ========================================
    // AI PROCESSING MODULE
    // ========================================
    
    const AIProcessor = {
        async process(input, field, fieldContext = null) {
            try {
                console.log("AI processing:", input);

                // Prepare request body
                const requestBody = {
                    input: input,
                    field: field,
                    userLanguage: VoiceSystem.selectedLanguage,
                };

                // Add dropdown context if available
                if (fieldContext && fieldContext.type === "dropdown") {
                    requestBody.options = fieldContext.options;
                }

                const response = await fetch("https://your-backend-url.com/process", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                return result.value || input;
            } catch (error) {
                console.error("AI processing failed:", error);
                return input; // Fallback to raw input
            }
        }
    };

    // ========================================
    // LANGUAGE DETECTION
    // ========================================
    
    const LanguageDetector = {
        detectFormLanguage() {
            // Check page language attribute
            const pageLang = document.documentElement.lang || document.body.getAttribute("lang") || "en";

            // Collect text from page and form elements
            const pageText = document.body.innerText || "";
            const formElements = document.querySelectorAll(
                "label, input[placeholder], textarea[placeholder], input[aria-label], textarea[aria-label]"
            );
            const formText = Array.from(formElements)
                .map((el) => el.textContent || el.getAttribute("placeholder") || el.getAttribute("aria-label") || "")
                .join(" ");

            const allText = (pageText + " " + formText).toLowerCase();

            // Count characters
            const hindiCharRegex = /[\u0900-\u097F]/g;
            const latinCharRegex = /[a-z]/gi;
            const hindiCharCount = (allText.match(hindiCharRegex) || []).length;
            const latinCharCount = (allText.match(latinCharRegex) || []).length;

            // Decision logic
            let detectedLanguage = "en";
            if (pageLang.startsWith("hi")) {
                detectedLanguage = "hi";
            } else if (hindiCharCount > latinCharCount && hindiCharCount > 0) {
                detectedLanguage = "hi";
            } else {
                detectedLanguage = "en";
            }

            console.log(`Detected form language: ${detectedLanguage}`);
            return detectedLanguage;
        }
    };

    // ========================================
    // MAIN SDK OBJECT
    // ========================================
    
    const AawazzSDK = {
        isRunning: false,
        shouldStop: false,

        async start() {
            // PREVENT DUPLICATE EXECUTION
            if (AawazzState.isRunning) {
                console.log("Aawazz is already running");
                return;
            }

            // INITIALIZE STATE
            AawazzState.isRunning = true;
            AawazzState.currentIndex = 0;
            AawazzState.completed = {};
            
            this.isRunning = true;
            this.shouldStop = false;

            console.log("Starting Aawazz SDK with controlled flow...");

            try {
                // Add highlighting styles
                FieldHighlighter.addAawazzStyles();
                
                // Load language preference
                VoiceSystem.loadLanguagePreference();

                // Extract form fields
                const fields = FieldDetector.extractFields();
                AawazzState.fields = fields;
                AawazzState.totalFields = fields.length;
                
                console.log("Extracted fields:", fields);

                if (fields.length === 0) {
                    const lang = VoiceSystem.getCurrentLanguage();
                    await VoiceSystem.speak(lang.noFieldsMessage);
                    AawazzState.isRunning = false;
                    this.isRunning = false;
                    return;
                }

                // Greet user
                const lang = VoiceSystem.getCurrentLanguage();
                const greetingMessage = lang.greeting;
                await VoiceSystem.speak(greetingMessage);

                const startMessage = lang.startMessage.replace("{count}", fields.length);
                await VoiceSystem.speak(startMessage);

                // Detect form language
                const formLanguage = LanguageDetector.detectFormLanguage();
                console.log(`Form language: ${formLanguage}, User language: ${VoiceSystem.selectedLanguage}`);

                // START CONTROLLED FLOW
                await this.processNextField();

            } catch (error) {
                console.error("Aawazz error:", error);
                await VoiceSystem.speak("An error occurred while filling the form.");
                AawazzState.isRunning = false;
                this.isRunning = false;
            }
        },

        // MAIN LOOP (CONTROLLED FLOW)
        async processNextField() {
            // CHECK COMPLETION
            if (AawazzState.currentIndex >= AawazzState.fields.length) {
                // Remove field highlights
                FieldHighlighter.removeFieldHighlights();
                
                const lang = VoiceSystem.getCurrentLanguage();
                await VoiceSystem.speak(lang.completeMessage);
                console.log("Aawazz completed successfully");
                AawazzState.isRunning = false;
                this.isRunning = false;
                return;
            }

            // CHECK FOR STOP REQUEST
            if (this.shouldStop) {
                // Remove field highlights
                FieldHighlighter.removeFieldHighlights();
                
                const lang = VoiceSystem.getCurrentLanguage();
                await VoiceSystem.speak(lang.stopMessage);
                AawazzState.isRunning = false;
                this.isRunning = false;
                return;
            }

            const field = AawazzState.fields[AawazzState.currentIndex];

            // AUTO-SKIP FILLED FIELDS
            let isFieldFilled = false;
            
            if (field.type === "radio-group" || field.type === "checkbox-group") {
                // For radio and checkbox groups, check if any option is selected
                isFieldFilled = field.allElements && field.allElements.some(el => el.checked);
            } else {
                // For other fields, check the value
                isFieldFilled = field.element.value && field.element.value.trim() !== "";
            }
            
            if (isFieldFilled) {
                console.log(`Skipping already filled field: ${field.label}`);
                AawazzState.completed[field.id] = true;
                AawazzState.currentIndex++;
                return this.processNextField();
            }

            // SKIP IF ALREADY COMPLETED
            if (AawazzState.completed[field.id]) {
                AawazzState.currentIndex++;
                return this.processNextField();
            }

            // PROCESS CURRENT FIELD
            await this.processField(field);
        },

        // PROCESS FIELD
        async processField(field) {
            console.log(`Processing field ${AawazzState.currentIndex + 1}/${AawazzState.totalFields}: ${field.label}`);

            try {
                // HIGHLIGHT CURRENT FIELD
                FieldHighlighter.highlightActiveField(field);
                
                // UPDATE REAL-TIME TRACKING
                this.updateProgress({
                    current: AawazzState.currentIndex + 1,
                    total: AawazzState.totalFields,
                    label: field.label,
                    question: this.generateQuestion(field),
                    field: field
                });

                // ASK
                const question = this.generateQuestion(field);
                await VoiceSystem.speak(question);

                // LISTEN
                const input = await VoiceSystem.listenWithRetry();

                if (!input || input.trim() === "") {
                    await VoiceSystem.speak("मुझे समझ नहीं आया, कृपया दोहराएं");
                    return this.processField(field); // RETRY SAME FIELD
                }

                // PROCESS
                const value = await this.processFieldByType(field, input);

                // VALIDATION
                if (!value || (typeof value === 'string' && value.trim() === "")) {
                    await VoiceSystem.speak("यह सही नहीं है, कृपया दोबारा बताएं");
                    return this.processField(field); // RETRY SAME FIELD
                }

                // FILL
                await this.fillFieldByType(field, value);

                // MARK COMPLETE
                AawazzState.completed[field.id] = true;

                // SUCCESS FEEDBACK
                const lang = VoiceSystem.getCurrentLanguage();
                await VoiceSystem.speak(lang.successMessage);

                // MOVE NEXT
                AawazzState.currentIndex++;

                // CONTINUE
                return this.processNextField();

            } catch (error) {
                console.error("Field processing error:", error);
                await VoiceSystem.speak("इस फील्ड में समस्या हो रही है, अगला फील्ड आजमाते हैं");
                
                // MOVE TO NEXT FIELD ON ERROR
                AawazzState.currentIndex++;
                return this.processNextField();
            }
        },

        // GENERATE QUESTION
        generateQuestion(field) {
            if (VoiceSystem.selectedLanguage === "hi-IN") {
                return this.generateHindiQuestion(field.label, field.options);
            } else {
                return this.generateEnglishQuestion(field.label, field.options);
            }
        },

        // PROCESS FIELD BY TYPE
        async processFieldByType(field, input) {
            let finalAnswer = input;

            // Check for structured fields that need rule-based processing (skip AI)
            if (FormFiller.isPasswordField(field.element)) {
                // Password field: remove spaces, convert Hindi to English
                finalAnswer = FormFiller.cleanPasswordInput(input);
                if (FormFiller.containsHindiCharacters(input)) {
                    finalAnswer = FormFiller.basicHindiToEnglish(input);
                    finalAnswer = finalAnswer.replace(/\s+/g, "");
                }
                console.log(`Password field processed: "${input}" → "${finalAnswer}"`);
            } else if (FormFiller.isUsernameField(field.element)) {
                // Username field: remove spaces, convert to lowercase, convert Hindi to English
                finalAnswer = FormFiller.cleanUsernameInput(input);
                if (FormFiller.containsHindiCharacters(input)) {
                    finalAnswer = FormFiller.basicHindiToEnglish(input);
                    finalAnswer = finalAnswer.replace(/\s+/g, "");
                }
                finalAnswer = finalAnswer.toLowerCase();
                console.log(`Username field processed: "${input}" → "${finalAnswer}"`);
            } else if (FieldDetector.isEmailField(field.element, field.label)) {
                // Email field: apply strict email normalization
                finalAnswer = FormFiller.processEmailInput(input);
                console.log(`Email field processed: "${input}" → "${finalAnswer}"`);
            } else if (field.type !== "radio-group" && field.type !== "checkbox-group" && field.type !== "date-field") {
                // Use AI for normal fields only
                const fieldContext = field.type === "select" ? { type: "dropdown", options: field.options } : null;
                finalAnswer = await AIProcessor.process(input, field.label, fieldContext);
            }

            return finalAnswer;
        },

        // FILL FIELD BY TYPE
        async fillFieldByType(field, value) {
            try {
                if (field.type === "radio-group") {
                    await this.handleRadioGroup(field, value);
                } else if (field.type === "checkbox-group") {
                    await this.handleCheckboxGroup(field, value);
                } else if (field.type === "date-field") {
                    await this.handleDateField(field, value);
                } else {
                    FormFiller.fillFormField(field.element, value);
                }
            } catch (error) {
                console.error("Field filling error:", error);
                throw error;
            }
        },

        // REAL-TIME TRACKING UI
        updateProgress(progressInfo) {
            // Emit custom event for UI updates
            const event = new CustomEvent('aawazzProgress', {
                detail: {
                    current: progressInfo.current,
                    total: progressInfo.total,
                    label: progressInfo.label,
                    percentage: Math.round((progressInfo.current / progressInfo.total) * 100)
                }
            });
            document.dispatchEvent(event);

            console.log(`Progress: ${progressInfo.current}/${progressInfo.total} - ${progressInfo.label}`);
        },

        stop() {
            if (!this.isRunning) {
                return;
            }

            this.shouldStop = true;
            AawazzState.isRunning = false;
            
            // Remove field highlights
            FieldHighlighter.removeFieldHighlights();
            
            VoiceSystem.stop();
            console.log("Aawazz stop requested");
        },

        generateEnglishQuestion(fieldLabel, options = null) {
            if (options && Array.isArray(options) && options.length > 0) {
                const limitedOptions = options.slice(0, 5);
                const optionsText = limitedOptions
                    .map((opt, index) => `${index + 1}. ${opt.text || opt.value || opt}`)
                    .join(", ");
                return `What is your ${fieldLabel}? Options: ${optionsText}`;
            }

            const questionTemplates = {
                name: "What is your name?",
                "full name": "What is your full name?",
                "first name": "What is your first name?",
                "last name": "What is your last name?",
                email: "What is your email address?",
                phone: "What is your phone number?",
                address: "What is your address?",
                city: "What city do you live in?",
                state: "What state do you live in?",
                country: "What country do you live in?",
                age: "How old are you?",
                birthday: "What is your date of birth?",
            };

            const fieldLower = fieldLabel.toLowerCase();
            return questionTemplates[fieldLower] || `What is your ${fieldLabel}?`;
        },

        generateHindiQuestion(fieldLabel, options = null) {
            // Debug: Log the actual field label
            console.log("DEBUG: Field label:", JSON.stringify(fieldLabel));
            console.log("DEBUG: Options:", options);
            
            // Check for checkbox/acceptance fields first
            if (this.isAcceptanceField(fieldLabel)) {
                return "क्या आप नियम और शर्तों को स्वीकार करते हैं?";
            }

            if (options && Array.isArray(options) && options.length > 0) {
                const limitedOptions = options.slice(0, 5);
                const optionsText = limitedOptions
                    .map((opt, index) => `${index + 1}. ${opt.text || opt.value || opt}`)
                    .join(", ");
                
                // Use proper Hindi grammar based on field label
                let questionPrefix = this.getHindiQuestionPrefix(fieldLabel);
                return `${questionPrefix} ${fieldLabel} kya hai? विकल्प हैं: ${optionsText}`;
            }

            const hindiQuestions = {
                name: "aapka naam kya hai?",
                "full name": "aapka poora naam kya hai?",
                "first name": "aapka pehla naam kya hai?",
                "last name": "aapka antim naam kya hai?",
                email: "aapka email kya hai?",
                phone: "aapka mobile number kya hai?",
                address: "aapka pata kya hai?",
                city: "aapka sheher kya hai?",
                state: "aapka rajya kya hai?",
                country: "aapka desh kya hai?",
                age: "aapki umra kya hai?",
                birthday: "aapki janmdin tithi kya hai?",
                // Hindi field mappings
                "लिंग": "aapka ling kya hai?", // Gender
                "शिक्षा स्तर": "aapka shiksha star kya hai?", // Education level
                "पासवर्ड": "aapka password kya hai?", // Password
                "ईमेल": "aapka email kya hai?", // Email
                "पूरा नाम": "aapka poora naam kya hai?", // Full name
                "ईमेल पता": "aapka email pata kya hai?", // Email address
                "मोबाइल": "aapka mobile number kya hai?", // Mobile
                "जन्म तिथि": "aapki janmdin tithi kya hai?", // Birth date
                "शहर": "aapka sheher kya hai?", // City
                "राज्य": "aapka rajya kya hai?", // State
                "देश": "aapka desh kya hai?", // Country
                "पता": "aapka pata kya hai?", // Address
                "उम्र": "aapki umra kya hai?", // Age
            };

            const fieldLower = fieldLabel.toLowerCase();
            return hindiQuestions[fieldLabel] || hindiQuestions[fieldLower] || `${this.getHindiQuestionPrefix(fieldLabel)} ${fieldLabel} kya hai?`;
        },

        isAcceptanceField(fieldLabel) {
            // Check if this is a terms/conditions or acceptance field
            const acceptanceKeywords = [
                'स्वीकार', 'accept', 'agree', 'terms', 'conditions', 'नियम', 'शर्त',
                'शर्तों', 'terms and conditions', 'agree to', 'consent'
            ];
            
            const fieldLower = fieldLabel.toLowerCase();
            return acceptanceKeywords.some(keyword => fieldLower.includes(keyword));
        },

        getHindiQuestionPrefix(fieldLabel) {
            // Determine correct Hindi prefix based on field type
            const masculineFields = ['naam', 'name', 'email', 'phone', 'mobile', 'address', 'password', 'ling', 'शिक्षा', 'शिक्षा स्तर'];
            const feminineFields = ['umra', 'age', 'janmdin', 'birthday'];
            
            const fieldLower = fieldLabel.toLowerCase();
            
            if (masculineFields.some(mf => fieldLower.includes(mf))) {
                return "aapka";
            } else if (feminineFields.some(ff => fieldLower.includes(ff))) {
                return "aapki";
            } else {
                // Default to masculine for unknown fields
                return "aapka";
            }
        },

        async handleRadioGroup(field, input) {
            const matchedOption = FormFiller.matchUserInputToOption(input, field.options);
            if (matchedOption) {
                matchedOption.element.checked = true;
                matchedOption.element.dispatchEvent(new Event("change", { bubbles: true }));
                return matchedOption.text;
            }
            return null;
        },

        async handleCheckboxGroup(field, input) {
            // Simple implementation - split by common separators
            const parts = input.toLowerCase().split(/[,;]|और|or|and/).map(p => p.trim()).filter(p => p.length > 0);
            const matchedOptions = [];

            for (const part of parts) {
                const matched = FormFiller.matchUserInputToOption(part, field.options);
                if (matched && !matchedOptions.includes(matched)) {
                    matchedOptions.push(matched);
                }
            }

            matchedOptions.forEach((option) => {
                option.element.checked = true;
                option.element.dispatchEvent(new Event("change", { bubbles: true }));
            });

            return matchedOptions.map(o => o.text).join(", ");
        },

        async handleDateField(field, input) {
            const formattedDate = FormFiller.parseAndFormatDate(input, field.dateFormat);
            if (formattedDate) {
                FormFiller.fillFormField(field.element, formattedDate);
                return formattedDate;
            }
            return null;
        }
    };

    // ========================================
    // EXPOSE GLOBAL API
    // ========================================
    
    // Attach to window
    window.Aawazz = {
        start: AawazzSDK.start.bind(AawazzSDK),
        stop: AawazzSDK.stop.bind(AawazzSDK),
        
        // Additional utility methods
        setLanguage: (lang) => VoiceSystem.switchLanguage(lang),
        getLanguage: () => VoiceSystem.selectedLanguage,
        detectFields: () => FieldDetector.extractFields(),
        
        // Internal modules (for advanced usage)
        FieldDetector,
        VoiceSystem,
        FormFiller,
        AIProcessor,
        LanguageDetector,
        FieldHighlighter
    };

    // Auto-initialize
    console.log("Aawazz SDK loaded successfully");
    
    // Add keyboard shortcut (Escape key to stop)
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            AawazzSDK.stop();
        }
    });

})();
