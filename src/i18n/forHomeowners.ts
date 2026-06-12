// 语言维度统一到国家配置中心一处定义（SiteLang），避免与 country.ts 重复定义漂移。
import type { SiteLang } from '@/lib/country';
export type Lang = SiteLang;

const translations = {
  en: {
    // Header
    backToTarmeer: 'Back to Tarmeer',
    // Hero
    tagline: 'Find Your Perfect Renovation Company',
    headline: 'Transform Your Home in UAE',
    subtitle: 'Compare verified companies, browse real portfolios, and get free quotes — all in one place.',
    // Form
    formTitle: 'Get Free Quotes',
    area: 'Area (m\u00B2)',
    areaPlaceholder: 'e.g. 150',
    city: 'City',
    cityPlaceholder: 'Select your city',
    phone: 'Phone Number',
    phonePlaceholder: 'e.g. 50 123 4567',
    submit: 'Get Free Quotes',
    submitting: 'Submitting...',
    successTitle: 'Request received!',
    successMessage: 'Our team will match you with the best companies for your project. Expect a call within 24 hours.',
    successBrowse: 'Browse Companies',
    // Pain points
    painTitle: 'Why Homeowners Choose Tarmeer',
    pain1Title: 'Compare & Save',
    pain1Desc: 'Get multiple quotes from verified companies. No more guessing on price — see real market rates side by side.',
    pain2Title: 'Real Portfolios',
    pain2Desc: 'Browse thousands of actual project photos. See the quality of work before you commit.',
    pain3Title: 'Expert Matching',
    pain3Desc: 'Tell us your requirements and budget. We match you with companies that specialize in your project type.',
    // How it works
    howTitle: 'How It Works',
    step1Title: 'Submit Your Requirements',
    step1Desc: 'Tell us about your space, style preferences, and budget. Takes less than 2 minutes.',
    step2Title: 'Get Matched',
    step2Desc: 'We connect you with 3-5 pre-vetted companies that fit your project scope and budget.',
    step3Title: 'Start Your Project',
    step3Desc: 'Compare proposals, visit showrooms, and pick the company you trust. We stay with you throughout.',
    // Trust
    trustTitle: 'Trusted by Homeowners Across UAE',
    trustCompanies: 'Verified Companies',
    trustProjects: 'Project Photos',
    trustCities: 'Cities Covered',
    // Footer
    privacy: 'Privacy Policy',
    contactUs: 'Contact Us',
  },
  ar: {
    backToTarmeer: '\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u062a\u0631\u0645\u064a\u0631',
    tagline: '\u0627\u0639\u062b\u0631 \u0639\u0644\u0649 \u0634\u0631\u0643\u0629 \u0627\u0644\u062a\u062c\u062f\u064a\u062f \u0627\u0644\u0645\u062b\u0627\u0644\u064a\u0629',
    headline: '\u062d\u0648\u0651\u0644 \u0645\u0646\u0632\u0644\u0643 \u0641\u064a \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a',
    subtitle: '\u0642\u0627\u0631\u0646 \u0627\u0644\u0634\u0631\u0643\u0627\u062a \u0627\u0644\u0645\u0648\u062b\u0642\u0629\u060c \u062a\u0635\u0641\u062d \u0623\u0639\u0645\u0627\u0644\u0647\u0645 \u0627\u0644\u062d\u0642\u064a\u0642\u064a\u0629\u060c \u0648\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0639\u0631\u0648\u0636 \u0623\u0633\u0639\u0627\u0631 \u0645\u062c\u0627\u0646\u064a\u0629.',
    formTitle: '\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0639\u0631\u0648\u0636 \u0623\u0633\u0639\u0627\u0631 \u0645\u062c\u0627\u0646\u064a\u0629',
    area: '\u0627\u0644\u0645\u0633\u0627\u062d\u0629 (m\u00B2)',
    areaPlaceholder: '\u0645\u062b\u0627\u0644: 150',
    city: '\u0627\u0644\u0645\u062f\u064a\u0646\u0629',
    cityPlaceholder: '\u0627\u062e\u062a\u0631 \u0645\u062f\u064a\u0646\u062a\u0643',
    phone: '\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641',
    phonePlaceholder: '\u0645\u062b\u0627\u0644: 50 123 4567',
    submit: '\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0639\u0631\u0648\u0636 \u0623\u0633\u0639\u0627\u0631',
    submitting: '\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0631\u0633\u0627\u0644...',
    successTitle: '\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0637\u0644\u0628\u0643!',
    successMessage: '\u0633\u064a\u0642\u0648\u0645 \u0641\u0631\u064a\u0642\u0646\u0627 \u0628\u0645\u0637\u0627\u0628\u0642\u062a\u0643 \u0645\u0639 \u0623\u0641\u0636\u0644 \u0627\u0644\u0634\u0631\u0643\u0627\u062a. \u062a\u0648\u0642\u0639 \u0627\u062a\u0635\u0627\u0644\u0627\u064b \u062e\u0644\u0627\u0644 24 \u0633\u0627\u0639\u0629.',
    successBrowse: '\u062a\u0635\u0641\u062d \u0627\u0644\u0634\u0631\u0643\u0627\u062a',
    painTitle: '\u0644\u0645\u0627\u0630\u0627 \u064a\u062e\u062a\u0627\u0631 \u0623\u0635\u062d\u0627\u0628 \u0627\u0644\u0645\u0646\u0627\u0632\u0644 \u062a\u0631\u0645\u064a\u0631',
    pain1Title: '\u0642\u0627\u0631\u0646 \u0648\u0648\u0641\u0651\u0631',
    pain1Desc: '\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0639\u062f\u0629 \u0639\u0631\u0648\u0636 \u0623\u0633\u0639\u0627\u0631 \u0645\u0646 \u0634\u0631\u0643\u0627\u062a \u0645\u0648\u062b\u0642\u0629. \u0634\u0627\u0647\u062f \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u062d\u0642\u064a\u0642\u064a\u0629 \u062c\u0646\u0628\u0627\u064b \u0625\u0644\u0649 \u062c\u0646\u0628.',
    pain2Title: '\u0623\u0639\u0645\u0627\u0644 \u062d\u0642\u064a\u0642\u064a\u0629',
    pain2Desc: '\u062a\u0635\u0641\u062d \u0622\u0644\u0627\u0641 \u0635\u0648\u0631 \u0627\u0644\u0645\u0634\u0627\u0631\u064a\u0639 \u0627\u0644\u062d\u0642\u064a\u0642\u064a\u0629. \u0634\u0627\u0647\u062f \u062c\u0648\u062f\u0629 \u0627\u0644\u0639\u0645\u0644 \u0642\u0628\u0644 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645.',
    pain3Title: '\u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u062e\u0628\u0631\u0627\u0621',
    pain3Desc: '\u0623\u062e\u0628\u0631\u0646\u0627 \u0628\u0645\u062a\u0637\u0644\u0628\u0627\u062a\u0643 \u0648\u0645\u064a\u0632\u0627\u0646\u064a\u062a\u0643. \u0646\u0637\u0627\u0628\u0642\u0643 \u0645\u0639 \u0634\u0631\u0643\u0627\u062a \u0645\u062a\u062e\u0635\u0635\u0629 \u0641\u064a \u0646\u0648\u0639 \u0645\u0634\u0631\u0648\u0639\u0643.',
    howTitle: '\u0643\u064a\u0641 \u064a\u0639\u0645\u0644',
    step1Title: '\u0623\u0631\u0633\u0644 \u0645\u062a\u0637\u0644\u0628\u0627\u062a\u0643',
    step1Desc: '\u0623\u062e\u0628\u0631\u0646\u0627 \u0639\u0646 \u0645\u0633\u0627\u062d\u062a\u0643 \u0648\u062a\u0641\u0636\u064a\u0644\u0627\u062a\u0643 \u0648\u0645\u064a\u0632\u0627\u0646\u064a\u062a\u0643. \u064a\u0633\u062a\u063a\u0631\u0642 \u0623\u0642\u0644 \u0645\u0646 \u062f\u0642\u064a\u0642\u062a\u064a\u0646.',
    step2Title: '\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629',
    step2Desc: '\u0646\u0631\u0628\u0637\u0643 \u0628 3-5 \u0634\u0631\u0643\u0627\u062a \u0645\u0648\u062b\u0642\u0629 \u062a\u0646\u0627\u0633\u0628 \u0646\u0637\u0627\u0642 \u0645\u0634\u0631\u0648\u0639\u0643 \u0648\u0645\u064a\u0632\u0627\u0646\u064a\u062a\u0643.',
    step3Title: '\u0627\u0628\u062f\u0623 \u0645\u0634\u0631\u0648\u0639\u0643',
    step3Desc: '\u0642\u0627\u0631\u0646 \u0627\u0644\u0639\u0631\u0648\u0636\u060c \u0632\u0631 \u0627\u0644\u0645\u0639\u0627\u0631\u0636\u060c \u0648\u0627\u062e\u062a\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u0627\u0644\u062a\u064a \u062a\u062b\u0642 \u0628\u0647\u0627.',
    trustTitle: '\u0645\u0648\u062b\u0648\u0642 \u0645\u0646 \u0623\u0635\u062d\u0627\u0628 \u0627\u0644\u0645\u0646\u0627\u0632\u0644 \u0641\u064a \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a',
    trustCompanies: '\u0634\u0631\u0643\u0629 \u0645\u0648\u062b\u0642\u0629',
    trustProjects: '\u0635\u0648\u0631\u0629 \u0645\u0634\u0631\u0648\u0639',
    trustCities: '\u0645\u062f\u0646 \u0645\u063a\u0637\u0627\u0629',
    privacy: '\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629',
    contactUs: '\u0627\u062a\u0635\u0644 \u0628\u0646\u0627',
  },
  vi: {
    // Header
    backToTarmeer: 'Quay l\u1ea1i Tarmeer',
    // Hero
    tagline: 'T\u00ecm C\u00f4ng ty C\u1ea3i t\u1ea1o Ho\u00e0n h\u1ea3o cho B\u1ea1n',
    headline: 'C\u1ea3i t\u1ea1o Ng\u00f4i nh\u00e0 c\u1ee7a B\u1ea1n t\u1ea1i Vi\u1ec7t Nam',
    subtitle: 'So s\u00e1nh c\u00e1c c\u00f4ng ty \u0111\u00e3 x\u00e1c minh, xem portfolio th\u1ef1c t\u1ebf v\u00e0 nh\u1eadn b\u00e1o gi\u00e1 mi\u1ec5n ph\u00ed \u2014 t\u1ea5t c\u1ea3 t\u1ea1i m\u1ed9t n\u01a1i.',
    // Form
    formTitle: 'Nh\u1eadn B\u00e1o gi\u00e1 Mi\u1ec5n ph\u00ed',
    area: 'Di\u1ec7n t\u00edch (m\u00b2)',
    areaPlaceholder: 'VD: 150',
    city: 'Th\u00e0nh ph\u1ed1',
    cityPlaceholder: 'Ch\u1ecdn th\u00e0nh ph\u1ed1 c\u1ee7a b\u1ea1n',
    phone: 'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i',
    phonePlaceholder: 'VD: 090 123 4567',
    submit: 'Nh\u1eadn B\u00e1o gi\u00e1 Mi\u1ec5n ph\u00ed',
    submitting: '\u0110ang g\u1eedi...',
    successTitle: '\u0110\u00e3 nh\u1eadn y\u00eau c\u1ea7u!',
    successMessage: '\u0110\u1ed9i ng\u0169 c\u1ee7a ch\u00fang t\u00f4i s\u1ebd k\u1ebft n\u1ed1i b\u1ea1n v\u1edbi nh\u1eefng c\u00f4ng ty ph\u00f9 h\u1ee3p nh\u1ea5t cho d\u1ef1 \u00e1n c\u1ee7a b\u1ea1n. B\u1ea1n s\u1ebd nh\u1eadn \u0111\u01b0\u1ee3c cu\u1ed9c g\u1ecdi trong v\u00f2ng 24 gi\u1edd.',
    successBrowse: 'Xem c\u00e1c C\u00f4ng ty',
    // Pain points
    painTitle: 'V\u00ec sao Ch\u1ee7 nh\u00e0 ch\u1ecdn Tarmeer',
    pain1Title: 'So s\u00e1nh & Ti\u1ebft ki\u1ec7m',
    pain1Desc: 'Nh\u1eadn nhi\u1ec1u b\u00e1o gi\u00e1 t\u1eeb c\u00e1c c\u00f4ng ty \u0111\u00e3 x\u00e1c minh. Kh\u00f4ng c\u00f2n \u0111o\u00e1n m\u00f2 v\u1ec1 gi\u00e1 \u2014 xem gi\u00e1 th\u1ecb tr\u01b0\u1eddng th\u1ef1c t\u1ebf c\u1ea1nh nhau.',
    pain2Title: 'Portfolio Th\u1ef1c t\u1ebf',
    pain2Desc: 'Xem h\u00e0ng ngh\u00ecn \u1ea3nh d\u1ef1 \u00e1n th\u1ef1c t\u1ebf. \u0110\u00e1nh gi\u00e1 ch\u1ea5t l\u01b0\u1ee3ng c\u00f4ng vi\u1ec7c tr\u01b0\u1edbc khi quy\u1ebft \u0111\u1ecbnh.',
    pain3Title: 'K\u1ebft n\u1ed1i Chuy\u00ean gia',
    pain3Desc: 'Cho ch\u00fang t\u00f4i bi\u1ebft y\u00eau c\u1ea7u v\u00e0 ng\u00e2n s\u00e1ch c\u1ee7a b\u1ea1n. Ch\u00fang t\u00f4i k\u1ebft n\u1ed1i b\u1ea1n v\u1edbi nh\u1eefng c\u00f4ng ty chuy\u00ean v\u1ec1 lo\u1ea1i d\u1ef1 \u00e1n c\u1ee7a b\u1ea1n.',
    // How it works
    howTitle: 'C\u00e1ch th\u1ee9c Ho\u1ea1t \u0111\u1ed9ng',
    step1Title: 'G\u1eedi Y\u00eau c\u1ea7u c\u1ee7a B\u1ea1n',
    step1Desc: 'Cho ch\u00fang t\u00f4i bi\u1ebft v\u1ec1 kh\u00f4ng gian, phong c\u00e1ch y\u00eau th\u00edch v\u00e0 ng\u00e2n s\u00e1ch c\u1ee7a b\u1ea1n. Ch\u1ec9 m\u1ea5t ch\u01b0a \u0111\u1ebfn 2 ph\u00fat.',
    step2Title: '\u0110\u01b0\u1ee3c K\u1ebft n\u1ed1i',
    step2Desc: 'Ch\u00fang t\u00f4i k\u1ebft n\u1ed1i b\u1ea1n v\u1edbi 3-5 c\u00f4ng ty \u0111\u00e3 \u0111\u01b0\u1ee3c tuy\u1ec3n ch\u1ecdn ph\u00f9 h\u1ee3p v\u1edbi quy m\u00f4 v\u00e0 ng\u00e2n s\u00e1ch d\u1ef1 \u00e1n c\u1ee7a b\u1ea1n.',
    step3Title: 'B\u1eaft \u0111\u1ea7u D\u1ef1 \u00e1n',
    step3Desc: 'So s\u00e1nh \u0111\u1ec1 xu\u1ea5t, gh\u00e9 th\u0103m showroom v\u00e0 ch\u1ecdn c\u00f4ng ty b\u1ea1n tin t\u01b0\u1edfng. Ch\u00fang t\u00f4i lu\u00f4n \u0111\u1ed3ng h\u00e0nh c\u00f9ng b\u1ea1n.',
    // Trust
    trustTitle: '\u0110\u01b0\u1ee3c Ch\u1ee7 nh\u00e0 tr\u00ean kh\u1eafp Vi\u1ec7t Nam Tin t\u01b0\u1edfng',
    trustCompanies: 'C\u00f4ng ty \u0110\u00e3 x\u00e1c minh',
    trustProjects: '\u1ea2nh D\u1ef1 \u00e1n',
    trustCities: 'Th\u00e0nh ph\u1ed1 Ph\u1ee7 s\u00f3ng',
    // Footer
    privacy: 'Ch\u00ednh s\u00e1ch B\u1ea3o m\u1eadt',
    contactUs: 'Li\u00ean h\u1ec7',
  },
} as const;

export function t(lang: Lang, key: keyof typeof translations.en): string {
  return translations[lang][key];
}

export default translations;
