# ChironAI - Intelligent Website Navigation Assistant

ChironAI is a sophisticated Chrome extension that creates step-by-step guided tours of websites and software applications, reducing the learning curve and increasing productivity. It uses AI-powered analysis to understand user intent and generate interactive walkthroughs.

## Features

### Core Functionality

- **AI-Powered Navigation**: Uses OpenAI's GPT models to analyze DOM elements and generate step-by-step guides
- **Interactive Tours**: Creates guided walkthroughs using Intro.js with highlighted elements and tooltips
- **Cross-Tab Persistence**: Maintains guide state across browser tabs and page refreshes
- **Smart Element Detection**: Automatically locates UI elements using CSS selectors and XPath
- **Real-time Guidance**: Provides contextual help based on user actions

### Specialized Integrations

- **Canva Integration**: Pre-built guides for common Canva operations (text formatting, design tools, etc.)
- **Manual Guide System**: Customizable step-by-step instructions for specific workflows
- **Context-Aware Suggestions**: Intelligent prompt suggestions based on current page context

### User Experience

- **VSCode-style Interface**: Modern, dark-themed popup interface
- **Privacy-First Design**: Local storage for API keys and user preferences
- **Responsive Design**: Adapts to different screen sizes and orientations
- **Keyboard Shortcuts**: ESC key to exit tours, intuitive navigation

## Architecture

### Core Components

#### `manifest.json`

- Chrome Extension Manifest V3 configuration
- Content script injection for all URLs and Canva-specific scripts
- Permissions for storage, active tab access, and scripting
- Host permissions for OpenAI API and Canva domains

#### `background.js`

- Service worker handling extension lifecycle
- Message routing between popup and content scripts
- API key management and OpenAI integration
- Analytics tracking (configurable endpoint)
- Guide state persistence across tabs

#### `content.js`

- DOM analysis and serialization
- Intro.js tour management
- Element detection and highlighting
- Two-phase guide generation (parse → locate)

#### `popup-injector.js`

- VSCode-style popup interface
- API key configuration
- Prompt input and suggestions
- Privacy policy overlay
- History tracking

#### `ChironCanva/`

- **Canva.js**: Canva-specific content script with custom styling
- **Canva.json**: Pre-built manual guides for Canva operations
- **canva-automation.js**: Automation utilities for Canva workflows
- **Canva.automation.json**: Automation configurations

### External Dependencies

- **Intro.js**: Tour framework for guided walkthroughs
- **OpenAI API**: GPT models for intelligent analysis
- **Chrome Extension APIs**: Storage, tabs, scripting, and messaging

## Security & Privacy

### Security Measures

**No Hardcoded Secrets**: API keys are stored securely in Chrome's local storage  
**Content Security Policy**: Strict CSP prevents script injection attacks  
**No Inline Scripts**: All JavaScript is loaded from extension files  
**HTTPS Only**: All external requests use secure connections  
**Input Sanitization**: User inputs are properly escaped and validated  
**No eval() Usage**: No dynamic code execution in the codebase

### Privacy Features

**Local Storage**: API keys and preferences stored locally  
**Minimal Analytics**: Optional, configurable analytics endpoint  
**No Personal Data Collection**: Only anonymous usage events  
**User Control**: Full control over data and API key management

### Data Handling

- **API Keys**: Stored locally in Chrome storage, never transmitted to third parties
- **DOM Analysis**: Processed locally and sent to OpenAI for guide generation
- **User Preferences**: Stored locally, not synced across devices
- **Analytics**: Optional, sends only anonymous usage events to configurable endpoint

## Installation & Setup

### Prerequisites

- Google Chrome browser
- OpenAI API key (for AI-powered features)

### Installation Steps

1. **Clone the Repository**

   ```bash
   git clone <repository-url>
   cd Chiron--AI
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Load Extension in Chrome**

   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory

4. **Configure API Key**
   - Click the ChironAI extension icon
   - Go to Settings tab
   - Enter your OpenAI API key
   - Click "Save API Key"

### Configuration

#### API Key Setup

1. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/)
2. Open ChironAI popup and navigate to Settings
3. Paste your API key and save

#### Analytics (Optional)

- Default analytics endpoint: `https://webhook.site/f19b3b33-cffa-4dba-bdba-94922f9c1c4f`
- Can be configured in `background.js` line 5
- Sends anonymous usage events only

## Usage

### Basic Usage

1. Navigate to any website
2. Click the ChironAI extension icon
3. Enter your goal or task description
4. Click "Go" to start the guided tour
5. Follow the highlighted elements and instructions

### Canva-Specific Features

1. Navigate to [canva.com](https://canva.com)
2. Open ChironAI popup
3. Use pre-built guides for common tasks:
   - Text formatting (bold, italic, headings)
   - Design tools (colors, fonts, spacing)
   - Layout adjustments (alignment, indentation)
   - And many more...

### Advanced Features

- **Cross-Tab Navigation**: Guides persist when opening new tabs
- **Manual Guides**: Custom step-by-step instructions
- **Context Suggestions**: AI-powered prompt suggestions
- **Tour Controls**: ESC to exit, keyboard navigation

## Development

### Project Structure

```
Chiron--AI/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── content.js            # Main content script
├── popup-injector.js     # Popup interface
├── style.css             # Styling
├── ChironCanva/          # Canva-specific features
│   ├── Canva.js
│   ├── Canva.json
│   ├── canva-automation.js
│   └── Canva.automation.json
├── libs/                 # External libraries
│   ├── intro.min.js
│   └── introjs.min.css
└── package.json          # Dependencies
```

### Development Commands

```bash
# Install dependencies
npm install

# Run tests (when implemented)
npm test

# Build for production (when implemented)
npm run build
```

### Key Development Files

- **`manifest.json`**: Extension permissions and configuration
- **`background.js`**: Core logic and API integration
- **`content.js`**: DOM manipulation and tour management
- **`popup-injector.js`**: User interface and interactions

## Contributing

### Development Guidelines

1. Follow existing code style and patterns
2. Test changes across different websites
3. Ensure security best practices are maintained
4. Update documentation for new features

### Security Considerations

- Never commit API keys or sensitive data
- Validate all user inputs
- Use Chrome's security APIs appropriately
- Follow Content Security Policy guidelines

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, feature requests, or questions:

1. Check existing documentation
2. Review the codebase for similar implementations
3. Create an issue with detailed description
4. Include browser version and error messages

## Version History

- **v1.0**: Initial release with core navigation features
- AI-powered guide generation
- Canva integration
- Cross-tab persistence
- Privacy-focused design

---

**Note**: This extension requires an OpenAI API key for full functionality. API usage is subject to OpenAI's terms of service and pricing.
