/**
 * Form field extraction utility
 * Extracts form fields and their labels using safe DOM methods only
 */

/**
 * Safely extracts text content from an element
 * @param {Element} element - DOM element to extract text from
 * @returns {string} Trimmed text content
 */
function safeGetTextContent(element) {
  return element ? element.textContent.trim() : "";
}

/**
 * Safely gets attribute value from an element
 * @param {Element} element - DOM element to get attribute from
 * @param {string} attribute - Attribute name to get
 * @returns {string} Trimmed attribute value or empty string
 */
function safeGetAttribute(element, attribute) {
  return element ? (element.getAttribute(attribute) || "").trim() : "";
}

function getTextFromPreviousSibling(element) {
  const previousSibling = element ? element.previousElementSibling : null;
  return safeGetTextContent(previousSibling);
}

/**
 * Generates a unique field ID
 * @param {number} index - Field index
 * @returns {string} Unique field ID
 */
function generateFieldId(index) {
  return "aawazz-field-" + index;
}

/**
 * Extracts label for a form element using priority order
 * @param {Element} element - Form element to find label for
 * @param {number} index - Field index for fallback label
 * @returns {string} Extracted label text
 */
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
 * Determines field type for input elements
 * @param {Element} element - Form element
 * @returns {string} Field type
 */
function getFieldType(element) {
  const tagName = element.tagName.toLowerCase();

  if (tagName === "input") {
    return element.type || "text";
  }

  return tagName;
}

/**
 * Checks if a field is empty
 * @param {Element} element - Form element to check
 * @returns {boolean} True if field is empty
 */
function isFieldEmpty(element) {
  const value = element.value || "";
  return value.trim() === "";
}

/**
 * Extracts form fields from the current page
 * Uses only safe DOM methods, no innerHTML
 * @returns {Array<Object>} Array of field objects with id, type, label, and element
 */
function extractFields() {
  console.log("extractFields function called!");
  const fields = [];

  // Use safe querySelector to find all relevant form elements
  const selector =
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select';
  const formElements = document.querySelectorAll(selector);

  console.log("Found form elements:", formElements.length);

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
      element: element,
    };

    // Add to fields array
    fields.push(fieldObject);
  });

  console.log("Returning fields:", fields);
  return fields;
}

// Attach to window for Chrome extension compatibility
if (typeof window !== "undefined") {
  window.extractFields = extractFields;
  console.log("extractFields function attached to window");
  console.log("window.extractFields type:", typeof window.extractFields);
} else {
  console.log("window object not available");
}

console.log("form.js finished loading");
