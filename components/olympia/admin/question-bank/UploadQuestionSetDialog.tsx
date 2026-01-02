'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadQuestionSetAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'
import getSupabase from '@/lib/supabase'
import { extractRequiredAssetBasenames, parseQuestionSetWorkbook } from '@/lib/olympia/question-set-workbook'

const initialState: ActionState = { error: null, success: null }

type AssetManifestEntry = { name: string; path: string; publicUrl: string }

export function UploadQuestionSetDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(uploadQuestionSetAction, initialState)

  const [xlsxFile, setXlsxFile] = useState<File | null>(null)
  const [assetFolderFiles, setAssetFolderFiles] = useState<File[]>([])
  const [assetManifest, setAssetManifest] = useState<Record<string, AssetManifestEntry>>({})
  const [requiredAssets, setRequiredAssets] = useState<string[]>([])
  const [missingAssets, setMissingAssets] = useState<string[]>([])
  const [isUploadingAssets, setIsUploadingAssets] = useState(false)
  const [assetUploadError, setAssetUploadError] = useState<string | null>(null)

  const assetCountLabel = useMemo(() => {
    const count = Object.keys(assetManifest).length
    if (count === 0) return 'Chưa tải tài nguyên.'
    return `Đã tải ${count} file lên Supabase.`
  }, [assetManifest])

  const assetManifestForSubmit = useMemo(() => {
    const requiredLower = new Set(requiredAssets.map((n) => n.toLowerCase()))
    if (requiredLower.size === 0) return {}
    const filtered: Record<string, AssetManifestEntry> = {}
    for (const [key, value] of Object.entries(assetManifest)) {
      if (requiredLower.has(key)) filtered[key] = value
    }
    return filtered
  }, [assetManifest, requiredAssets])

  const hasMessage = state.error || state.success

  const handleOpenChange = (value: boolean) => {
    if (hasMessage && state.success) {
      setOpen(false)
    } else {
      setOpen(value)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!xlsxFile) {
        setRequiredAssets([])
        return
      }
      try {
        const buf = await xlsxFile.arrayBuffer()
        const { items } = await parseQuestionSetWorkbook(buf)
        const required = extractRequiredAssetBasenames(items)
        if (!cancelled) setRequiredAssets(required)
      } catch (err) {
        if (!cancelled) {
          setRequiredAssets([])
          setAssetUploadError(err instanceof Error ? err.message : 'Không thể đọc file .xlsx để kiểm tra tài nguyên.')
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [xlsxFile])

  useEffect(() => {
    const requiredLower = new Set(requiredAssets.map((n) => n.toLowerCase()))
    if (requiredLower.size === 0) {
      setMissingAssets([])
      return
    }
    const availableLower = new Set(Object.keys(assetManifest))
    const missing = Array.from(requiredLower).filter((name) => !availableLower.has(name))
    setMissingAssets(missing)
  }, [requiredAssets, assetManifest])

  async function handleXlsxChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAssetUploadError(null)
    const file = e.target.files?.[0] ?? null
    setXlsxFile(file)
  }

  async function handleAssetFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAssetUploadError(null)
    const files = Array.from(e.target.files ?? [])
    setAssetFolderFiles(files)
    setAssetManifest({})

    if (files.length === 0) return

    setIsUploadingAssets(true)
    try {
      const supabase = await getSupabase()
      const bucket = 'olympia-assets'
      const batchId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now())

      const manifest: Record<string, AssetManifestEntry> = {}
      for (const file of files) {
        const safeName = file.name.replace(/[/\\]/g, '_')
        const path = `question-sets/${batchId}/${safeName}`

        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          upsert: true,
          contentType: file.type || undefined,
        })
        if (error) {
          throw new Error(`Upload thất bại: ${file.name} (${error.message})`)
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        const key = file.name.toLowerCase()
        manifest[key] = { name: file.name, path, publicUrl: data.publicUrl }
      }

      setAssetManifest(manifest)
    } catch (err) {
      setAssetUploadError(err instanceof Error ? err.message : 'Không thể tải thư mục tài nguyên.')
    } finally {
      setIsUploadingAssets(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">Tạo bộ đề (.xlsx)</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tải bộ đề từ Excel</DialogTitle>
          <DialogDescription>
            File .xlsx không có hàng tiêu đề, thứ tự cột: CODE · LĨNH VỰC/VỊ TRÍ · CÂU HỎI · ĐÁP ÁN · GHI CHÚ · NGƯỜI GỬI · NGUỒN · LINK ẢNH/VIDEO · LINK ÂM THANH.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên bộ đề</Label>
            <Input id="name" name="name" placeholder="Ví dụ: Tuần 05 - Bảng A" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File .xlsx</Label>
            <Input id="file" name="file" type="file" accept=".xlsx" required onChange={handleXlsxChange} />
            <p className="text-xs text-muted-foreground">
              Mỗi hàng tương ứng 1 câu hỏi, để trống ô nếu không có dữ liệu. Hệ thống sẽ bỏ qua dòng thiếu CODE, CÂU HỎI hoặc ĐÁP ÁN.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assets">Tải nguyên (thư mục)</Label>
            <Input
              id="assets"
              name="assets"
              type="file"
              multiple
              onChange={handleAssetFolderChange}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({ webkitdirectory: 'true', directory: 'true' } as any)}
            />
            <p className="text-xs text-muted-foreground">
              Chọn 1 thư mục chứa các file xuất hiện trong cột LINK ẢNH/VIDEO và LINK ÂM THANH (nếu dư file thì không sao).
            </p>
            <p className={cn('text-xs', isUploadingAssets ? 'text-muted-foreground' : 'text-muted-foreground')}>
              {isUploadingAssets ? `Đang tải ${assetFolderFiles.length} file lên Supabase...` : assetCountLabel}
            </p>
            {assetUploadError ? <p className="text-xs text-destructive">{assetUploadError}</p> : null}
            {requiredAssets.length > 0 ? (
              <p className="text-xs text-muted-foreground">Cần {requiredAssets.length} tài nguyên theo file .xlsx.</p>
            ) : null}
            {missingAssets.length > 0 ? (
              <p className="text-xs text-destructive">
                Thiếu {missingAssets.length} file: {missingAssets.slice(0, 8).join(', ')}
                {missingAssets.length > 8 ? '…' : ''}
              </p>
            ) : null}
          </div>

          <input type="hidden" name="assetManifest" value={JSON.stringify(assetManifestForSubmit)} />

          {hasMessage ? (
            <p className={cn('text-sm', state.error ? 'text-destructive' : 'text-green-600')}>
              {state.error ?? state.success}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={isUploadingAssets || missingAssets.length > 0}>
              Tải lên
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
