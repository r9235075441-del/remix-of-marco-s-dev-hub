import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import ServerConfig from "./models/ServerConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not defined");
  process.exit(1);
}

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI as string);
    console.log("Connected.");

    const existingConfig = await ServerConfig.findOne({ _id: 1 });
    if (existingConfig) {
      console.log("Server config already exists:", existingConfig.webName);
    } else {
      console.log("Creating default server config...");
      const defaultConfig = {
        _id: 1,
        webName: process.env.NEXT_PUBLIC_APP_NAME || "PW-MARCO",
        registrationOpen: true,
        sidebarLogoUrl: "/logo.png",
        sidebarTitle: process.env.NEXT_PUBLIC_APP_NAME || "PW-MARCO",
        isDirectLoginOpen: true,
        password: process.env.ADMIN_PASSWORD || "change-me",
        tg_bot: "your_bot_username",
        tg_channel: "your_channel",
        tg_username: "your_username",
        username: process.env.ADMIN_USERNAME || "admin",
        shortner_servers: []
      };
      await ServerConfig.create(defaultConfig);
      console.log("Default server config created.");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
