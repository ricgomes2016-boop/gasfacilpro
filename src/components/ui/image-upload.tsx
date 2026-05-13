import { useState, useRef } from "react";
import { Upload, X, Loader2, ImageIcon, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  className?: string;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  bucket = "product-images",
  folder = "products",
  className,
  disabled = false,
}: ImageUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Use imagens JPG, PNG, WebP ou GIF.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
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
                Clique para enviar
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
