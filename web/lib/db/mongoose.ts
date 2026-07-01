import mongoose from "mongoose";

/**
 * Connexion Mongoose en singleton — indispensable en environnement serverless
 * (Vercel) pour ne pas rouvrir une connexion à chaque invocation.
 */
const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongoose ?? { conn: null, promise: null };
global._mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI manquant dans l'environnement (.env.local).");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .catch((err) => {
        // Ne pas mémoriser une promesse rejetée : sinon toute connexion
        // future échouerait à l'identique (ex. IP whitelistée après coup)
        // jusqu'au redémarrage du process. On réinitialise pour retenter.
        cached.promise = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
  return cached.conn;
}
