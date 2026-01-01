import { UploadQuestionSetDialog } from '@/components/olympia/admin/question-bank/UploadQuestionSetDialog'
import { ViewQuestionSetDialog } from '@/components/olympia/admin/question-bank/ViewQuestionSetDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getServerAuthContext } from '@/lib/server-auth'

type QuestionRow = {
  id: string
  code: string
  category: string | null
  question_text: string
  answer_text: string
  note: string | null
  created_at: string
  question_sets?: { name: string } | { name: string }[] | null
}

type QuestionSetRow = {
  id: string
  name: string
  item_count: number
  original_filename: string | null
  created_at: string
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })
const formatDate = (value: string) => dateFormatter.format(new Date(value))

async function fetchQuestionBank() {
  const { supabase } = await getServerAuthContext()
  const olympia = supabase.schema('olympia')
  const { data, error, count } = await olympia
    .from('question_set_items')
    .select('id, code, category, question_text, answer_text, note, created_at, question_sets(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return {
    total: count ?? data?.length ?? 0,
    questions: data ?? [],
  }
}

async function fetchQuestionSets() {
  try {
    const { supabase } = await getServerAuthContext()
    const olympia = supabase.schema('olympia')
    const { data, error } = await olympia
      .from('question_sets')
      .select('id, name, item_count, original_filename, created_at')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.warn('[QuestionBank] Failed to fetch question sets:', error.message)
      return []
    }

    return data ?? []
  } catch (err) {
    console.warn('[QuestionBank] Question sets table may not exist yet:', err)
    return []
  }
}

function CategoryBadges({ questions }: { questions: QuestionRow[] }) {
  const counts = questions.reduce<Record<string, number>>((acc, q) => {
    const key = q.category ?? 'Chưa phân loại'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const entries = Object.entries(counts)
  if (entries.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([cat, value]) => (
        <Badge key={cat} variant="secondary">
          {cat}: {value}
        </Badge>
      ))}
    </div>
  )
}

export default async function OlympiaQuestionBankPage() {
  const [{ total, questions }, questionSets] = await Promise.all([fetchQuestionBank(), fetchQuestionSets()])

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bộ câu hỏi Olympia</h2>
          <p className="text-sm text-muted-foreground">Hiển thị tối đa 50 câu mới nhất cho mục đích kiểm tra nhanh.</p>
        </div>
        <div className="flex gap-2">
          <UploadQuestionSetDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tổng quan</CardTitle>
          <CardDescription>
            {total} câu hỏi được ghi nhận trong bảng <span className="font-medium text-slate-900">olympia.question_set_items</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bộ đếm theo chuyên mục dựa trên 50 bản ghi mới nhất. Sau khi có bộ lọc, thông tin thống kê sẽ cập nhật theo
            điều kiện.
          </p>
          <CategoryBadges questions={questions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bộ đề đã tải lên</CardTitle>
          <CardDescription>Danh sách tối đa 30 bộ đề mới nhất.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {questionSets.length === 0 ? (
            <Alert>
              <AlertTitle>Chưa có bộ đề</AlertTitle>
              <AlertDescription>Tải file .xlsx để tạo bộ đề cố định, không chỉnh sửa trực tiếp.</AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên bộ đề</TableHead>
                  <TableHead>Số câu</TableHead>
                  <TableHead>File gốc</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questionSets.map((set: QuestionSetRow) => (
                  <TableRow key={set.id}>
                    <TableCell className="font-medium">{set.name}</TableCell>
                    <TableCell>{set.item_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{set.original_filename ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(set.created_at)}</TableCell>
                    <TableCell>
                      <ViewQuestionSetDialog
                        questionSetId={set.id}
                        questionSetName={set.name}
                        itemCount={set.item_count}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {questions.length === 0 ? (
        <Alert>
          <AlertTitle>Chưa có dữ liệu</AlertTitle>
          <AlertDescription>
            Tải bộ đề hoặc tạo câu hỏi mới để kiểm thử tính năng đồng bộ.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>50 câu hỏi gần nhất</CardTitle>
            <CardDescription>Danh sách có thể mở rộng thành data table có phân trang sau khi kết nối hoàn chỉnh.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Chuyên mục</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead>Đáp án</TableHead>
                  <TableHead>Bộ đề</TableHead>
                  <TableHead>Tạo lúc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell className="font-mono text-xs">{question.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{question.category ?? 'Chưa phân loại'}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xl text-sm">
                      <p className="line-clamp-3 text-muted-foreground">{question.question_text}</p>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-900">{question.answer_text}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {Array.isArray(question.question_sets)
                        ? question.question_sets[0]?.name ?? '—'
                        : (question.question_sets as Record<string, string> | null)?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(question.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
