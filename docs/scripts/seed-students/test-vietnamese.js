function normalize(name) {
  return name
    .replace(/[Đ]/g, 'D')
    .replace(/[đ]/g, 'd')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tests = [
  // Tên đầy đủ phổ biến
  'NGUYỄN VĂN A',
  'TRẦN THỊ B', 
  'LÊ HOÀNG C',
  'ĐẶNG CHÂU THIÊN PHÚ',
  'PHẠM ĐÌNH QUANG',
  'VÕ MINH TÂM',
  'ĐỖ HỒNG ÂN',
  'ĐOÀN XUÂN PHƯỚC',
  'DƯƠNG NGỌC HẠNH',
  'HUỲNH THỊ UYÊN',
  
  // Test các nguyên âm với 5 dấu thanh
  // A: á à ả ã ạ
  'Ánh', 'Àng', 'Ảnh', 'Ãnh', 'Ạnh',
  
  // Â: ấ ầ ẩ ẫ ậ
  'Âu', 'Ấu', 'Ầu', 'Ẩu', 'Ẫu', 'Ậu',
  
  // Ă: ắ ằ ẳ ẵ ặ
  'Ăn', 'Ắn', 'Ằn', 'Ẳn', 'Ẵn', 'Ặn',
  
  // E: é è ẻ ẽ ẹ
  'Éo', 'Èo', 'Ẻo', 'Ẽo', 'Ẹo',
  
  // Ê: ế ề ể ễ ệ
  'Êm', 'Ếm', 'Ềm', 'Ểm', 'Ễm', 'Ệm',
  
  // I: í ì ỉ ĩ ị
  'Ía', 'Ìa', 'Ỉa', 'Ĩa', 'Ịa',
  
  // O: ó ò ỏ õ ọ
  'Óc', 'Òc', 'Ỏc', 'Õc', 'Ọc',
  
  // Ô: ố ồ ổ ỗ ộ
  'Ôi', 'Ối', 'Ồi', 'Ổi', 'Ỗi', 'Ội',
  
  // Ơ: ớ ờ ở ỡ ợ
  'Ơn', 'Ớn', 'Ờn', 'Ởn', 'Ỡn', 'Ợn',
  
  // U: ú ù ủ ũ ụ
  'Úa', 'Ùa', 'Ủa', 'Ũa', 'Ụa',
  
  // Ư: ứ ừ ử ữ ự
  'Ưu', 'Ứu', 'Ừu', 'Ửu', 'Ữu', 'Ựu',
  
  // Y: ý ỳ ỷ ỹ ỵ
  'Ýt', 'Ỳt', 'Ỷt', 'Ỹt', 'Ỵt',
  
  // Đ/đ đặc biệt
  'ĐỒNG',
  'Đinh',
  'đại',
];

console.log('=== TEST CHUẨN HÓA TIẾNG VIỆT ===\n');

let passed = 0;
let failed = 0;

tests.forEach(test => {
  const result = normalize(test);
  
  // Expected: chuyển về ASCII thuần
  const expected = test
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[àáảãạăắằẳẵặâấầẩẫậ]/g, 'a')
    .replace(/[èéẻẽẹêếềểễệ]/g, 'e')
    .replace(/[ìíỉĩị]/g, 'i')
    .replace(/[òóỏõọôốồổỗộơớờởỡợ]/g, 'o')
    .replace(/[ùúủũụưứừửữự]/g, 'u')
    .replace(/[ỳýỷỹỵ]/g, 'y');
  
  const match = result === expected;
  if (match) {
    passed++;
    console.log(`✅ ${test.padEnd(25)} → ${result}`);
  } else {
    failed++;
    console.log(`❌ ${test.padEnd(25)} → ${result}`);
    console.log(`   Expected: ${expected}`);
  }
});

console.log(`\n=== KẾT QUẢ ===`);
console.log(`Passed: ${passed}/${tests.length}`);
console.log(`Failed: ${failed}/${tests.length}`);

// Test cụ thể cho username generation
console.log('\n=== TEST USERNAME GENERATION ===');
const nameTests = [
  'ĐẶNG CHÂU THIÊN PHÚ',
  'NGUYỄN VĂN A',
  'TRẦN THỊ B',
  'HUỲNH THỊ UYÊN',
  'VÕ MINH TÂM',
];

nameTests.forEach(fullName => {
  const normalized = normalize(fullName);
  const tokens = normalized.split(' ');
  const initials = tokens.slice(0, -1).map(w => w[0]).join('');
  const username = initials + tokens.slice(-1)[0];
  console.log(`${fullName.padEnd(30)} → ${username}`);
});
