import serverless from 'serverless-http';
import { app } from '../../server.js'; // Use .js extension for ES Module compat

// In Netlify, the API routes are served from /.netlify/functions/api
// But express defined them as /api/*
// Setting basePath to /.netlify/functions allows Express to match /api/*
export const handler = serverless(app, {
  basePath: '/.netlify/functions'
});
