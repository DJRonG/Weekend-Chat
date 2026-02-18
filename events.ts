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
      const result = await db.execute('SELECT * FROM events ORDER BY start_datetime');
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching events:', error);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }
  }

  if (req.method === 'POST') {
    try {
      const data = req.body;

      if (!data.name || !data.start_datetime) {
        return res.status(400).json({ error: 'Name and start_datetime are required' });
      }

      const result = await db.execute({
        sql: `INSERT INTO events 
              (name, venue_name, latitude, longitude, start_datetime, 
               end_datetime, expected_attendance, is_road_closure) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          data.name,
          data.venue_name || null,
          data.latitude || null,
          data.longitude || null,
          data.start_datetime,
          data.end_datetime || null,
          data.expected_attendance || null,
          data.is_road_closure ? 1 : 0,
        ],
      });

      return res.status(201).json({ 
        id: Number(result.lastInsertRowid), 
        ...data 
      });
    } catch (error) {
      console.error('Error creating event:', error);
      return res.status(500).json({ error: 'Failed to create event' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
