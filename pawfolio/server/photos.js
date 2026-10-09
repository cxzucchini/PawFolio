export function photoInput(value) {
  if (value === undefined) return undefined;
  if (value === '') return '';
  const fail = () => {
    const error = new Error(
      'Choose a valid JPEG, PNG, or WebP photo under 500 KB after resizing.',
    );
    error.status = 400;
    throw error;
  };
  if (typeof value !== 'string' || value.length > 700000) return fail();
  const match = value.match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match) return fail();
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 500 * 1024 || bytes.toString('base64') !== match[2])
    return fail();
  const valid =
    match[1] === 'jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : match[1] === 'png'
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.subarray(0, 4).toString() === 'RIFF' &&
          bytes.subarray(8, 12).toString() === 'WEBP';
  if (!valid) return fail();
  return value;
}
