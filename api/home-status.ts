import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const result = await db.execute(
        'SELECT * FROM home_status ORDER BY id DESC LIMIT 1'
      );
      return res.status(200).json(result.rows[0] || null);
    } catch (error) {
      console.error('Error fetching home status:', error);
      return res.status(500).json({ error: 'Failed to fetch home status' });
    }
  }

  if (req.method === 'POST') {
    try {
      const data = req.body;

      const result = await db.execute({
        sql: `INSERT INTO home_status 
              (ev_charge_percentage, garden_watered, last_watered_at) 
              VALUES (?, ?, ?)`,
        args: [
          data.ev_charge_percentage || null,
          data.garden_watered ? 1 : 0,
          data.last_watered_at || null,
        ],
      });

      return res.status(201).json({ 
        id: Number(result.lastInsertRowid), 
        ...data 
      });
    } catch (error) {
      console.error('Error creating home status:', error);
      return res.status(500).json({ error: 'Failed to create home status' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const data = req.body;

      await db.execute({
        sql: `UPDATE home_status 
              SET ev_charge_percentage = ?, 
                  garden_watered = ?, 
                  last_watered_at = ?, 
                  updated_at = CURRENT_TIMESTAMP 
              WHERE id = (SELECT id FROM home_status ORDER BY id DESC LIMIT 1)`,
        args: [
          data.ev_charge_percentage || null,
          data.garden_watered ? 1 : 0,
          data.last_watered_at || null,
        ],
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating home status:', error);
      return res.status(500).json({ error: 'Failed to update home status' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
