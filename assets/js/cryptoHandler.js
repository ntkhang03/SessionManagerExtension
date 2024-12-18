// Function to generate secret key from password using PBKDF2
async function generateKeyFromPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 10000, // the number of iterations to run the key-derivation function
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-CBC", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// Function to encrypt data
async function encrypt(text, password) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await generateKeyFromPassword(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: iv },
    key,
    encoder.encode(text)
  );

  return {
    iv: Array.from(iv),
    salt: Array.from(salt),
    encryptedData: Array.from(new Uint8Array(encrypted))
  };
}

// Function to decrypt data
async function decrypt(encryptedData, password) {
  const iv = new Uint8Array(encryptedData.iv);
  const salt = new Uint8Array(encryptedData.salt);
  const cipherText = new Uint8Array(encryptedData.encryptedData);

  const key = await generateKeyFromPassword(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: iv },
    key,
    cipherText
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export default { encrypt, decrypt };
