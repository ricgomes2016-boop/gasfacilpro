import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Extracts { bucket, path } from a Supabase Storage URL
 * (public, sign or authenticated form). Returns null if it
 * doesn't look like a Supabase storage URL.
 */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    const marker = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!marker) return null;
    return { bucket: decodeURIComponent(marker[1]), path: decodeURIComponent(marker[2].split("?")[0]) };
  } catch {
    return null;
  }
}

const cache = new Map<string, { url: string; exp: number }>();

export async function resolveSignedUrl(value: string, fallbackBucket?: string): Promise<string> {
  if (!value) return value;
  const parsed = parseStorageUrl(value);
  const bucket = parsed?.bucket || fallbackBucket;
  const path = parsed?.path || (fallbackBucket ? value : null);
  if (!bucket || !path) return value;

  const key = `${bucket}/${path}`;
  const cached = cache.get(key);
  if (cached && cached.exp > Date.now()) return cached.url;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return value;
  cache.set(key, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

interface SignedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  value: string | null | undefined;
  bucket?: string;
}

export function SignedImage({ value, bucket, ...imgProps }: SignedImageProps) {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (!value) {
      setSrc(undefined);
      return;
    }
    resolveSignedUrl(value, bucket).then((u) => { if (alive) setSrc(u); });
    return () => { alive = false; };
  }, [value, bucket]);

  if (!src) return null;
  return <img src={src} {...imgProps} />;
}
