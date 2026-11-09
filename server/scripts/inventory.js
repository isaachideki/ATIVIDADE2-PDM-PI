import 'dotenv/config';
import mongoose from 'mongoose';

const TARGET_DBS = ['RotuScan', 'RotuScanDB'];

async function runInventory() {
  const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!rawUri) {
    console.error('Erro: MONGODB_URI ou MONGO_URI não definida no .env');
    process.exit(1);
  }

    const dbMatch = rawUri.match(/\.mongodb\.net\/([^?]*)/);
  const configuredDb = dbMatch && dbMatch[1] ? dbMatch[1] : '(default/test)';
  console.log('==================================================');
  console.log('INVENTÁRIO SOMENTE-LEITURA — MONGODB ATLAS');
  console.log(`Banco configurado na URI (.env): ${configuredDb}`);
  console.log('==================================================\n');

  const conn = await mongoose.connect(rawUri);

  try {
    for (const dbName of TARGET_DBS) {
      console.log(`--- Banco: ${dbName} ---`);
      const db = conn.connection.useDb(dbName, { useCache: true }).db;
      const collections = await db.listCollections().toArray();

      if (collections.length === 0) {
        console.log('  (Nenhuma coleção encontrada)\n');
        continue;
      }

      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        const sample = await db.collection(col.name).findOne(
          {},
          { projection: { senha: 0, password: 0 } }
        );
        const fields = sample ? Object.keys(sample).join(', ') : '(vazia)';
        console.log(`  • ${col.name}: ${count} documento(s) | campos: [${fields}]`);
      }
      console.log('');
    }
  } finally {
    await mongoose.disconnect();
  }
}

runInventory().catch((err) => {
  console.error('Falha ao executar inventário:', err.message);
  process.exit(1);
});

