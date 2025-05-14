import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  description: String,
  
  genre: { type: String, required: true },
  publicationDate: { type: String, required: true },
  borrowed: { type: Boolean, default: false },
  borrowedBy: String,
  borrowedDate: Date
});

export const Book = mongoose.model('Book', bookSchema);
