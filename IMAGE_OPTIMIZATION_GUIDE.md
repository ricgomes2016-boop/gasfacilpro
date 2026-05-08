# Guia de Otimização de Imagens - GasFácil

## 1. Formatos de Imagem

### WebP (Recomendado)
- **Tamanho:** 25-35% menor que JPEG
- **Qualidade:** Excelente
- **Suporte:** 95% dos navegadores modernos
- **Fallback:** JPEG para navegadores antigos

```html
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <source srcSet="image.jpg" type="image/jpeg" />
  <img src="image.jpg" alt="..." loading="lazy" />
</picture>
```

### JPEG
- **Uso:** Fotos e imagens complexas
- **Qualidade:** 80-85 é um bom balanço

### PNG
- **Uso:** Ícones, logos, imagens com transparência
- **Tamanho:** Maior que JPEG/WebP
- **Vantagem:** Transparência perfeita

### SVG
- **Uso:** Ícones, logos, gráficos
- **Vantagem:** Escalável, pequeno tamanho
- **Desvantagem:** Não ideal para fotos

## 2. Compressão de Imagens

### Ferramentas Online
- [TinyPNG](https://tinypng.com/) - Compressão com perda
- [Squoosh](https://squoosh.app/) - Comparação de formatos
- [ImageOptim](https://imageoptim.com/) - macOS

### Ferramentas CLI
```bash
# ImageMagick
convert image.jpg -quality 85 image-optimized.jpg
convert image.jpg -define webp:method=6 image.webp

# ImageMagick - Batch
mogrify -quality 85 -format jpg *.jpg
mogrify -define webp:method=6 -format webp *.jpg

# FFmpeg
ffmpeg -i image.jpg -c:v libwebp -quality 85 image.webp

# Node.js - Sharp
npm install sharp
```

### Script Node.js com Sharp
```javascript
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function optimizeImages(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    if (!/\.(jpg|jpeg|png)$/i.test(file)) continue;
    
    const inputPath = path.join(dir, file);
    const outputPath = path.join(dir, file.replace(/\.\w+$/, '.webp'));
    
    try {
      await sharp(inputPath)
        .webp({ quality: 85 })
        .toFile(outputPath);
      console.log(`✓ ${file} → ${path.basename(outputPath)}`);
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`);
    }
  }
}

optimizeImages('./public/images');
```

## 3. Lazy Loading

### HTML Nativo
```html
<!-- Carrega apenas quando próximo da viewport -->
<img src="image.jpg" alt="..." loading="lazy" />
```

### React com Intersection Observer
```typescript
import { useEffect, useRef, useState } from 'react';

function LazyImage({ src, alt }: { src: string; alt: string }) {
  const [imageSrc, setImageSrc] = useState<string>();
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver;

    if (imageRef && imageSrc === undefined) {
      observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setImageSrc(src);
              observer.unobserve(imageRef);
            }
          });
        },
        { rootMargin: '50px' }
      );
      observer.observe(imageRef);
    }

    return () => observer?.disconnect();
  }, [imageRef, imageSrc, src]);

  return (
    <img
      ref={setImageRef}
      src={imageSrc}
      alt={alt}
      loading="lazy"
    />
  );
}
```

## 4. Responsive Images

### Srcset para Diferentes Resoluções
```html
<img
  srcSet="
    image-320w.jpg 320w,
    image-640w.jpg 640w,
    image-1280w.jpg 1280w
  "
  sizes="(max-width: 640px) 100vw, 50vw"
  src="image-640w.jpg"
  alt="..."
/>
```

### Picture para Diferentes Formatos
```html
<picture>
  <source media="(min-width: 1024px)" srcSet="image-large.webp" type="image/webp" />
  <source media="(min-width: 1024px)" srcSet="image-large.jpg" type="image/jpeg" />
  <source srcSet="image-small.webp" type="image/webp" />
  <img src="image-small.jpg" alt="..." loading="lazy" />
</picture>
```

## 5. Otimizações Avançadas

### Image CDN (Cloudinary, Imgix)
```html
<!-- Cloudinary -->
<img
  src="https://res.cloudinary.com/demo/image/fetch/w_300,h_300,c_fill/https://example.com/image.jpg"
  alt="..."
/>
```

### Next.js Image Component (se usar Next.js)
```typescript
import Image from 'next/image';

export default function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero"
      width={1200}
      height={600}
      priority
      quality={85}
    />
  );
}
```

### Vite Image Plugin
```bash
npm install vite-plugin-image-optimization
```

```typescript
// vite.config.ts
import imageOptimization from 'vite-plugin-image-optimization';

export default {
  plugins: [imageOptimization()],
};
```

## 6. Checklist de Otimização

- [ ] Converter imagens para WebP com fallback
- [ ] Comprimir imagens (85% qualidade)
- [ ] Implementar lazy loading
- [ ] Usar srcset para responsive images
- [ ] Remover metadados EXIF
- [ ] Usar SVG para ícones
- [ ] Implementar image CDN se necessário
- [ ] Testar com Lighthouse
- [ ] Monitorar Core Web Vitals

## 7. Tamanhos Recomendados

| Tipo | Tamanho Máximo | Qualidade |
|------|----------------|-----------|
| Thumbnail | 50KB | 70% |
| Card | 100KB | 80% |
| Hero | 200KB | 85% |
| Full-width | 300KB | 85% |
| Icon (SVG) | 5KB | N/A |

## 8. Ferramentas de Teste

```bash
# Lighthouse
npm install -g lighthouse
lighthouse https://seu-site.com

# WebPageTest
# Acesse: https://www.webpagetest.org/

# Google PageSpeed Insights
# Acesse: https://pagespeed.web.dev/
```

---

**Última atualização:** 8 de Maio de 2026
