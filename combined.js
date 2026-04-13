// Combined content script for Aawazz extension
// Creates floating Aawazz button and includes form field extraction

// Debug: Log when script loads
console.log('Combined content script loading...');

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
  console.log('extractFields function called!');
  const fields = [];
  
  // Use safe querySelector to find all relevant form elements
  const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select';
  const formElements = document.querySelectorAll(selector);

  console.log('Found form elements:', formElements.length);

  // Process each form element
  formElements.forEach((element, index) => {
    // Skip if field is not empty
    if (!isFieldEmpty(element)) {
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

  console.log('Returning fields:', fields);
  return fields;
}

// Attach to window for debugging
window.extractFields = extractFields;
console.log('extractFields function attached to window');

// Create Aawazz button
if (!document.getElementById('Aawazz-root')) {
  // Create container div
  const container = document.createElement('div');
  container.id = 'Aawazz-root';
  
  // Create floating button
  const button = document.createElement('button');
  button.textContent = 'Available Fields: 0';
  
  // Style the button using JavaScript
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
  
  // Update button with field count
  function updateFieldCount() {
    try {
      const fields = window.extractFields();
      button.textContent = `Available Fields: ${fields.length}`;
      console.log('Field count updated:', fields.length);
    } catch (error) {
      button.textContent = 'Fields: Error';
      console.error('Error updating field count:', error);
    }
  }
  
  // Initial field count update
  setTimeout(updateFieldCount, 100);
  
  // Add click event listener
  button.addEventListener('click', () => {
    console.log('Aawazz Started');
    
    try {
      const fields = window.extractFields();
      console.log('Extracted fields:', fields);
      console.log('Total fields detected:', fields.length);
      alert(`Found ${fields.length} form fields to fill!`);
    } catch (error) {
      console.error('Error extracting fields:', error);
      alert('Error extracting form fields: ' + error.message);
    }
  });
  
  // Append button to container and container to body
  container.appendChild(button);
  document.body.appendChild(container);
  
  console.log('Aawazz button created');
  
  // Update field count periodically
  setInterval(updateFieldCount, 2000);
}

console.log('Combined content script loaded successfully');
