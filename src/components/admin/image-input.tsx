"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Campo de foto com pré-visualização. Envia o arquivo junto do formulário (otimizado no servidor). */
export function ImageInput({ name, current, label, removable = true, aspect = "aspect-[3/4]", className }: { name: string; current: string | null; label: string; removable?: boolean; aspect?: string; className?: string }) {
  const [preview, setPreview] = useState<string | null>(current);
  const [removed, setRemoved] = useState(false);
  const id = `img-${name}`;
  return (
    <div className={className}>
      <span className="text-[0.85rem] font-medium text-graphite">{label}</span>
      <label
        htmlFor={id}
        className={cn(
          "group relative mt-1.5 flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-input bg-card text-sm text-muted-foreground transition-colors hover:border-teal focus-within:ring-3 focus-within:ring-ring/40",
          aspect,
        )}
      >
        {preview ? (
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 p-4 text-center"><ImagePlus className="size-6 text-teal" /> Clique para enviar<br /><span className="text-xs">JPG, PNG, WebP · até 8 MB</span></span>
        )}
        {preview && <span className="absolute inset-x-0 bottom-0 bg-black/45 py-2 text-center text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">Trocar foto</span>}
        <input
          id={id}
          name={name}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setPreview(URL.createObjectURL(f));
              setRemoved(false);
            }
          }}
        />
      </label>
      {removable && preview && (
        <button type="button" onClick={() => { setPreview(null); setRemoved(true); }} className="mt-2 flex items-center gap-1 text-xs text-merlot hover:underline">
          <Trash2 className="size-3.5" /> Remover foto
        </button>
      )}
      {removed && <input type="hidden" name={`remove_${name}`} value="1" />}
    </div>
  );
}
