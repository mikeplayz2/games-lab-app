const AVATAR_PREFIX = "games-lab-avatar:";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;

export async function makeAvatar(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Choose a valid image file.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Choose an image smaller than 5 MB.");
  }

  const image = await new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const loadedImage = new Image();
    loadedImage.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(loadedImage);
    };
    loadedImage.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That image could not be opened."));
    };
    loadedImage.src = objectUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Your browser could not process that image.");
  }

  const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
  const cropX = (image.naturalWidth - cropSize) / 2;
  const cropY = (image.naturalHeight - cropSize) / 2;
  context.drawImage(
    image,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  );
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function saveAvatar(uid, avatar) {
  try {
    localStorage.setItem(`${AVATAR_PREFIX}${uid}`, avatar);
  } catch (error) {
    throw new Error("Your profile photo could not be saved in this browser.", {
      cause: error
    });
  }
}

export function getAvatar(uid) {
  return localStorage.getItem(`${AVATAR_PREFIX}${uid}`);
}
