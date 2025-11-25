# HubSpot Deal Path Deviation App

Installable HubSpot App that monitors and analyzes your B2B deal pipelines, detects deviations from historical win-patterns, flags stalled or risky deals, and surfaces actionable insights directly on deal records. Enables sales and RevOps teams to identify deals that are off-track early and guide corrective action to improve win rate and velocity.

## Features

- **OAuth 2.0 Integration**: Secure authentication with HubSpot portals
- **Pipeline Deviation Detection**:
  - **Stalled Deals**: Identifies deals that have been inactive beyond threshold
  - **Skipped Stages**: Detects when deals jump over stages in the pipeline
  - **Abnormal Time-in-Stage**: Flags deals taking significantly longer than average
  - **Backward Movement**: Alerts when deals regress to earlier stages
- **CRM Card Extension**: Displays deviation alerts, risk levels, and recommendations directly on deal records
- **HubSpot Property Updates**: Automatically updates deal properties with risk scores
- **Timeline Events**: Creates timeline events for significant deviations
- **REST API**: Comprehensive API endpoints for deal analysis and pipeline metrics

## Prerequisites

- Node.js 18.0.0 or higher
- HubSpot Developer Account
- HubSpot App with OAuth credentials

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/inevitablesale/hubspot-deal-path-deviation-app.git
   cd hubspot-deal-path-deviation-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment example file:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env`:
   ```
   HUBSPOT_CLIENT_ID=your_client_id
   HUBSPOT_CLIENT_SECRET=your_client_secret
   HUBSPOT_REDIRECT_URI=http://localhost:3000/oauth/callback
   SESSION_SECRET=your_session_secret
   ```

5. Build the application:
   ```bash
   npm run build
   ```

6. Start the server:
   ```bash
   npm start
   ```

## Development

Run the development server with hot reload:
```bash
npm run dev
```

## API Endpoints

### OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/oauth/install` | Initiates OAuth flow with HubSpot |
| GET | `/oauth/callback` | OAuth callback handler |
| GET | `/oauth/status/:portalId` | Check authentication status |

### Deals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deals` | List deals with pagination |
| GET | `/api/deals/:dealId` | Get deal details |
| GET | `/api/deals/:dealId/analysis` | Get deviation analysis for a deal |
| POST | `/api/deals/:dealId/refresh-analysis` | Refresh analysis and update properties |

### Pipelines

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pipelines` | List all pipelines |
| GET | `/api/pipelines/:pipelineId/metrics` | Get pipeline metrics and stage statistics |

### CRM Card

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/crm-card/deal-deviation` | CRM card data endpoint for HubSpot |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Application health status |

## HubSpot App Configuration

### Required Scopes

- `crm.objects.deals.read`
- `crm.objects.deals.write`
- `crm.schemas.deals.read`
- `timeline`

### CRM Card Setup

1. In your HubSpot app settings, create a new CRM card
2. Set the data fetch URL to: `https://your-domain.com/crm-card/deal-deviation`
3. Configure the card for the "Deal" object type

### Custom Properties (Optional)

Create these deal properties for automatic risk score tracking:

- `deal_risk_level` (Dropdown: LOW, MEDIUM, HIGH, CRITICAL)
- `deal_risk_score` (Number)
- `deal_deviation_count` (Number)
- `deal_last_analyzed` (DateTime)

## Risk Scoring

### Deviation Types

| Type | Description | Default Weight |
|------|-------------|----------------|
| Stalled Deal | Deal inactive beyond threshold | 25 |
| Skipped Stage | Deal jumped over stages | 30 |
| Backward Movement | Deal regressed to earlier stage | 40 |
| Abnormal Time-in-Stage | Time exceeds 2x average | 20 |

### Risk Levels

| Level | Score Range | Description |
|-------|-------------|-------------|
| LOW | 0-24 | Deal progressing normally |
| MEDIUM | 25-49 | Minor concerns, monitor closely |
| HIGH | 50-74 | Significant risk, action needed |
| CRITICAL | 75-100 | Urgent intervention required |

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Linting

Check code quality:
```bash
npm run lint
```

Fix linting issues:
```bash
npm run lint:fix
```

Format code:
```bash
npm run format
```

## Project Structure

```
├── src/
│   ├── config/          # Configuration management
│   ├── middleware/      # Express middleware
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   │   ├── deal.service.ts      # HubSpot deal operations
│   │   ├── oauth.service.ts     # OAuth token management
│   │   ├── scoring.engine.ts    # Deviation detection logic
│   │   └── timeline.service.ts  # Timeline event creation
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── app.ts           # Express app setup
│   └── index.ts         # Application entry point
├── tests/               # Test files
├── .env.example         # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## License

ISC

