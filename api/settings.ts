import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const result = await db.execute(
        'SELECT * FROM user_settings ORDER BY id DESC LIMIT 1'
      );
      return res.status(200).json(result.rows[0] || null);
    } catch (error) {
      console.error('Error fetching settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const data = req.body;

      const existing = await db.execute(
        'SELECT id FROM user_settings ORDER BY id DESC LIMIT 1'
      );

      if (existing.rows.length > 0) {
        await db.execute({
          sql: `UPDATE user_settings 
                SET home_latitude = ?, 
                    home_longitude = ?, 
                    max_comfortable_walk_distance = ?, 
                    temperature_drive_threshold_high = ?, 
                    temperature_drive_threshold_low = ?, 
                    rain_drive_threshold = ?, 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?`,
          args: [
            data.home_latitude || null,
            data.home_longitude || null,
            data.max_comfortable_walk_distance || 1.5,
            data.temperature_drive_threshold_high || 30,
            data.temperature_drive_threshold_low || 5,
            data.rain_drive_threshold || 40,
            existing.rows[0].id,
          ],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO user_settings 
                (home_latitude, home_longitude, max_comfortable_walk_distance, 
                 temperature_drive_threshold_high, temperature_drive_threshold_low, 
                 rain_drive_threshold) 
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            data.home_latitude || null,
            data.home_longitude || null,
            data.max_comfortable_walk_distance || 1.5,
            data.temperature_drive_threshold_high || 30,
            data.temperature_drive_threshold_low || 5,
            data.rain_drive_threshold || 40,
          ],
        });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating settings:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
