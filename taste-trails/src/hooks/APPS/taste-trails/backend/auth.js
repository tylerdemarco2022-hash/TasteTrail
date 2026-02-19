import { supabase } from './supabase.js'

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' })
    }

    const token = authHeader.substring(7)
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Attach user to request
    req.user = user
    next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

/**
 * Middleware to optionally attach user if token is provided and valid.
 * Does not error if token is missing or invalid; simply proceeds.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }

    const token = authHeader.substring(7)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      // Proceed without user if token invalid
      return next()
    }

    req.user = user
    next()
  } catch (error) {
    // Do not block request on optional auth errors
    console.warn('Optional auth warning:', error?.message || error)
    next()
  }
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Check if user has admin role
    const { data: userData, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (error || !userData || userData.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    req.isAdmin = true
    next()
  } catch (error) {
    console.error('Admin middleware error:', error)
    res.status(403).json({ error: 'Admin verification failed' })
  }
}

/**
 * Log admin action to admin_logs table
 */
export async function logAdminAction(adminId, action, targetType, targetId, details = {}) {
  try {
    await supabase.from('admin_logs').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: String(targetId),
      details
    })
  } catch (error) {
    console.error('Failed to log admin action:', error)
  }
}
