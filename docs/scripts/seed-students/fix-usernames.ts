import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const ENV_PRIORITY = ['.env', '.env.local'];

for (const envFile of ENV_PRIORITY) {
	const envPath = path.resolve(process.cwd(), envFile);
	if (fs.existsSync(envPath)) {
		dotenv.config({ path: envPath, override: true });
	}
}

const GRADE_YEAR_MAP: Record<string, string> = {
	'10': '2528',
	'11': '2427',
	'12': '2326',
};

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

/**
 * Normalize Vietnamese name to ASCII tokens
 */
function normalizeNameTokens(fullName: string): string[] {
	if (!fullName) return [];
	const cleaned = fullName
		.replace(/[Đ]/g, 'D')
		.replace(/[đ]/g, 'd')
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return cleaned ? cleaned.split(' ') : [];
}

/**
 * Build expected username from full name and class code
 */
function buildExpectedUsername(fullName: string, classCode: string, gradeLabel: string): string | null {
	const tokens = normalizeNameTokens(fullName);
	if (!tokens.length) return null;

	const yearCode = GRADE_YEAR_MAP[gradeLabel];
	if (!yearCode) return null;

	const lastToken = tokens[tokens.length - 1];
	const initials = tokens
		.slice(0, -1)
		.map((token) => token[0])
		.join('');
	const namePart = `${initials}${lastToken}`;
	const suffix = classCode.replace(/^\d+/, '').toLowerCase();

	if (!suffix) return null;

	return `${namePart}${suffix}${yearCode}`;
}

/**
 * Extract grade number from class name (e.g., "10A1" → "10")
 */
function extractGradeFromClassName(className: string): string | null {
	if (!className) return null;
	const match = className.match(/^(\d+)/);
	return match ? match[1] : null;
}

type AuthUser = {
	id: string;
	email: string;
	user_metadata: {
		full_name?: string;
		display_name?: string;
		class_name?: string;
	};
};

type PublicUser = {
	id: string;
	auth_uid: string;
	user_name: string | null;
	email: string | null;
	class_id: string | null;
	classes?: {
		name: string;
	} | {
		name: string;
	}[];
};

async function main() {
	const supabaseUrl = ensureEnv('SUPABASE_URL', ['NEXT_PUBLIC_SUPABASE_URL']);
	const serviceKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');

	const supabase = createClient(supabaseUrl, serviceKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});

	console.log('=== KIỂM TRA VÀ SỬA USERNAME/EMAIL ===\n');

	// Step 1: Get all auth users with display_name or full_name
	console.log('Đang lấy danh sách auth.users...');
	const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

	if (authError || !authUsers) {
		throw new Error(`Lỗi lấy auth users: ${authError?.message}`);
	}

	const usersWithDisplayName = authUsers.users.filter(
		(user) => user.user_metadata?.full_name || user.user_metadata?.display_name
	) as AuthUser[];

	console.log(`✓ Tìm thấy ${usersWithDisplayName.length} tài khoản có display name\n`);

	// Step 2: Get corresponding public.users
	const authUids = usersWithDisplayName.map((u) => u.id);
	const { data: publicUsers, error: publicError } = await supabase
		.from('users')
		.select('id, auth_uid, user_name, email, class_id, classes!fk_users_class(name)')
		.in('auth_uid', authUids);

	if (publicError) {
		throw new Error(`Lỗi lấy public users: ${publicError.message}`);
	}

	const publicUsersMap = new Map<string, PublicUser>();
	(publicUsers || []).forEach((u) => {
		publicUsersMap.set(u.auth_uid, u as unknown as PublicUser);
	});

	// Step 3: Check and fix each user
	const stats = {
		checked: 0,
		needsFix: 0,
		fixed: 0,
		skipped: 0,
		errors: 0,
	};

	for (const authUser of usersWithDisplayName) {
		stats.checked += 1;

		const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.display_name;
		const classNameFromMeta = authUser.user_metadata?.class_name;

		if (!fullName) {
			console.log(`[SKIP] ${authUser.email}: Không có full_name`);
			stats.skipped += 1;
			continue;
		}

		const publicUser = publicUsersMap.get(authUser.id);
		if (!publicUser) {
			console.log(`[SKIP] ${fullName}: Không tìm thấy public.users`);
			stats.skipped += 1;
			continue;
		}

		// Get class info
		const classData = Array.isArray(publicUser.classes)
			? publicUser.classes[0]
			: publicUser.classes;
		const className = classData?.name || classNameFromMeta || '';

		if (!className) {
			console.log(`[SKIP] ${fullName}: Không có thông tin lớp`);
			stats.skipped += 1;
			continue;
		}

		const gradeNumber = extractGradeFromClassName(className);
		if (!gradeNumber || !GRADE_YEAR_MAP[gradeNumber]) {
			console.log(`[SKIP] ${fullName}: Không xác định được khối từ lớp "${className}"`);
			stats.skipped += 1;
			continue;
		}

		// Build expected username and email
		const expectedUsername = buildExpectedUsername(fullName, className, gradeNumber);
		if (!expectedUsername) {
			console.log(`[SKIP] ${fullName}: Không thể tạo username từ tên`);
			stats.skipped += 1;
			continue;
		}

		const expectedEmail = `${expectedUsername}@edusync.edu.vn`;

		// Check if needs fixing
		const authEmailMismatch = authUser.email !== expectedEmail;
		const publicUsernameMismatch = publicUser.user_name !== expectedUsername;
		const publicEmailMismatch = publicUser.email !== expectedEmail;

		if (!authEmailMismatch && !publicUsernameMismatch && !publicEmailMismatch) {
			// All correct
			continue;
		}

		stats.needsFix += 1;
		console.log(`\n[FIX] ${fullName} (${className})`);
		console.log(`  Current auth email:   ${authUser.email}`);
		console.log(`  Current public user:  ${publicUser.user_name}`);
		console.log(`  Current public email: ${publicUser.email}`);
		console.log(`  Expected username:    ${expectedUsername}`);
		console.log(`  Expected email:       ${expectedEmail}`);

		try {
			// Fix auth.users email
			if (authEmailMismatch) {
				const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
					authUser.id,
					{ email: expectedEmail }
				);
				if (authUpdateError) {
					console.log(`  ❌ Lỗi cập nhật auth email: ${authUpdateError.message}`);
					stats.errors += 1;
					continue;
				}
				console.log(`  ✓ Cập nhật auth email`);
			}

			// Fix public.users
			if (publicUsernameMismatch || publicEmailMismatch) {
				const { error: publicUpdateError } = await supabase
					.from('users')
					.update({
						user_name: expectedUsername,
						email: expectedEmail,
					})
					.eq('id', publicUser.id);

				if (publicUpdateError) {
					console.log(`  ❌ Lỗi cập nhật public users: ${publicUpdateError.message}`);
					stats.errors += 1;
					continue;
				}
				console.log(`  ✓ Cập nhật public.users`);
			}

			stats.fixed += 1;
			console.log(`  ✅ Hoàn tất`);
		} catch (error) {
			console.error(`  ❌ Lỗi: ${error}`);
			stats.errors += 1;
		}
	}

	console.log('\n=== KẾT QUẢ ===');
	console.log(`Đã kiểm tra:     ${stats.checked}`);
	console.log(`Cần sửa:         ${stats.needsFix}`);
	console.log(`Đã sửa:          ${stats.fixed}`);
	console.log(`Bỏ qua:          ${stats.skipped}`);
	console.log(`Lỗi:             ${stats.errors}`);
}

main().catch((error) => {
	console.error('Script gặp lỗi:', error);
	process.exitCode = 1;
});
