import mongoose from 'mongoose';
import { CATEGORIAS } from './User.js';

export function montarMarcaPeso(marca, peso, marcaPesoLegado = '') {
  const m = typeof marca === 'string' ? marca.trim() : '';
  const p = typeof peso === 'string' ? peso.trim() : '';
  if (m && p) return `${m} • ${p}`;
  if (m) return m;
  if (p) return p;
  return typeof marcaPesoLegado === 'string' ? marcaPesoLegado.trim() : '';
}

const alergicoSchema = new mongoose.Schema(
  {
    categoria: { type: String, enum: CATEGORIAS, required: true },
    tipo: { type: String, enum: ['CONTEM', 'TRACOS'], required: true },
    termo: { type: String, trim: true, maxlength: 120, default: '' },
    trecho: { type: String, trim: true, maxlength: 240, default: '' },
    aproximado: { type: Boolean, default: false },
    termos: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
  },
  { _id: false }
);

const ingredienteSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true, maxlength: 120 },
    risco: { type: Boolean, default: false },
    fonte: { type: String, trim: true, maxlength: 80, default: null },
  },
  { _id: false }
);

const scanLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    escaneadoPorNome: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'Usuário',
    },
    nomeProduto: {
      type: String,
      required: true,
      default: 'Produto Seguro',
      trim: true,
      maxlength: 80,
    },
    nomeAutomatico: {
      type: Boolean,
      default: true,
    },
    nomeBusca: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    marca: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
    },
    peso: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null,
    },
    // Mantido para compatibilidade com documentos legados e clientes web/mobile
    marcaPeso: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    // Foto capturada comprimida em Base64 (data:image/jpeg;base64,...) ou URI persistente
    imagemUri: {
      type: String,
      default: null,
    },
    imagemThumb: {
      type: String,
      select: false,
      default: null,
    },
    // Caminho relativo a server/uploads (ex.: scans/<userId>/<logId>.jpg)
    imagemArquivo: {
      type: String,
      trim: true,
      maxlength: 260,
      default: null,
    },
    // Chave de imagem de demonstração (somente seed:true)
    imagemDemo: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
    },
    intoleranciaDetectada: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
    nivelSensibilidade: {
      type: String,
      enum: ['Leve', 'Moderado', 'Grave'],
      default: 'Moderado',
    },
    confiancaOcr: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    motorOcr: {
      type: String,
      trim: true,
      maxlength: 40,
      default: 'tesseract',
    },
    textoBruto: {
      type: String,
      default: '',
    },
    veredito: {
      type: String,
      enum: ['SEGURO', 'PERIGOSO'],
      required: true,
    },
    alergicosDetectados: {
      type: [alergicoSchema],
      default: [],
    },
    ingredientesDetalhados: {
      type: [ingredienteSchema],
      default: [],
    },
    curtido: {
      type: Boolean,
      default: false,
    },
    seed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    strict: true,
    collection: 'scanlogs',
  }
);

scanLogSchema.index({ userId: 1, createdAt: -1 });
scanLogSchema.index({ userId: 1, curtido: 1, createdAt: -1 });

const ScanLog = mongoose.models.ScanLog || mongoose.model('ScanLog', scanLogSchema);
export default ScanLog;
