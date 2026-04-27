# 🚀 Deployment Guide

## Quick Start

### 1. Deploy Backend (Required)

```bash
# Deploy to any Node.js hosting (Vercel, Railway, etc.)
cd server
npm install

# Set environment variables
GEMINI_API_KEY=your_gemini_api_key
PORT=3000

# Start server
npm start
```

**Backend URL:** `https://your-backend-url.com`

### 2. Deploy SDK (For Websites)

```bash
# Host sdk.js on any CDN or web server
# Upload: /sdk/sdk.js
# Upload: /sdk/demo.html (optional demo)

# Update API_URL in sdk.js if needed:
# https://your-backend-url.com/process
```

### 3. Use SDK in Websites

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Website</title>
</head>
<body>
    <form>
        <input name="name" placeholder="Name">
        <input name="email" placeholder="Email">
        <button type="button" onclick="startVoiceForm()">Start Voice Form</button>
    </form>

    <!-- Load Aawazz SDK -->
    <script src="https://your-cdn.com/sdk.js"></script>
    
    <script>
        async function startVoiceForm() {
            try {
                await window.Aawazz.start();
            } catch (error) {
                console.error('Voice form error:', error);
            }
        }
    </script>
</body>
</html>
```

### 4. Chrome Extension (Development Only)

```bash
# For testing only - not for production
# Load in Chrome: chrome://extensions/ > Load unpacked > select /extension folder
```

## Production Checklist

- [ ] Backend deployed and accessible
- [ ] SDK hosted on CDN
- [ ] API_URL updated in sdk.js
- [ ] Test with demo.html
- [ ] Test on target websites
- [ ] GEMINI_API_KEY configured
- [ ] HTTPS enabled (required for microphone)

## Environment Variables

**Backend (.env):**
```
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

## API Endpoints

**POST** `/process` - Processes voice input with AI

## SDK Integration

**CDN URL:** `https://your-cdn.com/sdk.js`

**Global API:** `window.Aawazz`

**Main Methods:**
- `window.Aawazz.start()` - Start voice form filling
- `window.Aawazz.stop()` - Stop current session

## Support

- SDK: Pure JavaScript, works in any browser
- Backend: Node.js + Express + Gemini API
- Extension: Chrome only (development)

---

**Ready for production! 🎉**
