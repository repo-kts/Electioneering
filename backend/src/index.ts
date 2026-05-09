// Local dev entry — boots the Express app on PORT.
// In serverless (Vercel) the handler in api/index.ts is used instead.
import { getApp } from './app.js';

const PORT = Number(process.env.PORT) || 4000;
const app = getApp();
app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
