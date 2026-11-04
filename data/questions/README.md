# Формат на файловете с въпроси

Всяка обработена матура е един JSON файл: `data/questions/<клас>/<година>-<сесия>.json`
(напр. `data/questions/12-klas/2023-mai.json`). Импортира се с:

```bash
npm run import:questions -- data/questions/12-klas/2023-mai.json
```

или от сайта: **Админ → Импорт**. Повторен импорт на същата матура замества старите ѝ въпроси.

```jsonc
{
  "grade": "G12",                                  // G7 | G10 | G12
  "exam": { "year": 2023, "session": "май" },      // по желание; title се генерира сам
  "passages": [                                    // текстове за четене с разбиране
    { "key": "t1", "title": "Заглавие", "text": "Целият текст…" }
  ],
  "questions": [
    {
      "no": 1,                                     // номер на задачата в матурата
      "section": "LANGUAGE",                       // LANGUAGE | LITERATURE | READING
      "topic": "SPELLING",                         // само за LANGUAGE: GRAMMAR | LEXIS | SPELLING | PUNCTUATION
      "type": "SINGLE_CHOICE",                     // SINGLE_CHOICE | SHORT_ANSWER | MATCHING
      "prompt": "В кой ред има правописна грешка?",
      "context": null,                             // кратък откъс към въпроса (по желание)
      "options": ["…", "…", "…", "…"],
      "correct": "В",                              // буква от ключа (А/Б/В/Г) или индекс 0..3
      "explanation": null
    },
    {
      "no": 23,
      "section": "LITERATURE",
      "type": "SINGLE_CHOICE",
      "work": { "title": "Железният светилник", "author": "Димитър Талев" }, // null = общ въпрос
      "prompt": "…", "options": ["…"], "correct": "А"
    },
    {
      "no": 5,
      "section": "LANGUAGE", "topic": "SPELLING",
      "type": "SHORT_ANSWER",
      "prompt": "Запишете правилно думата…",
      "acceptedAnswers": ["вариант 1", "вариант 2"]  // всички допустими отговори от ключа
    },
    {
      "no": 30,
      "section": "READING", "passage": "t1",
      "type": "MATCHING",                           // свързване — само в мини тестовете
      "prompt": "Свържете…",
      "matching": { "left": ["…", "…"], "right": ["…", "…", "…"], "pairs": [2, 0] }
    }
  ]
}
```

## Правила

- **Есе, ЛИС, преразказ, теза** — не се включват.
- **Литература** — всеки въпрос има `work` (произведението, за което е), или `null`, ако е общ.
  Ако произведението го няма в базата, се създава автоматично.
- **Четене с разбиране** — само в мини тестовете, никога в мултиплейъра.
- **Мултиплейър** — ползва `SINGLE_CHOICE` и `SHORT_ANSWER` от Език и Литература.
- Въпрос без верен отговор се записва като „непроверен“ (DRAFT) и не се показва, докато не се оправи от админа.
