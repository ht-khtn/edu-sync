import type { SupabaseClient } from "@supabase/supabase-js";
import type { Criteria, Student } from "@/lib/violations";

// Clean types
export type ViolationHistorySearchParams = {
    classId?: string;
    studentId?: string;
    criteriaId?: string;
    start?: string;
    end?: string;
};

export type ClassOption = {
    id: string;
    name: string;
};

export type StudentOption = {
    id: string;
    name: string;
};

export type CriteriaOption = {
    id: string;
    name: string;
};

export type ViolationRecord = {
    id: string;
    created_at: string;
    class_id: string | null;
    score: number | null;
    note: string | null;
    classes:
    | { id: string; name: string | null }
    | { id: string; name: string | null }[]
    | null;
    criteria:
    | { id: string | number; name: string | null }
    | { id: string | number; name: string | null }[]
    | null;
    users:
    | {
        user_profiles:
        | { full_name: string | null }[]
        | { full_name: string | null }
        | null;
        user_name: string | null;
    }
    | {
        user_profiles:
        | { full_name: string | null }[]
        | { full_name: string | null }
        | null;
        user_name: string | null;
    }[]
    | null;
};

export type ViolationHistoryData = {
    filteredClasses: ClassOption[];
    students: StudentOption[];
    criteria: CriteriaOption[];
    records: ViolationRecord[] | null;
    recordsError: Error | null;
};

// Helper functions
function filterClassesByAllowedIds(
    classes: { id: string; name: string | null }[] | null,
    allowedViewClassIds: Set<string> | null
): ClassOption[] {
    if (!classes) return [];

    const filtered = allowedViewClassIds
        ? classes.filter((c) => allowedViewClassIds.has(c.id))
        : classes;

    return filtered.map((c) => ({
        id: c.id,
        name: c.name || c.id,
    }));
}

function mapStudentsToOptions(students: Student[]): StudentOption[] {
    return students.map((s) => ({
        id: s.id,
        name: s.full_name || s.user_name || s.id.slice(0, 8),
    }));
}

function mapCriteriaToOptions(criteriaList: Criteria[]): CriteriaOption[] {
    return criteriaList.map((c) => ({
        id: c.id,
        name: c.name,
    }));
}

function buildRecordsQuery(
    supabase: SupabaseClient,
    searchParams: ViolationHistorySearchParams | undefined,
    allowedViewClassIds: Set<string> | null
) {
    let query = supabase
        .from("records")
        .select(
            "id, created_at, student_id, class_id, score, note, classes(id,name), criteria(id,name), users:student_id(user_profiles(full_name), user_name)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);

    if (allowedViewClassIds) {
        query = query.in("class_id", Array.from(allowedViewClassIds));
    }
    if (searchParams?.classId) {
        query = query.eq("class_id", searchParams.classId);
    }
    if (searchParams?.studentId) {
        query = query.eq("student_id", searchParams.studentId);
    }
    if (searchParams?.criteriaId) {
        query = query.eq("criteria_id", searchParams.criteriaId);
    }
    if (searchParams?.start) {
        const startDate = new Date(searchParams.start);
        if (!isNaN(startDate.getTime())) {
            query = query.gte("created_at", startDate.toISOString());
        }
    }
    if (searchParams?.end) {
        const endDate = new Date(searchParams.end);
        if (!isNaN(endDate.getTime())) {
            // Add 1 day 23:59 buffer inclusive
            endDate.setHours(23, 59, 59, 999);
            query = query.lte("created_at", endDate.toISOString());
        }
    }

    return query;
}

export function formatRecordDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
    });
}

export function getRecordClassName(record: ViolationRecord): string {
    const classEntry = Array.isArray(record.classes)
        ? record.classes[0]
        : record.classes;
    return classEntry?.name || record.class_id || "—";
}

export function getRecordStudentName(record: ViolationRecord): string {
    const userEntry = Array.isArray(record.users)
        ? record.users[0]
        : record.users;
    const profileEntry = Array.isArray(userEntry?.user_profiles)
        ? userEntry?.user_profiles[0]
        : userEntry?.user_profiles;
    return profileEntry?.full_name || userEntry?.user_name || "—";
}

export function getRecordCriteriaName(record: ViolationRecord): string {
    const criteriaEntry = Array.isArray(record.criteria)
        ? record.criteria[0]
        : record.criteria;
    return (
        criteriaEntry?.name ||
        (criteriaEntry?.id ? `#${String(criteriaEntry.id).slice(0, 8)}` : "—")
    );
}

// Main data fetching function
export async function fetchViolationHistoryData(
    supabase: SupabaseClient,
    searchParams: ViolationHistorySearchParams | undefined,
    allowedViewClassIds: Set<string> | null,
    classes: { id: string; name: string | null }[] | null,
    students: Student[],
    criteriaList: Criteria[]
): Promise<ViolationHistoryData> {
    // Filter classes by allowed set
    const filteredClasses = filterClassesByAllowedIds(classes, allowedViewClassIds);

    // Map students and criteria to options
    const studentOptions = mapStudentsToOptions(students);
    const criteriaOptions = mapCriteriaToOptions(criteriaList);

    // Build and execute records query
    const query = buildRecordsQuery(supabase, searchParams, allowedViewClassIds);
    const { data: rows, error: rowsErr } = await query;

    return {
        filteredClasses,
        students: studentOptions,
        criteria: criteriaOptions,
        records: (rows as ViolationRecord[]) || null,
        recordsError: rowsErr ? new Error(rowsErr.message || String(rowsErr)) : null,
    };
}
