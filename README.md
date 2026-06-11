# RunCoach AI 🏃

מאמן ריצה אישי מבוסס AI. כל משתמש נרשם, מזין את הנתונים שלו, בונה תוכנית אימונים,
מדווח אחרי כל אימון — והמאמן (Claude) מנתח, נותן פידבק ומציע שינויים בתוכנית לפי
איך שהגוף מגיב.

הנתונים נשמרים ב-Supabase, כל משתמש רואה רק את הנתונים שלו, ומפתח ה-API של Claude
מוסתר בצד השרת (Edge Function) כך שלעולם לא נחשף בדפדפן.

---

## מה כבר מוכן

- ✅ מסד נתונים ב-Supabase עם 5 טבלאות והגנת RLS (כל משתמש רואה רק את שלו)
- ✅ פרויקט React מלא עם 5 מסכים (לוח בקרה, תוכנית, עדכון יומי, צ'אט, פרופיל)
- ✅ התחברות עם מייל וסיסמה
- ✅ Edge Function שמדבר עם Claude בבטחה (הקובץ מוכן — צריך לפרוס, ראה למטה)

---

## הרצה מקומית (במחשב שלך)

צריך Node.js מותקן (גרסה 18 ומעלה). להורדה: https://nodejs.org

```bash
# 1. נכנסים לתיקיית הפרויקט
cd runcoach-app

# 2. מתקינים את החבילות (פעם אחת)
npm install

# 3. מריצים
npm run dev
```

ייפתח אתר בכתובת http://localhost:5173 — אפשר להירשם ולהתחיל.

> קובץ `.env` כבר מכיל את פרטי החיבור ל-Supabase שלך, אז אין מה להגדיר.

---

## פריסת ה-Edge Function (הצעד שחסר כדי שהצ'אט יעבוד)

הצ'אט עם המאמן עובד דרך פונקציית שרת בשם `coach` שמחזיקה את מפתח Claude בסוד.
צריך לפרוס אותה פעם אחת ולהזין את המפתח.

### דרך א' — דרך ה-CLI של Supabase (מומלץ)

```bash
# מתקינים את ה-CLI (פעם אחת)
npm install -g supabase

# מתחברים
supabase login

# מקשרים לפרויקט
supabase link --project-ref iuyxymijqurroqsifidm

# מזינים את מפתח Claude כסוד (מחליפים sk-ant-... במפתח האמיתי)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# פורסים את הפונקציה
supabase functions deploy coach
```

### דרך ב' — דרך הדשבורד של Supabase

1. נכנסים ל-https://supabase.com/dashboard/project/iuyxymijqurroqsifidm
2. Edge Functions → Create a new function → שם: `coach`
3. מדביקים את התוכן של `supabase/functions/coach/index.ts`
4. Settings → Edge Functions → Secrets → מוסיפים:
   `ANTHROPIC_API_KEY` = המפתח שלך מ-https://console.anthropic.com

> **מאיפה מפתח Claude?** נכנסים ל-https://console.anthropic.com,
> Settings → API Keys → Create Key. שים לב שזה מחייב חשבון בתשלום
> (יש קרדיט חינמי להתחלה).

---

## העלאה לאוויר (אתר חי עם כתובת)

הכי קל עם Vercel (חינם):

1. מעלים את הפרויקט ל-GitHub
2. נכנסים ל-https://vercel.com, מחברים את ה-repo
3. ב-Environment Variables מוסיפים:
   - `VITE_SUPABASE_URL` = https://iuyxymijqurroqsifidm.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = (המפתח מ-.env)
4. Deploy — תוך דקה יש לך אתר חי.

---

## מבנה הפרויקט

```
runcoach-app/
├── src/
│   ├── lib/
│   │   ├── supabase.js       חיבור ל-Supabase
│   │   ├── coach.js          קריאה ל-Edge Function + בניית system prompt
│   │   ├── constants.js      סוגי אימונים, ימים
│   │   └── useProfile.js     טעינה/שמירת פרופיל
│   ├── context/
│   │   └── AuthContext.jsx   ניהול התחברות
│   ├── screens/
│   │   ├── AuthScreen.jsx        הרשמה/כניסה
│   │   ├── DashboardScreen.jsx   לוח בקרה
│   │   ├── PlannerScreen.jsx     תוכנית שבועית
│   │   ├── UpdateScreen.jsx      עדכון יומי
│   │   ├── CoachScreen.jsx       צ'אט עם המאמן
│   │   └── ProfileScreen.jsx     פרופיל (12 שדות)
│   ├── App.jsx               ניווט בין המסכים
│   └── main.jsx              נקודת כניסה
├── supabase/
│   └── functions/coach/      ה-Edge Function (שרת הביניים)
└── .env                      פרטי החיבור
```

## הטבלאות ב-Supabase

- `profiles` — 12 שדות הפרופיל (נוצר אוטומטית בהרשמה)
- `training_plans` — תוכנית לכל שבוע
- `workouts` — האימונים בכל תוכנית
- `daily_updates` — דיווחים אחרי אימון (נתונים + תחושות)
- `chat_messages` — היסטוריית הצ'אט (כך המאמן זוכר הכל)

---

## ניהול טוקנים (חיסכון בעלויות Claude)

- system prompt קומפקטי שנבנה מהפרופיל — לא חוזרים על מידע
- חלון של 8 הודעות אחרונות בלבד נשלח בכל בקשה
- max_tokens מוגבל ל-450
- היסטוריה מלאה נשמרת ב-DB אבל לא נשלחת כולה ל-API
