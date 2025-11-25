import app from './app';
import { config, isConfigValid } from './config';

const PORT = config.port;

if (!isConfigValid()) {
  console.warn('Warning: HubSpot OAuth credentials not configured. Some features may not work.');
}

app.listen(PORT, () => {
  console.log(`🚀 HubSpot Deal Path Deviation App running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 OAuth install: http://localhost:${PORT}/oauth/install`);
});
