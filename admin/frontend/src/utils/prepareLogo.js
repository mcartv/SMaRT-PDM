// Remove only a uniform background connected to the image edges, preserving
// enclosed details (including white lettering) inside the logo.
export function clearLogoBackground(image) {
  const { data, width, height } = image;
  const corners = [0, width - 1, (height - 1) * width, width * height - 1];
  const solid = corners.filter(p => data[p * 4 + 3] > 240);
  if (solid.length !== 4) return image;
  const color = [0, 1, 2].map(c => solid.reduce((sum, p) => sum + data[p * 4 + c], 0) / 4);
  const matches = p => [0, 1, 2].every(c => Math.abs(data[p * 4 + c] - color[c]) <= 24);
  if (!corners.every(matches)) return image;
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  function visit(p) {
    if (!seen[p] && matches(p)) { seen[p] = 1; queue[tail++] = p; }
  }
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const p = queue[head++]; data[p * 4 + 3] = 0;
    if (p % width) visit(p - 1);
    if (p % width < width - 1) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p < width * (height - 1)) visit(p + width);
  }
  return image;
}

export async function prepareLogo(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = clearLogoBackground(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(pixels, 0, 0);
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels.data[(y * canvas.width + x) * 4 + 3] > 16) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (right < left) throw Error('The image is blank. Choose a logo with visible details.');
    const output = document.createElement('canvas');
    output.width = right - left + 1; output.height = bottom - top + 1;
    output.getContext('2d').drawImage(canvas, left, top, output.width, output.height, 0, 0, output.width, output.height);
    const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
    if (!blob) throw Error('Unable to process this image. Try another file.');
    return new File([blob], 'logo.png', { type: 'image/png' });
  } finally { bitmap.close(); }
}
