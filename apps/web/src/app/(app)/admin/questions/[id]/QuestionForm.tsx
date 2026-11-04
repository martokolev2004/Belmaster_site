'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GRADES, SECTION_LABELS, TOPIC_LABELS, type GradeCode } from '@belmaster/shared';
import { Alert, Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { deleteQuestionAction, saveQuestionAction } from '../../actions';

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

interface Q {
  id: string;
  grade: GradeCode;
  section: keyof typeof SECTION_LABELS;
  topic: keyof typeof TOPIC_LABELS | null;
  type: 'SINGLE_CHOICE' | 'SHORT_ANSWER' | 'MATCHING' | 'FILL_BLANKS' | 'PUNCTUATION';
  answerCount: number;
  blanksText: string | null;
  blanksLines: string | null;
  punctOriginal: string | null;
  punctAnswer: string | null;
  prompt: string;
  context: string | null;
  options: string[];
  correctIndex: number | null;
  acceptedAnswers: string[];
  matching: { left: string[]; right: string[]; pairs: number[] } | null;
  explanation: string | null;
  status: 'ACTIVE' | 'DRAFT' | 'HIDDEN';
  inMultiplayer: boolean;
  workId: string | null;
  passageId: string | null;
  sourceNo: number | null;
  sourceNote: string | null;
  examTitle: string | null;
  openReports: number;
}

export function QuestionForm({
  question,
  works,
  passages,
  back,
}: {
  question: Q | null;
  works: { id: string; grade: GradeCode; title: string; author: string }[];
  passages: { id: string; grade: GradeCode; label: string }[];
  back: string;
}) {
  const [grade, setGrade] = useState<GradeCode>(question?.grade ?? 'G12');
  const [section, setSection] = useState(question?.section ?? 'LANGUAGE');
  const [type, setType] = useState(question?.type ?? 'SINGLE_CHOICE');
  const [options, setOptions] = useState((question?.options ?? ['', '', '', '']).join('\n'));
  const optionList = options.split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={back} className="mb-4 inline-block font-bold text-secondary">
        ← Към въпросите
      </Link>
      {question?.openReports ? (
        <div className="mb-4">
          <Alert>Този въпрос има {question.openReports} отворени доклада.</Alert>
        </div>
      ) : null}
      <form action={saveQuestionAction} className="space-y-4">
        <input type="hidden" name="id" value={question?.id ?? 'new'} />
        <input type="hidden" name="back" value={back} />
        <Card className="grid gap-4 md:grid-cols-3">
          <Field label="Клас">
            <Select name="grade" value={grade} onChange={(e) => setGrade(e.target.value as GradeCode)}>
              {GRADES.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Раздел">
            <Select name="section" value={section} onChange={(e) => setSection(e.target.value as Q['section'])}>
              {Object.entries(SECTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Статус">
            <Select name="status" defaultValue={question?.status ?? 'ACTIVE'}>
              <option value="ACTIVE">Активен</option>
              <option value="DRAFT">Непроверен</option>
              <option value="HIDDEN">Скрит</option>
            </Select>
          </Field>
          {section === 'LANGUAGE' && (
            <Field label="Подтема">
              <Select name="topic" defaultValue={question?.topic ?? 'GRAMMAR'}>
                {Object.entries(TOPIC_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {section === 'LITERATURE' && (
            <Field label="Произведение" hint="Празно = общ въпрос">
              <Select name="workId" defaultValue={question?.workId ?? ''}>
                <option value="">— общ —</option>
                {works
                  .filter((w) => w.grade === grade)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title} — {w.author}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          {section === 'READING' && (
            <Field label="Текст">
              <Select name="passageId" defaultValue={question?.passageId ?? ''}>
                <option value="">—</option>
                {passages
                  .filter((p) => p.grade === grade)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          <Field label="В мултиплейъра" hint="„Автоматично“: според типа (пунктуацията и четенето — не).">
            <Select name="inMultiplayer" defaultValue={question ? (question.inMultiplayer ? 'yes' : 'no') : 'auto'}>
              <option value="auto">Автоматично</option>
              <option value="yes">Да</option>
              <option value="no">Не</option>
            </Select>
          </Field>
          <Field label="Тип">
            <Select name="type" value={type} onChange={(e) => setType(e.target.value as Q['type'])}>
              <option value="SINGLE_CHOICE">Избор на отговор</option>
              <option value="SHORT_ANSWER">Кратък отговор</option>
              <option value="MATCHING">Свързване</option>
              <option value="FILL_BLANKS">Празни места</option>
              <option value="PUNCTUATION">Пунктуация (липсващи знаци)</option>
            </Select>
          </Field>
        </Card>

        <Card className="space-y-4">
          <Field label="Условие">
            <Textarea name="prompt" defaultValue={question?.prompt} required />
          </Field>
          <Field label="Пример / откъс към въпроса (по желание)">
            <Textarea name="context" defaultValue={question?.context ?? ''} className="min-h-20" />
          </Field>

          {type === 'SINGLE_CHOICE' && (
            <>
              <Field label="Отговори (по един на ред)">
                <Textarea name="options" value={options} onChange={(e) => setOptions(e.target.value)} />
              </Field>
              <Field label="Верен отговор">
                <Select name="correctIndex" defaultValue={question?.correctIndex ?? 0}>
                  {optionList.map((o, i) => (
                    <option key={i} value={i}>
                      {LETTERS[i]}) {o}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
          {type === 'SHORT_ANSWER' && (
            <>
              <Field label="Допустими верни отговори (по един на ред)" hint="Сравнява се без значение от главни/малки букви, кавички и интервали. По ключови думи: ~проблеми със зрението|зрени (приема всеки отговор, съдържащ „зрени“).">
                <Textarea name="acceptedAnswers" defaultValue={question?.acceptedAnswers.join('\n')} />
              </Field>
              <Field label="Колко отговора се искат" hint="Напр. 2 за „Запишете ДВЕ…“ — всеки се търси в списъка по-горе.">
                <Input name="answerCount" type="number" min={1} max={5} defaultValue={question?.answerCount ?? 1} />
              </Field>
            </>
          )}
          {type === 'FILL_BLANKS' && (
            <>
              <Field label="Текст с празни места" hint="Отбележи всяко място с {{А}}, {{Б}}, {{В}}…">
                <Textarea name="blanksText" defaultValue={question?.blanksText ?? ''} className="min-h-32" />
              </Field>
              <Field label="Варианти за всяко място" hint="По един ред на място: А: стимул | стимулант* | симулант  (* = верният)">
                <Textarea name="blanksLines" defaultValue={question?.blanksLines ?? ''} className="font-mono text-sm" />
              </Field>
            </>
          )}
          {type === 'PUNCTUATION' && (
            <>
              <Field label="Текст БЕЗ липсващите знаци (както е в задачата)">
                <Textarea name="punctOriginal" defaultValue={question?.punctOriginal ?? ''} className="min-h-32" />
              </Field>
              <Field label="Верният текст (със знаците)" hint="Думите трябва да са същите — различават се само знаците.">
                <Textarea name="punctAnswer" defaultValue={question?.punctAnswer ?? ''} className="min-h-32" />
              </Field>
            </>
          )}
          {type === 'MATCHING' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Лява колона (1, 2, 3…)">
                <Textarea name="mLeft" defaultValue={question?.matching?.left.join('\n')} />
              </Field>
              <Field label="Дясна колона (А, Б, В…)">
                <Textarea name="mRight" defaultValue={question?.matching?.right.join('\n')} />
              </Field>
              <Field label="Верни двойки" hint="Буквите за 1, 2, 3… подред, напр.: В А Г Б">
                <Input name="mPairs" defaultValue={question?.matching?.pairs.map((p) => LETTERS[p]).join(' ')} />
              </Field>
            </div>
          )}
          <Field label="Обяснение (показва се след отговора)">
            <Textarea name="explanation" defaultValue={question?.explanation ?? ''} className="min-h-20" />
          </Field>
        </Card>

        <Card className="grid gap-4 md:grid-cols-2">
          <Field label="Номер в матурата">
            <Input name="sourceNo" type="number" defaultValue={question?.sourceNo ?? ''} />
          </Field>
          <Field label="Бележка за източника">
            <Input name="sourceNote" defaultValue={question?.sourceNote ?? ''} />
          </Field>
          {question?.examTitle && <p className="text-sm text-muted md:col-span-2">Матура: {question.examTitle}</p>}
        </Card>

        <div className="flex justify-between gap-3">
          <Button type="submit" size="lg">
            Запази
          </Button>
        </div>
      </form>
      {question && (
        <form
          action={deleteQuestionAction}
          className="mt-6"
          onSubmit={(e) => {
            if (!confirm('Да изтрия ли въпроса?')) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={question.id} />
          <button className="font-extrabold text-error">Изтрий въпроса</button>
        </form>
      )}
    </div>
  );
}
