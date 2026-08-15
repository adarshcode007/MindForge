import mongoose from 'mongoose';

const { Schema } = mongoose;

const deckSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  color: { type: String, required: true }, // hex, assigned from a rotating palette on create
  tags: { type: [String], default: [] },   // denormalized rollup of all tags in this deck's questions
  questionCount: { type: Number, default: 0 },
}, { 
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
    }
  }
});

const Deck = mongoose.model('Deck', deckSchema);
export default Deck;
