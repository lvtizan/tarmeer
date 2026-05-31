export interface FaqItem {
  q: { en: string; ar: string };
  a: { en: string; ar: string };
}

export interface FaqCategory {
  title: { en: string; ar: string };
  items: FaqItem[];
}

export const FAQ_DATA: FaqCategory[] = [
  {
    title: { en: 'Finding Design Companies', ar: 'البحث عن شركات التصميم' },
    items: [
      {
        q: { en: 'How do I choose an interior design company in the UAE?', ar: 'كيف أختار شركة تصميم داخلي في الإمارات؟' },
        a: { en: 'Look at their portfolio for projects similar to yours, check client reviews, verify they are licensed in the UAE, and ensure their style matches your vision. On Tarmeer, you can compare 50+ verified interior design companies across Dubai, Abu Dhabi, Sharjah, and other emirates — each with verified portfolios and direct contact.', ar: 'اطلع على مشاريعهم السابقة المشابهة لمشروعك، وتحقق من تقييمات العملاء، وتأكد من أنهم مرخصون في الإمارات، وأن أسلوبهم يتناسب مع رؤيتك. على تعمير، يمكنك مقارنة أكثر من 50 شركة تصميم داخلي معتمدة في دبي وأبوظبي والشارقة وغيرها — كل منها بمعرض أعمال موثق وتواصل مباشر.' },
      },
      {
        q: { en: 'How much does interior design cost in the UAE?', ar: 'كم تكلفة التصميم الداخلي في الإمارات؟' },
        a: { en: 'Interior design fees in the UAE typically range from AED 50 to AED 250 per square foot, depending on the scope, materials, and designer experience. A full villa design (300-500 sqm) may cost AED 80,000 to AED 400,000 including design fees and fit-out. Apartment renovations usually range from AED 30,000 to AED 150,000. Request quotes from multiple companies on Tarmeer to compare.', ar: 'تتراوح رسوم التصميم الداخلي في الإمارات عادةً من 50 إلى 250 درهم للقدم المربع، حسب النطاق والمواد وخبرة المصمم. قد يكلف تصميم فيلا كاملة (300-500 متر مربع) من 80,000 إلى 400,000 درهم شاملة رسوم التصميم والتنفيذ. تجديد الشقق عادةً يتراوح من 30,000 إلى 150,000 درهم. اطلب عروض أسعار من شركات متعددة على تعمير للمقارنة.' },
      },
      {
        q: { en: 'What should I look for in a design company portfolio?', ar: 'ما الذي يجب أن أبحث عنه في معرض أعمال شركة التصميم؟' },
        a: { en: 'Focus on projects similar to your property type (villa, apartment, office), check if they handle your preferred style (modern, Arabic, minimalist), look for before/after transformations, and verify they work in your emirate. High-resolution project photos with detailed descriptions indicate professionalism.', ar: 'ركز على المشاريع المشابهة لنوع عقارك (فيلا، شقة، مكتب)، وتحقق من أنهم يعملون بأسلوبك المفضل (حديث، عربي، بسيط)، وابحث عن صور قبل وبعد التحول، وتأكد من أنهم يعملون في إمارتك. الصور عالية الجودة مع الأوصاف التفصيلية تدل على الاحترافية.' },
      },
      {
        q: { en: 'Can I hire a designer from another emirate?', ar: 'هل يمكنني توظيف مصمم من إمارة أخرى؟' },
        a: { en: 'Yes, many design companies in the UAE operate across multiple emirates. A Dubai-based firm can handle projects in Abu Dhabi, Sharjah, or Ajman. Discuss travel fees and site visit logistics upfront. On Tarmeer, filter companies by their service areas to find those covering your location.', ar: 'نعم، العديد من شركات التصميم في الإمارات تعمل عبر إمارات متعددة. يمكن لشركة مقرها دبي تنفيذ مشاريع في أبوظبي أو الشارقة أو عجمان. ناقش رسوم التنقل وزيارات الموقع مسبقاً. على تعمير، يمكنك تصفية الشركات حسب مناطق خدمتها للعثور على من يغطي موقعك.' },
      },
      {
        q: { en: 'Do I need a permit for interior renovation in Dubai?', ar: 'هل أحتاج تصريح لتجديد الديكور الداخلي في دبي؟' },
        a: { en: 'Yes, most interior fit-out work in Dubai requires a permit from the relevant municipality or free zone authority. Your design company should handle the permit process as part of their service. Structural changes, MEP modifications, and commercial fit-outs always require permits. Simple cosmetic changes like painting may not.', ar: 'نعم، معظم أعمال التجهيز الداخلي في دبي تتطلب تصريحاً من البلدية أو سلطة المنطقة الحرة المختصة. يجب أن تتولى شركة التصميم عملية التصريح كجزء من خدماتها. التغييرات الهيكلية وتعديلات الأنظمة الكهربائية والميكانيكية والتجهيزات التجارية تتطلب دائماً تصاريح. التغييرات التجميلية البسيطة مثل الطلاء قد لا تحتاج.' },
      },
    ],
  },
  {
    title: { en: 'Design Inspiration & Styles', ar: 'إلهام التصميم والأنماط' },
    items: [
      {
        q: { en: 'What are the most popular interior design styles in UAE homes?', ar: 'ما هي أنماط التصميم الداخلي الأكثر شعبية في المنازل الإماراتية؟' },
        a: { en: 'The most popular styles in UAE homes are Modern Contemporary (clean lines, neutral palettes), Luxury Arabic (ornate details, gold accents, marble), Modern Arabic (traditional motifs with contemporary execution), and Minimalist (functional, clutter-free). Villa owners often prefer Modern Arabic or Luxury styles, while apartment residents lean toward Contemporary or Scandinavian-inspired designs.', ar: 'الأنماط الأكثر شعبية في المنازل الإماراتية هي المعاصر الحديث (خطوط نظيفة، ألوان محايدة)، العربي الفاخر (تفاصيل مزخرفة، لمسات ذهبية، رخام)، العربي الحديث (زخارف تقليدية بتنفيذ معاصر)، والبسيط (عملي، خالي من الفوضى). يفضل أصحاب الفلل عادةً الأسلوب العربي الحديث أو الفاخر، بينما يميل سكان الشقق إلى التصميم المعاصر أو المستوحى من الطراز الاسكندنافي.' },
      },
      {
        q: { en: 'How is villa design different from apartment design in the UAE?', ar: 'كيف يختلف تصميم الفلل عن تصميم الشقق في الإمارات؟' },
        a: { en: 'Villa design involves exterior facades, landscaping, multiple floors with staircase design, majlis/formal areas, and often servant quarters. Apartment design focuses on maximizing limited space, storage solutions, and working within fixed layouts. Villas typically cost 2-3x more due to larger area and greater complexity. Both benefit from climate-appropriate materials that handle UAE humidity and heat.', ar: 'يشمل تصميم الفلل الواجهات الخارجية والمناظر الطبيعية والطوابق المتعددة مع تصميم الدرج والمجلس والمناطق الرسمية وغالباً غرف الخدم. يركز تصميم الشقق على تعظيم المساحة المحدودة وحلول التخزين والعمل ضمن تخطيطات ثابتة. تكلفة الفلل عادةً 2-3 أضعاف بسبب المساحة الأكبر والتعقيد الأكثر. كلاهما يستفيد من مواد مناسبة للمناخ تتحمل رطوبة وحرارة الإمارات.' },
      },
      {
        q: { en: 'What design trends are popular in Dubai right now?', ar: 'ما هي اتجاهات التصميم الرائجة في دبي حالياً؟' },
        a: { en: 'Current Dubai design trends include: biophilic design (indoor greenery, natural materials), warm minimalism (beige/terracotta palettes replacing cool grays), statement lighting as sculptural art, integrated smart home technology, sustainable and locally-sourced materials, and mixed-use spaces that combine living with home offices. Japanese-inspired wabi-sabi aesthetics are also gaining popularity.', ar: 'تشمل اتجاهات التصميم الحالية في دبي: التصميم البيوفيلي (النباتات الداخلية، المواد الطبيعية)، البساطة الدافئة (ألوان البيج/التيراكوتا بدلاً من الرمادي البارد)، الإضاءة المميزة كفن نحتي، تكنولوجيا المنزل الذكي المدمجة، المواد المستدامة والمحلية، والمساحات متعددة الاستخدام التي تجمع بين السكن والمكتب المنزلي. جماليات الوابي-سابي اليابانية أيضاً تكتسب شعبية.' },
      },
      {
        q: { en: 'How do I design a modern majlis?', ar: 'كيف أصمم مجلساً عصرياً؟' },
        a: { en: 'A modern majlis blends traditional Arabian hospitality with contemporary design. Key elements include: low-profile seating along walls (but with modern upholstery), a mix of Arabic geometric patterns with clean lines, warm lighting with decorative lanterns or statement chandeliers, quality materials like marble flooring with carpet accents, and technology integration (hidden speakers, smart lighting). Many UAE designers specialize in modern majlis design — browse their work on Tarmeer.', ar: 'يمزج المجلس العصري بين الضيافة العربية التقليدية والتصميم المعاصر. العناصر الأساسية تشمل: مقاعد منخفضة على طول الجدران (لكن بتنجيد عصري)، مزيج من الأنماط الهندسية العربية مع الخطوط النظيفة، إضاءة دافئة مع فوانيس مزخرفة أو ثريات مميزة، مواد عالية الجودة مثل أرضيات الرخام مع لمسات السجاد، وتكامل التكنولوجيا (سماعات مخفية، إضاءة ذكية). العديد من مصممي الإمارات متخصصون في تصميم المجالس العصرية — تصفح أعمالهم على تعمير.' },
      },
      {
        q: { en: 'What materials work best for UAE climate?', ar: 'ما هي المواد الأفضل لمناخ الإمارات؟' },
        a: { en: 'For UAE interiors, choose materials that handle high humidity and temperature fluctuations: porcelain/ceramic tiles over hardwood (more stable), engineered stone over natural marble for countertops (less porous), moisture-resistant MDF for cabinetry, fade-resistant fabrics for sun-exposed areas, and anti-microbial finishes for bathrooms. For exteriors, use UV-resistant paints and thermal-insulating cladding.', ar: 'لداخل المنازل الإماراتية، اختر مواد تتحمل الرطوبة العالية وتقلبات الحرارة: بلاط البورسلين/السيراميك بدلاً من الخشب الصلب (أكثر استقراراً)، الحجر الصناعي بدلاً من الرخام الطبيعي لأسطح العمل (أقل مسامية)، خشب MDF المقاوم للرطوبة للخزائن، أقمشة مقاومة للبهتان للمناطق المعرضة للشمس، وتشطيبات مضادة للميكروبات للحمامات. للخارج، استخدم دهانات مقاومة للأشعة فوق البنفسجية وكسوة عازلة حرارياً.' },
      },
    ],
  },
  {
    title: { en: 'Renovation Services & Process', ar: 'خدمات التجديد والعملية' },
    items: [
      {
        q: { en: 'What is the typical renovation process in the UAE?', ar: 'ما هي عملية التجديد النموذجية في الإمارات؟' },
        a: { en: 'The typical process: 1) Initial consultation and site visit, 2) Concept design with mood boards, 3) Detailed drawings and 3D renderings, 4) Material selection and quotation, 5) Permit application (if needed), 6) Demolition and construction, 7) MEP rough-in (electrical, plumbing, AC), 8) Finishing works (flooring, painting, fixtures), 9) Furniture installation and styling, 10) Final walkthrough and handover. Timeline: 2-6 months depending on scope.', ar: 'العملية النموذجية: 1) استشارة أولية وزيارة للموقع، 2) تصميم مفاهيمي مع لوحات المزاج، 3) رسومات تفصيلية وتصورات ثلاثية الأبعاد، 4) اختيار المواد وعرض السعر، 5) طلب التصريح (إذا لزم الأمر)، 6) الهدم والبناء، 7) التمديدات (الكهرباء، السباكة، التكييف)، 8) أعمال التشطيب (الأرضيات، الطلاء، التركيبات)، 9) تركيب الأثاث والتنسيق، 10) الجولة النهائية والتسليم. المدة: 2-6 أشهر حسب النطاق.' },
      },
      {
        q: { en: 'How long does a full home renovation take in Dubai?', ar: 'كم تستغرق عملية تجديد منزل كامل في دبي؟' },
        a: { en: 'A full home renovation in Dubai typically takes: Studio/1BR apartment: 4-8 weeks, 2-3BR apartment: 8-12 weeks, Villa (up to 400 sqm): 3-5 months, Large villa (400+ sqm): 5-8 months. Add 2-4 weeks for design phase and 1-3 weeks for permit processing. Delays can occur due to material shipping (especially imported items), permit revisions, or scope changes.', ar: 'يستغرق التجديد الكامل في دبي عادةً: استوديو/غرفة واحدة: 4-8 أسابيع، شقة 2-3 غرف: 8-12 أسبوع، فيلا (حتى 400 متر مربع): 3-5 أشهر، فيلا كبيرة (400+ متر مربع): 5-8 أشهر. أضف 2-4 أسابيع لمرحلة التصميم و1-3 أسابيع لمعالجة التصاريح. قد تحدث تأخيرات بسبب شحن المواد (خاصة المستوردة) أو مراجعات التصاريح أو تغييرات النطاق.' },
      },
      {
        q: { en: 'What is the difference between design-only and design-build services?', ar: 'ما الفرق بين خدمات التصميم فقط وخدمات التصميم والبناء؟' },
        a: { en: 'Design-only: the firm creates drawings, 3D renders, and specifications, then you hire a separate contractor to execute. Design-build (turnkey): one company handles everything from concept to completed space. Design-build is usually 10-15% more expensive but offers single accountability, faster timelines, and better quality control. Most UAE homeowners prefer design-build for convenience.', ar: 'التصميم فقط: تقوم الشركة بإنشاء الرسومات والتصورات ثلاثية الأبعاد والمواصفات، ثم تستأجر مقاولاً منفصلاً للتنفيذ. التصميم والبناء (تسليم مفتاح): شركة واحدة تتولى كل شيء من المفهوم إلى المساحة المكتملة. التصميم والبناء عادةً أغلى بنسبة 10-15% لكنه يوفر مسؤولية واحدة وجداول زمنية أسرع ومراقبة جودة أفضل. معظم أصحاب المنازل في الإمارات يفضلون التصميم والبناء للراحة.' },
      },
      {
        q: { en: 'What services does Tarmeer offer for new home design?', ar: 'ما هي خدمات تعمير لتصميم المنازل الجديدة؟' },
        a: { en: 'Tarmeer offers three core design packages: 1) New Home Design — floor plans, 3D renderings, construction drawings, and full material specifications for new builds. 2) Soft Decoration — furniture selection, color schemes, lighting plans, and styling for move-in ready spaces. 3) House Exterior Design — facade concepts, material selection, and construction-ready exterior documentation. Each package includes consultation, visualization, and documentation delivery.', ar: 'تقدم تعمير ثلاث حزم تصميم أساسية: 1) تصميم المنزل الجديد — مخططات الطوابق، تصورات ثلاثية الأبعاد، رسومات البناء، ومواصفات المواد الكاملة للبناء الجديد. 2) الديكور الناعم — اختيار الأثاث، مخططات الألوان، خطط الإضاءة، والتنسيق للمساحات الجاهزة للسكن. 3) تصميم واجهات المنازل — مفاهيم الواجهات، اختيار المواد، ووثائق خارجية جاهزة للبناء. كل حزمة تتضمن استشارة وتصوراً وتسليم الوثائق.' },
      },
      {
        q: { en: 'How do I get started with a renovation project?', ar: 'كيف أبدأ مشروع تجديد؟' },
        a: { en: 'Start by: 1) Defining your budget range, 2) Collecting inspiration images (Pinterest, Instagram, or browse Tarmeer portfolios), 3) Listing your must-haves vs nice-to-haves, 4) Browsing companies on Tarmeer filtered by your city, style preference, and budget, 5) Contacting 2-3 companies for initial consultations (most offer complimentary initial consultations), 6) Comparing proposals and portfolios before committing. Tarmeer makes step 4 easy with detailed company profiles and verified project galleries.', ar: 'ابدأ بـ: 1) تحديد نطاق ميزانيتك، 2) جمع صور إلهام (بينترست، إنستغرام، أو تصفح معارض تعمير)، 3) إعداد قائمة بالأولويات مقابل الرغبات، 4) تصفح الشركات على تعمير مصفاة حسب مدينتك وتفضيل الأسلوب والميزانية، 5) التواصل مع 2-3 شركات للاستشارات الأولية (معظمها تقدم استشارات أولية مجانية)، 6) مقارنة العروض والمعارض قبل الالتزام. تعمير يسهل الخطوة 4 مع ملفات تعريف الشركات التفصيلية ومعارض المشاريع الموثقة.' },
      },
    ],
  },
];
