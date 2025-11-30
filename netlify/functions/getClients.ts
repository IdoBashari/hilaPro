import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import pkg from 'pg';
const { Pool } = pkg;

// The connection string is automatically provided by Netlify when linked to a Neon database.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  try {
    // Note: Using quoted identifiers like "businessId" to preserve camelCase, 
    // assuming the table was created with them.
    const { rows } = await pool.query('SELECT id, name, "businessId", contacts, email, address FROM clients ORDER BY name ASC;');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow requests from any origin
      },
      body: JSON.stringify(rows),
    };
  } catch (error) {
    console.error('Database Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch clients from database.' }),
    };
  }
};

export { handler };
