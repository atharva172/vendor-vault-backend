const ImageKit = require('@imagekit/nodejs');
const { toFile } = require('@imagekit/nodejs');
const {v4: uuid} = require('uuid')

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const uploadImage = async (file) => {
  if (!file || !file.buffer) {
    throw new Error('Image file buffer is required');
  }

  // ImageKit v7 exposes upload under files.upload, older versions expose upload directly.
  const uploadFn = imagekit?.files?.upload || imagekit?.upload;
  if (typeof uploadFn !== 'function') {
    throw new Error('ImageKit upload API is not available on this SDK version');
  }

  const fileName = `${uuid()}-${file.originalname}`;
  const imageFile = await toFile(file.buffer, fileName, { type: file.mimetype });

  const uploadResponse = await uploadFn.call(imagekit.files || imagekit, {
    file: imageFile,
    fileName,
    folder: '/products',
  });

  return {
    id: uploadResponse.fileId,
    url: uploadResponse.url,
    thumbnail: uploadResponse.thumbnailUrl,
  };
};

module.exports = {
  // Backward compatibility for callers using imagekit.upload(file)
  upload: uploadImage,
  uploadImage,
};
