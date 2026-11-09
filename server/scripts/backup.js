import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('ERRO: Variável MONGO_URI / MONGODB_URI não encontrada no .env.');
  process.exit(1);
}

async function executarBackup() {
  const agora = new Date().toISOString().replace(/[:.]/g, '-');
  const pastaDestino = path.join(__dirname, '..', 'backups', `backup-${agora}`);
  fs.mkdirSync(pastaDestino, { recursive: true });

  console.log(`Iniciando backup somente-leitura em: ${pastaDestino}`);

  try {
    const conn = await mongoose.connect(MONGO_URI);
    const bancosParaExportar = ['RotuScanDB', 'RotuScan'];

    for (const nomeBanco of bancosParaExportar) {
      const db = conn.connection.client.db(nomeBanco);
      const colecoes = await db.listCollections().toArray();
      const pastaBanco = path.join(pastaDestino, nomeBanco);
      fs.mkdirSync(pastaBanco, { recursive: true });

      console.log(`\nBanco: ${nomeBanco} (${colecoes.length} coleções)`);

      for (const colInfo of colecoes) {
        const nomeCol = colInfo.name;
        const docs = await db.collection(nomeCol).find({}).toArray();
        const arquivoSaida = path.join(pastaBanco, `${nomeCol}.json`);
        fs.writeFileSync(arquivoSaida, JSON.stringify(docs, null, 2), 'utf-8');
        console.log(`  - ${nomeCol}: ${docs.length} documento(s) exportado(s)`);
      }
    }

    console.log('\nBackup concluído com sucesso!');
  } catch (err) {
    console.error('Erro durante o backup:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

executarBackup();

