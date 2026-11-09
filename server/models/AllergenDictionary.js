import mongoose from 'mongoose';
import { CATEGORIAS } from './User.js';

const allergenDictionarySchema = new mongoose.Schema(
  {
    categoria: {
      type: String,
      enum: CATEGORIAS,
      required: true,
      unique: true,
      trim: true,
    },
    sinonimos: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
    excecoes: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
  },
  {
    timestamps: true,
    strict: true,
    collection: 'allergendictionaries',
  }
);

const AllergenDictionary =
  mongoose.models.AllergenDictionary ||
  mongoose.model('AllergenDictionary', allergenDictionarySchema);

export default AllergenDictionary;
