import { autoFetchMenu } from '../backend/auto_menu_fetcher.js';

(async () => {
  try {
    const res = await autoFetchMenu('The Mill House', 'Charlotte, NC');
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Auto-fetch error:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
