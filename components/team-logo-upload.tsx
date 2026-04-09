"use client"

import { useState, useRef, useCallback } from "react"
import Image from "next/image"
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Upload, X, ImageIcon, Loader2, Crop as CropIcon, ZoomIn } from "lucide-react"

interface TeamLogoUploadProps {
  teamId?: string
  currentLogoUrl?: string | null
  onUploadComplete: (url: string | null) => void
  size?: "sm" | "md" | "lg"
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const OUTPUT_SIZE = 400               // final square px written to storage

const sizeMap = {
  sm: 48,
  md: 80,
  lg: 96,
}

// Draw the cropped area onto a canvas and return a Blob
function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  outputSize: number
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext("2d")!

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    outputSize,
    outputSize
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas empty"))),
      "image/webp",
      0.92
    )
  })
}

function centeredSquareCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, 1, width, height),
    width,
    height
  )
}

export function TeamLogoUpload({
  teamId,
  currentLogoUrl,
  onUploadComplete,
  size = "md",
}: TeamLogoUploadProps) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [preview, setPreview] = useState<string | null>(currentLogoUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [rawSrc, setRawSrc] = useState<string>("")
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [rawFile, setRawFile] = useState<File | null>(null)

  const previewSize = sizeMap[size]

  // ── Step 1: user picks a file → validate → open crop modal ──────────────
  const handleFileChange = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file", description: "Only JPG, PNG, and WebP are allowed.", variant: "destructive" })
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Max size is 2 MB.", variant: "destructive" })
      return
    }
    setRawFile(file)
    const objectUrl = URL.createObjectURL(file)
    setRawSrc(objectUrl)
    setCrop(undefined)
    setCompletedCrop(undefined)
    setCropModalOpen(true)
  }

  // When the crop image loads, default to a centered square selection
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centeredSquareCrop(width, height))
  }, [])

  // ── Step 2: user confirms crop → crop → upload ───────────────────────────
  const handleConfirmCrop = async () => {
    if (!imgRef.current || !completedCrop || !rawFile) return
    setUploading(true)

    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop, OUTPUT_SIZE)
      const supabase = createClient()
      const path = teamId ? `${teamId}/logo.webp` : `temp/${Date.now()}.webp`

      const { error: uploadError } = await supabase.storage
        .from("team-logos")
        .upload(path, blob, { upsert: true, contentType: "image/webp" })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from("team-logos")
        .getPublicUrl(path)

      const bustedUrl = `${publicUrl}?t=${Date.now()}`
      setPreview(bustedUrl)
      onUploadComplete(bustedUrl)
      setCropModalOpen(false)
      toast({ title: "Logo uploaded", description: "Your team logo has been saved." })
    } catch (err) {
      console.error(err)
      toast({ title: "Upload failed", description: "Could not upload the logo. Please try again.", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  // ── Remove ───────────────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!teamId || !preview) {
      setPreview(null)
      onUploadComplete(null)
      return
    }
    setRemoving(true)
    try {
      const supabase = createClient()
      const { data: files } = await supabase.storage.from("team-logos").list(teamId)
      if (files?.length) {
        await supabase.storage.from("team-logos").remove(files.map((f) => `${teamId}/${f.name}`))
      }
      setPreview(null)
      onUploadComplete(null)
      toast({ title: "Logo removed" })
    } catch {
      toast({ title: "Error", description: "Could not remove logo.", variant: "destructive" })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      {/* ── Inline control ── */}
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div
          className="relative shrink-0 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center"
          style={{ width: previewSize, height: previewSize }}
        >
          {preview ? (
            <Image src={preview} alt="Team logo" fill className="object-cover" unoptimized />
          ) : (
            <ImageIcon className="h-6 w-6 text-gray-300" />
          )}
        </div>

        {/* Buttons + hint */}
        <div className="flex flex-col gap-2 justify-center flex-1 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileChange(file)
              e.target.value = ""
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || removing}
              onClick={() => inputRef.current?.click()}
              className="bg-transparent cursor-pointer"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {preview ? "Change Logo" : "Upload Logo"}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || removing}
                onClick={handleRemove}
                className="text-destructive border-destructive/30 hover:bg-destructive/10 bg-transparent cursor-pointer"
              >
                {removing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><X className="mr-1 h-3.5 w-3.5" />Remove</>
                }
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            JPG, PNG or WebP · Max 2 MB · You can crop before uploading
          </p>
        </div>
      </div>

      {/* ── Crop modal ── */}
      <Dialog open={cropModalOpen} onOpenChange={(open) => { if (!open && !uploading) setCropModalOpen(false) }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="h-4 w-4" /> Crop Your Logo
            </DialogTitle>
            <DialogDescription>
              Drag the square to select the area you want. The logo will always be saved as a square.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center my-2 rounded-xl overflow-hidden bg-gray-950 p-2">
            {rawSrc && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop={false}
                minWidth={60}
                minHeight={60}
                keepSelection
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={rawSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{ maxHeight: "60vh", maxWidth: "100%", display: "block" }}
                />
              </ReactCrop>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            <ZoomIn className="inline h-3 w-3 mr-1" />
            Tip: drag a corner to resize the selection
          </p>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              className="bg-transparent cursor-pointer"
              disabled={uploading}
              onClick={() => setCropModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={uploading || !completedCrop}
              onClick={handleConfirmCrop}
              className="bg-[#EE0505] hover:bg-red-700 cursor-pointer"
            >
              {uploading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
                : <><Upload className="mr-2 h-4 w-4" />Upload Logo</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
