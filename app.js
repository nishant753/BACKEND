import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import session from 'express-session';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import MongoStore from 'connect-mongo';
import { Book } from './models/book.js';
import { User } from './models/user.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Setup view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://127.0.0.1:27017/libraryDB' }),
  })
);

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) return done(null, false, { message: 'Incorrect email.' });
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return done(null, false, { message: 'Incorrect password.' });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// MongoDB connection
mongoose
  .connect('mongodb://127.0.0.1:27017/libraryDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Middleware to make user available in all views
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

// Auth middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Registration routes
app.get('/register', (req, res) => {
  res.render('register.ejs');
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const user = new User({ name, email, password });
    await user.save();
    res.redirect('/login');
  } catch (err) {
    res.status(400).send('Registration failed. Email may already be in use.');
  }
});

// Login routes
app.get('/login', (req, res) => {
  res.render('login.ejs');
});

app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
  })
);

// Logout route
app.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    res.redirect('/login');
  });
});

app.get('/', async (req, res) => {
  const books = await Book.find({});
  res.render('index.ejs', { books });
});

// Route to create a new book entry (protected)
app.get('/create', ensureAuthenticated, (req, res) => {
  res.render('create.ejs', { bookToEdit: null });
});

// Route to view all books
app.get('/view', async (req, res) => {
  const books = await Book.find({});
  res.render('view.ejs', { books });
});

// Search route for searching books by title or author
app.get('/search', async (req, res) => {
  const searchQuery = req.query.q;
  const books = await Book.find({
    $or: [
      { title: { $regex: searchQuery, $options: 'i' } },
      { author: { $regex: searchQuery, $options: 'i' } },
    ],
  });
  res.render('index.ejs', { books });
});


app.get('/mybook', ensureAuthenticated, async (req, res) => {
  const books = await Book.find({ borrowed: true, borrowedBy: req.user.name });
  res.render('mybook', { books });
});


// Post route to add a new book (protected, with debug/error handling)
app.post('/submit', ensureAuthenticated, async (req, res) => {
  try {
    const { title, author, description, genre } = req.body;

    // Debug: Log the received form data
    console.log('Received form data:', req.body);

    // Basic validation
    if (!title || !author || !genre) {
      return res.status(400).send('All fields (title, author, genre) are required.');
    }

    const today = new Date();
    const newBook = new Book({
      title,
      author,
      description,
      genre,
      publicationDate: today.toDateString(),
    });

    await newBook.save();
    res.redirect('/');
  } catch (error) {
    // Debug: Log the error details
    console.error('Error submitting book:', error);
    res.status(500).send('Error submitting book: ' + error.message);
  }
});

// Route to edit an existing book (protected)
app.get('/edit/:id', ensureAuthenticated, async (req, res) => {
  const bookId = req.params.id;
  const bookToEdit = await Book.findById(bookId);
  if (!bookToEdit) {
    return res.status(404).send('Book not found');
  }
  res.render('create', { bookToEdit });
});

// Post route to update an existing book (protected)
app.post('/edit/:id', ensureAuthenticated, async (req, res) => {
  const bookId = req.params.id;
  const { title, author, description, genre } = req.body;
  try {
    const updatedBook = await Book.findByIdAndUpdate(
      bookId,
      { title, author, description, genre },
      { new: true }
    );
    if (!updatedBook) {
      return res.status(404).send('Book not found');
    }
    res.redirect('/');
  } catch (error) {
    console.error('❌ Error updating book:', error);
    res.status(500).send('Internal Server Error');
  }
});



// Borrowing route (protected)
app.post('/borrow/:id', ensureAuthenticated, async (req, res) => {
  const bookId = req.params.id;
  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).send('Book not found');
    }
    if (book.borrowed) {
      return res.status(400).send('Book already borrowed');
    }
    book.borrowed = true;
    book.borrowedBy = req.user.name; // Link to logged-in user
    book.borrowedDate = new Date();
    await book.save();
    res.redirect('/view');
  } catch (error) {
    console.error('❌ Error borrowing book:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Return a borrowed book (protected)
app.post('/return/:id', ensureAuthenticated, async (req, res) => {
  const bookId = req.params.id;
  try {
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).send('Book not found');
    }
    if (!book.borrowed) {
      return res.status(400).send('Book is not borrowed');
    }
    book.borrowed = false;
    book.borrowedBy = '';
    book.borrowedDate = null;
    await book.save();
    res.redirect('/view');
  } catch (error) {
    console.error('❌ Error returning book:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});


// Error-handling middleware
app.use((err, req, res, next) => {
  console.error('Error caught by middleware:', err.stack);
  res.status(500).send('Something broke!');
});

// Start server
const port = 4000;
app.listen(port, () => {
  console.log(`Library Management App Listening at port:- ${port}`);
});
