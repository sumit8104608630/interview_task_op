import { cloudinary } from '../../config/cloudinary.js';

/**
 * Cloudinary image storage integration service
 * Handles asset uploads and removals, returning secure URLs and public IDs.
 */
export class CloudinaryService {
  /**
   * Uploads an image file or stream to Cloudinary under a specific folder
   * @param {string|Buffer} fileSource - Local file path, Base64 data URI, or remote URL
   * @param {object} options
   * @param {string} options.folder - Destination folder in Cloudinary
   * @param {Array<string>} [options.tags] - Search tags for asset management
   * @returns {Promise<{ secureUrl: string, publicId: string, format: string, width: number, height: number }>}
   */
  static async uploadImage(fileSource, { folder = 'hotel-booking-portal', tags = [] } = {}) {
    try {
      const uploadResult = await cloudinary.uploader.upload(fileSource, {
        folder,
        tags,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      return {
        secureUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
      };
    } catch (error) {
      console.error('[Cloudinary Upload Error]', error.message);
      throw new Error(`Cloudinary image upload failed: ${error.message}`);
    }
  }

  /**
   * Uploads a hotel property image
   * @param {string|Buffer} fileSource
   * @param {string} hotelId
   * @returns {Promise<{ secureUrl: string, publicId: string }>}
   */
  static async uploadHotelImage(fileSource, hotelId) {
    return this.uploadImage(fileSource, {
      folder: `hotel-booking-portal/hotels/${hotelId}`,
      tags: ['hotel', `hotel-${hotelId}`],
    });
  }

  /**
   * Uploads a room category image
   * @param {string|Buffer} fileSource
   * @param {string} hotelId
   * @param {string} roomTypeId
   * @returns {Promise<{ secureUrl: string, publicId: string }>}
   */
  static async uploadRoomImage(fileSource, hotelId, roomTypeId) {
    return this.uploadImage(fileSource, {
      folder: `hotel-booking-portal/hotels/${hotelId}/rooms/${roomTypeId}`,
      tags: ['room', `hotel-${hotelId}`, `room-${roomTypeId}`],
    });
  }

  /**
   * Deletes an image from Cloudinary using its public ID
   * @param {string} publicId - The Cloudinary public identifier
   * @returns {Promise<{ result: string }>}
   */
  static async deleteImage(publicId) {
    if (!publicId) {
      throw new Error('A valid Cloudinary publicId is required for deletion.');
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });

      return result;
    } catch (error) {
      console.error('[Cloudinary Delete Error]', error.message);
      throw new Error(`Cloudinary image deletion failed: ${error.message}`);
    }
  }
}

export default CloudinaryService;
