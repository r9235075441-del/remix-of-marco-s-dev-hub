import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("CRITICAL: MONGODB_URI is not defined in environment variables.");
}

// FORCE global bufferCommands for all schemas and connections
// This is critical for Next.js 15 + Turbopack environments
mongoose.set('bufferCommands', true);
if (mongoose.Schema.prototype.options) {
  (mongoose.Schema.prototype.options as any).bufferCommands = true;
}

// Listen for connection events to help debugging
mongoose.connection.on('connected', () => console.log('MongoDB: Connected to database'));
mongoose.connection.on('error', (err) => console.error('MongoDB: Connection error:', err));
mongoose.connection.on('disconnected', () => console.log('MongoDB: Disconnected'));

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  // Check if we are already connected
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return cached.conn;
  }

  if (!MONGODB_URI) {
    return null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: true, // Explicitly enable for this connection
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 20000, 
      socketTimeoutMS: 45000,
    };

    console.log("MongoDB: Starting connection attempt...");
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error("MongoDB: Failed to connect during dbConnect()", e);
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
