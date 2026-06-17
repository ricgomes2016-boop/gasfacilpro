import { useState, useRef } from "react";
import { Upload, X, Loader2, ImageIcon, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SignedImage } from "@/components/ui/signed-image";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  className?: string;
  disabled?: boolean;
  allowCamera?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  bucket = "product-images",
  folder = "products",
  className,
  disabled = false,
  allowCamera = false,
}: ImageUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth = 1600, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas indisponível"));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao comprimir"))),
            "image/jpeg",
            quality
          );
        };
        img.onerror = () => reject(new Error("Imagem inválida"));
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (allow generic image/* from camera capture)
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Always compress to JPEG to avoid huge camera files & HEIC issues
      let uploadBlob: Blob = file;
      let ext = "jpg";
      try {
        uploadBlob = await compressImage(file);
      } catch (err) {
        console.warn("Compressão falhou, enviando original:", err);
        ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      }

      if (uploadBlob.size > 10 * 1024 * 1024) {
        throw new Error("Imagem muito grande mesmo após compressão (máx 10MB).");
      }

      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, uploadBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onChange(urlData.publicUrl);
      
      toast({
        title: "Imagem enviada!",
        description: "A imagem foi carregada com sucesso.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!value) return;

    try {
      // Extract file path from URL
      const url = new URL(value);
      const pathParts = url.pathname.split("/storage/v1/object/public/");
      if (pathParts.length > 1) {
        const [bucketName, ...fileParts] = pathParts[1].split("/");
        const filePath = fileParts.join("/");
        
        await supabase.storage.from(bucketName).remove([filePath]);
      }
    } catch (error) {
      console.error("Error removing file:", error);
    }

    onChange(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      {allowCamera && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
      )}

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Preview"
            className="h-32 w-32 object-cover rounded-lg border border-border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleRemove}
            disabled={disabled || isUploading}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
            className={cn(
              "flex flex-col items-center justify-center h-32 w-32 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors",
              "bg-muted/50 hover:bg-muted cursor-pointer",
              (disabled || isUploading) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground text-center px-2">
                  Enviar arquivo
                </span>
              </>
            )}
          </button>
          {allowCamera && (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={disabled || isUploading}
              className={cn(
                "flex flex-col items-center justify-center h-32 w-32 rounded-lg border-2 border-dashed border-primary/40 hover:border-primary transition-colors",
                "bg-primary/5 hover:bg-primary/10 cursor-pointer",
                (disabled || isUploading) && "opacity-50 cursor-not-allowed"
              )}
            >
              <Camera className="h-8 w-8 text-primary mb-2" />
              <span className="text-xs text-primary text-center px-2 font-medium">
                Tirar foto
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
