// Vercel serverless entry. Vercel routes /api/* (and everything via
// vercel.json rewrites) to this single function. The Express app is
// reused across warm invocations via the getApp() singleton.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getApp } from '../src/app.js';

const app = getApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}

// Larger body limit for file uploads. Vercel hard-caps at 4.5MB on the
// hobby plan and ~50MB on Pro. Keep multer's own 25MB limit in sync.
export const config = {
  api: {
    bodyParser: false, // let express.json + multer handle parsing
  },
  maxDuration: 30,
};
