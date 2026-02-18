import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const result = await db.execute('SELECT * FROM destinations ORDER BY name');
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching destinations:', error);
      return res.status(500).json({ error: 'Failed to fetch destinations' });
    }
  }

  if (req.method === 'POST') {
    try {
      const data = req.body;
      
      if (!data.name || !data.address) {
        return res.status(400).json({ error: 'Name and address are required' });
      }

      const result = await db.execute({
        sql: `INSERT INTO destinations 
              (name, address, latitude, longitude, typical_parking_difficulty, 
               has_parking_garage, parking_cost_estimate) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          data.name,
          data.address,
          data.latitude || null,
          data.longitude || null,
          data.typical_parking_difficulty || null,
          data.has_parking_garage ? 1 : 0,
          data.parking_cost_estimate || null,
        ],
      });

      return res.status(201).json({ 
        id: Number(result.lastInsertRowid), 
        ...data 
      });
    } catch (error) {
      console.error('Error creating destination:', error);
      return res.status(500).json({ error: 'Failed to create destination' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
