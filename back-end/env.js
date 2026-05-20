import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '.env'), quiet: true })

const PORT = process.env.PORT
const CORS_ORIGIN = process.env.CORS_ORIGIN
const MONGODB_URI = process.env.MONGODB_URI
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET
const FACEBOOK_GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v25.0"
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const MONGODB_MAX_POOL_SIZE = process.env.MONGODB_MAX_POOL_SIZE
const MONGODB_MIN_POOL_SIZE = process.env.MONGODB_MIN_POOL_SIZE
const MONGODB_MAX_IDLE_TIME_MS = process.env.MONGODB_MAX_IDLE_TIME_MS
const MONGODB_WAIT_QUEUE_TIMEOUT_MS = process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS
const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER
const EMAIL_FROM = process.env.EMAIL_FROM || (process.env.SMTP_USER ? `BattleArena <${process.env.SMTP_USER}>` : "BattleArena <no-reply@localhost>")
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || process.env.CORS_ORIGIN || "http://localhost:8080"
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || ""
const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = process.env.SMTP_PORT
const SMTP_SECURE = process.env.SMTP_SECURE
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || (EMAIL_FROM.includes("@") ? `mailto:${EMAIL_FROM.match(/<([^>]+)>/)?.[1] || EMAIL_FROM}` : "mailto:no-reply@localhost")

export {
    PORT,
    CORS_ORIGIN,
    MONGODB_URI,
    ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRY,
    RAPIDAPI_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET,
    FACEBOOK_GRAPH_VERSION,
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    MONGODB_MAX_POOL_SIZE,
    MONGODB_MIN_POOL_SIZE,
    MONGODB_MAX_IDLE_TIME_MS,
    MONGODB_WAIT_QUEUE_TIMEOUT_MS,
    RESEND_API_KEY,
    EMAIL_PROVIDER,
    EMAIL_FROM,
    APP_PUBLIC_URL,
    API_PUBLIC_URL,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
}
