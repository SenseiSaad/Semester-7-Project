/* index.js — single import surface for the logic layer. UI components should
   import from here (or from the specific module) and never implement business
   rules themselves. */

export * from './storage.js';
export * from './seed.js';
export * from './auth.js';
export * from './eligibility.js';
export * from './attendance.js';
export * from './qr.js';
export * from './csv.js';
export * from './courses.js';
export * from './policy.js';
