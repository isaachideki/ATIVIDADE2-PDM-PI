import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const confirmar = process.argv.includes('--confirm');
const dryRun = !confirmar || process.argv.includes('--dry-run');

if (!MONGO_URI) {
  console.error('ERRO: Variável MONGO_URI / MONGODB_URI não encontrada no .env.');
  process.exit(1);
}

const COLECOES_LEGADAS_ROTUSCANDB = ['usuarios', 'restricaos', 'historicos', 'produtos'];

async function executarLimpeza() {
  console.log('==============================================================');
  console.log(
    dryRun
      ? 'MODO SIMULAÇÃO (--dry-run): Nenhuma coleção será removida.'
      : 'MODO EXECUÇÃO (--confirm): Removendo coleções legadas.'
  );
  console.log('==============================================================\n');

  try {
    const conn = await mongoose.connect(MONGO_URI);
    const client = conn.connection.client;

        const dbOficial = client.db('RotuScanDB');
    const existentesOficial = (await dbOficial.listCollections().toArray()).map((c) => c.name);

    console.log('Banco oficial: RotuScanDB');
    for (const nomeCol of COLECOES_LEGADAS_ROTUSCANDB) {
      if (existentesOficial.includes(nomeCol)) {
        const qtd = await dbOficial.collection(nomeCol).countDocuments();
        console.log(
          `  - Coleção legada '${nomeCol}' (${qtd} docs): ${dryRun ? 'SERIA REMOVIDA' : 'REMOVENDO...'}`
        );
        if (!dryRun) {
          await dbOficial.collection(nomeCol).drop();
        }
      }
    }

        const dbDuplicado = client.db('RotuScan');
    const existentesDuplicado = (await dbDuplicado.listCollections().toArray()).map((c) => c.name);

    console.log('\nBanco legado/duplicado: RotuScan');
    if (existentesDuplicado.length === 0) {
      console.log('  - Nenhuma coleção encontrada.');
    } else {
      for (const nomeCol of existentesDuplicado) {
        const qtd = await dbDuplicado.collection(nomeCol).countDocuments();
        console.log(
          `  - Coleção '${nomeCol}' (${qtd} docs): ${dryRun ? 'SERIA REMOVIDA' : 'REMOVENDO...'}`
        );
        if (!dryRun) {
          await dbDuplicado.collection(nomeCol).drop();
        }
      }
    }

    if (dryRun) {
      console.log('\nNenhuma alteração foi feita. Execute primeiro `npm run backup` e `npm run migrate -- --confirm`.');
      console.log('Quando desejar remover as coleções legadas acima, execute:');
      console.log('  npm run cleanup -- --confirm');
    } else {
      console.log('\nLimpeza concluída com sucesso!');
    }
  } catch (err) {
    console.error('Erro durante cleanupDb:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

executarLimpeza();

