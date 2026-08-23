# سياسة الأمان والإفصاح عن الثغرات

## الإصدارات المدعومة

| الإصدار أو الفرع | حالة الدعم الأمني |
| --- | --- |
| `main` | مدعوم |
| الإصدارات أو الفروع المؤرشفة | غير مدعومة ما لم يذكر خلاف ذلك |

## الإبلاغ الخاص

يرجى **عدم** فتح مشكلة عامة تتضمن تفاصيل ثغرة أو دليل استغلال. أرسل التقرير بصورة خاصة من خلال [GitHub Security Advisories](https://github.com/Harb-k2/harb/security/advisories/new). إذا لم تتوفر هذه القناة في حسابك، افتح مشكلة عامة بعنوان `Security contact requested` من دون وصف فني أو بيانات حساسة؛ سيُرتب مالك المستودع قناة خاصة للمتابعة.

ينبغي أن يتضمن التقرير وصفاً واضحاً للأثر، والخطوات الدنيا لإعادة الإنتاج، والنسخة أو الالتزام المتأثر، وأي سجلات أو أمثلة **منزوعة الأسرار والبيانات الشخصية**. لا ترفق رموز وصول أو ملفات عميل أو بيانات واقعية في تقريرك.

## نطاق الاختبار المصرح به

ينطبق هذا النطاق على مصدر Harb المنشور، وواجهة الويب، والخادم، وعميل سطح المكتب الموزع. يرحب Harb بالبحث حسن النية الذي يقتصر على الأصول التي تملك تفويضاً صريحاً لاختبارها.

لا يصرح بهذه السياسة بهجمات حجب الخدمة، أو الهندسة الاجتماعية، أو الوصول إلى بيانات مستخدمين آخرين، أو تعديل البيانات، أو نشر الثغرة قبل منح المالك فرصة معقولة للمعالجة. أوقف الاختبار فور الوصول غير المقصود إلى بيانات حساسة أو تجاوز حدود التفويض، ثم أبلغ عنها عبر القناة الخاصة.

## التعامل والإفصاح

يستهدف المشروع تأكيد الاستلام خلال **7 أيام**، ومشاركة تحديث عن حالة المعالجة خلال **30 يوماً** عندما تسمح المعلومات المتاحة بذلك. يتم تنسيق الإفصاح العام بعد الإصلاح أو التخفيف المناسبين؛ والهدف الافتراضي هو فترة تنسيق تصل إلى **90 يوماً**، مع إمكان تعديلها باتفاق الباحث والمالك بحسب الأثر وتعقيد الإصلاح.

## شكر الباحثين

يجوز للباحث طلب ذكر اسمه في ملاحظات الإصدار أو صفحة شكر بعد إصلاح المشكلة، ما لم يطلب عدم الكشف عن هويته.

---

## Security Policy (English)

Please do **not** disclose vulnerability details in a public issue. Report privately through [GitHub Security Advisories](https://github.com/Harb-k2/harb/security/advisories/new). If that form is unavailable, open a public issue titled `Security contact requested` without technical details or sensitive data so the repository owner can arrange a private channel.

Only test assets you are explicitly authorized to assess. Do not perform denial-of-service attacks, social engineering, data access or modification, or public disclosure before coordination. Stop if you encounter sensitive data. Reports should include impact, minimal reproduction steps, affected version or commit, and sanitized evidence only.

The project targets acknowledgement within 7 days, a status update within 30 days where practical, and coordinated disclosure after remediation. The default coordination period is up to 90 days, subject to agreement based on impact and fix complexity.
