const express = require('express');
const router = express.Router();
const Book = require('../models/book'); // Make sure you have a Book model

// INDEX – list all books
router.get('/', async (req, res) => {
  const books = await Book.find();
  res.render('books/index', { books });
});

// NEW – form to create new book
router.get('/new', (req, res) => {
  res.render('books/new');
});

// CREATE – add new book to DB
router.post('/', async (req, res) => {
  const { title, author, genre, publishedYear } = req.body;
  await Book.create({ title, author, genre, publishedYear });
  res.redirect('/books');
});

// SHOW – show one book
router.get('/:id', async (req, res) => {
  const book = await Book.findById(req.params.id);
  res.render('books/show', { book });
});

// EDIT – form to edit a book
router.get('/:id/edit', async (req, res) => {
  const book = await Book.findById(req.params.id);
  res.render('books/edit', { book });
});

// UPDATE – update book in DB
router.put('/:id', async (req, res) => {
  const { title, author, genre, publishedYear } = req.body;
  await Book.findByIdAndUpdate(req.params.id, { title, author, genre, publishedYear });
  res.redirect('/books');
});


// BORROW – mark book as borrowed
router.put('/:id/borrow', async (req, res) => {
  const { id } = req.params;
  const { borrower } = req.body;

  try {
    const book = await Book.findById(id);
    if (!book) return res.status(404).send('Book not found');

    if (book.borrowed) {
      return res.status(400).send('Book is already borrowed');
    }

    book.borrowed = true;
    book.borrowedBy = borrower;
    book.borrowedDate = new Date();
    await book.save();

    res.redirect('/books');
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// RETURN – mark book as returned
router.put('/:id/return', async (req, res) => {
  const { id } = req.params;

  try {
    const book = await Book.findById(id);
    if (!book) return res.status(404).send('Book not found');

    if (!book.borrowed) {
      return res.status(400).send('Book is not currently borrowed');
    }

    book.borrowed = false;
    book.borrowedBy = '';
    book.borrowedDate = null;
    await book.save();

    res.redirect('/books');
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
