/**
 * Admin Restaurant Routes
 * 
 * Photo uploads, missing photo reports, and restaurant management
 */

import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { supabase } from '../../backend/supabase.js';
import { createRateLimiter, hasRecentAction, recordAction } from '../../backend/middleware/rateLimiter.js';
import { logActivity, calculateDynamicConfidence } from '../../backend/discovery/discoveryEngineUtils.js';
import crypto from 'crypto';

const router = express.Router();

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

export default router;
