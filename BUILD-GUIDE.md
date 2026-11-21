# دليل بناء منصة ChemLMS — من البداية للنهاية (برومبت كامل)

> هذا البرومبت يجمع **كل الخطوات** التي تم تنفيذها لبناء منصة تعليم الكيمياء
> (ChemLMS) من الصفر حتى الوضع الحالي. يمكن إعادة تنفيذه بالكامل باتباعه.

---

## 1. الهدف الأساسي

بناء منصة تعليم كيمياء (LMS) **عاملة وبيقدر المستخدم يشتغل عليها**،
تدعم 4 أدوار (admin، مدرس، طالب، ولي أمر)، ثيم داكن/فاتح، دعم العربية والإنجليزية
مع RTL، مناهج متعددة، أدوات كيمياء، 8 أنواع أسئلة مع تصحيح آلي، بيانات دائمة في
Supabase (لا تنتهي)، ومستضافة على Render.

---

## 2. الـ Stack (التقنيات)

- **الواجهات:** React + TypeScript + Tailwind CSS
- **البيانات:** طبقة خدمة (Service Layer) موحدة — في المرحلة الأولى Mock في الذاكرة،
  خلفها REST قابل للتوصيل بـ Supabase
- **الاستضافات:** Render (static site) — مثالي للطبقة الأمامية
- **البيانات الدائمة:** Supabase (Postgres + Auth + Storage)
  - المشرروع: `mxseuwlhhkqkpgofecoa`
  - الـ URL: `https://mxseuwlhhkqkpgofecoa.supabase.co`

---

## 3. إعدادات Supabase الأولية

1. أنشئ مشروع Supabase جديد.
2. في **Authentication → Providers** فعّل:
   - **Email** (تسجيل/دخول بالبريد)
   - **Phone** (تسجيل/دخول بالهاتف)
3. في **Authentication → URL Configuration** عيّن **Site URL** و **Redirect URLs**
   لتطبيقك (أو الـ domain عند الـ deployment).
4. أنشئ **جدول (table) واحد** باسم `app_data`:
   - عمود `id` (text, primary)
   - عمود `collection` (text) — اسم مجموعة البيانات
   - عمود `data` (jsonb) — المحتوى
   - عمود `updated_at` (timestamp)
   - (تستخدم لحفظ كل الcollections كملف JSON واحد — حل خفيف وبديل عن إنشاء
     عشرات الجداول)
5. أنشئ RLS Policies على `app_data` لتسمح بالقراءة/الكتابة لـ anon/service role
   حسب الحاجة.
6. احصل على **anon key** و **URL** واحفظهما في `src/services/supabase.ts`.

> ⚠️ **تحذير مهم:** لا تستخدم Postgres مجاني من Render لأنه **ينتهي بعد 30 يومًا**.
> لهذا تم اختيار Supabase ليحفظ البيانات **بشكل دائم**.

---

## 4. إعداد تطبيق React من الصفر

```bash
npm create vite@latest chemlms -- --template react-ts
cd chemlms
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install react-router-dom
```

- عيّن Tailwind بدل CSS العادي.
- أنشئ بنية الملفات:

```
src/
├── components/        # مكونات UI عادية
├── features/          # ميزات (كل دور في مجلد)
│   ├── chem/          # أدوات الكيمياء
│   ├── admin/         # لوحة المدير
│   ├── teacher/       # لوحة المدرس
│   ├── student/       # لوحة الطالب
│   └── parent/        # لوحة ولي الأمر
├── context/           # AppContext (الجلسة، الرسائلي، الToast)
├── data/              # بيانات الإseed + بيانات ثابتة
├── i18n/              # الترجمة EN/AR
├── services/          # طبقة الخدمة (db، api، supabase، password، grading)
├── types.ts           # كل الأنواع (interfaces)
├── App.tsx            # الrouting الرئيسي + التبويبات
└── main.tsx
```

---

## 5. طبقة الخدمة (Service Layer) — القلب

يجب أن تكون **الواجهة الوحيدة** للبيانات. الكود الأمامي لا يتعامل مع الـ DB مباشرة،
بل يمر عبر الـ services. أنشئ هذه الملفات:

### 5.1 `src/services/db.ts`
- يحتوي على **مجموعات البيانات في الذاكرة** (curricula، classes، users، courses،
  lessons، questions، quizzes، assignments، submissions، grades، attendance،
  messages، notifications، auditLogs، videos...).
- يحتوي على دالة **`persist(collection)`** التي تحفظ التغييرات في Supabase
  (واجهة JSONB) بشكل دائم.
- اجعل `videos` ضمن الـ collections القابلة للحفظ.

### 5.2 `src/services/api.ts`
الـ API لكل الميزات. من أهم الدوال:
- **الـ Auth:** تسجيل، دخول، تغيير كلمة المرور، تأكيد البريد، تسجيل/دخول بالهاتف،
  إنشاء حساب من المدير.
- **الـ Users:** CRUD بالكامل مع التحكم في الدور.
- **الـ Curricula/Classes/Courses/Lessons:** CRUD.
- **الـ Questions/Quizzes/Assignments:** CRUD + التصحيح الآلي.
- **الـ gradebook، attendance، messages، notifications.**
- **`videosApi`:** list/byId/forCourse/forLesson/save/remove + `playableUrl`.
- **`assessmentApi`:** submitAssignment + `saveAssignmentFile` + `fileUrl`.
- كل تغيير يُسجّل في **`auditLogs`** (سجل أنشطة) ويُحفظ.

### 5.3 `src/services/password.ts`
- هاش كلمة المرور بـ **PBKDF2** (ليس نص عادي) — `hashPassword` / `verifyPassword`.
- دوال مساعدة: `normalizePhone` / `isValidPhone`.

### 5.4 `src/services/grading.ts`
- **تصحيح آلي كيميائي ذكي** لـ 8 أنواع أسئلة:
  اختيار من متعدد، صح/خطأ، ملء الفراغ، المطابقة، الإجابة القصيرة، المقال،
  الرسم/التسمية، الحساب الكيميائي.

### 5.5 `src/services/supabase.ts`
- الـ anon key + URL.
- `saveCollection`، `loadAll`، `clearAll`.
- **دوال Storage:** `storageObjectUrl`، `uploadToStorage`، `deleteFromStorage`،
  `storageEnabled`.

---

## 6. بيانات الإseed (Seed Data)

يجب أن يحتوي الإseed على:
- **3 مناهج** (curricula)
- **عدة فصول** (classes)
- **1 مدير، 3 مدرسين، 20 طالب، 12 ولي أمر**
- دروس كيمياء نموذجية
- **30+ سؤال** مصنف (tagged) حسب الموضوع/الهدف
- نتائج (grades) وحضور (attendance) ورسائلي (messages) نموذجية
- `videos: []` (مؤقتًا)

> **حساب المدير:** email `mohamedabdelmoaty84@gmail.com`، phone `00966549837701`،
> password `admin123`، id `u-admin`.

---

## 7. الأدوار والواجهات (4 أدوار)

### 7.1 تطبيق تسجيل/دخول
- نموذج دخول بالبريد وكلمة المرور.
- تسجيل ذاتي (للمستخدم العادي).
- دخول/تسجيل بالهاتف.
- تغيير كلمة المرور.
- تأكيد البريد (مرقم رمزي).
- **تبديل الأدوار** (Role Switcher) — لتجربة كل لوحة دون تسجيل كل مرة.

### 7.2 لوحة المدير (AdminDashboard)
- CRUD كامل لكل شيء: المناهج، الفصول، الدورات، الدروس، الأسئلة، الاختبارات،
  الواجبات.
- **المتابعة الحقيقية:** سجل الدرجات، الحضور، رسائلي الطلاب، الإشعارات.
- CRUD بيانات الكيمياء.
- التحكم في الحسابات والأدوار.
- **قسم الفيديوهات** (VideosView): عرض/تشغيل/حذف + رفع.

### 7.3 لوحة المدرس (TeacherDashboard)
- عرض الدورات والطلاب.
- الاختبارات والواجبات — عرض الحلول، تصحيح، إعطاء ملاحظات.
- جدول درجات مع **رابط تحميل ملف الواجب**.
- الحضور والرسائلي.

### 7.4 لوحة الطالب (StudentDashboard)
- عرض الدورات والدروس.
- حل الاختبارات (8 أنواع أسئلة).
- **تسليم الواجبات** (`AssignmentSubmit`): ملاحظة + رفع ملف (لـ cloud storage).
- عرض الدرجات والحضور والرسائلي والإشعارات.

### 7.5 لوحة ولي الأمر (ParentDashboard)
- **متغير تبديل الأطفال** — يختار أي من أبنائه ليرى بياناته.
- عرض درجات الأبناء، الحضور، التقدم.

---

## 8. أدوات الكيمياء (Chemistry Tools) — التميز الأساسي

أنشئ مجلد `src/features/chem/` يحتوي على:
1. **Periodic Table** — الجدول الدوري (عرض، تفاصيل العنصر).
2. **Notation** — تدوين كيميائي (صيغ، معادلات).
3. **Balancer/Calculators** — موازن المعادلات + حسابات (الكتلة المولية، التركيب
   النسبي، التركيز...).
4. **Molecule Viewer** — عرض الجزيئات ثلاثي الأبعاد.
5. **Virtual Lab** — مختبر افتراضي كامل (انظر القسم 10).
6. **Safety Module** —  module السلامة في المختبر.

> الأدوات تُعرض كنقاط تبويب في `ChemTools.tsx`.

---

## 9. المختبر الافتراضي + الفيديوهات + الواجبات

### 9.1 Virtual Lab (VirtualLab.tsx)
- **6 محاكاة** + مركز تجارب:
  1. **Titration** — معايرة مع منحنى pH حي، نقطة التكافؤ، الدليل.
  2. **pH scale** — مقياس الحموضة.
  3. **Reaction rate** — سرعة التفاعل مع Arrhenius والمحفزات.
  4. **Gas laws** — قوانين الغازات.
  5. **Stoichiometry** — الحساب المتكافئ مع المتفاعل المحدد.
  6. **Molarity** — التركيز والمحاليل المخففة.
- زر **"🎬 Video library"** يفتح مكتبة الفيديوهات.
- `src/data/labExperiments.ts` يحتوي على `LAB_EXPERIMENTS`: قائمة 6 تجارب
  (الهدف، الخطوات، السلامة، المحاكاة، عنوان التقرير).

### 9.2 Video Library (VideoLibrary.tsx)
- شبكة بطاقات، مشغل فيديو (modal)، نموذج رفع.
- `UploadForm` — مُصدّر لإعادة استخدامه (في المكتبة ولوحة المدير).
- الرفع إلى **Supabase Storage** أولاً، ولو فشل يرجع لـ base64.
- عرض badge "cloud" أو "inline" ليبين آلية التخزين.

### 9.3 الواجبات (AssignmentSubmit)
- الطالب يُدخل ملاحظة + يرفع ملف.
- الملف يُرفع لـ Supabase Storage (مع fallback base64).
- المدرس ينزل الملف من جدول الدرجات.

### 9.4 Deliverable Studio (استخراج الملفات) — `src/features/chem/DeliverableStudio.tsx`
- أداة لتوليد الـ deliverables (ملفات تعليمية) بناءً على **برومبت ثابت**.
- **Master Prompt** — يُحفظ مرة واحدة (في Supabase، دائم) ويُستخدم في كل job.
- **Base files** — ملفات مؤسسة/templates (PDF/DOCX) تُرفع وتُحفظ.
- **Lesson file** — الدرس المولّد منه الـ deliverable.
- **Generate** — اختيار نوع الـ deliverable (Summary/Worksheet/Quiz/Exam/Lesson Plan/Full Package/Booklet/Night Revision)، إنشاء job، ثم التنفيذ تفاعليًا بواسطة الـ agent (عبر Arena) الذي يتبع البرومبت بالـ wizard.
- `deliverableApi` (في `src/services/api.ts`): حفظ البرومبت، رفع/حذف الملفات، إنشاء/تحديث الـ jobs — كلها في collection `deliverables` في Supabase.
- متاح للمدرس والمدير (مخفي عن الطلاب).

---

## 10. تصحيح أسئلة الكيمياء (8 أنواع)

في `src/services/grading.ts`:
- اختيار من متعدد، صح/خطأ، ملء الفراغ، مطابقة، إجابة قصيرة، مقال، رسم/تسمية،
  حساب كيميائي.
- تصحيح آلي ذكي (يدخل اعتبارات كيميائية مثل توحيد المقال، التقريب في الحسابات).

---

## 11. الترجمة (i18n)

- `src/i18n/index.ts` يحتوي على مفاتيح EN و AR.
- دعم RTL تلقائي حسب اللغة (العربية RTL).
- تبديل اللغة من الشريط العلوي.

---

## 12. الثيم (الداكن/الفاتح)

- تبديل ثيم في الـ context، مع فئات Tailwind للداكن.

---

## 13. استضافة على Render

1. شارك الـ repo على GitHub.
2. في Render: **New → Static Site**، اربط الـ repo.
3. ضع ملف **`render.yaml`** لتحديد:
   - الـ build command (`npm run build`)
   - مجلد الإخراج (`dist`)
   - `static` serving.
4. deploy → يعطيك URL مباشر للموقع.

> **ملاحظة:** Render free static site لا ينطفئ (لا spin-down)، ولا يحتاج كارت.

---

## 14. رفع الكود إلى GitHub

- **استخدم PAT كلاسيكي (`ghp_...`)** وليس fine-grained — الـ fine-grained
  Fails بالـ 403 على الـ Git Data API والـ push.
- لا ترفع ملفات workflow إلا بـ `workflow` scope (أو استبعدها).
- استخدم:
  ```bash
  git add -A
  git commit -m "feat: ..."
  git push origin main
  ```

---

## 15. Supabase Storage (لرفع الفيديوهات والواجبات الكبيرة)

> **لماذا؟** رفع الفيديوهات كـ base64 في JSONB محدود (8 MB). الـ Storage يدعم
> ملفات كبيرة جدًا.

### 15.1 ما تم في الكود
- `src/services/supabase.ts`: دوال `uploadToStorage`، `deleteFromStorage`،
  `storageObjectUrl`.
- `Video` و `AssignmentFile` أنواعها تدعم `storagePath`/`storageUrl`/`storageProvider`.
- `videosApi.save` و `assessmentApi.saveAssignmentFile` يرفعون للـ Storage أولاً،
  ولو فشل يرجعوا لـ base64 (fallback آمن — لا كس).
- `videosApi.playableUrl` / `assessmentApi.fileUrl` يحلوا URL المناسب.

### 15.2 إنشاء bucket (يدوي من الـ dashboard — خطوة واحدة)
- افتح: `https://database.new.supabase.com/project/mxseuwlhhkqkpgofecoa/storage`
- **New bucket** → Name: `videos` → ✓ **Public** → **Create**.

> **لماذا يدوي؟** الـ connector مفيهوش tool لإنشاء buckets، والـ service key
> القيمة بتتهامى، والـ storage service ليه cache منفصلة مبتعرفش SQL insert
> المباشر (تعطي `NoSuchBucket`).

### 15.3 بعد إنشاء bucket
- **لا تحتاج إعادة تشغيل** — الكود مجهّز وسبق deploy.
- ارفع فيديو جديد، وسترى badge "cloud" (خضراء) = الرفع سارٍ للـ cloud.

---

## 16. اختبارات الجودة

قبل كل commit:
```bash
npx tsc --noEmit    # يجب أن يكون exit 0 (نظيف)
npm run build       # يجب أن ينجح
```

- اكتب اختبارات Node للـ service layer (باستخدام esbuild لتجميع api.ts/db.ts
  لـ `.mjs` ثم تشغيلها بـ node).
- تأكد من سلامة: رفع الفيديو، تخزين dataUrl/storagePath، القائمة، التحديث، الحذف،
  تسليم الواجب، إعادة التسليم، cleanup.

---

## 17. الوضع الحالي (النتيجة النهائية)

✅ **مكتمل ومضبوط ومعمول deploy:**
- تطبيق React+TS+Tailwind مع 4 أدوار + لوحات كاملة.
- أدوات كيمياء كاملة + مختبر افتراضي (6 محاكاة).
- مكتبة فيديوهات + واجبات مع رفع لـ Supabase Storage (+ fallback).
- تصحيح آلي لـ 8 أنواع أسئلة.
- بيانات دائمة في Supabase.
- tsc نظيف، build نجح، preview شغال (port 4173).

⏳ **خطوة واحدة متبقية من الـ dashboard:**
- إنشاء bucket `videos` (Public) لتفعيل رفع الملفات الكبيرة إلى cloud storage
  بدل fallback base64.

---

## 18. معلومات مهمة للرجوع

| العنصر | القيمة |
|---|---|
| Repo | `https://github.com/MrMohamedAbdelmoaty/chemlms` |
| Supabase project | `mxseuwlhhkqkpgofecoa` |
| Supabase URL | `https://mxseuwlhhkqkpgofecoa.supabase.co` |
| حساب المدير | `mohamedabdelmoaty84@gmail.com` / `admin123` |
| المدير id | `u-admin` |
| أحدث commit | `048a0fc` |
| Preview | port 4173 |

---

*هذا البرومبت يُعيد بناء المنصة بالكامل باتباعه من الصفر حتى التشغيل.*
