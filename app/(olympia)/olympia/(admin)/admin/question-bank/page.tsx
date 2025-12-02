import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })
const formatDate = (value: string) => dateFormatter.format(new Date(value))

async function fetchQuestionBank() {
  const { supabase } = await getServerAuthContext()
  const { data, error, count } = await supabase
    .from('olympia.questions')
    .select('id, code, category, question_text, answer_text, note, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return {
    total: count ?? data?.length ?? 0,
    questions: data ?? [],
  }
}

function QuestionActions() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Tạo câu hỏi</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chức năng đang phát triển</DialogTitle>
          <DialogDescription>
            Form nhập câu hỏi sẽ được gắn khi hoàn tất Supabase function kiểm tra trùng mã câu hỏi.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Hiện tại bạn có thể nhập dữ liệu bằng file CSV và chạy script seed để điền vào bảng olympia.questions.
        </p>
      </DialogContent>
    </Dialog>
  )
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
  const { total, questions } = await fetchQuestionBank()

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bộ câu hỏi Olympia</h2>
          <p className="text-sm text-muted-foreground">Hiển thị tối đa 50 câu mới nhất cho mục đích kiểm tra nhanh.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Tìm theo mã..." className="w-48" disabled />
          <QuestionActions />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tổng quan</CardTitle>
          <CardDescription>
            {total} câu hỏi được ghi nhận trong bảng <span className="font-medium text-slate-900">olympia.questions</span>.
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

      {questions.length === 0 ? (
        <Alert>
          <AlertTitle>Chưa có dữ liệu</AlertTitle>
          <AlertDescription>
            Thêm câu hỏi mới vào bảng olympia.questions để kiểm thử tính năng đồng bộ.
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
