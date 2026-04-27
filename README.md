# Aawazz - Voice-Powered Form Filling

A production-ready voice form filling system with separate SDK, backend, and Chrome extension components.

## 📁 Project Structure

```
Aawazz-AI/
├── sdk/                 # Deployable browser SDK
│   ├── sdk.js          # Main SDK file (70KB)
│   └── demo.html       # SDK demo page
├── server/             # Backend API server
│   ├── server.js       # Express server with Gemini API
│   ├── package.json    # Node.js dependencies
│   └── .env           # Environment variables
└── extension/          # Chrome extension (development only)
    ├── manifest.json   # Extension manifest
    ├── content.js      # Content script (125KB)
    ├── background.js   # Background service worker
    ├── form.js         # Form utilities
    ├── combined.js     # Combined logic
    └── demo-hindi-only.html # Extension demo
```

## 🚀 Deployment Guide

### 1. Backend Server (Required)

Deploy the backend first:

```bash
cd server
npm install
npm start
```

**Environment Variables:**
```
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

**Endpoint:** `https://your-backend-url.com/process`

### 2. SDK (For Production Websites)

Include the SDK in any website:

```html
<script src="https://yourdomain.com/sdk.js"></script>
<script>
  // Start voice form filling
  await window.Aawazz.start();
</script>
```

**Features:**
- ✅ Pure JavaScript (no dependencies)
- ✅ Works in any browser
- ✅ Radio button & checkbox support
- ✅ Hindi/English voice recognition
- ✅ Form field detection
- ✅ AI-powered processing

### 3. Chrome Extension (Development Only)

Load the extension in Chrome for testing:

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

## 📋 API Reference

### SDK Methods

```javascript
// Main methods
await window.Aawazz.start();     // Start voice form filling
window.Aawazz.stop();            // Stop current session

// Utilities
window.Aawazz.setLanguage('hi-IN');  // Set language
window.Aawazz.getLanguage();         // Get current language
window.Aawazz.detectFields();         // Detect form fields

// Advanced modules
window.Aawazz.FieldDetector;    // Field detection
window.Aawazz.VoiceSystem;      // Voice synthesis/recognition
window.Aawazz.AIProcessor;      // AI processing
window.Aawazz.FormFiller;       // Form filling
window.Aawazz.LanguageDetector; // Language detection
window.Aawazz.FieldHighlighter; // Visual highlighting
```

### Backend API

**POST** `/process`

```json
{
  "input": "user speech input",
  "field": "field label",
  "context": {
    "type": "dropdown",
    "options": ["option1", "option2"]
  }
}
```

**Response:**
```json
{
  "processed": "ai-processed-response"
}
```

## 🎯 Features

### Field Types Supported
- ✅ Text inputs
- ✅ Radio buttons (groups)
- ✅ Checkboxes (groups)
- ✅ Dropdowns
- ✅ Textareas
- ✅ Email fields
- ✅ Phone fields
- ✅ Password fields
- ✅ Username fields
- ✅ Date fields

### Languages
- ✅ Hindi (hi-IN)
- ✅ English (en-IN)

### Smart Processing
- ✅ Hindi to English transliteration
- ✅ Email symbol conversion (@, .)
- ✅ Username cleaning (spaces, lowercase)
- ✅ Password normalization
- ✅ Acceptance field detection
- ✅ Natural question generation

## 🔧 Development

### Local Development

1. **Start Backend:**
```bash
cd server
npm start
```

2. **Test SDK:**
```bash
# Open sdk/demo.html in browser
# Update API_URL in sdk.js to localhost:3000
```

3. **Test Extension:**
```bash
# Load extension in Chrome
# Test on any webpage with forms
```

### Code Quality

- ✅ No Chrome APIs in SDK
- ✅ Pure browser JavaScript
- ✅ Modular architecture
- ✅ Error handling
- ✅ Debug logging
- ✅ Production ready

## 📝 Notes

- **SDK** is for production deployment
- **Extension** is for development/testing only
- **Backend** must be deployed first
- All components work independently
- No cross-dependencies between components

## 🚀 Production Deployment

1. Deploy backend server (Node.js + Express)
2. Host sdk.js on CDN/web server
3. Update API_URL in sdk.js to deployed backend
4. Include SDK script in target websites
5. Extension is optional (for development only)

---

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**License:** MIT
