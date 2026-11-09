import mongoose from 'mongoose';

const solicitacaoVinculoSchema = new mongoose.Schema(
  {
    pacienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    nutricionistaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Nutricionista',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDENTE', 'APROVADO', 'RECUSADO'],
      default: 'PENDENTE',
      required: true,
    },
    encerradaEm: { type: Date, default: null },
    encerradaPor: {
      type: String,
      enum: ['PACIENTE', 'NUTRICIONISTA', null],
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
    collection: 'solicitacoesVinculo',
  }
);

solicitacaoVinculoSchema.index(
  { pacienteId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'PENDENTE' },
  }
);
solicitacaoVinculoSchema.index({ nutricionistaId: 1, status: 1, createdAt: -1 });

const SolicitacaoVinculo =
  mongoose.models.SolicitacaoVinculo ||
  mongoose.model('SolicitacaoVinculo', solicitacaoVinculoSchema);
export default SolicitacaoVinculo;
