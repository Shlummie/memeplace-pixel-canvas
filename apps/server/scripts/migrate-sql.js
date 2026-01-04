const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      console.log(`Applying migration ${file}`);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
    }
    console.log('All migrations applied successfully');
  } finally {
    await client.end();
  }
}

runMigrations().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});

