# Aawazz SDK

A reusable browser SDK for voice-powered form filling that works on any website without requiring a browser extension.

## 🚀 Quick Start

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Website</title>
</head>
<body>
    <form>
        <input type="text" name="fullName" placeholder="Full Name">
        <input type="email" name="email" placeholder="Email">
        <input type="tel" name="phone" placeholder="Phone">
        <button type="button" onclick="Aawazz.start()">
            Fill Form with Voice
        </button>
    </form>

    <!-- Load the SDK -->
    <script src="https://yourdomain.com/sdk.js"></script>
</body>
</html>
```

### Advanced Usage

```javascript
// Start voice form filling
Aawazz.start();

// Stop the process
Aawazz.stop();

// Set language (Hindi or English)
Aawazz.setLanguage('hi-IN'); // Hindi
Aawazz.setLanguage('en-IN'); // English

// Get current language
console.log(Aawazz.getLanguage());

// Detect available form fields
const fields = Aawazz.detectFields();
console.log('Found fields:', fields);
```

## 📋 Features

### ✅ Core Functionality
- **Voice Recognition**: Speech-to-text for form input
- **Voice Synthesis**: Text-to-speech for questions and feedback
- **Field Detection**: Automatic detection of all form fields
- **Smart Filling**: Intelligent form field population
- **Multi-language**: English and Hindi support
- **Cross-browser**: Works on all modern browsers

### 🔧 Field Type Support
- **Text Fields**: Standard input fields
- **Email Fields**: With automatic validation and formatting
- **Password Fields**: Secure handling with space removal
- **Phone Fields**: Number formatting
- **Date Fields**: Multiple date format support
- **Select Dropdowns**: Smart option matching
- **Radio Groups**: Single selection handling
- **Checkbox Groups**: Multiple selection support
- **Textareas**: Multi-line text input

### 🌍 Language Support
- **English (en-IN)**: Full English language support
- **Hindi (hi-IN)**: Complete Hindi language support
- **Auto-detection**: Automatic form language detection
- **Mixed Input**: Handles Hinglish (Hindi + English) input

### 🎯 Smart Features
- **AI Processing**: Backend AI for intelligent input cleaning
- **Hindi Transliteration**: Automatic Hindi to English conversion
- **Email Formatting**: Smart email address processing
- **Date Parsing**: Multiple date format recognition
- **Framework Support**: React, Vue, Angular compatibility
- **Error Handling**: Robust error recovery and fallbacks

## 🔧 API Reference

### Main Methods

#### `Aawazz.start()`
Starts the voice form filling process.

```javascript
Aawazz.start().then(() => {
    console.log('Form filling completed');
}).catch(error => {
    console.error('Error:', error);
});
```

#### `Aawazz.stop()`
Stops the current voice form filling process.

```javascript
Aawazz.stop();
```

#### `Aawazz.setLanguage(languageCode)`
Sets the user interface language.

**Parameters:**
- `languageCode` (string): `'en-IN'` for English, `'hi-IN'` for Hindi

```javascript
Aawazz.setLanguage('hi-IN'); // Switch to Hindi
```

#### `Aawazz.getLanguage()`
Returns the current language code.

```javascript
const currentLang = Aawazz.getLanguage(); // 'en-IN' or 'hi-IN'
```

#### `Aawazz.detectFields()`
Returns an array of detected form fields.

```javascript
const fields = Aawazz.detectFields();
console.log(fields);
// Output:
// [
//   {
//     id: "fullName",
//     type: "text",
//     label: "Full Name",
//     element: <input>
//   },
//   ...
// ]
```

### Advanced Modules

For advanced usage, you can access internal modules:

```javascript
// Field detection utilities
const fieldDetector = Aawazz.FieldDetector;
const fields = fieldDetector.extractFields();

// Voice system utilities
const voiceSystem = Aawazz.VoiceSystem;
await voiceSystem.speak("Hello world");
const result = await voiceSystem.listen();

// Form filling utilities
const formFiller = Aawazz.FormFiller;
formFiller.fillFormField(inputElement, "John Doe");

// AI processing utilities
const aiProcessor = Aawazz.AIProcessor;
const cleaned = await aiProcessor.process("raw input", "field name");

// Language detection utilities
const langDetector = Aawazz.LanguageDetector;
const formLang = langDetector.detectFormLanguage();
```

## 🔧 Backend Integration

The SDK expects a backend API endpoint at `https://your-backend-url.com/process` for AI processing.

### Request Format

```json
{
  "input": "user's spoken input",
  "field": "field label/name",
  "userLanguage": "en-IN",
  "options": [
    { "text": "Option 1", "value": "opt1" },
    { "text": "Option 2", "value": "opt2" }
  ]
}
```

### Response Format

```json
{
  "value": "processed and cleaned input"
}
```

### Example Backend (Node.js)

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/process', async (req, res) => {
  const { input, field, userLanguage, options } = req.body;
  
  // Your AI processing logic here
  const processedInput = await yourAIProcessor(input, field, userLanguage, options);
  
  res.json({ value: processedInput });
});

app.listen(3000, () => {
  console.log('AI processing server running on port 3000');
});
```

## 🎨 Customization

### Styling the Experience

The SDK runs without UI by default, but you can create your own interface:

```javascript
// Custom start button
document.getElementById('myButton').addEventListener('click', () => {
  Aawazz.start();
});

// Custom status updates
const originalStart = Aawazz.start;
Aawazz.start = async function() {
  // Show your custom UI
  document.getElementById('myStatus').textContent = 'Starting...';
  
  try {
    await originalStart.call(this);
    document.getElementById('myStatus').textContent = 'Completed!';
  } catch (error) {
    document.getElementById('myStatus').textContent = 'Error: ' + error.message;
  }
};
```

### Custom Backend URL

To use a different backend endpoint, modify the AIProcessor module:

```javascript
// In sdk.js, find the AIProcessor.process method
// Change this line:
const response = await fetch("https://your-backend-url.com/process", {
// To your custom URL:
const response = await fetch("https://api.yourservice.com/clean", {
```

## 🔒 Security Considerations

- **No API Keys**: The SDK doesn't include any API keys in the frontend
- **HTTPS Only**: Always serve the SDK over HTTPS
- **CORS Headers**: Ensure your backend has proper CORS headers
- **Input Validation**: Backend should validate and sanitize all inputs
- **Rate Limiting**: Implement rate limiting on your backend API

## 🌐 Browser Compatibility

### Supported Browsers
- ✅ Chrome 25+
- ✅ Firefox 44+
- ✅ Safari 14.1+
- ✅ Edge 79+
- ✅ Opera 15+

### Required Features
- **SpeechRecognition**: Web Speech API
- **SpeechSynthesis**: Text-to-speech API
- **ES6 Support**: Modern JavaScript features
- **Fetch API**: For backend communication

### Mobile Support
- ✅ Chrome Mobile (Android 6+)
- ✅ Safari Mobile (iOS 14.1+)
- ✅ Samsung Internet
- ✅ Firefox Mobile

## 📱 Mobile Optimization

The SDK is optimized for mobile devices:

- **Touch-friendly**: Works with touch interfaces
- **Responsive**: Adapts to screen sizes
- **Battery Efficient**: Minimal resource usage
- **Permission Handling**: Proper microphone permission requests

## 🚀 Deployment

### 1. Host the SDK

Upload `sdk.js` to your web server or CDN:

```bash
# Upload to your server
scp sdk.js user@yourserver.com:/var/www/html/

# Or use a CDN
# Upload to AWS S3, CloudFront, Fastly, etc.
```

### 2. Update Backend URL

Edit the backend URL in `sdk.js`:

```javascript
// Find this line in AIProcessor.process method:
const response = await fetch("https://your-backend-url.com/process", {

// Replace with your actual backend URL
const response = await fetch("https://api.yourdomain.com/process", {
```

### 3. Include in Websites

Add the SDK to any website:

```html
<!-- Production -->
<script src="https://yourcdn.com/sdk.js"></script>

<!-- Development -->
<script src="https://yourdomain.com/sdk.js"></script>
```

## 🐛 Troubleshooting

### Common Issues

#### Microphone Not Working
```javascript
// Check microphone permissions
navigator.permissions.query({ name: 'microphone' }).then(result => {
  console.log('Microphone permission:', result.state);
});
```

#### Speech Recognition Fails
- Ensure HTTPS is used
- Check microphone permissions
- Try a different browser
- Check network connectivity

#### Form Fields Not Detected
- Verify field has proper labels
- Check for hidden fields
- Ensure fields are not inside iframes
- Look for dynamic form generation

#### Backend Connection Issues
- Check CORS headers
- Verify backend URL
- Monitor network requests in DevTools
- Check API key configuration

### Debug Mode

Enable detailed logging:

```javascript
// Enable debug logging
window.AawazzSDK_DEBUG = true;

// Or check console for detailed logs
Aawazz.detectFields(); // Will show field detection details
```

## 📄 License

This SDK is provided as-is for integration into your applications. Please ensure you have proper licensing for any third-party dependencies used in your backend AI processing.

## 🤝 Support

For issues and questions:

1. Check the troubleshooting section above
2. Verify your backend API is working
3. Test with the provided demo.html
4. Check browser console for errors
5. Ensure proper HTTPS setup

## 🔄 Version History

### v1.0.0
- Initial release
- Core voice form filling functionality
- English and Hindi language support
- All major field types supported
- Cross-browser compatibility
- Mobile optimization
