# Axievale

AI-powered Axie Infinity marketplace valuation tool. Browse the Axie marketplace and get instant AI-generated valuations based on trades and current marketplace conditions.

## Features

- 🔗 **Marketplace Integration** - Direct links to Axie Infinity marketplace
- 🤖 **AI Valuations** - Get intelligent price estimates based on:
  - Current marketplace listings
  - Recent trade history
  - Axie traits and purity
  - Part rarity and meta relevance
- 📊 **Market Analysis** - Compare prices with similar Axies
- 🎯 **Quality Scoring** - Understand Axie value drivers

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google AI Studio API key (optional, for enhanced AI insights)

### Installation

```bash
# Clone the repository
git clone https://github.com/toxzak-svg/Axievale.git
cd Axievale

# Install dependencies
npm install

# Copy environment example
cp .env.example .env

# Edit .env with your API keys (optional)
# GOOGLE_AI_API_KEY=your_key_here

# Start the server
npm start
```

### Development

```bash
# Run with hot-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Usage

1. **Browse Marketplace** - Click "Browse Marketplace" to see current listings
2. **Search by ID** - Enter an Axie ID to get detailed valuation
3. **Filter Results** - Use class and sort filters to find specific Axies
4. **Get Valuations** - Click "Get AI Valuation" on any Axie card

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/marketplace` | GET | Get marketplace listings |
| `/api/marketplace/recent-sales` | GET | Get recently sold Axies |
| `/api/axie/:id` | GET | Get Axie details |
| `/api/axie/:id/valuation` | GET | Get AI valuation for an Axie |
| `/api/valuation/batch` | POST | Batch valuation for multiple Axies |

### Query Parameters

**GET /api/marketplace**
- `limit` - Number of results (default: 20)
- `offset` - Pagination offset (default: 0)
- `classes` - Comma-separated class filter (e.g., "Beast,Aquatic")
- `sortBy` - Sort order: `PriceAsc`, `PriceDesc`, `Latest`

## Valuation Methodology

The valuation algorithm considers:

1. **Purity** - Percentage of parts matching the Axie's class
2. **Part Value** - Meta-relevant parts increase value
3. **Breed Count** - Lower breed count = higher value potential
4. **Market Comparison** - Comparison with similar listings
5. **AI Enhancement** - Google AI-powered insights (when configured)

### Confidence Score

The confidence score (0-100%) indicates reliability:
- **70%+** High confidence - Many comparable sales
- **40-70%** Medium confidence - Limited market data
- **<40%** Low confidence - Rare traits, limited comparables

## Project Structure

```
axievale/
├── public/
│   └── index.html        # Frontend UI
├── src/
│   ├── api/
│   │   └── routes.js     # API endpoints
│   ├── config/
│   │   └── index.js      # Configuration
│   ├── services/
│   │   ├── axieService.js      # Axie Infinity API integration
│   │   └── valuationService.js # AI valuation logic
│   └── server.js         # Express server
├── tests/
│   ├── api.test.js       # API tests
│   └── valuationService.test.js # Valuation tests
└── package.json
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment mode | No |
| `GOOGLE_AI_API_KEY` | Google AI Studio API key for AI insights | No |
| `AXIE_GRAPHQL_ENDPOINT` | Axie API endpoint | No |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is not affiliated with Sky Mavis or Axie Infinity. Valuations are estimates only and should not be considered financial advice.