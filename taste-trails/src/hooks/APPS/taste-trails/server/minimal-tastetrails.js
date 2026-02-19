import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase as supabaseClient } from '../backend/supabase.js';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import dns from 'dns';
import authRoutes from './routes/auth.js';
import { resolveMenuSource } from './menu_source_resolver.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = supabaseClient;

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Static file serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticDir = path.join(__dirname, '../src/public');
app.use('/static', express.static(staticDir));

// Auth routes
app.use('/auth', authRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Health and ping
app.get('/api/health', (req, res) => {
	res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});
app.get('/api/ping', (req, res) => {
	res.status(200).json({ pong: true, time: Date.now() });
});

// Supabase test
app.get('/api/supabase-test', async (req, res) => {
	if (!supabase) {
		return res.status(500).json({ error: 'Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_KEY or SUPABASE_KEY.' });
	}
	const url = SUPABASE_URL;
	if (!url) {
		return res.status(500).json({ error: 'SUPABASE_URL missing.' });
	}
	try {
		const hostname = url.replace(/^https?:\/\//, '').split('/')[0];
		await new Promise((resolve, reject) => {
			dns.lookup(hostname, err => {
				if (err) reject(new Error('DNS lookup failed for ' + hostname));
				else resolve();
			});
		});
		await new Promise((resolve, reject) => {
			https.get(url, resp => {
				if (resp.statusCode >= 200 && resp.statusCode < 400) resolve();
				else reject(new Error('HTTPS request failed with status ' + resp.statusCode));
			}).on('error', err => reject(new Error('HTTPS request error: ' + err.message)));
		});
	} catch (connErr) {
		return res.status(500).json({ error: 'Supabase connectivity check failed: ' + connErr.message });
	}
	try {
		const { data, error } = await supabase.from('restaurants').select('*').limit(1);
		if (error) return res.status(500).json({ error: 'Supabase auth/API error: ' + error.message });
		res.json({ data });
	} catch (err) {
		res.status(500).json({ error: 'Supabase fetch failed: ' + (err.message || 'Unknown error') });
	}
});

// Menu source
app.get('/api/restaurant/:id/menu-source', async (req, res) => {
	if (!supabase) {
		return res.status(500).json({ error: 'Supabase client not initialized.' });
	}
	const restaurantId = req.params.id;
	try {
		const { data, error } = await supabase
			.from('restaurant_menus')
			.select('id,restaurant_id,source_url,source_type,updated_at')
			.eq('restaurant_id', restaurantId)
			.order('updated_at', { ascending: false })
			.limit(1);
		if (error) return res.status(500).json({ error: error.message });
		if (data && data.length > 0 && data[0].source_url) {
			return res.json({ menuSource: data[0] });
		}
		const restaurant = {
			name: restaurantId,
			website: undefined,
			yelp_url: undefined,
			google_place_id: undefined
		};
		const resolved = await resolveMenuSource(restaurant);
		if (resolved.error) {
			return res.status(404).json({ error: resolved.error });
		}
		return res.json({ menuSource: resolved });
	} catch (err) {
		console.error('[API /api/restaurant/:id/menu-source] Error:', {
			error: err,
			stack: err.stack,
			line: (err.stack || '').split('\n')[1] || ''
		});
		res.status(500).json({ error: err.message || 'Unknown error' });
	}
});

// Full menu
app.get('/api/restaurant/:id/full-menu', async (req, res) => {
	if (!supabase) {
		return res.status(500).json({ error: 'Supabase client not initialized.' });
	}
	const restaurantId = req.params.id;
	try {
		const { data, error } = await supabase
			.from('restaurant_menus')
			.select('id,restaurant_id,menu_json,source_url,source_type,updated_at')
			.eq('restaurant_id', restaurantId)
			.order('updated_at', { ascending: false })
			.limit(1);
		if (error) return res.status(500).json({ error: error.message });
		if (!data || data.length === 0 || !data[0].menu_json) {
			return res.status(404).json({ error: 'No menu found for this restaurant.' });
		}
		res.json({ menu: data[0].menu_json, meta: {
			id: data[0].id,
			restaurant_id: data[0].restaurant_id,
			source_url: data[0].source_url,
			source_type: data[0].source_type,
			updated_at: data[0].updated_at
		}});
	} catch (err) {
		res.status(500).json({ error: err.message || 'Unknown error' });
	}
});

const PORT = 8888;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
	console.log(`Minimal TasteTrails backend running on http://${HOST}:${PORT}`);
});



