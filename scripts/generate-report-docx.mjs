import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel,
  ShadingType, TableLayoutType, PageBreak,
} from 'docx';
import { writeFileSync } from 'fs';

// ─── Helpers ───
const GOLD = '8B6914';
const GREEN = '16a34a';
const RED = 'dc2626';
const AMBER = 'd97706';
const GRAY = '555555';
const LIGHT_BG = 'F5F5F5';
const WHITE = 'FFFFFF';
const FONT = 'Readex Pro';

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 200 : 300, after: 120 },
    children: [new TextRun({ text, font: FONT, bold: true, size: level === HeadingLevel.HEADING_1 ? 36 : 28, color: '111111', rightToLeft: true })],
  });
}

function sectionHeading(num, title) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 360, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 6 } },
    children: [
      new TextRun({ text: `${num}. `, font: FONT, bold: true, size: 28, color: GOLD, rightToLeft: true }),
      new TextRun({ text: title, font: FONT, bold: true, size: 28, color: '111111', rightToLeft: true }),
    ],
  });
}

function desc(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: 160 },
    children: [new TextRun({ text, font: FONT, size: 20, color: GRAY, rightToLeft: true })],
  });
}

function featureTitle(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 22, color: GOLD, rightToLeft: true })],
  });
}

function featureDesc(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: 80 },
    children: [new TextRun({ text, font: FONT, size: 20, color: '333333', rightToLeft: true })],
  });
}

function tagPill(text) {
  return new TextRun({ text: `  ✓ ${text}  `, font: FONT, bold: true, size: 18, color: GREEN, rightToLeft: true });
}

function scenario(quote, author) {
  return [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { before: 200, after: 40 },
      shading: { type: ShadingType.SOLID, color: LIGHT_BG },
      indent: { right: 200, left: 200 },
      children: [new TextRun({ text: `« ${quote} »`, font: FONT, size: 20, italics: true, color: '222222', rightToLeft: true })],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.LEFT,
      spacing: { after: 160 },
      indent: { right: 200, left: 200 },
      children: [new TextRun({ text: `— ${author}`, font: FONT, bold: true, size: 18, color: GOLD, rightToLeft: true })],
    }),
  ];
}

// ─── Table helpers ───
function headerCell(text) {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: 'E8E8E8' },
    children: [new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text, font: FONT, bold: true, size: 18, color: '111111', rightToLeft: true })],
    })],
  });
}

function cell(text, color = '222222') {
  return new TableCell({
    children: [new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text, font: FONT, size: 18, color, bold: color !== '222222', rightToLeft: true })],
    })],
  });
}

function yesCell(text)  { return cell(`✓ ${text}`, GREEN); }
function noCell(text)   { return cell(`✗ ${text}`, RED); }
function midCell(text)  { return cell(`▲ ${text}`, AMBER); }
function labelCell(text) {
  return new TableCell({
    children: [new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text, font: FONT, bold: true, size: 18, color: '111111', rightToLeft: true })],
    })],
  });
}

// ─── Build Document ───
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 20, rightToLeft: true },
        paragraph: { bidirectional: true, alignment: AlignmentType.RIGHT },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 720, bottom: 720, right: 900, left: 900 },
        size: { orientation: 'portrait' },
      },
    },
    children: [
      // ─── Header ───
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: 'منظومة إدارة المبيعات والمخزون', font: FONT, bold: true, size: 20, color: GOLD, rightToLeft: true })],
      }),
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: 'منظومة Flow لمستلزمات المقاهي والمطاعم', font: FONT, bold: true, size: 36, color: '111111', rightToLeft: true })],
      }),
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({
          text: 'منظومة متكاملة تشتغل بدون إنترنت نهائياً — مصممة لإدارة المبيعات والمخزون وحسابات الزبائن والموردين والورديات المالية لمحلات مستلزمات المقاهي والمطاعم في ليبيا.',
          font: FONT, size: 20, color: GRAY, rightToLeft: true,
        })],
      }),
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          tagPill('بدون إنترنت 100%'),
          tagPill('جهاز واحد أو شبكة محلية'),
          tagPill('دقة 3 خانات عشرية'),
          tagPill('معدات ومستهلكات'),
          tagPill('فواتير A4 + إيصالات حرارية'),
          tagPill('كشوفات حساب'),
          tagPill('ملكية دائمة'),
        ],
      }),

      // ─── Section 1 ───
      sectionHeading(1, 'العمل بدون إنترنت والتشغيل المستقل'),
      desc('المنظومة تشتغل بدون إنترنت من أول يوم. الخادم وقاعدة البيانات والطباعة — كل شيء يدور على جهازك داخل المحل. ما تحتاج خط نت ولا اشتراك سحابي.'),

      featureTitle('💻 تشغيل على جهاز واحد'),
      featureDesc('تقدر تنصب المنظومة على كمبيوتر واحد في المحل وتبدأ تشتغل فوراً. كل شيء — من إصدار الفواتير للمخزون للتقارير — يمشي على نفس الجهاز بدون ما تحتاج أي شيء إضافي.'),
      featureTitle('📡 ربط أجهزة عبر شبكة محلية'),
      featureDesc('لو عندك أكثر من كاشير أو تابلت للجرد، تربطهم كلهم على سيرفر المحل عبر WiFi داخلي. ما يحتاج إنترنت — شبكة محلية وبس.'),
      featureTitle('🛡️ بياناتك عندك وتحت إيدك'),
      featureDesc('أسعارك وأسماء زبائنك وبيانات مبيعاتك مخزنة في جهازك أنت — مش على سيرفرات خارجية. وشراء المنظومة ملكية دائمة بدون رسوم شهرية أو سنوية.'),
      featureTitle('⚡ استجابة فورية'),
      featureDesc('لأن كل شيء يشتغل محلي على جهازك، سرعة المنظومة ما تتأثر بالنت أو بالضغط على سيرفرات بعيدة. الفواتير والبحث عن الأصناف يتم في لمح البصر.'),

      // ─── Section 2 ───
      sectionHeading(2, 'نقطة البيع والطباعة'),
      desc('شاشة بيع سهلة وسريعة — الكاشير يقدر يخلص الفاتورة في ثواني. ومعها نظام طباعة مزدوج: فواتير A4 رسمية للمعدات، وإيصالات حرارية سريعة للمستهلكات.'),

      featureTitle('🔍 بحث فوري وقراءة باركود'),
      featureDesc('الكاشير يمرر الباركود بالقارئ أو يفتح كاميرا التابلت ويقرأ. وإذا ما كان فيه باركود، يبحث بالاسم أو التصنيف أو الرقم التسلسلي ويلقى الصنف بسرعة.'),
      featureTitle('📄 فواتير A4 رسمية للمعدات'),
      featureDesc('لما تبيع آلة أو جهاز، المنظومة تطبع فاتورة A4 فيها: اسم الموديل، الرقم التسلسلي، شروط الضمان، خاتم المؤسسة، والمبلغ مكتوب بالحروف العربية (مثال: خمسة آلاف دينار لا غير).'),
      featureTitle('🧾 إيصالات حرارية 80mm'),
      featureDesc('للبيوعات اليومية السريعة، المنظومة تطبع إيصال حراري صغير فيه تفاصيل العملية وكود QR وبيانات الوردية والكاشير. طباعة فورية بدون تأخير.'),
      featureTitle('💳 طرق دفع متعددة'),
      featureDesc('كل فاتورة تقدر تحدد طريقة دفعها: نقد مباشر، على حساب الزبون (دين)، بطاقة تداول، أو تحويل مصرفي. كل طريقة تتوثق ويتسجل أثرها.'),
      featureTitle('🔄 إلغاء وإرجاع الفواتير'),
      featureDesc('إذا حصل خطأ أو الزبون رجّع بضاعة، المنظومة تلغي الفاتورة أو ترجّع بند محدد بموافقة المدير. الكميات ترجع للمخزون والنقدية تتعدل تلقائياً.'),
      featureTitle('🔒 موافقة المدير برمز PIN'),
      featureDesc('عمليات حساسة مثل البيع بدون رصيد كافي أو منح خصم فوق الحد المسموح — ما تمشي إلا بإدخال رمز المدير. العملية تتوثق ويتسجل مين وافق ومتى.'),

      // ─── Section 3 ───
      sectionHeading(3, 'إدارة المخزون — معدات ومستهلكات'),
      desc('المنظومة تفرق بين الأجهزة الكبيرة (ماكينات، مطاحن) والمواد الاستهلاكية (أكواب، حبوب بن، نكهات). كل نوع عنده حقوله وطريقة تتبعه.'),

      featureTitle('⚙️ تتبع المعدات والأجهزة'),
      featureDesc('كل جهاز يتسجل برقم تسلسلي فريد واسم الموديل ومدة الضمان. لما تبيعه، هالبيانات تظهر في الفاتورة تلقائياً.'),
      featureTitle('☕ تتبع المواد الاستهلاكية'),
      featureDesc('المواد الخام تتسجل برقم التشغيلة وتاريخ انتهاء الصلاحية. وتقدر تحدد نقطة إعادة الطلب لكل صنف عشان ما يخلص عليك بدون ما تنتبه.'),
      featureTitle('📜 سجل حركة المخزون'),
      featureDesc('أي حركة على المخزون — بيع، شراء، تسوية — تتسجل في دفتر دائم يوضح: نوع الحركة، الموظف اللي نفذها، والرصيد بعد الحركة. ما فيه تعديل يمر بدون توثيق.'),
      featureTitle('⚠️ تنبيهات النواقص والصلاحية'),
      featureDesc('المنظومة تنبهك لما صنف يوصل لحد النقص أو لما مادة تقرب من انتهاء صلاحيتها، عشان تقدر تطلب قبل ما ينفد.'),

      // ─── Section 4 ───
      sectionHeading(4, 'المشتريات والموردين'),
      desc('تسجيل فواتير الشراء من الموردين وتتبع ديونهم، مع إعادة حساب تكلفة الأصناف تلقائياً عشان تقارير الأرباح تكون دقيقة.'),

      featureTitle('📝 فواتير شراء مرقمة'),
      featureDesc('كل فاتورة شراء تاخذ رقم تسلسلي مرتب وبدون فراغات. الكميات المشتراة تنضاف للمخزون فوراً، والدفعة ترتبط بنقدية الوردية.'),
      featureTitle('📈 تحديث التكلفة تلقائياً'),
      featureDesc('لما تشتري نفس الصنف بسعر مختلف عن المرة اللي قبلها، المنظومة تحسب متوسط التكلفة المرجح تلقائياً. هذا يضمن إن تقارير الأرباح تعكس الواقع.'),
      featureTitle('🤝 حسابات الموردين'),
      featureDesc('تتبع اللي عليك لكل مورد، وسجل التسديدات اللي دفعتها. وتقدر تطبع كشف حساب لكل مورد يوضح الحركة كاملة.'),

      // ─── Section 5 ───
      sectionHeading(5, 'ديون الزبائن وكشوف الحسابات'),
      desc('تقدر تبيع بالدين للزبائن الدائمين وتتابع رصيد كل واحد. والمنظومة تولد كشف حساب A4 جاهز للطباعة يوضح كل الحركات والرصيد.'),

      featureTitle('📒 كشف حساب الزبون'),
      featureDesc('كشف حساب A4 لكل زبون يوضح فيه: كل فاتورة آجلة، كل سداد دفعه، والرصيد المتبقي عليه بدقة 3 خانات عشرية. يتطبع أو يتصدر حسب الحاجة.'),
      featureTitle('💵 تسجيل السدادات'),
      featureDesc('لما الزبون يدفع جزء من دينه أو كله، المبلغ يتسجل في الوردية النشطة ويدخل درج النقدية، ورصيد الزبون يتحدث فوراً. ويتصدر له إيصال سداد.'),
      featureTitle('🔍 ربط سريع من شاشة البيع'),
      featureDesc('من شاشة نقطة البيع، تختار الزبون بضغطة وحدة والفاتورة تتوجه لحسابه مباشرة. ما تحتاج تفتح شاشات ثانية أو تبحث طويل.'),

      // ─── Page break before section 6 ───
      new Paragraph({ children: [new PageBreak()] }),

      // ─── Section 6 ───
      sectionHeading(6, 'الورديات والرقابة المالية'),
      desc('نظام ورديات صارم يربط كل عملية بالموظف والوردية. عند الإغلاق، النظام يقارن النقدية الفعلية بالمتوقعة ويسجل الفارق بشكل لا يقبل التعديل.'),

      featureTitle('🔒 وردية موحدة للدرج'),
      featureDesc('وردية واحدة تشترك فيها كل الأجهزة المتصلة بنفس درج النقدية. كل عملية — بيع، سداد، مصروف — يتسجل فيها اسم الموظف اللي نفذها.'),
      featureTitle('📊 مطابقة النقدية عند الإغلاق'),
      featureDesc('لما تقفل الوردية، المنظومة تطلب منك تعد النقدية في الدرج وتدخل المبلغ الفعلي. بعدها تحسب الفرق — زيادة أو عجز — وتسجله في سجل دائم ما يتعدل.'),
      featureTitle('🧾 مصروفات يومية من الدرج'),
      featureDesc('لو صرفت فلوس من الدرج على مصروف تشغيلي (صيانة، توصيل، غيره)، تسجله مع السبب والتصنيف. المبلغ ينخصم تلقائياً من النقدية المتوقعة للوردية.'),
      featureTitle('🎯 دقة حسابية بالملي-دينار'),
      featureDesc('المنظومة تخزن المبالغ بدقة 3 خانات عشرية (0.000 د.ل) وتستخدم طريقة حساب تمنع أخطاء التقريب اللي تصير في المنظومات الثانية لما تتعامل مع أرقام كثيرة.'),

      // ─── Section 7 ───
      sectionHeading(7, 'الأمن والصلاحيات والنسخ الاحتياطي'),
      desc('نظام صلاحيات يفرق بين المدير والبائع، مع سجل رقابة يوثق كل عملية. والنسخ الاحتياطي والاستعادة بنقرة واحدة.'),

      featureTitle('🔑 تبديل سريع برمز PIN'),
      featureDesc('على نفس الجهاز، الكاشير يتبدل بإدخال رمز 4 أرقام بدون ما يسجل خروج كامل. العملية فورية ولا تعطل سير العمل.'),
      featureTitle('📋 سجل رقابة شامل'),
      featureDesc('كل عملية — دخول النظام، إلغاء فاتورة، تعديل مخزون، إضافة موظف — تتسجل باسم المستخدم والوقت والتاريخ. ما فيه شيء يمر بدون أثر.'),
      featureTitle('💾 نسخ احتياطي بنقرة واحدة'),
      featureDesc('تنشئ نسخة احتياطية مضغوطة لكل بيانات المنظومة بضغطة زر. ولو حصلت مشكلة، تقدر تسترجع النسخة بنفس السهولة.'),

      // ─── Section 8 ───
      sectionHeading(8, 'مقارنة مع البدائل المتاحة'),
      desc('مقارنة عملية بين منظومة Flow والبدائل السحابية والمنظومات التقليدية على 15 معياراً أساسياً.'),

      // ─── Comparison Table ───
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          new TableRow({ children: [headerCell('المعيار'), headerCell('منظومة Flow'), headerCell('البدائل السحابية'), headerCell('المنظومات التقليدية')] }),
          new TableRow({ children: [labelCell('العمل بدون إنترنت'), yesCell('تعمل 100% بدون إنترنت'), noCell('تحتاج اتصال مستمر'), yesCell('تعمل بدون إنترنت')] }),
          new TableRow({ children: [labelCell('التشغيل على جهاز واحد'), yesCell('جاهزة فوراً'), noCell('تحتاج متصفح وإنترنت'), yesCell('تعمل على جهاز واحد')] }),
          new TableRow({ children: [labelCell('ربط أجهزة عبر شبكة محلية'), yesCell('ربط بدون إنترنت'), noCell('تحتاج إنترنت لكل جهاز'), noCell('إعداد معقد')] }),
          new TableRow({ children: [labelCell('الرسوم الشهرية'), yesCell('ملكية دائمة — بدون اشتراك'), noCell('رسوم شهرية أو سنوية'), yesCell('شراء مرة واحدة')] }),
          new TableRow({ children: [labelCell('خصوصية البيانات'), yesCell('البيانات في جهازك'), noCell('البيانات على سيرفرات خارجية'), yesCell('بيانات محلية')] }),
          new TableRow({ children: [labelCell('تمريز مزدوج (معدات + مستهلكات)'), yesCell('سيريال + دفعة + صلاحية'), noCell('كميات مجردة فقط'), noCell('كميات مجردة')] }),
          new TableRow({ children: [labelCell('فواتير A4 مع تفقيط عربي'), yesCell('فواتير A4 + تفقيط + ضمان'), midCell('فواتير عامة بسيطة'), noCell('غير متوفر')] }),
          new TableRow({ children: [labelCell('إيصالات حرارية 80mm مع QR'), yesCell('طباعة سريعة + كود QR'), yesCell('تدعم الطباعة'), midCell('طباعة بدون QR')] }),
          new TableRow({ children: [labelCell('كشوفات حساب زبائن وموردين'), yesCell('كشوف حساب تفصيلية A4'), midCell('تقارير مجمعة'), noCell('غير متوفرة')] }),
          new TableRow({ children: [labelCell('دقة 3 خانات عشرية'), yesCell('دقة 0.000 د.ل'), noCell('خانتين فقط'), noCell('خانتين فقط')] }),
          new TableRow({ children: [labelCell('تحديث تكلفة الصنف تلقائياً'), yesCell('تلقائي مع كل عملية شراء'), noCell('سعر ثابت أو يدوي'), noCell('غير متوفر')] }),
          new TableRow({ children: [labelCell('وردية مالية موحدة + مطابقة'), yesCell('وردية مشتركة + فارق محسوب'), midCell('ورديات منفصلة'), noCell('بدون مطابقة')] }),
          new TableRow({ children: [labelCell('تبديل موظفين برمز PIN'), yesCell('تبديل فوري بـ PIN'), noCell('تسجيل خروج ودخول كامل'), noCell('كلمة سر واحدة للجميع')] }),
          new TableRow({ children: [labelCell('نسخ احتياطي بنقرة واحدة'), yesCell('نسخ واستعادة فورية'), noCell('لا تستطيع تحميل بياناتك'), noCell('إعداد يدوي معقد')] }),
          new TableRow({ children: [labelCell('سرعة معالجة الفواتير'), yesCell('استجابة فورية محلياً'), noCell('تتأثر بسرعة الإنترنت'), midCell('تبطئ مع كثرة البيانات')] }),
        ],
      }),

      // ─── Usage Scenarios ───
      new Paragraph({ spacing: { before: 360 }, bidirectional: true, alignment: AlignmentType.RIGHT, children: [
        new TextRun({ text: 'من واقع الاستخدام', font: FONT, bold: true, size: 24, color: GOLD, rightToLeft: true }),
      ] }),

      ...scenario(
        'في رمضان الطلب يكون مضاعف وأحياناً النت يقطع لساعات. المنظومة ما توقفت ولا مرة — الفواتير والمخزون كله يشتغل عادي لأن ما لها علاقة بالنت أصلاً.',
        'صاحب محل مستلزمات مقاهي'
      ),
      ...scenario(
        'في أوقات الذروة، أمرر الباركود وتطلع الفاتورة وتتطبع في ثواني. الزبون ما يستنى والطابور يمشي بسرعة. وإذا الزبون على حساب، أختاره بضغطة وحدة.',
        'كاشير نقطة بيع'
      ),
      ...scenario(
        'أول ما نقفل الوردية، النظام يقولي المفروض كم في الدرج. مرة لقينا عجز 15 دينار — النظام سجله وما نقدر نعدله. هذي الرقابة اللي كنت أدور عليها.',
        'مدير محل'
      ),

      // ─── Closing Callout ───
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 360, after: 60 },
        border: {
          right: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 8 },
        },
        shading: { type: ShadingType.SOLID, color: LIGHT_BG },
        indent: { right: 100 },
        children: [
          new TextRun({ text: 'خلاصة: ', font: FONT, bold: true, size: 22, color: GOLD, rightToLeft: true }),
          new TextRun({
            text: 'منظومة Flow تجمع لك بين السرعة المحلية اللي ما تعتمد على إنترنت، ودقة حسابية بالملي-دينار، وطباعة فواتير رسمية ومتخصصة، ورقابة مالية صارمة على الورديات والنقدية. ملكية دائمة بدون رسوم شهرية — تستثمر مرة واحدة وتشتغل عليها على طول.',
            font: FONT, size: 20, color: '333333', rightToLeft: true,
          }),
        ],
      }),
    ],
  }],
});

// ─── Write to disk ───
const buffer = await Packer.toBuffer(doc);
writeFileSync('d:/projects/pos/دليل-مميزات-منظومة-Flow.docx', buffer);
console.log('✅ Created: d:/projects/pos/دليل-مميزات-منظومة-Flow.docx');
