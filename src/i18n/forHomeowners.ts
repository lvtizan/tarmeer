export type Lang = 'en' | 'ar';

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
} as const;

export function t(lang: Lang, key: keyof typeof translations.en): string {
  return translations[lang][key];
}

export default translations;
