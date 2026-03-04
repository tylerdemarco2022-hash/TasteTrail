import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { supabase } from '../../backend/supabase.js';
import { createRateLimiter, hasRecentAction, recordAction } from '../../backend/middleware/rateLimiter.js';
import { logActivity, calculateDynamicConfidence } from '../../backend/discovery/discoveryEngineUtils.js';
import { addScrapeJob } from '../workers/queueSetup.js';

const router = express.Router();

/**
 * Admin Restaurant Routes
 * 
 * Photo uploads, missing photo reports, and restaurant management
 */

// Multer setup for in-memory storage
// PHASE 15: Restricted file types and size
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // PHASE 15: 5MB max (was 10MB)
  fileFilter: (req, file, cb) => {
    // PHASE 15: Only accept JPEG and PNG
    const allowedMimes = ['image/jpeg', 'image/png'];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type. Allowed: JPEG, PNG. Got: ${file.mimetype}`));
    }
    cb(null, true);
  }
});

// Middleware: Check admin token
const checkAdminToken = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN || 'dev-token-change-me';

  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }
  next();
};

/**
 * GET /admin/restaurants
 * List all restaurants with full details
 */
router.get('/', checkAdminToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, address, city, state, cuisine, cover_photo_url, confidence, lat, lng, flagged_closed, menu_status, trending_score, scan_count, place_id, website, lunch_url, dinner_url, drinks_url, pdf_url, created_at')
      .order('name', { ascending: true })
      .limit(500);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ restaurants: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /admin/restaurants
 * Create a new restaurant
 */
router.post('/', checkAdminToken, async (req, res) => {
  const { name, address, city, state, cuisine, cover_photo_url, website, lunch_url, dinner_url, drinks_url, pdf_url } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        name: name.trim(),
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        cuisine: cuisine?.trim() || null,
        cover_photo_url: cover_photo_url?.trim() || null,
        website: website?.trim() || null,
        lunch_url: lunch_url?.trim() || null,
        dinner_url: dinner_url?.trim() || null,
        drinks_url: drinks_url?.trim() || null,
        pdf_url: pdf_url?.trim() || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    console.log(`[Admin] Restaurant created: ${name}`);
    res.json({ success: true, restaurant: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /admin/restaurants/:id
 * Full update of any restaurant fields
 */
router.put('/:id', checkAdminToken, async (req, res) => {
  const { id } = req.params;
  const { name, cover_photo_url, cuisine, flagged_closed, address, city, state, website, lunch_url, dinner_url, drinks_url, pdf_url } = req.body;

  try {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (cover_photo_url !== undefined) updates.cover_photo_url = cover_photo_url || null;
    if (cuisine !== undefined) updates.cuisine = cuisine || null;
    if (address !== undefined) updates.address = address || null;
    if (city !== undefined) updates.city = city || null;
    if (state !== undefined) updates.state = state || null;
    if (flagged_closed !== undefined) updates.flagged_closed = Boolean(flagged_closed);
    if (website !== undefined) updates.website = website?.trim() || null;
    if (lunch_url !== undefined) updates.lunch_url = lunch_url?.trim() || null;
    if (dinner_url !== undefined) updates.dinner_url = dinner_url?.trim() || null;
    if (drinks_url !== undefined) updates.drinks_url = drinks_url?.trim() || null;
    if (pdf_url !== undefined) updates.pdf_url = pdf_url?.trim() || null;

    const { data, error } = await supabase
      .from('restaurants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    console.log(`[Admin] Restaurant ${id} updated`);
    res.json({ success: true, restaurant: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /admin/restaurants/update-metadata
 * Update service_model and cuisine_tags for a restaurant by name
 * Body: { name, service_model, cuisine_tags }
 * Auth: Requires x-admin-token header
 */
router.post('/update-metadata', checkAdminToken, async (req, res) => {
  try {
    const { name, service_model, cuisine_tags } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing restaurant name' });
    const { data: restaurant, error: fetchError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('name', name)
      .single();
    if (fetchError || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        service_model: service_model || null,
        cuisine_tags: Array.isArray(cuisine_tags) ? cuisine_tags.join(',') : (cuisine_tags || null),
        updated_at: new Date()
      })
      .eq('id', restaurant.id);
    if (updateError) {
      return res.status(500).json({ error: 'Failed to update restaurant metadata' });
    }
    res.json({ success: true, message: 'Metadata updated' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/restaurants/:id/cover-photo
 * Upload and save a cover photo for a restaurant
 * 
 * Multipart form-data with file field 'photo'
 */
router.post('/:id/cover-photo', checkAdminToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const restaurantId = req.params.id;

    // Validate restaurant exists
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('id', restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Resize and compress image
    let processedBuffer;
    try {
      processedBuffer = await sharp(req.file.buffer)
        .resize(1200, 800, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80, progressive: true })
        .toBuffer();
    } catch (sharpError) {
      console.error('Sharp error:', sharpError);
      return res.status(400).json({ error: 'Failed to process image' });
    }

    // PHASE 15: Get previous photo URL to delete old file
    const { data: existingRestaurant } = await supabase
      .from('restaurants')
      .select('cover_photo_url')
      .eq('id', restaurantId)
      .single();

    // Generate unique filename
    const filename = `restaurant-${restaurantId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
    const bucketPath = `restaurant-covers/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('restaurant-covers')
      .upload(bucketPath, processedBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload image to storage' });
    }

    // PHASE 15: Delete previous cover photo to avoid orphaned files
    if (existingRestaurant && existingRestaurant.cover_photo_url) {
      try {
        // Extract filename from URL
        const urlParts = existingRestaurant.cover_photo_url.split('/');
        const oldFilename = urlParts[urlParts.length - 1];
        const oldBucketPath = `restaurant-covers/${oldFilename}`;
        
        // Delete from storage
        await supabase.storage
          .from('restaurant-covers')
          .remove([oldBucketPath])
          .catch(err => {
            // Log but don't fail - file might not exist
            console.warn(`Could not delete old photo: ${err.message}`);
          });
      } catch (err) {
        console.warn(`Error deleting old photo: ${err.message}`);
      }
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('restaurant-covers')
      .getPublicUrl(bucketPath);

    const photoUrl = publicUrl.publicUrl;

    // Update restaurant with cover photo URL
    const { data: updated, error: updateError } = await supabase
      .from('restaurants')
      .update({ cover_photo_url: photoUrl, updated_at: new Date() })
      .eq('id', restaurantId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to update restaurant' });
    }

    res.json({
      success: true,
      restaurantId: restaurantId,
      restaurantName: updated.name,
      photoUrl: photoUrl,
      fileSize: processedBuffer.length,
      message: 'Cover photo uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading cover photo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /admin/restaurants/missing-photos
 * List all restaurants without a cover photo
 */
router.get('/missing-photos', checkAdminToken, async (req, res) => {
  try {
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, cuisine, confidence, lat, lng, source')
      .is('cover_photo_url', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Query error:', error);
      return res.status(500).json({ error: 'Failed to fetch restaurants' });
    }

    res.json({
      success: true,
      count: restaurants ? restaurants.length : 0,
      restaurants: restaurants || [],
      message: `Found ${restaurants ? restaurants.length : 0} restaurants missing cover photos`
    });

  } catch (error) {
    console.error('Error fetching missing photos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/restaurants/:id/flag-closed
 * PHASE 12: Community-driven closure reporting
 * PHASE 15: Rate limited and admin-token protected
 * PHASE 17: Prevents duplicate flags within 24h
 * 
 * Flag a restaurant as closed by user report
 * Auth: Requires x-admin-token header
 */
const flagClosedRateLimiter = createRateLimiter(60);
router.post('/:id/flag-closed', checkAdminToken, flagClosedRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const userIp = req.ip || req.connection.remoteAddress || 'unknown';

    // PHASE 17: Check for recent closure flag from same IP
    const flagKey = `flag-closed-${id}`;
    if (hasRecentAction(userIp, flagKey, 24 * 60 * 60 * 1000)) { // 24 hours
      return res.status(400).json({
        error: 'You have already reported this restaurant as closed in the last 24 hours',
        message: 'Please try again later'
      });
    }

    // Validate restaurant exists
    const { data: restaurant, error: fetchError } = await supabase
      .from('restaurants')
      .select('id, flagged_closed, confidence, scan_count, user_confirmations, cover_photo_url')
      .eq('id', id)
      .single();

    if (fetchError || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Update flagged_closed status and increment user_confirmations (PHASE 17)
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        flagged_closed: true,
        user_confirmations: (restaurant.user_confirmations || 0) + 1
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to flag restaurant as closed:', updateError);
      return res.status(500).json({ error: 'Failed to update restaurant status' });
    }

    // Log the closure flag activity
    await logActivity(supabase, id, 'flag_closed', userIp);

    // PHASE 17: Recalculate dynamic confidence (flagged_closed drops confidence by 2)
    // Ensure it stays between 0 and 5
    const newConfidence = Math.max(0, Math.min(5, calculateDynamicConfidence(
      restaurant.confidence,
      restaurant.scan_count,
      !!restaurant.cover_photo_url,
      (restaurant.user_confirmations || 0) + 1, // incremented above
      true // flagged_closed = true
    )));

    // Update confidence in database
    await supabase
      .from('restaurants')
      .update({ confidence: newConfidence })
      .eq('id', id);

    // PHASE 17: Record action to prevent duplicates
    recordAction(userIp, flagKey);

    res.json({
      success: true,
      restaurantId: id,
      flagged_closed: true,
      updated_confidence: newConfidence,
      message: 'Thank you for reporting. This restaurant may be closed.'
    });

  } catch (error) {
    console.error('Error flagging restaurant as closed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /admin/restaurants/:id/scrape
 * Enqueue an immediate scrape job for a restaurant.
 * Uses whatever URL is already saved on the restaurant record.
 */
router.post('/:id/scrape', checkAdminToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('id', id)
      .single();

    if (error || !restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const job = await addScrapeJob({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      jobType: 'manual_override'
    });

    if (!job) {
      return res.status(503).json({ error: 'Scrape queue unavailable (Redis may be down)' });
    }

    console.log(`[Admin] Scrape enqueued for ${restaurant.name} (${id})`);
    res.json({ success: true, jobId: job.id, restaurantName: restaurant.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
