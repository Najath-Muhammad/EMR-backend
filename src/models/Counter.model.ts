import mongoose, { Schema } from 'mongoose';

export interface CounterDocument {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDocument>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const CounterModel = mongoose.model<CounterDocument>('Counter', counterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const result = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return result.seq;
}
