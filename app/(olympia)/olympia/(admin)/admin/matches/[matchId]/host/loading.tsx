export default function HostConsoleLoading() {
  // Tắt skeleton: khi router.refresh()/navigation, host page rất hay bị "nháy" skeleton gây khó chịu.
  // Giữ fallback tối giản để không làm trống trang hoàn toàn.
  return <div className="text-sm text-muted-foreground">Đang tải…</div>
}
