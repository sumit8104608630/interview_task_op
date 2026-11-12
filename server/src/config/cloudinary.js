import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

/**
 * Configure Cloudinary SDK instance with environment credentials
 */
cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

export { cloudinary };
export default cloudinary;
