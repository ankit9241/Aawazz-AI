// Content script for Aawazz extension
// Creates floating Aawazz button and includes form field extraction

// Form field extraction functions
function safeGetTextContent(element) {
  return element ? element.textContent.trim() : '';
}

function safeGetAttribute(element, attribute) {
  return element ? (element.getAttribute(attribute) || '').trim() : '';
}

function generateFieldId(index) {
  return 'aawazz-field-' + index;
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

  // 2. Check placeholder
  const placeholderText = safeGetAttribute(element, 'placeholder');
  if (placeholderText) {
    return placeholderText;
  }

  // 3. Check aria-label
  const ariaLabelText = safeGetAttribute(element, 'aria-label');
  if (ariaLabelText) {
    return ariaLabelText;
  }

  // 4. Fallback to "Field X"
  return 'Field ' + (index + 1);
}

function getFieldType(element) {
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'input') {
    return element.type || 'text';
  }
  
  return tagName;
}

function isFieldEmpty(element) {
  const value = element.value || '';
  return value.trim() === '';
}

function extractFields() {
  const fields = [];
  
  // Use safe querySelector to find all relevant form elements
  // Exclude Aawazz UI elements to avoid picking up our own inputs
  const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([id*="Aawazz"]):not([id*="aawazz"]), textarea:not([id*="Aawazz"]):not([id*="aawazz"]), select:not([id*="Aawazz"]):not([id*="aawazz"])';
  const formElements = document.querySelectorAll(selector);

  // Process each form element
  formElements.forEach((element, index) => {
    // Skip if field is not empty
    if (!isFieldEmpty(element)) {
      return;
    }
    
    // Skip if element is within Aawazz UI container
    const aawazzContainer = document.getElementById('Aawazz-ui');
    if (aawazzContainer && aawazzContainer.contains(element)) {
      console.log('Skipping Aawazz UI element:', element);
      return;
    }

    // Generate unique ID if missing
    if (!element.id && !element.name) {
      element.id = generateFieldId(index);
    }

    // Determine field ID
    const fieldId = element.id || element.name || generateFieldId(index);
    
    // Extract field type and label
    const fieldType = getFieldType(element);
    const fieldLabel = extractFieldLabel(element, index);

    // Create field object
    const fieldObject = {
      id: fieldId,
      type: fieldType,
      label: fieldLabel,
      element: element
    };

    // Add to fields array
    fields.push(fieldObject);
  });

  return fields;
}

// Speech synthesis function
function speak(text) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    
    utterance.onend = () => {
      resolve();
    };
    
    utterance.onerror = (event) => {
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };

    speechSynthesis.speak(utterance);
  });
}

// 🔧 FINAL CLEAN LISTEN FUNCTION (USE THIS EXACTLY)
function listen() {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    recognition = new SpeechRecognition();

    recognition.lang = selectedLanguage === 'hi-IN' ? "hi-IN" : "en-US";
    recognition.continuous = true; // Enable to capture full phrases
    recognition.interimResults = false; // Disable interim results for cleaner recognition
    recognition.maxAlternatives = 1; // Use single best result to avoid fragmentation
    
    // Set timeout for longer listening
    recognition.maxDuration = 5000; // 5 seconds to capture full input

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
        if (selectedLanguage === 'en-IN') {
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
        reject(err.error);
      }
    };

    recognition.onend = () => {
      if (!resolved) {
        reject("No speech detected");
      }
    };

    // Add timeout to stop recognition after 5 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        recognition.stop();
        reject(new Error('Speech recognition timeout'));
      }
    }, 5000);

    recognition.start();
  });
}

// Normalize transcript by removing noise and formatting
function normalizeTranscript(transcript) {
  if (!transcript) return '';
  
  return transcript
    .trim()
    .toLowerCase()
    // Remove common filler words and noise
    .replace(/\b(um|uh|ah|er|mm|like|you know|I mean|actually|basically)\b/gi, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    // Remove leading articles for cleaner responses
    .replace(/^(a|an|the)\s+/i, '')
    .trim();
}

// Check if response is unclear or too short
function isUnclearResponse(response) {
  if (!response || response.length < 2) return true;
  
  // Check for common unclear patterns
  const unclearPatterns = [
    /^(yes|no|yeah|yep|nope)$/,  // Only yes/no without context
    /^(okay|ok|alright)$/,       // Only agreement words
    /^(hmm|uh|um)$/,             // Hesitation sounds
    /^(I don't know|not sure|maybe)$/, // Uncertainty phrases
    /^\d+$/,                     // Only numbers (unless context suggests it's expected)
    /^[^\w\s]+$/                 // Only punctuation/symbols
  ];
  
  return unclearPatterns.some(pattern => pattern.test(response));
}

// Enhanced listening with specific context
function listenWithContext(context = '') {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      reject(new Error('Speech recognition not supported'));
      return;
    }

    recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 2; // Get more alternatives for better accuracy
    
    // Set context hints if available
    if (context) {
      recognition.grammars = null; // Reset grammars
      // You could add custom grammars here for specific contexts
    }
    
    recognition.onresult = (event) => {
      const results = event.results[0];
      let bestTranscript = '';
      let bestConfidence = 0;
      
      // Find the best result among alternatives
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.confidence > bestConfidence) {
          bestConfidence = result.confidence;
          bestTranscript = result.transcript;
        }
      }
      
      console.log(`Context: "${context}" - Result: "${bestTranscript}" (confidence: ${bestConfidence})`);
      
      const normalizedTranscript = normalizeTranscript(bestTranscript);
      
      // If confidence is still low, try the other language
      if (bestConfidence < 0.6) {
        console.log('Low confidence, trying alternative language...');
        // Could implement fallback logic here
      }
      
      resolve(normalizedTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Context recognition error:', event.error);
      reject(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.onend = () => {
      if (!recognition.resultList || recognition.resultList.length === 0) {
        reject(new Error('No speech detected'));
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
  const uiContainer = document.createElement('div');
  uiContainer.id = 'Aawazz-ui';
  
  // Style the container
  uiContainer.style.position = 'fixed';
  uiContainer.style.bottom = '80px';
  uiContainer.style.right = '20px';
  uiContainer.style.backgroundColor = '#1a1a1a';
  uiContainer.style.color = '#ffffff';
  uiContainer.style.padding = '16px';
  uiContainer.style.borderRadius = '12px';
  uiContainer.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
  uiContainer.style.zIndex = '10001';
  uiContainer.style.minWidth = '320px';
  uiContainer.style.maxWidth = '400px';
  uiContainer.style.fontFamily = 'Arial, sans-serif';
  uiContainer.style.fontSize = '14px';
  uiContainer.style.display = 'none';
  uiContainer.style.transition = 'opacity 0.3s ease';
  
  // Create status section
  const statusSection = document.createElement('div');
  statusSection.id = 'Aawazz-status';
  statusSection.style.marginBottom = '12px';
  statusSection.style.fontWeight = '600';
  statusSection.style.fontSize = '16px';
  statusSection.style.color = '#4CAF50';
  
  // Create question section
  const questionSection = document.createElement('div');
  questionSection.id = 'Aawazz-question';
  questionSection.style.marginBottom = '12px';
  questionSection.style.lineHeight = '1.4';
  questionSection.style.color = '#e0e0e0';
  
  // Create progress section
  const progressSection = document.createElement('div');
  progressSection.id = 'Aawazz-progress';
  progressSection.style.fontSize = '12px';
  progressSection.style.color = '#9e9e9e';
  progressSection.style.fontStyle = 'italic';
  progressSection.style.marginBottom = '12px';
  
  // Create input section (initially hidden)
  const inputSection = document.createElement('div');
  inputSection.id = 'Aawazz-input-section';
  inputSection.style.display = 'none';
  inputSection.style.marginBottom = '12px';
  
  // Create input label
  const inputLabel = document.createElement('div');
  inputLabel.textContent = 'Edit your response:';
  inputLabel.style.fontSize = '12px';
  inputLabel.style.color = '#9e9e9e';
  inputLabel.style.marginBottom = '6px';
  
  // Create input box
  const inputBox = document.createElement('input');
  inputBox.id = 'Aawazz-input';
  inputBox.type = 'text';
  inputBox.style.width = '100%';
  inputBox.style.padding = '8px';
  inputBox.style.backgroundColor = '#2a2a2a';
  inputBox.style.color = '#ffffff';
  inputBox.style.border = '1px solid #444';
  inputBox.style.borderRadius = '6px';
  inputBox.style.fontSize = '14px';
  inputBox.style.marginBottom = '8px';
  inputBox.style.boxSizing = 'border-box';
  
  // Create confirm button for input
  const confirmButton = document.createElement('button');
  confirmButton.id = 'Aawazz-confirm-button';
  confirmButton.textContent = 'Confirm';
  confirmButton.style.padding = '6px 12px';
  confirmButton.style.backgroundColor = '#4CAF50';
  confirmButton.style.color = 'white';
  confirmButton.style.border = 'none';
  confirmButton.style.borderRadius = '4px';
  confirmButton.style.fontSize = '12px';
  confirmButton.style.cursor = 'pointer';
  confirmButton.style.marginRight = '8px';
  
  // Add hover effect to confirm button
  confirmButton.addEventListener('mouseenter', () => {
    confirmButton.style.backgroundColor = '#45a049';
  });
  
  confirmButton.addEventListener('mouseleave', () => {
    confirmButton.style.backgroundColor = '#4CAF50';
  });
  
  // Create cancel button for input
  const cancelButton = document.createElement('button');
  cancelButton.id = 'Aawazz-cancel-button';
  cancelButton.textContent = 'Cancel';
  cancelButton.style.padding = '6px 12px';
  cancelButton.style.backgroundColor = '#666';
  cancelButton.style.color = 'white';
  cancelButton.style.border = 'none';
  cancelButton.style.borderRadius = '4px';
  cancelButton.style.fontSize = '12px';
  cancelButton.style.cursor = 'pointer';
  
  // Add hover effect to cancel button
  cancelButton.addEventListener('mouseenter', () => {
    cancelButton.style.backgroundColor = '#555';
  });
  
  cancelButton.addEventListener('mouseleave', () => {
    cancelButton.style.backgroundColor = '#666';
  });
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.appendChild(confirmButton);
  buttonContainer.appendChild(cancelButton);
  
  // Assemble input section
  inputSection.appendChild(inputLabel);
  inputSection.appendChild(inputBox);
  inputSection.appendChild(buttonContainer);
  
  // Create language selector
  const languageSelector = document.createElement('div');
  languageSelector.id = 'Aawazz-language-selector';
  languageSelector.style.marginBottom = '12px';
  
  // Create language label
  const languageLabel = document.createElement('div');
  languageLabel.textContent = 'Language:';
  languageLabel.style.fontSize = '12px';
  languageLabel.style.color = '#9e9e9e';
  languageLabel.style.marginBottom = '6px';
  
  // Create language buttons container
  const languageButtons = document.createElement('div');
  languageButtons.style.display = 'flex';
  languageButtons.style.gap = '8px';
  
  // English button
  const englishButton = document.createElement('button');
  englishButton.id = 'Aawazz-lang-en';
  englishButton.textContent = 'English';
  englishButton.style.padding = '4px 8px';
  englishButton.style.backgroundColor = '#4CAF50';
  englishButton.style.color = 'white';
  englishButton.style.border = 'none';
  englishButton.style.borderRadius = '4px';
  englishButton.style.fontSize = '11px';
  englishButton.style.cursor = 'pointer';
  englishButton.style.flex = '1';
  
  // Hindi button
  const hindiButton = document.createElement('button');
  hindiButton.id = 'Aawazz-lang-hi';
  hindiButton.textContent = 'Hindi';
  hindiButton.style.padding = '4px 8px';
  hindiButton.style.backgroundColor = '#666';
  hindiButton.style.color = 'white';
  hindiButton.style.border = 'none';
  hindiButton.style.borderRadius = '4px';
  hindiButton.style.fontSize = '11px';
  hindiButton.style.cursor = 'pointer';
  hindiButton.style.flex = '1';
  
  // Add click events for language buttons
  englishButton.addEventListener('click', () => {
    switchLanguage('en-IN');
    updateLanguageButtons();
    // Show feedback
    updateAawazzUI('Language Changed', 'Switched to English', '0 of 0');
  });
  
  hindiButton.addEventListener('click', () => {
    switchLanguage('hi-IN');
    updateLanguageButtons();
    // Show feedback
    updateAawazzUI('Language Changed', 'Switched to Hindi', '0 of 0');
  });
  
  // Add hover effects
  [englishButton, hindiButton].forEach(button => {
    button.addEventListener('mouseenter', () => {
      if (button.style.backgroundColor !== '#4CAF50') {
        button.style.backgroundColor = '#555';
      }
    });
    
    button.addEventListener('mouseleave', () => {
      if (button.style.backgroundColor !== '#4CAF50') {
        button.style.backgroundColor = '#666';
      }
    });
  });
  
  // Assemble language selector
  languageButtons.appendChild(englishButton);
  languageButtons.appendChild(hindiButton);
  languageSelector.appendChild(languageLabel);
  languageSelector.appendChild(languageButtons);
  
  // Create options section (for dropdowns)
  const optionsSection = document.createElement('div');
  optionsSection.id = 'Aawazz-options';
  optionsSection.style.display = 'none';
  optionsSection.style.fontSize = '12px';
  optionsSection.style.color = '#666';
  optionsSection.style.marginTop = '10px';
  
  // Create stop button
  const stopButton = document.createElement('button');
  stopButton.id = 'Aawazz-stop-button';
  stopButton.textContent = 'Stop';
  stopButton.style.width = '100%';
  stopButton.style.padding = '8px';
  stopButton.style.backgroundColor = '#f44336';
  stopButton.style.color = '#ffffff';
  stopButton.style.border = 'none';
  stopButton.style.borderRadius = '6px';
  stopButton.style.cursor = 'pointer';
  stopButton.style.fontSize = '14px';
  stopButton.style.fontWeight = 'bold';
  stopButton.style.transition = 'background-color 0.2s ease';
  
  // Add hover effect to stop button
  stopButton.addEventListener('mouseenter', () => {
    stopButton.style.backgroundColor = '#d32f2f';
  });
  
  stopButton.addEventListener('mouseleave', () => {
    stopButton.style.backgroundColor = '#f44336';
  });
  
  // Add click event to stop button
  stopButton.addEventListener('click', () => {
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
  const englishButton = document.getElementById('Aawazz-lang-en');
  const hindiButton = document.getElementById('Aawazz-lang-hi');
  
  if (englishButton && hindiButton) {
    if (selectedLanguage === 'en-IN') {
      englishButton.style.backgroundColor = '#4CAF50';
      hindiButton.style.backgroundColor = '#666';
    } else if (selectedLanguage === 'hi-IN') {
      englishButton.style.backgroundColor = '#666';
      hindiButton.style.backgroundColor = '#4CAF50';
    }
  }
}

// Update UI elements with enhanced styling and animations
function updateAawazzUI(status, question, progress, dropdownOptions = null) {
  const uiContainer = document.getElementById('Aawazz-ui');
  if (!uiContainer) return;
  
  const statusElement = document.getElementById('Aawazz-status');
  const questionElement = document.getElementById('Aawazz-question');
  const progressElement = document.getElementById('Aawazz-progress');
  const optionsElement = document.getElementById('Aawazz-options');
  
  if (statusElement) {
    statusElement.textContent = status;
    
    // Color-coded status with animations
    if (status.toLowerCase().includes('listening')) {
      statusElement.style.color = '#2196F3'; // Blue for listening
      statusElement.style.animation = 'pulse 1.5s infinite';
      statusElement.style.textShadow = '0 0 10px rgba(33, 150, 243, 0.5)';
    } else if (status.toLowerCase().includes('speaking')) {
      statusElement.style.color = '#4CAF50'; // Green for speaking
      statusElement.style.animation = 'none';
      statusElement.style.textShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
    } else if (status.toLowerCase().includes('error')) {
      statusElement.style.color = '#f44336'; // Red for errors
      statusElement.style.animation = 'shake 0.5s';
      statusElement.style.textShadow = '0 0 10px rgba(244, 67, 54, 0.5)';
    } else if (status.toLowerCase().includes('editing')) {
      statusElement.style.color = '#FF9800'; // Orange for editing
      statusElement.style.animation = 'none';
      statusElement.style.textShadow = '0 0 10px rgba(255, 152, 0, 0.5)';
    } else if (status.toLowerCase().includes('success')) {
      statusElement.style.color = '#8BC34A'; // Light green for success
      statusElement.style.animation = 'fadeIn 0.3s';
      statusElement.style.textShadow = '0 0 10px rgba(139, 195, 74, 0.5)';
    } else if (status.toLowerCase().includes('stopped')) {
      statusElement.style.color = '#9E9E9E'; // Gray for stopped
      statusElement.style.animation = 'fadeOut 0.3s';
      statusElement.style.textShadow = '0 0 10px rgba(158, 158, 158, 0.5)';
    } else {
      statusElement.style.color = '#FFC107'; // Amber for other states
      statusElement.style.animation = 'none';
      statusElement.style.textShadow = '0 0 10px rgba(255, 193, 7, 0.5)';
    }
  }
  
  if (questionElement) {
    questionElement.textContent = question;
    // Truncate long questions with ellipsis
    if (question.length > 80) {
      questionElement.style.fontSize = '12px';
      questionElement.style.lineHeight = '1.3';
    } else {
      questionElement.style.fontSize = '14px';
      questionElement.style.lineHeight = '1.4';
    }
  }
  
  // Display dropdown options if available
  if (optionsElement && dropdownOptions && dropdownOptions.length > 0) {
    optionsElement.style.display = 'block';
    optionsElement.style.marginTop = '10px';
    optionsElement.innerHTML = `
      <div style="font-size: 12px; color: #666; margin-bottom: 5px;">
        <strong>Options:</strong>
      </div>
      ${dropdownOptions.map((opt, index) => `
        <div style="background: #f5f5f5; padding: 8px; margin: 3px 0; border-radius: 4px; cursor: pointer; transition: background 0.2s;">
          <div style="font-weight: bold; color: #333;">${index + 1}. ${opt.text || opt.value}</div>
        </div>
      `).join('')}
    `;
    optionsElement.style.fontSize = '12px';
  } else if (optionsElement) {
    optionsElement.style.display = 'none';
  }
  
  if (progressElement) {
    progressElement.textContent = progress;
  }
}

// Highlight active field on the page
function highlightActiveField(field) {
  // Remove previous highlights
  document.querySelectorAll('.aawazz-field-highlight').forEach(el => {
    el.classList.remove('aawazz-field-highlight');
    el.style.outline = '';
    el.style.boxShadow = '';
  });
  
  if (field && field.element) {
    // Add highlight to current field
    field.element.classList.add('aawazz-field-highlight');
    field.element.style.outline = '2px solid #2196F3';
    field.element.style.outlineOffset = '-2px';
    field.element.style.boxShadow = '0 0 15px rgba(33, 150, 243, 0.3)';
    
    // Scroll field into view
    field.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
  }
}

// Remove field highlights
function removeFieldHighlights() {
  document.querySelectorAll('.aawazz-field-highlight').forEach(el => {
    el.classList.remove('aawazz-field-highlight');
    el.style.outline = '';
    el.style.boxShadow = '';
  });
}

// Add CSS animations to the page
function addAawazzStyles() {
  if (document.getElementById('aawazz-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'aawazz-styles';
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
  const uiContainer = document.getElementById('Aawazz-ui');
  if (uiContainer) {
    uiContainer.style.display = 'block';
    uiContainer.style.opacity = '1';
  }
}

function hideAawazzUI() {
  const uiContainer = document.getElementById('Aawazz-ui');
  if (uiContainer) {
    uiContainer.style.opacity = '0';
    setTimeout(() => {
      uiContainer.style.display = 'none';
    }, 300);
  }
}

// Show input section for editing
function showInputSection(currentText) {
  const inputSection = document.getElementById('Aawazz-input-section');
  const inputBox = document.getElementById('Aawazz-input');
  const confirmButton = document.getElementById('Aawazz-confirm-button');
  const cancelButton = document.getElementById('Aawazz-cancel-button');
  
  if (inputSection && inputBox && confirmButton && cancelButton) {
    inputBox.value = currentText;
    inputSection.style.display = 'block';
    inputBox.focus();
    inputBox.select();
  }
}

// Hide input section
function hideInputSection() {
  const inputSection = document.getElementById('Aawazz-input-section');
  if (inputSection) {
    inputSection.style.display = 'none';
  }
}

// Get edited text from input
function getEditedText() {
  const inputBox = document.getElementById('Aawazz-input');
  return inputBox ? inputBox.value.trim() : '';
}

// Check if field should show input (name fields or low confidence)
function shouldShowInput(field, response) {
  const fieldLabel = field.label.toLowerCase();
  const isNameField = fieldLabel.includes('name') || fieldLabel.includes('first') || fieldLabel.includes('last') || fieldLabel.includes('full');
  const isShortResponse = response.length < 3;
  const hasNumbers = /\d/.test(response) && !fieldLabel.includes('phone') && !fieldLabel.includes('age');
  
  return isNameField || isShortResponse || hasNumbers;
}

// Global variables
let shouldStopAawazz = false;
let selectedLanguage = 'en-IN'; // Default to Indian English
let recognition = null; // Store recognition object globally

// Language configuration
const languages = {
  'en-IN': {
    name: 'English (India)',
    code: 'en-IN',
    speechCode: 'en-IN',
    recognitionCode: 'en-IN',
    fallbackCode: 'en-US',
    greeting: 'Hello, I am Aawazz. I will help you fill forms using your voice.',
    questionPrefix: 'What is your',
    confirmPrompt: 'If this is correct say yes, otherwise say no clearly.',
    retryMessage: 'Let\'s try again.',
    successMessage: 'filled successfully.',
    skipMessage: 'Skipping',
    errorMessage: 'I didn\'t catch that. Let\'s try again.',
    noSpeechMessage: 'I didn\'t hear anything. Please try again.',
    unclearMessage: 'Please say yes or no clearly.',
    stopMessage: 'Aawazz process stopped.',
    completeMessage: 'All fields are filled.',
    noFieldsMessage: 'No empty form fields found on this page.',
    startMessage: 'Found {count} form fields to fill. Let\'s start.',
    yesVariations: ['yes', 'yeah', 'yep', 'correct', 'right', 'that\'s it', 'that\'s right', 'okay', 'ok', 'sure', 'affirmative', 'definitely', 'absolutely', 'exactly', 'precisely', 'yup', 'y', 'mhm', 'uh-huh', 'sounds good', 'good', 'great', 'perfect', 'fine', 'alright', 'all right', 'confirmed', 'agree', 'agreed', 'accepted', 'approved', 'yes please', 'yes that\'s correct'],
    noVariations: ['no', 'nope', 'wrong', 'incorrect', 'not right', 'that\'s wrong', 'that\'s not right', 'negative', 'n', 'nah', 'no way', 'absolutely not', 'definitely not', 'no thanks', 'no thank you', 'not correct', 'not exactly', 'disagree', 'disagreed', 'rejected', 'declined', 'denied', 'incorrect', 'bad', 'terrible', 'awful', 'horrible', 'not good', 'not acceptable', 'no that\'s wrong', 'try again', 'do over', 'start over', 'reset']
  },
  'hi-IN': {
    name: 'Hindi (India)',
    code: 'hi-IN',
    speechCode: 'hi-IN',
    recognitionCode: 'hi-IN',
    fallbackCode: 'en-IN',
    greeting: 'Hello, main Aawazz hoon. Main aapki awaaz se forms fill karne mein madad karunga.',
    questionPrefix: 'Aapka',
    confirmPrompt: 'Agar yeh sahi hai toh yes boliye, warna no clearly boliye.',
    retryMessage: 'Phir se koshish karte hain.',
    successMessage: 'successfully fill ho gaya.',
    skipMessage: 'Skip kar raha hun',
    errorMessage: 'Mujhe samajh nahi aaya. Phir se koshish karte hain.',
    noSpeechMessage: 'Maine kuch nahi suna. Kripya phir se koshish karein.',
    unclearMessage: 'Kripya yes ya no clearly boliye.',
    stopMessage: 'Aawazz process stop ho gaya.',
    completeMessage: 'Saare fields fill ho gaye hain.',
    noFieldsMessage: 'Is page par koi empty form fields nahi mile.',
    startMessage: '{count} form fields fill karne ke liye mile hain. Chaliye shuru karte hain.',
    yesVariations: ['yes', 'haan', 'han', 'ji haan', 'sahi', 'thik hai', 'theek hai', 'correct', 'right', 'okay', 'ok', 'sure', 'bilkul', 'ha', 'ji', 'achcha', 'good', 'great', 'perfect', 'fine', 'alright', 'confirmed', 'agree', 'agreed', 'accepted', 'approved'],
    noVariations: ['no', 'nahi', 'na', 'ji nahi', 'galat', 'wrong', 'incorrect', 'sahi nahi', 'negative', 'nahi thanks', 'disagree', 'disagreed', 'rejected', 'declined', 'denied', 'incorrect', 'bad', 'terrible', 'awful', 'horrible', 'not good', 'not acceptable', 'try again', 'phir se koshish karein']
  }
};

// Convert English field labels to natural Hindi questions
function getHindiQuestion(label, options = null) {
  const labelLower = label.toLowerCase();
  
  // Check if this is a dropdown field with options
  if (options && Array.isArray(options) && options.length > 0) {
    // Limit options to 3-5 for clarity
    const limitedOptions = options.slice(0, 5);
    const optionsText = limitedOptions.map((opt, index) => `${index + 1}. ${opt.text || opt.value || opt}`).join(', ');
    return `aapki ${label} kya hai? विकल्प हैं: ${optionsText}`;
  }
  
  // Hindi question templates based on field type
  const hindiQuestions = {
    'full name': 'aapka poora naam kya hai?',
    'name': 'aapka naam kya hai?',
    'first name': 'aapka pehla naam kya hai?',
    'last name': 'aapka antim naam kya hai?',
    'email': 'aapka email kya hai?',
    'phone number': 'aapka mobile number kya hai?',
    'phone': 'aapka mobile number kya hai?',
    'telephone': 'aapka phone number kya hai?',
    'mobile': 'aapka mobile number kya hai?',
    'address': 'aapka pata kya hai?',
    'city': 'aapka shehar kya hai?',
    'state': 'aapka rajya kya hai?',
    'country': 'aapka desh kya hai?',
    'zip code': 'aapka pin code kya hai?',
    'postal code': 'aapka pin code kya hai?',
    'company': 'aapki company kya hai?',
    'job title': 'aapka pad kya hai?',
    'message': 'aapka sandesh kya hai?',
    'comments': 'aapki tippaniyan kya hain?',
    'age': 'aapki umra kya hai?',
    'birthday': 'aapki janmdin tithi kya hai?',
    'birth date': 'aapka janmdin tithi kya hai?',
    'website': 'aapki website kya hai?',
    'url': 'aapki website URL kya hai?'
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
    const optionText = (option.text || option.value || '').toLowerCase().trim();
    if (optionText === inputLower) {
      return option;
    }
  }
  
  // Partial match (e.g., "11" → "Class 11")
  for (const option of options) {
    const optionText = (option.text || option.value || '').toLowerCase().trim();
    if (optionText.includes(inputLower) || inputLower.includes(optionText)) {
      return option;
    }
  }
  
  // Number match (e.g., "11" → "Class 11")
  const inputNumber = inputLower.replace(/[^0-9]/g, '');
  if (inputNumber) {
    for (const option of options) {
      const optionText = (option.text || option.value || '').toLowerCase().trim();
      const optionNumber = optionText.replace(/[^0-9]/g, '');
      if (optionNumber === inputNumber) {
        return option;
      }
    }
  }
  
  // Fallback: return first option if no match found
  return options[0];
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
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', '�': 'au',
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

// Check if field is a name field for enhanced processing
function isNameField(fieldLabel) {
  if (!fieldLabel) return false;
  
  const labelLower = fieldLabel.toLowerCase();
  const nameKeywords = [
    'name', 'full name', 'first name', 'last name', 'given name', 'family name',
    'surname', 'firstname', 'lastname', 'middle name', 'nickname', 'display name'
  ];
  
  return nameKeywords.some(keyword => labelLower.includes(keyword));
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
    const words = cleaned.split(' ');
    const capitalizedWords = words.map(word => {
      if (word.length > 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word;
    });
    cleaned = capitalizedWords.join(' ');
  }
  
  console.log(`Name cleaned: "${text}" -> "${cleaned}"`);
  return cleaned;
}

// Get current language configuration
function getCurrentLanguage() {
  return languages[selectedLanguage] || languages['en-IN'];
}

// Switch language function
function switchLanguage(languageCode) {
  if (languages[languageCode]) {
    selectedLanguage = languageCode;
    console.log(`Language switched to: ${languages[languageCode].name}`);
    // Store in localStorage for persistence
    localStorage.setItem('aawazz-language', languageCode);
    return true;
  }
  return false;
}

// Load saved language preference
function loadLanguagePreference() {
  const saved = localStorage.getItem('aawazz-language');
  if (saved && languages[saved]) {
    selectedLanguage = saved;
    console.log(`Loaded language preference: ${languages[selectedLanguage].name}`);
  }
}

// Speech synthesis function with language support and proper cancellation
function speak(text) {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    // Cancel any ongoing speech immediately
    speechSynthesis.cancel();

    // Normalize text for better speech
    const normalizedText = text.trim().replace(/\s+/g, ' ');
    
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
  console.log('Aawazz stop requested');
  
  // Stop any ongoing speech immediately
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    console.log('Speech synthesis cancelled');
  }
  
  // Stop any ongoing speech recognition
  if (recognition) {
    try {
      recognition.stop();
      console.log('Speech recognition stopped');
    } catch (error) {
      console.log('Speech recognition already stopped or not running');
    }
  }
  
  // Remove field highlights
  removeFieldHighlights();
  
  // Show stopped message
  const lang = getCurrentLanguage();
  const stopMessage = lang.stopMessage;
  updateAawazzUI('Stopped', stopMessage, '0 of 0');
  
  // Speak the stopped message
  speak(stopMessage).catch(error => {
    console.log('Error speaking stop message:', error);
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
  if (!document.getElementById('Aawazz-ui')) {
    createAawazzUI();
  }
  
  const lang = getCurrentLanguage();
  
  try {
    // Extract form fields
    const fields = extractFields();
    console.log('Extracted fields:', fields);
    
    if (fields.length === 0) {
      showAawazzUI();
      updateAawazzUI('Status', lang.noFieldsMessage, '0 of 0');
      await speak(lang.noFieldsMessage);
      hideAawazzUI();
      return;
    }
    
    showAawazzUI();
    
    // 1. INTRO MESSAGE: Greet user naturally
    const greetingMessage = selectedLanguage === 'hi-IN' ? 
      "नमस्ते, मैं आपकी फॉर्म भरने में मदद करूंगा।" : 
      "Hi, I will help you fill this form.";
    
    updateAawazzUI('Starting', greetingMessage, '0 of ' + fields.length);
    await speak(greetingMessage);
    
    const startMessage = lang.startMessage.replace('{count}', fields.length);
    updateAawazzUI('Ready', startMessage, '0 of ' + fields.length);
    await speak(startMessage);
    
    // Detect form language once at the beginning
    const formLanguage = detectFormLanguage();
    console.log(`Form language: ${formLanguage}, User language: ${selectedLanguage}`);
    
    // Loop through fields sequentially with clean structure
    for (let i = 0; i < fields.length; i++) {
      // Check if stop was requested
      if (shouldStopAawazz) {
        removeFieldHighlights();
        updateAawazzUI('Stopped', lang.stopMessage, `${i} of ${fields.length}`);
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
      
      console.log(`Current language: ${currentLang.code} - ${currentLang.name}`);
      console.log(`Selected language variable: ${selectedLanguage}`);
      console.log(`Field label: ${field.label}`);
      console.log(`Field options:`, field.options || 'none');
      
      if (currentLang.code === 'hi-IN') {
        // Use natural Hindi question with options if available
        console.log('Using Hindi question generation');
        question = getHindiQuestion(field.label, field.options);
      } else {
        // Use English question with options if available
        console.log('Using English question generation');
        question = generateSimpleQuestion(field.label, field.options);
      }
      
      console.log(`Generated question: "${question}"`);
      
      // Pass dropdown options to UI if available
      const dropdownOptions = field.options || null;
      updateAawazzUI('Speaking', question, `${i + 1} of ${fields.length}`, dropdownOptions);
      await speak(question);
      
      // Listen once
      let response;
      try {
        response = await listen();
        console.log(`Raw response: "${response}"`);
      } catch (listenError) {
        console.log('Listen failed:', listenError);
        updateAawazzUI('Skipped', `Skipping ${field.label}`, `${i + 1} of ${fields.length}`);
        await speak(`Skipping ${field.label}`);
        continue; // Move to next field
      }
      
      // Enhanced name preprocessing for English
      if (selectedLanguage === 'en-IN' && isNameField(field.label)) {
        response = cleanNameRecognition(response);
        console.log(`Name preprocessed: "${response}"`);
      }
      
      // Process with AI
      updateAawazzUI('Processing', 'Just a moment...', `${i + 1} of ${fields.length}`);
      let finalAnswer = await processWithAI(response, field.label);
      console.log(`AI cleaned: "${finalAnswer}"`);
      
      // 6. FILL: Handle dropdowns and Hindi to English conversion
      if (finalAnswer) {
        try {
          updateAawazzUI('Processing', 'Just a moment...', `${i + 1} of ${fields.length}`);
          
          console.log(`Original: "${finalAnswer}"`);
          
          // Check if this is a dropdown/select field
          const tagName = field.element.tagName.toLowerCase();
          let cleanedValue;
          
          if (tagName === 'select') {
            // Get dropdown options for AI processing
            const options = Array.from(field.element.options).map(opt => ({
              text: opt.text,
              value: opt.value
            }));
            
            console.log('Dropdown options:', options);
            
            // Process with dropdown context
            const fieldContext = {
              type: 'dropdown',
              label: field.label,
              options: options,
              userLanguage: selectedLanguage,
              formLanguage: formLanguage
            };
            
            // AI processing with dropdown context
            cleanedValue = await processWithAI(finalAnswer, field.label, fieldContext);
            console.log(`AI cleaned for dropdown: "${cleanedValue}"`);
            
          } else {
            // Regular field processing
            cleanedValue = await processWithAI(finalAnswer, field.label);
            console.log(`AI cleaned: "${cleanedValue}"`);
          }
          
          // FRONTEND SAFETY: Ensure English output for English forms
          if (formLanguage === 'English' && containsHindiCharacters(cleanedValue)) {
            const transliterated = basicHindiToEnglish(cleanedValue);
            console.log(`FRONTEND: AI returned Hindi, applying transliteration: "${transliterated}"`);
            cleanedValue = transliterated;
          }
          
          // ALWAYS use AI processed value for filling
          fillFormField(field.element, cleanedValue);
          console.log(`Filled: "${cleanedValue}"`);
          
          // Simple success response
          const successResponse = selectedLanguage === 'hi-IN' ? 'ठीक!' : 'Perfect!';
          updateAawazzUI('Success', successResponse, `${i + 1} of ${fields.length}`);
          await speak(successResponse);
          
        } catch (fillError) {
          console.error('Fill error:', fillError);
          
          // FALLBACK: Use original only if AI completely fails
          fillFormField(field.element, finalAnswer);
          console.log(`AI failed, using original: "${finalAnswer}"`);
        }
      }      
            
      // Remove highlight and move to next field
      removeFieldHighlights();
      
      // Small delay between fields for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Check if stop was requested before completion
    if (shouldStopAawazz) {
      console.log('Aawazz stopped by user before completion');
      removeFieldHighlights();
      updateAawazzUI('Stopped', lang.stopMessage, `${fields.length} of ${fields.length}`);
      await speak(lang.stopMessage);
      hideAawazzUI();
      return;
    }
    
    // 9. END MESSAGE: Natural completion message
    const endMessage = selectedLanguage === 'hi-IN' ? 
      'सब हो गया है! कृपया अपना फॉर्म देखें और जरूरत के अनुसार बदलाव करें।' : 
      'All done! Please review your form and make any changes you need.';
    
    updateAawazzUI('Complete', endMessage, `${fields.length} of ${fields.length}`);
    await speak(endMessage);
    hideAawazzUI();
    
    console.log('Aawazz completed successfully');
    
    // Hide UI after completion
    setTimeout(() => {
      removeFieldHighlights();
      hideAawazzUI();
    }, 3000);
    
  } catch (error) {
    console.error('Aawazz critical error:', error);
    removeFieldHighlights();
    updateAawazzUI('Error', 'An error occurred while filling the form.', '0 of 0');
    try {
      await speak('An error occurred while filling the form.');
    } catch (speakError) {
      console.error('Error speaking error message:', speakError);
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
    const optionsText = limitedOptions.map((opt, index) => `${index + 1}. ${opt.text || opt.value || opt}`).join(', ');
    return `What is your ${fieldLabel}? Options: ${optionsText}`;
  }
  
  const fieldLower = fieldLabel.toLowerCase();
  
  // Simple question templates based on field type
  const questionTemplates = {
    'name': 'What is your name?',
    'full name': 'What is your full name?',
    'first name': 'What is your first name?',
    'last name': 'What is your last name?',
    'email': 'What is your email address?',
    'phone': 'What is your phone number?',
    'telephone': 'What is your telephone number?',
    'mobile': 'What is your mobile number?',
    'address': 'What is your address?',
    'city': 'What city do you live in?',
    'state': 'What state do you live in?',
    'country': 'What country do you live in?',
    'zip': 'What is your zip code?',
    'postal': 'What is your postal code?',
    'age': 'How old are you?',
    'birthday': 'What is your date of birth?',
    'birth date': 'What is your birth date?',
    'company': 'Where do you work?',
    'job': 'What is your job title?',
    'occupation': 'What is your occupation?',
    'position': 'What is your position?',
    'department': 'What department do you work in?',
    'website': 'What is your website?',
    'url': 'What is your website URL?',
    'comment': 'What would you like to say?',
    'message': 'What message would you like to leave?',
    'notes': 'What notes would you like to add?',
    'subject': 'What is the subject?',
    'description': 'Please describe this briefly'
  };
  
  // Find matching question or use default
  let question = questionTemplates[fieldLower] || `What is your ${fieldLabel}?`;
  
  return question;
}

// Detect form language by analyzing page content
function detectFormLanguage() {
  // Check page language attribute
  const pageLang = document.documentElement.lang || document.body.getAttribute('lang') || 'en';
  
  // Check for Hindi indicators in the page
  const hindiIndicators = [
    /[\u0900-\u097F]/, // Hindi Unicode range
    /namaste|dhanyawad|shukriya/i,
    /kya|hai|hain|ho|i/,
    /mera|teri|uska|hamara/i,
    /naam|pata|number|address/i
  ];
  
  // Check text content for Hindi
  const pageText = document.body.innerText.toLowerCase();
  const hasHindiContent = hindiIndicators.some(pattern => pattern.test(pageText));
  
  // Check form labels and placeholders
  const formElements = document.querySelectorAll('label, input[placeholder], textarea[placeholder]');
  const formText = Array.from(formElements).map(el => 
    (el.textContent || el.getAttribute('placeholder') || '').toLowerCase()
  ).join(' ');
  
  const hasHindiForm = hindiIndicators.some(pattern => pattern.test(formText));
  
  // Determine form language
  if (pageLang.startsWith('hi') || hasHindiContent || hasHindiForm) {
    console.log('Form language detected: Hindi');
    return 'hi';
  } else {
    console.log('Form language detected: English');
    return 'en';
  }
}

// Detect if input contains English words
function containsEnglishWords(text) {
  if (!text) return false;
  
  // Check for common English patterns and academic subjects
  const englishPatterns = [
    // Common English words
    /\b(the|and|or|but|in|on|at|to|for|of|with|by|from|up|out|about|over|under)\b/gi,
    /\b(is|are|was|were|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|can)\b/gi,
    
    // Academic subjects (common in forms)
    /\b(mathematics|physics|chemistry|biology|computer|science|engineering|medical|business|economics|statistics|algebra|geometry|history|geography|psychology|sociology|literature|philosophy)\b/gi,
    
    // Common greetings and responses
    /\b(hello|hi|hey|good|morning|evening|night|thank|you|please|sorry|yes|no|okay|alright|sure|absolutely|definitely|probably|maybe|actually|basically)\b/gi,
    
    // Common descriptive words
    /\b(important|necessary|required|optional|available|present|absent|complete|incomplete|correct|incorrect|valid|invalid|primary|secondary|higher|lower|upper|final|initial)\b/gi,
    
    // Technical and business terms
    /\b(software|hardware|database|network|security|development|design|analysis|management|marketing|sales|finance|accounting|human|resources)\b/gi
  ];
  
  return englishPatterns.some(pattern => pattern.test(text));
}

// AI processing function with dropdown and language conversion support
async function processWithAI(input, field, fieldContext = null) {
  try {
    console.log("RAW:", input);
    
    // Detect input language to handle mixed scenarios
    const isEnglishInput = containsEnglishWords(input);
    const isHindiInput = containsHindiCharacters(input);
    
    console.log(`Input language detection - English: ${isEnglishInput}, Hindi: ${isHindiInput}`);
    
    // Prepare request body with context
    const requestBody = {
      input: input,
      field: field,
      userLanguage: selectedLanguage,
      detectedInputLanguage: isEnglishInput ? 'en' : (isHindiInput ? 'hi' : 'unknown')
    };
    
    // Add dropdown context if available
    if (fieldContext && fieldContext.type === 'dropdown') {
      requestBody.options = fieldContext.options;
      requestBody.userLanguage = fieldContext.userLanguage;
      requestBody.formLanguage = fieldContext.formLanguage;
      console.log('Processing dropdown with options:', fieldContext.options);
    }
    
    const response = await fetch('http://localhost:3000/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Backend processing error:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const finalAnswer = result.value;
    
    console.log("AI:", finalAnswer);
    return finalAnswer;
    
  } catch (error) {
    console.error('AI processing failed:', error);
    
    // Fallback to raw input if backend fails
    console.log("Falling back to raw input");
    return input;
  }
}

// Optimized form field filling with modern framework compatibility
function fillFormField(element, value) {
  const tagName = element.tagName.toLowerCase();
  
  // Focus element before filling for better compatibility
  try {
    element.focus();
  } catch (e) {
    // Ignore focus errors
  }
  
  if (tagName === 'input' || tagName === 'textarea') {
    try {
      // Use native value setter for maximum framework compatibility
      const setter = Object.getOwnPropertyDescriptor(element.__proto__, 'value').set;
      setter.call(element, value);
      
      // Dispatch comprehensive events for framework detection
      const events = [
        { type: 'input', bubbles: true, cancelable: true, composed: true },
        { type: 'change', bubbles: true, cancelable: true, composed: true },
        { type: 'blur', bubbles: true, cancelable: true, composed: true }
      ];
      
      events.forEach(eventConfig => {
        const event = new Event(eventConfig.type, eventConfig);
        element.dispatchEvent(event);
      });
      
      // Special handling for React
      if (element._reactInternalInstance || element.__reactInternalInstance) {
        const reactInstance = element._reactInternalInstance || element.__reactInternalInstance;
        if (reactInstance && reactInstance.stateNode) {
          reactInstance.stateNode.value = value;
        }
      }
      
      // Special handling for Vue
      if (element.__vue__) {
        element.__vue__.$emit('input', value);
      }
      
      // Special handling for Angular
      if (element.ngControl) {
        element.ngControl.control.setValue(value);
        element.ngControl.control.markAsDirty();
      }
      
      console.log(`Successfully filled ${tagName} with value: "${value}"`);
      
    } catch (error) {
      console.error('Error with native setter, using fallback:', error);
      // Reliable fallback method
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }
    
  } else if (tagName === 'select') {
    try {
      // Use smart option matching
      const options = Array.from(element.options).map(opt => ({
        text: opt.text,
        value: opt.value
      }));
      
      const matchedOption = matchUserInputToOption(value, options);
      
      if (matchedOption) {
        // Find the index of the matched option
        const optionElements = Array.from(element.options);
        const selectedIndex = optionElements.findIndex(opt => 
          (opt.text || opt.value) === (matchedOption.text || matchedOption.value)
        );
        
        if (selectedIndex !== -1) {
          // Use native setter for better compatibility
          const setter = Object.getOwnPropertyDescriptor(element.__proto__, 'selectedIndex').set;
          setter.call(element, selectedIndex);
          
          // Dispatch change event
          element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
          
          console.log(`Successfully selected option ${selectedIndex}: "${optionElements[selectedIndex].text}"`);
        } else {
          console.warn(`Matched option not found in element options: "${matchedOption.text}"`);
        }
      } else {
        console.warn(`No matching option found for value: "${value}". Available options:`, options.map(opt => opt.text));
        
        // Fallback: select first option if available
        if (options.length > 0) {
          const setter = Object.getOwnPropertyDescriptor(element.__proto__, 'selectedIndex').set;
          setter.call(element, 0);
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      
    } catch (error) {
      console.error('Error filling select element:', error);
      // Fallback
      if (element.options.length > 0) {
        element.selectedIndex = 0;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    
  } else if (tagName === 'div' || tagName === 'span') {
    // Handle contenteditable divs or other elements
    if (element.contentEditable === 'true') {
      element.textContent = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
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
console.log('Aawazz functions attached to window');

// Add keyboard shortcut to stop Aawazz (Escape key)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    stopAawazz();
  }
});

// Create Aawazz button
if (!document.getElementById('Aawazz-root')) {
  // Create container div
  const container = document.createElement('div');
  container.id = 'Aawazz-root';
  
  // Create floating button
  const button = document.createElement('button');
  button.textContent = 'Start Aawazz';
  
  // Style the button
  button.style.position = 'fixed';
  button.style.bottom = '20px';
  button.style.right = '20px';
  button.style.zIndex = '10000';
  button.style.padding = '12px 20px';
  button.style.backgroundColor = '#4285f4';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '24px';
  button.style.fontSize = '14px';
  button.style.fontWeight = '600';
  button.style.cursor = 'pointer';
  button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
  button.style.transition = 'transform 0.2s ease';
  
  // Add hover effect
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.05)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
  });
  
  // Set initial button text
  button.textContent = 'Start Aawazz';
  
  // Add click event listener
  button.addEventListener('click', async () => {
    console.log('Aawazz Started');
    
    try {
      await startAawazz();
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    }
  });
  
  // Append button to container and container to body
  container.appendChild(button);
  document.body.appendChild(container);
  
  console.log('Aawazz button created');
}

console.log('Content script loaded successfully');
