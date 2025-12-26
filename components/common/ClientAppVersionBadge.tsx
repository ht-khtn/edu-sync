"use client";

import dynamic from "next/dynamic";

const AppVersionBadge = dynamic(
    () => import("@/components/common/AppVersionBadge"),
    { ssr: false }
);

export default function ClientAppVersionBadge() {
    return <AppVersionBadge />;
}
