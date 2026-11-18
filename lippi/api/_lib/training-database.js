import pg from 'pg';

// Reuse the site's existing database configuration without changing the founder survey.
export function createTrainingDatabase({env = process.env, Pool = pg.Pool} = {}) {
  let poolPromise;
  const connect = async () => {
    const urls = String(env.SURVEY_DATABASE_URL || env.DATABASE_URL || '').split(/\s+/).filter(Boolean);
    if (!urls.length) throw new Error('Training database configuration unavailable.');
    for (const connectionString of urls) {
      const candidate = new Pool({connectionString, ssl: {rejectUnauthorized: false}, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 6000});
      try {
        await candidate.query('SELECT 1');
        return candidate;
      } catch {
        await candidate.end().catch(() => {});
      }
    }
    throw new Error('Training database is temporarily unavailable.');
  };
  const pool = () => (poolPromise ??= connect().catch(error => { poolPromise = undefined; throw error; }));
  const transaction = async work => {
    const client = await (await pool()).connect();
    try {
      await client.query('BEGIN');
      const result = await work((...args) => client.query(...args));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };
  return {query: async (...args) => (await pool()).query(...args), transaction};
}

export const trainingDatabase = createTrainingDatabase();
