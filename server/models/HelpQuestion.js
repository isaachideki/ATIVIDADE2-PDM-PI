import mongoose from 'mongoose';

const helpQuestionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    nome: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    pergunta: {
      type: String,
      required: true,
      trim: true,
    },
    resposta: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['PENDENTE', 'RESPONDIDA'],
      default: 'PENDENTE',
    },
  },
  { timestamps: true, collection: 'helpquestions' }
);

helpQuestionSchema.index({ userId: 1, createdAt: -1 });

const HelpQuestion =
  mongoose.models.HelpQuestion ||
  mongoose.model('HelpQuestion', helpQuestionSchema);

export default HelpQuestion;

