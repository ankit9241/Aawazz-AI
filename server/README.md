# Aawazz Form Processor Server

A simple Node.js Express server that processes form field inputs using Google's Gemini AI API.

## Features

- 🤖 **AI-Powered Processing**: Uses Gemini API for intelligent field processing
- 🔒 **Secure**: Environment variable configuration for API keys
- 🚀 **Fast**: Lightweight Express server
- 🛡️ **Error Handling**: Comprehensive error handling and validation
- 📊 **Health Check**: Built-in health monitoring endpoint
- 🔧 **Field-Specific Processing**: Smart processing based on field types

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3000
NODE_ENV=development
```

### 3. Start the Server

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "Aawazz Form Processor"
}
```

### Process Form Field
```
POST /process
```

Request Body:
```json
{
  "field": "name",
  "input": "john doe"
}
```

Response:
```json
{
  "value": "John Doe",
  "field": "name",
  "originalInput": "john doe",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Supported Field Types

The server intelligently processes different field types:

- **Name**: Capitalizes first letters, removes extra spaces
- **Email**: Validates and extracts email format
- **Phone**: Formats phone numbers, removes non-numeric chars
- **Address**: Cleans and structures address data
- **City/State/Country**: Extracts location names
- **Zip/Postal**: Extracts postal codes
- **Date**: Formats dates as YYYY-MM-DD
- **Age**: Extracts numeric age
- **Custom**: Intelligent extraction for any field type

## Example Usage

### Using curl

```bash
# Process a name
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{"field": "name", "input": "jane smith"}'

# Process an email
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{"field": "email", "input": "contact me at jane.smith@example.com"}'

# Process a phone number
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{"field": "phone", "input": "call me at (555) 123-4567"}'
```

### Using JavaScript

```javascript
const response = await fetch('http://localhost:3000/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    field: 'name',
    input: 'john doe'
  })
});

const result = await response.json();
console.log(result.value); // "John Doe"
```

## Error Handling

The server provides comprehensive error handling:

### 400 Bad Request
```json
{
  "error": "Both field and input are required",
  "received": { "field": false, "input": true }
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid Gemini API key",
  "message": "Please check your GEMINI_API_KEY in .env file"
}
```

### 429 Too Many Requests
```json
{
  "error": "API quota exceeded",
  "message": "Gemini API quota limit reached"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Failed to process the request"
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Your Gemini API key |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment mode |

## Development

### Project Structure
```
server/
├── package.json          # Dependencies and scripts
├── server.js             # Main server file
├── .env.example          # Environment template
├── .env                  # Environment variables (gitignored)
└── README.md             # This file
```

### Dependencies
- **express**: Web framework
- **dotenv**: Environment variable loading
- **@google/generative-ai**: Gemini AI API client
- **cors**: Cross-origin resource sharing
- **nodemon**: Development auto-restart (dev only)

## Getting Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key and add it to your `.env` file

## License

MIT License - see LICENSE file for details.
