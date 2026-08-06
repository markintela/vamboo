export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const THUMB_SIZE = 480;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Recorta a área escolhida pelo usuário e redimensiona pra um thumb
// quadrado fixo — mantém o tamanho do arquivo enviado previsível
// (poucas dezenas de KB) independente do tamanho da foto original.
export async function getCroppedImageBlob(imageSrc: string, area: CropArea): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas não suportado neste navegador.');
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, THUMB_SIZE, THUMB_SIZE);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))), 'image/jpeg', 0.85);
  });
}
