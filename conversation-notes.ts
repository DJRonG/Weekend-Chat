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
      const result = await db.execute(
        'SELECT * FROM conversation_notes ORDER BY date_logged DESC LIMIT 20'
      );
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching conversation notes:', error);
      return res.status(500).json({ error: 'Failed to fetch conversation notes' });
    }
  }

  if (req.method === 'POST') {
    try {
      const data = req.body;

      if (!data.note_text) {
        return res.status(400).json({ error: 'note_text is required' });
      }

      const result = await db.execute({
        sql: `INSERT INTO conversation_notes 
              (note_text, category, contact_name, venue_mentioned, 
               emotional_state, date_logged) 
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          data.note_text,
          data.category || null,
          data.contact_name || null,
          data.venue_mentioned || null,
          data.emotional_state || null,
          data.date_logged || new Date().toISOString().split('T')[0],
        ],
      });

      return res.status(201).json({ 
        id: Number(result.lastInsertRowid), 
        ...data 
      });
    } catch (error) {
      console.error('Error creating conversation note:', error);
      return res.status(500).json({ error: 'Failed to create conversation note' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
