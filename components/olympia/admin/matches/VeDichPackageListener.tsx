'use client'



/**
 * Client-side wrapper that listens for 'olympia:package-confirmed' event
 * 
 * Lưu ý: trước đây có gọi router.refresh() khiến UX giống như reload trang
 * và làm mất state UI (đặc biệt ở vòng Về đích). Hiện tại không refresh nữa;
 * component chốt gói sẽ tự khóa UI sau khi thành công.
 */
export function VeDichPackageListener() {
    return null
}
