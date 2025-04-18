import express from 'express';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import inputRoutes from './router';

dotenv.config();

// initialize
const app = express();

app.use(cors());

app.use(morgan('dev'));

app.set('view engine', 'ejs');

app.use(express.static('static'));

app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // To parse the incoming requests with JSON payloads
app.use('/api/inputs', inputRoutes); // Mount routes under /api/inputs

// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// START THE SERVER
// =============================================================================
async function startServer() {
  try {
    // connect DB
    const mongoURI = process.env.MONGODB_URI;
    await mongoose.connect(mongoURI);
    console.log(`Mongoose connected to: ${mongoURI}`);

    const port = process.env.PORT || 9090;
    app.listen(port);

    console.log(`Listening on port ${port}`);
  } catch (error) {
    console.error(error);
  }
}

startServer();
