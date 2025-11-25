import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

type StudentRow = {
	STT: string;
	'Họ và tên': string;
	'Ngày sinh': string;
	'Khối': string;
	'Lớp': string;
};

const GRADE_YEAR_MAP: Record<string, string> = {
	'10': '2528',
	'11': '2427',
	'12': '2326',
};

const CLASS_COUNT: Record<string, number> = {
	'10': 10,
	'11': 11,
	'12': 10,
};

const DEFAULT_PASSWORD = '123';
const CSV_RELATIVE_PATH = path.resolve(process.cwd(), '.specific', 'dshs.csv');
const ENV_PRIORITY = ['.env', '.env.local'];

for (const envFile of ENV_PRIORITY) {
	const envPath = path.resolve(process.cwd(), envFile);
	if (fs.existsSync(envPath)) {
		dotenv.config({ path: envPath, override: true });
	}
}

type PublicUser = {
	id: string;
	auth_uid: string;
	class_id: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureEnv(key: string, fallbackKeys: string[] = []): string {
	const candidates = [key, ...fallbackKeys];
	for (const candidate of candidates) {
		const value = process.env[candidate];
		if (value) {
			return value;
		}
	}
	const display = candidates.join(' or ');
	throw new Error(`Missing required environment variable: ${display}`);
}

function normalizeNameTokens(fullName: string): string[] {
	if (!fullName) return [];
	const cleaned = fullName
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return cleaned ? cleaned.split(' ') : [];
}

function normalizeClassName(classCode: string): string {
	return classCode.replace(/\s+/g, '').toUpperCase();
}

function buildEmailAndUsername(fullName: string, classCode: string, gradeLabel: string) {
	const tokens = normalizeNameTokens(fullName);
	if (!tokens.length) {
		throw new Error(`Không thể phân tích tên: "${fullName}".`);
	}

	const yearCode = GRADE_YEAR_MAP[gradeLabel];
	if (!yearCode) {
		throw new Error(`Không tìm thấy niên khóa cho khối ${gradeLabel}.`);
	}

	const lastToken = tokens[tokens.length - 1];
	const initials = tokens
		.slice(0, -1)
		.map((token) => token[0])
		.join('');
	const namePart = `${initials}${lastToken}`;
	const suffix = classCode.replace(/^\d+/, '').toLowerCase();

	if (!suffix) {
		throw new Error(`Không thể lấy mã lớp từ "${classCode}".`);
	}

	const username = `${namePart}${suffix}${yearCode}`;
	return {
		username,
		email: `${username}@edusync.edu.vn`,
	};
}

function parseDateVn(value: string): string | null {
	if (!value) return null;
	const parts = value.split(/[\/\-]/).map((part) => part.trim());
	if (parts.length !== 3) return null;
	const [dayStr, monthStr, yearStr] = parts;
	const day = Number(dayStr);
	const month = Number(monthStr);
	const year = Number(yearStr.length === 2 ? `20${yearStr}` : yearStr);
	if (!day || !month || !year) return null;

	const date = new Date(Date.UTC(year, month - 1, day));
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

function extractGradeNumber(khoi: string): string | null {
	if (!khoi) return null;
	const match = khoi.match(/\d+/);
	return match ? match[0] : null;
}

async function ensureGrades(client: SupabaseClient, gradeNames: string[]) {
	const { data, error } = await client
		.from('grades')
		.select('id, name')
		.in('name', gradeNames);

	if (error) {
		throw error;
	}

	const existing = data ?? [];
	const missing = gradeNames.filter((grade) => !existing.some((row) => row.name === grade));

	if (missing.length) {
		const { error: insertError } = await client.from('grades').insert(missing.map((name) => ({ name })));
		if (insertError) {
			throw insertError;
		}
	}

	const { data: refreshed, error: refreshError } = await client
		.from('grades')
		.select('id, name')
		.in('name', gradeNames);

	if (refreshError || !refreshed) {
		throw refreshError ?? new Error('Không thể lấy danh sách khối.');
	}

	return new Map(refreshed.map((row) => [row.name, row.id as string]));
}

async function ensureClasses(client: SupabaseClient, gradeMap: Map<string, string>) {
	const classPayload: { name: string; grade_id: string }[] = [];

	for (const [gradeName, totalClasses] of Object.entries(CLASS_COUNT)) {
		const gradeId = gradeMap.get(gradeName);
		if (!gradeId) {
			throw new Error(`Không tìm thấy grade_id cho khối ${gradeName}.`);
		}

		for (let i = 1; i <= totalClasses; i += 1) {
			classPayload.push({ name: `${gradeName}A${i}`, grade_id: gradeId });
		}
	}

	const { error: upsertError } = await client
		.from('classes')
		.upsert(classPayload, { onConflict: 'name' });

	if (upsertError) {
		throw upsertError;
	}

	const { data, error } = await client
		.from('classes')
		.select('id, name')
		.in(
			'name',
			classPayload.map((row) => row.name),
		);

	if (error || !data) {
		throw error ?? new Error('Không thể lấy danh sách lớp.');
	}

	const classMap = new Map<string, string>();
	data.forEach((row) => {
		classMap.set(row.name.toUpperCase(), row.id as string);
	});
	return classMap;
}

async function ensureAuthUser(
	client: SupabaseClient,
	email: string,
	password: string,
	metadata: Record<string, unknown>,
): Promise<{ authUid: string; created: boolean }> {
	const { data, error } = await client.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: metadata,
	});

	if (data?.user) {
		return { authUid: data.user.id, created: true };
	}

	if (error) {
		const isConflict = error.message?.toLowerCase().includes('already registered');
		if (isConflict) {
			const { data: existingUser, error: lookupError } = await client
				.from('users')
				.select('auth_uid')
				.eq('email', email)
				.maybeSingle();

			if (lookupError && lookupError.code !== 'PGRST116') {
				throw lookupError;
			}

			if (existingUser?.auth_uid) {
				return { authUid: existingUser.auth_uid as string, created: false };
			}

			const { data: listData, error: listError } = await client.auth.admin.listUsers();
			if (listError) {
				throw listError;
			}

			const match = listData?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
			if (match) {
				return { authUid: match.id, created: false };
			}
		}
		throw error;
	}

	throw new Error('Không thể tạo hoặc tìm auth user.');
}

async function waitForPublicUserByAuthUid(
	client: SupabaseClient,
	authUid: string,
	attempts = 30,
	delayMs = 500,
): Promise<PublicUser | null> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		const { data, error } = await client
			.from('users')
			.select('id, auth_uid, class_id')
			.eq('auth_uid', authUid)
			.maybeSingle();

		if (error && error.code !== 'PGRST116') {
			console.warn('Lỗi khi đợi public.users:', error.message);
		}

		if (data) {
			return data as PublicUser;
		}

		await sleep(delayMs);
	}

	return null;
}

async function updateUserAndProfile(
	client: SupabaseClient,
	publicUser: PublicUser,
	classId: string,
	fullName: string,
	username: string,
	email: string,
	birthDate: string | null,
) {
	const { error: userError } = await client
		.from('users')
		.update({ class_id: classId, user_name: username, email })
		.eq('id', publicUser.id);

	if (userError) {
		throw userError;
	}

	const profilePayload: Record<string, unknown> = {
		user_id: publicUser.id,
		full_name: fullName,
		updated_at: new Date().toISOString(),
	};

	if (birthDate) {
		profilePayload.date_of_birth = birthDate;
	}

	const { error: profileError } = await client
		.from('user_profiles')
		.upsert(profilePayload, { onConflict: 'user_id' });

	if (profileError) {
		throw profileError;
	}
}

function loadStudentRows(): StudentRow[] {
	if (!fs.existsSync(CSV_RELATIVE_PATH)) {
		throw new Error(`Không tìm thấy file CSV tại ${CSV_RELATIVE_PATH}`);
	}

	const csvContent = fs.readFileSync(CSV_RELATIVE_PATH, 'utf8');
	return parse(csvContent, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as StudentRow[];
}

async function main() {
	const supabaseUrl = ensureEnv('SUPABASE_URL', ['NEXT_PUBLIC_SUPABASE_URL']);
	const serviceKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');

	const supabase = createClient(supabaseUrl, serviceKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	console.log('Đang đọc CSV học sinh...');
	const studentRows = loadStudentRows();
	console.log(`• Tổng số dòng: ${studentRows.length}`);

	console.log('Đảm bảo bảng grades đã có 10/11/12...');
	const gradeMap = await ensureGrades(supabase, Object.keys(GRADE_YEAR_MAP));

	console.log('Đảm bảo bảng classes đầy đủ 10A*, 11A*, 12A*...');
	const classMap = await ensureClasses(supabase, gradeMap);

	const stats = {
		processed: 0,
		success: 0,
		skipped: 0,
	};

	for (const row of studentRows) {
		stats.processed += 1;
		const fullName = row['Họ và tên']?.trim();
		const khoi = row['Khối']?.trim();
		const classCodeRaw = row['Lớp']?.trim();

		if (!fullName || !khoi || !classCodeRaw) {
			console.warn(`[SKIP] Dòng ${row.STT}: Thiếu dữ liệu bắt buộc.`);
			stats.skipped += 1;
			continue;
		}

		const gradeNumber = extractGradeNumber(khoi);
		if (!gradeNumber) {
			console.warn(`[SKIP] ${fullName}: Không xác định được khối từ "${khoi}".`);
			stats.skipped += 1;
			continue;
		}

		const normalizedClassName = normalizeClassName(classCodeRaw);
		const classId = classMap.get(normalizedClassName);
		if (!classId) {
			console.warn(`[SKIP] ${fullName}: Không tìm thấy lớp ${normalizedClassName} trong database.`);
			stats.skipped += 1;
			continue;
		}

		let emailInfo;
		try {
			emailInfo = buildEmailAndUsername(fullName, classCodeRaw, gradeNumber);
		} catch (err) {
			console.warn(`[SKIP] ${fullName}: ${(err as Error).message}`);
			stats.skipped += 1;
			continue;
		}

		const birthDate = parseDateVn(row['Ngày sinh']);

			try {
				const { authUid } = await ensureAuthUser(supabase, emailInfo.email, DEFAULT_PASSWORD, {
				full_name: fullName,
				class_name: normalizedClassName,
			});

				const publicUser = await waitForPublicUserByAuthUid(supabase, authUid);
			if (!publicUser) {
				throw new Error('Không tìm thấy public.users tương ứng sau khi đợi.');
			}

			await updateUserAndProfile(
				supabase,
				publicUser,
				classId,
				fullName,
				emailInfo.username,
					emailInfo.email,
				birthDate,
			);

			console.log(`[OK] ${fullName} -> ${emailInfo.email}`);
			stats.success += 1;
		} catch (error) {
			console.error(`[FAIL] ${fullName}:`, error);
		}
	}

	console.log('--- Hoàn tất ---');
	console.log(`Tổng xử lý: ${stats.processed}`);
	console.log(`Thành công: ${stats.success}`);
	console.log(`Bỏ qua: ${stats.skipped}`);
}

main().catch((error) => {
	console.error('Seed script gặp lỗi:', error);
	process.exitCode = 1;
});
